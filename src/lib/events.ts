// Domain event fan-out (NOTIF-001…010, INTEG-006/008): in-app notifications with recipient re-authorization,
// preferences and dedupe; Slack/Teams channel rules; signed customer webhooks with retries and delivery log.
// External deliveries run after the response via next/server `after()`.
import "server-only";
import { after } from "next/server";
import { db } from "./store";
import { newId } from "./ids";
import { can } from "./policy";
import { decrypt, hmacSha256 } from "./crypto";
import { safeFetch } from "./net";
import type { AuthContext, Mission, NotificationCategory, UUID } from "./types";
import type { Permission } from "./permissions";

export const EVENT_CATALOG: Record<string, { category: NotificationCategory; label: string; readPerm: Permission }> = {
  "mission.assigned": { category: "missions", label: "Mission assigned", readPerm: "mission:read" },
  "mission.approval_requested": { category: "missions", label: "Mission approval requested", readPerm: "mission:read" },
  "mission.approved": { category: "missions", label: "Mission approved", readPerm: "mission:read" },
  "mission.rejected": { category: "missions", label: "Mission rejected", readPerm: "mission:read" },
  "mission.started": { category: "missions", label: "Mission started", readPerm: "mission:read" },
  "mission.completed": { category: "missions", label: "Mission completed", readPerm: "mission:read" },
  "mission.aborted": { category: "missions", label: "Mission aborted", readPerm: "mission:read" },
  "inspection.assigned": { category: "inspections", label: "Inspection assigned", readPerm: "inspection:read" },
  "inspection.submitted": { category: "inspections", label: "Inspection submitted", readPerm: "inspection:read" },
  "inspection.approved": { category: "inspections", label: "Inspection approved", readPerm: "inspection:read" },
  "inspection.rejected": { category: "inspections", label: "Inspection rejected", readPerm: "inspection:read" },
  "finding.created": { category: "inspections", label: "Finding created", readPerm: "inspection:read" },
  "finding.overdue": { category: "inspections", label: "Finding overdue", readPerm: "inspection:read" },
  "progress.approval_requested": { category: "progress", label: "Progress awaiting approval", readPerm: "progress:read" },
  "progress.approved": { category: "progress", label: "Progress approved", readPerm: "progress:read" },
  "report.published": { category: "reports", label: "Report published", readPerm: "report:read" },
  "ai.analysis_completed": { category: "ai", label: "AI analysis completed", readPerm: "progress:read" },
  "security.mfa_changed": { category: "security", label: "Two-factor settings changed", readPerm: "org:read" },
  "security.break_glass": { category: "security", label: "Platform staff access", readPerm: "org:read" },
};
export const WEBHOOK_EVENTS = Object.keys(EVENT_CATALOG).filter((k) => !k.startsWith("security."));
export const MANDATORY: NotificationCategory[] = ["security", "billing"];

export interface DomainEvent {
  key: keyof typeof EVENT_CATALOG | string; orgId: UUID; projectId?: UUID; entityType: string; entityId: UUID;
  title: string; body: string; href?: string; severity?: "info" | "warning" | "critical";
  recipients?: UUID[]; data?: Record<string, unknown>;
}

const SEV_RANK = { info: 0, warning: 1, critical: 2 } as const;

function ctxForUser(orgId: UUID, userId: UUID): AuthContext | null {
  const m = db().memberships.find((x) => x.organizationId === orgId && x.userId === userId && x.status === "active");
  return m ? { userId, orgId, role: m.role, isPlatformStaff: false, sessionId: "event" } : null;
}

export function prefFor(orgId: UUID, userId: UUID, category: NotificationCategory) {
  const p = db().notificationPreferences.find((x) => x.organizationId === orgId && x.userId === userId && x.category === category);
  return p ?? { organizationId: orgId, userId, category, inApp: true, email: category !== "telemetry", digest: false };
}

export function emit(e: DomainEvent) {
  const meta = EVENT_CATALOG[e.key];
  const category = meta?.category ?? "missions";
  const severity = e.severity ?? "info";
  const now = new Date().toISOString();

  // 1. In-app notifications — each recipient re-authorized at send time (NOTIF-002).
  for (const userId of new Set(e.recipients ?? [])) {
    const ctx = ctxForUser(e.orgId, userId);
    if (!ctx) continue;
    if (meta && !can(ctx, meta.readPerm, { organizationId: e.orgId, projectId: e.projectId })) continue;
    const pref = prefFor(e.orgId, userId, category);
    if (!pref.inApp && !MANDATORY.includes(category)) continue;
    const dedupeKey = `${e.key}:${e.entityId}`;
    const dup = db().notifications.find((n) => n.organizationId === e.orgId && n.userId === userId && n.dedupeKey === dedupeKey && !n.readAt && Date.now() - Date.parse(n.createdAt) < 10 * 60_000);
    if (dup) { dup.occurrences = (dup.occurrences ?? 1) + 1; dup.createdAt = now; continue; } // NOTIF-008
    db().notifications.push({ id: newId(), organizationId: e.orgId, userId, eventKey: e.key, severity, title: e.title, body: e.body, href: e.href,
      createdAt: now, projectId: e.projectId, dedupeKey, occurrences: 1, digest: pref.digest && severity === "info" });
  }

  // 2. Slack / Teams channel rules (NOTIF-006).
  const rules = db().notificationRules.filter((r) => r.organizationId === e.orgId && r.active && r.categories.includes(category) &&
    SEV_RANK[severity] >= SEV_RANK[r.minSeverity] && (!r.projectIds.length || (e.projectId && r.projectIds.includes(e.projectId))));
  // 3. Customer webhooks (INTEG-006). Payload contains IDs and minimal fields only.
  const hooks = db().webhooks.filter((w) => w.organizationId === e.orgId && w.active && w.eventTypes.includes(e.key));
  if (!rules.length && !hooks.length) return;

  const appUrl = process.env.PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const link = e.href ? `${appUrl}${e.href}` : appUrl;
  after(async () => {
    await Promise.all([
      ...rules.map(async (r) => {
        const icon = severity === "critical" ? "🔴" : severity === "warning" ? "🟠" : "🔵";
        const body = r.channel === "slack"
          ? { text: `${icon} *${e.title}*\n${e.body}${link ? `\n<${link}|Open in AeroSight>` : ""}` }
          : { "@type": "MessageCard", "@context": "https://schema.org/extensions", summary: e.title, themeColor: severity === "critical" ? "F87171" : "FFB020",
              title: `${icon} ${e.title}`, text: e.body, potentialAction: link ? [{ "@type": "OpenUri", name: "Open in AeroSight", targets: [{ os: "default", uri: link }] }] : [] };
        try {
          const res = await safeFetch(decrypt(r.webhookUrlEnc), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
          r.lastStatus = res.ok ? `ok (${res.status})` : `HTTP ${res.status}`; r.consecutiveFailures = res.ok ? 0 : r.consecutiveFailures + 1;
        } catch (err) {
          r.lastStatus = `error: ${(err as Error).message}`; r.consecutiveFailures++;
        }
        r.lastSentAt = new Date().toISOString();
        if (r.consecutiveFailures >= 20) r.active = false; // INTEG-010
      }),
      ...hooks.map((w) => deliverWebhook(w.id, { id: newId(), type: e.key, createdAt: now, organizationId: e.orgId,
        data: { entityType: e.entityType, entityId: e.entityId, projectId: e.projectId, title: e.title, severity, url: link, ...(e.data ?? {}) } })),
    ]);
  });
}

/** Deliver with up to 3 attempts (0 s, 2 s, 6 s). Production retries extend to 24 h via a queue. */
export async function deliverWebhook(webhookId: UUID, event: { id: string; type: string; createdAt: string; organizationId: string; data: Record<string, unknown> }) {
  const w = db().webhooks.find((x) => x.id === webhookId);
  if (!w) return;
  const payload = JSON.stringify(event);
  const delays = [0, 2000, 6000];
  for (let attempt = 1; attempt <= delays.length; attempt++) {
    if (delays[attempt - 1]) await new Promise((r) => setTimeout(r, delays[attempt - 1]));
    const ts = Math.floor(Date.now() / 1000);
    const sig = hmacSha256(decrypt(w.secretEnc), `${ts}.${payload}`);
    let statusCode: number | undefined, durationMs: number | undefined, error: string | undefined;
    try {
      const res = await safeFetch(w.url, { method: "POST", body: payload, headers: { "content-type": "application/json", "x-aerosight-event": event.type,
        "x-aerosight-delivery": event.id, "x-aerosight-timestamp": String(ts), "x-aerosight-signature": `v1=${sig}` } });
      statusCode = res.status; durationMs = res.durationMs;
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = (err as Error).message;
    }
    db().webhookDeliveries.push({ id: newId(), organizationId: w.organizationId, webhookId: w.id, eventId: event.id, eventType: event.type, attempt,
      statusCode, durationMs, error, deliveredAt: new Date().toISOString(), payload: payload.slice(0, 2000) });
    if (!error) { w.consecutiveFailures = 0; return; }
    w.consecutiveFailures++;
    if (w.consecutiveFailures >= 20) { w.active = false; w.disabledReason = "Disabled after 20 consecutive failures"; return; }
  }
}

/** Project members holding any of the given roles (plus org-wide roles if requested). */
export function membersWithRoles(orgId: UUID, projectId: UUID | undefined, roles: string[], includeOrgWide = false): UUID[] {
  const ids = new Set<UUID>();
  if (projectId) db().projectMembers.filter((m) => m.organizationId === orgId && m.projectId === projectId && roles.includes(m.role)).forEach((m) => ids.add(m.userId));
  if (includeOrgWide) db().memberships.filter((m) => m.organizationId === orgId && (m.role === "org_owner" || m.role === "org_admin")).forEach((m) => ids.add(m.userId));
  return [...ids];
}

export function missionEvent(orgId: string, m: Mission, action: string, reason?: string) {
  const pilotUser = db().pilots.find((p) => p.id === m.pilotId)?.userId;
  const base = { orgId, projectId: m.projectId, entityType: "mission", entityId: m.id, href: `/app/missions/${m.id}` };
  const managers = membersWithRoles(orgId, m.projectId, ["project_manager", "site_manager"]);
  if (action === "submit") emit({ ...base, key: "mission.approval_requested", title: "Mission awaiting approval", body: m.name, recipients: membersWithRoles(orgId, m.projectId, ["project_manager"], true) });
  if (action === "approve") emit({ ...base, key: "mission.approved", title: "Mission approved", body: m.name, recipients: [m.createdBy!, pilotUser!].filter(Boolean) });
  if (action === "reject") emit({ ...base, key: "mission.rejected", severity: "warning", title: "Mission rejected", body: `${m.name} — ${reason ?? ""}`, recipients: [m.createdBy!, pilotUser!].filter(Boolean) });
  if (action === "start") emit({ ...base, key: "mission.started", title: "Flight started", body: `${m.name}${m.isSimulated ? " (simulated)" : ""}`, recipients: managers });
  if (action === "stop") emit({ ...base, key: "mission.completed", title: "Flight completed", body: m.name, recipients: managers });
  if (action === "abort") emit({ ...base, key: "mission.aborted", severity: "warning", title: "Flight aborted", body: `${m.name} — ${reason ?? ""}`, recipients: managers });
}

