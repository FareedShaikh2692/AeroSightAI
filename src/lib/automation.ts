// Enterprise automation — workflow rules engine (docs/13-Product/Future-Scope.md §3, Roadmap Phase 4).
// "When <event> and <conditions>, do <actions>." Rules subscribe to the domain event bus (events.ts). Safety:
//  • Actions run as the rule's creator, with that user's permissions re-checked at run time (like API keys).
//  • Events produced by automation never trigger automation (no loops); each rule is throttled to 30 runs/hour.
//  • Every run is logged with per-step results; outbound calls go through the SSRF guard.
import "server-only";
import { db } from "./store";
import { newId } from "./ids";
import { can, assertCan, HttpError } from "./policy";
import { decrypt } from "./crypto";
import { safeFetch } from "./net";
import type { AuthContext, AutomationAction, AutomationActionType, AutomationCondition, AutomationRule, AutomationRun, RoleKey, UUID } from "./types";
import type { DomainEvent } from "./events";

export const MAX_RULES_PER_ORG = 25;
export const MAX_RUNS_PER_RULE_PER_HOUR = 30;

export const TRIGGERS: Record<string, { label: string; fields: string[] }> = {
  "finding.created": { label: "Finding created", fields: ["severity", "finding.severity", "finding.category", "projectId"] },
  "finding.overdue": { label: "Finding overdue", fields: ["finding.severity", "finding.category", "projectId"] },
  "mission.completed": { label: "Flight completed", fields: ["mission.type", "mission.scheduled", "projectId"] },
  "mission.aborted": { label: "Flight aborted", fields: ["mission.type", "projectId"] },
  "mission.approval_requested": { label: "Mission awaiting approval", fields: ["mission.type", "projectId"] },
  "inspection.submitted": { label: "Inspection submitted", fields: ["inspection.type", "projectId"] },
  "inspection.rejected": { label: "Inspection returned", fields: ["inspection.type", "projectId"] },
  "progress.approval_requested": { label: "Progress awaiting approval", fields: ["progress.percent", "projectId"] },
  "report.published": { label: "Report published", fields: ["projectId"] },
  "ai.analysis_completed": { label: "AI analysis completed", fields: ["projectId"] },
  "risk.high": { label: "Project risk became high or critical", fields: ["risk.score", "risk.band", "projectId"] },
};

export const ACTIONS: Record<AutomationActionType, { label: string; params: string[]; appliesTo?: string[] }> = {
  notify_roles: { label: "Notify project roles", params: ["roles", "message"] },
  post_channel: { label: "Post to Slack / Teams channel", params: ["channelId", "message"] },
  send_webhook: { label: "Send signed webhook", params: ["webhookId"] },
  set_finding_due: { label: "Set finding due date", params: ["days"], appliesTo: ["finding"] },
  assign_finding: { label: "Assign finding to role", params: ["role"], appliesTo: ["finding"] },
  create_inspection: { label: "Schedule an inspection on the site", params: ["templateId", "dueDays"], appliesTo: ["finding", "mission", "inspection"] },
  run_ai_analysis: { label: "Run AI progress analysis", params: [] },
};

/** Facts the conditions can test, resolved from the event's entity. */
export function factsFor(e: DomainEvent): Record<string, string> {
  const d = db();
  const f: Record<string, string> = { severity: e.severity ?? "info", projectId: e.projectId ?? "", entityType: e.entityType };
  if (e.entityType === "finding") {
    const x = d.findings.find((r) => r.id === e.entityId);
    if (x) Object.assign(f, { "finding.severity": x.severity, "finding.category": x.category, "finding.status": x.status, siteId: x.siteId });
  } else if (e.entityType === "mission") {
    const x = d.missions.find((r) => r.id === e.entityId);
    if (x) Object.assign(f, { "mission.type": x.type, "mission.scheduled": String(!!x.scheduleId), siteId: x.siteId });
  } else if (e.entityType === "inspection") {
    const x = d.inspections.find((r) => r.id === e.entityId);
    if (x) Object.assign(f, { "inspection.type": x.type, siteId: x.siteId });
  } else if (e.entityType === "progress_record") {
    const x = d.progressRecords.find((r) => r.id === e.entityId);
    if (x) f["progress.percent"] = String(x.percentComplete);
  }
  for (const [k, v] of Object.entries(e.data ?? {})) if (typeof v === "string" || typeof v === "number") f[k] = String(v);
  return f;
}

export function evaluate(conds: AutomationCondition[], facts: Record<string, string>): boolean {
  return conds.every((c) => {
    const v = facts[c.field];
    if (v === undefined) return false;
    switch (c.op) {
      case "eq": return v === c.value;
      case "neq": return v !== c.value;
      case "in": return c.value.split(",").map((s) => s.trim()).includes(v);
      case "contains": return v.toLowerCase().includes(c.value.toLowerCase());
      case "gte": return Number(v) >= Number(c.value);
      case "lte": return Number(v) <= Number(c.value);
    }
  });
}

function creatorCtx(r: AutomationRule): AuthContext | null {
  const m = db().memberships.find((x) => x.organizationId === r.organizationId && x.userId === r.createdBy && x.status === "active");
  return m ? { userId: r.createdBy, orgId: r.organizationId, role: m.role, isPlatformStaff: false, sessionId: `automation:${r.id}` } : null;
}

/** Called by the event bus for every domain event (not for events produced by automations). */
export async function runAutomations(e: DomainEvent, deps: { emit: (e: DomainEvent) => void; deliverWebhook: (id: UUID, ev: { id: string; type: string; createdAt: string; organizationId: string; data: Record<string, unknown> }) => Promise<void>; analyze?: (ctx: AuthContext, projectId: UUID) => Promise<unknown> }) {
  if (e.data?._automation) return [];
  const rules = db().automationRules.filter((r) => r.organizationId === e.orgId && r.enabled && r.trigger === e.key);
  if (!rules.length) return [];
  const facts = factsFor(e);
  const runs: AutomationRun[] = [];
  for (const r of rules) {
    if (!evaluate(r.conditions, facts)) continue;
    const run: AutomationRun = { id: newId(), organizationId: r.organizationId, ruleId: r.id, trigger: e.key, entityType: e.entityType, entityId: e.entityId, at: new Date().toISOString(), status: "succeeded", steps: [] };
    const hourAgo = Date.now() - 3_600_000;
    if (db().automationRuns.filter((x) => x.ruleId === r.id && Date.parse(x.at) > hourAgo && x.status !== "throttled").length >= MAX_RUNS_PER_RULE_PER_HOUR) {
      run.status = "throttled";
    } else {
      const ctx = creatorCtx(r);
      for (const a of r.actions) {
        try {
          if (!ctx) throw new HttpError(403, "FORBIDDEN", "The rule's creator is no longer an active member.");
          run.steps.push({ action: a.type, ok: true, detail: await execute(ctx, a, e, facts, deps) });
        } catch (err) {
          run.steps.push({ action: a.type, ok: false, detail: (err as Error).message.slice(0, 300) });
        }
      }
      const failed = run.steps.filter((s) => !s.ok).length;
      run.status = failed === 0 ? "succeeded" : failed === run.steps.length ? "failed" : "partial";
      r.runCount++;
      r.lastRunAt = run.at;
    }
    db().automationRuns.push(run);
    runs.push(run);
  }
  if (db().automationRuns.length > 2000) db().automationRuns.splice(0, db().automationRuns.length - 2000);
  return runs;
}

const fill = (tpl: string, e: DomainEvent) => (tpl || "{title}: {body}").replace(/\{title\}/g, e.title).replace(/\{body\}/g, e.body).slice(0, 500);

async function execute(ctx: AuthContext, a: AutomationAction, e: DomainEvent, facts: Record<string, string>, deps: Parameters<typeof runAutomations>[1]): Promise<string> {
  const d = db();
  switch (a.type) {
    case "notify_roles": {
      const roles = (a.params.roles ?? "").split(",").map((s) => s.trim()).filter(Boolean) as RoleKey[];
      const users = new Set<string>();
      d.projectMembers.filter((m) => m.organizationId === e.orgId && m.projectId === e.projectId && roles.includes(m.role)).forEach((m) => users.add(m.userId));
      d.memberships.filter((m) => m.organizationId === e.orgId && m.status === "active" && (m.role === "org_owner" || m.role === "org_admin") && roles.includes(m.role)).forEach((m) => users.add(m.userId));
      deps.emit({ key: "automation.notification", orgId: e.orgId, projectId: e.projectId, entityType: e.entityType, entityId: e.entityId, href: e.href,
        severity: e.severity, title: `Automation: ${e.title}`, body: fill(a.params.message, e), recipients: [...users], data: { _automation: true } });
      return `Notified ${users.size} user(s)`;
    }
    case "post_channel": {
      assertCan(ctx, "notification:manage_rules");
      const ch = d.notificationRules.find((x) => x.id === a.params.channelId && x.organizationId === e.orgId && x.active);
      if (!ch) throw new Error("Channel not found or disabled.");
      const text = `⚙️ *${e.title}*\n${fill(a.params.message, e)}`;
      const body = ch.channel === "slack" ? { text } : { "@type": "MessageCard", "@context": "https://schema.org/extensions", summary: e.title, title: e.title, text: fill(a.params.message, e) };
      const res = await safeFetch(decrypt(ch.webhookUrlEnc), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Channel returned HTTP ${res.status}`);
      return `Posted to ${ch.name}`;
    }
    case "send_webhook": {
      assertCan(ctx, "integration:manage");
      const w = d.webhooks.find((x) => x.id === a.params.webhookId && x.organizationId === e.orgId && x.active);
      if (!w) throw new Error("Webhook not found or disabled.");
      await deps.deliverWebhook(w.id, { id: newId(), type: `automation.${e.key}`, createdAt: new Date().toISOString(), organizationId: e.orgId,
        data: { entityType: e.entityType, entityId: e.entityId, projectId: e.projectId, title: e.title, facts } });
      return `Webhook delivered to ${new URL(w.url).hostname}`;
    }
    case "set_finding_due": {
      const f = d.findings.find((x) => x.id === e.entityId && x.organizationId === e.orgId);
      if (!f) throw new Error("This action needs a finding event.");
      assertCan(ctx, "finding:update", f);
      const days = Math.max(0, Math.min(365, Number(a.params.days) || 0));
      f.dueDate = new Date(Date.parse(f.createdAt) + days * 86_400_000).toISOString().slice(0, 10);
      f.automationNote = `Due date set by automation (${days} d)`;
      return `Due date set to ${f.dueDate}`;
    }
    case "assign_finding": {
      const f = d.findings.find((x) => x.id === e.entityId && x.organizationId === e.orgId);
      if (!f) throw new Error("This action needs a finding event.");
      assertCan(ctx, "finding:update", f);
      const pm = d.projectMembers.find((m) => m.organizationId === e.orgId && m.projectId === f.projectId && m.role === a.params.role);
      if (!pm) throw new Error(`No project member with role ${a.params.role}.`);
      f.assigneeId = pm.userId;
      return `Assigned to ${d.users.find((u) => u.id === pm.userId)?.fullName ?? "user"}`;
    }
    case "create_inspection": {
      const siteId = facts.siteId;
      if (!siteId) throw new Error("This event has no site.");
      const site = d.sites.find((s) => s.id === siteId && s.organizationId === e.orgId)!;
      assertCan(ctx, "inspection:create", site);
      const tpl = d.inspectionTemplates.find((t) => t.id === a.params.templateId && t.organizationId === e.orgId && t.status === "published")
        ?? d.inspectionTemplates.find((t) => t.organizationId === e.orgId && t.status === "published");
      if (!tpl) throw new Error("No published inspection template.");
      const { createInspection } = await import("./repo");
      const pm = (role: string) => d.projectMembers.find((m) => m.organizationId === e.orgId && m.projectId === site.projectId && m.role === role)?.userId;
      const assignee = pm("inspector") ?? pm("site_manager") ?? ctx.userId, reviewer = pm("engineer") ?? pm("project_manager") ?? ctx.userId;
      const due = new Date(Date.now() + Math.max(1, Number(a.params.dueDays) || 3) * 86_400_000).toISOString().slice(0, 10);
      const i = createInspection(ctx, { siteId, templateId: tpl.id, title: `Follow-up: ${e.title}`.slice(0, 120), type: tpl.name.slice(0, 60), assigneeId: assignee, reviewerId: reviewer === assignee ? ctx.userId : reviewer, dueDate: due });
      return `Inspection ${i.code} scheduled for ${due}`;
    }
    case "run_ai_analysis": {
      if (!e.projectId) throw new Error("This event has no project.");
      if (!deps.analyze) throw new Error("AI analysis is unavailable here.");
      if (!can(ctx, "ai:analyze", { organizationId: e.orgId, projectId: e.projectId })) throw new HttpError(403, "FORBIDDEN", "Rule creator lacks ai:analyze.");
      const r = (await deps.analyze(ctx, e.projectId)) as { id: string; status: string; output?: { proposals?: number } };
      return `Analysis ${r.status}${r.output?.proposals !== undefined ? ` — ${r.output.proposals} proposal(s) queued for review` : ""}`;
    }
  }
}

// ---------- management ----------
export function validateRule(ctx: AuthContext, input: { name: string; trigger: string; conditions: AutomationCondition[]; actions: AutomationAction[] }) {
  assertCan(ctx, "integration:manage");
  if (!input.name.trim() || input.name.length > 80) throw new HttpError(422, "VALIDATION_ERROR", "Name the rule (max 80 characters).");
  const t = TRIGGERS[input.trigger];
  if (!t) throw new HttpError(422, "VALIDATION_ERROR", "Choose a trigger.");
  if (input.conditions.length > 5) throw new HttpError(422, "VALIDATION_ERROR", "At most 5 conditions.");
  for (const c of input.conditions) {
    if (!t.fields.includes(c.field)) throw new HttpError(422, "VALIDATION_ERROR", `Field ${c.field} is not available for ${input.trigger}.`);
    if (!["eq", "neq", "in", "gte", "lte", "contains"].includes(c.op) || c.value.length > 200) throw new HttpError(422, "VALIDATION_ERROR", "Invalid condition.");
  }
  if (!input.actions.length || input.actions.length > 5) throw new HttpError(422, "VALIDATION_ERROR", "Add 1–5 actions.");
  const entity = input.trigger.split(".")[0];
  for (const a of input.actions) {
    const meta = ACTIONS[a.type];
    if (!meta) throw new HttpError(422, "VALIDATION_ERROR", "Unknown action.");
    if (meta.appliesTo && !meta.appliesTo.includes(entity)) throw new HttpError(422, "VALIDATION_ERROR", `“${meta.label}” can't be used with ${t.label}.`);
    if (a.type === "notify_roles" && !(a.params.roles ?? "").trim()) throw new HttpError(422, "VALIDATION_ERROR", "Choose at least one role to notify.");
    if (a.type === "post_channel" && !db().notificationRules.some((x) => x.id === a.params.channelId && x.organizationId === ctx.orgId)) throw new HttpError(422, "VALIDATION_ERROR", "Choose a channel.");
    if (a.type === "send_webhook" && !db().webhooks.some((x) => x.id === a.params.webhookId && x.organizationId === ctx.orgId)) throw new HttpError(422, "VALIDATION_ERROR", "Choose a webhook.");
  }
}

export function saveRule(ctx: AuthContext, input: { id?: string; name: string; trigger: string; conditions: AutomationCondition[]; actions: AutomationAction[]; enabled: boolean }) {
  validateRule(ctx, input);
  const now = new Date().toISOString();
  if (input.id) {
    const r = db().automationRules.find((x) => x.id === input.id && x.organizationId === ctx.orgId);
    if (!r) throw new HttpError(404, "NOT_FOUND", "Rule not found.");
    Object.assign(r, { name: input.name.trim(), trigger: input.trigger, conditions: input.conditions, actions: input.actions, enabled: input.enabled, updatedAt: now, createdBy: ctx.userId });
    return r;
  }
  if (db().automationRules.filter((x) => x.organizationId === ctx.orgId).length >= MAX_RULES_PER_ORG) throw new HttpError(422, "LIMIT_REACHED", `Organizations can have up to ${MAX_RULES_PER_ORG} rules.`);
  const r: AutomationRule = { id: newId(), organizationId: ctx.orgId, name: input.name.trim(), enabled: input.enabled, trigger: input.trigger, conditions: input.conditions,
    actions: input.actions, createdBy: ctx.userId, createdAt: now, updatedAt: now, runCount: 0 };
  db().automationRules.push(r);
  return r;
}
