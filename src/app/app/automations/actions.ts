"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, audit } from "@/lib/auth";
import { assertCan, HttpError } from "@/lib/policy";
import { db } from "@/lib/store";
import { saveRule, runAutomations } from "@/lib/automation";
import { emit, deliverWebhook } from "@/lib/events";
import { analyzeProgress } from "@/lib/ai/features";
import type { AutomationActionType } from "@/lib/types";

export type AutoState = { error?: string | null; ok?: string | null };
const Rule = z.object({
  id: z.string().optional(), name: z.string(), trigger: z.string(), enabled: z.boolean(),
  conditions: z.array(z.object({ field: z.string(), op: z.enum(["eq", "neq", "in", "gte", "lte", "contains"]), value: z.string().max(200) })).max(5),
  actions: z.array(z.object({ type: z.string(), params: z.record(z.string(), z.string().max(500)) })).max(5),
});

export async function saveRuleAction(_: AutoState, f: FormData): Promise<AutoState> {
  const ctx = await requireContext();
  try {
    const input = Rule.parse(JSON.parse(String(f.get("rule") ?? "{}")));
    const r = saveRule(ctx, { ...input, actions: input.actions.map((a) => ({ type: a.type as AutomationActionType, params: a.params })) });
    await audit(ctx, input.id ? "automation.updated" : "automation.created", "automation_rule", r.id, { changes: { trigger: [null, r.trigger], actions: [null, r.actions.length] } });
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    if (e instanceof z.ZodError || e instanceof SyntaxError) return { error: "The rule is incomplete." };
    throw e;
  }
  revalidatePath("/app/automations");
  return { ok: "Rule saved. Its actions run with your permissions." };
}

export async function toggleRuleAction(f: FormData) {
  const ctx = await requireContext();
  assertCan(ctx, "integration:manage");
  const r = db().automationRules.find((x) => x.id === f.get("id") && x.organizationId === ctx.orgId);
  if (!r) return;
  r.enabled = !r.enabled;
  await audit(ctx, "automation.toggled", "automation_rule", r.id, { changes: { enabled: [!r.enabled, r.enabled] } });
  revalidatePath("/app/automations");
}

export async function deleteRuleAction(f: FormData) {
  const ctx = await requireContext();
  assertCan(ctx, "integration:manage");
  const i = db().automationRules.findIndex((x) => x.id === f.get("id") && x.organizationId === ctx.orgId);
  if (i < 0) return;
  const [r] = db().automationRules.splice(i, 1);
  await audit(ctx, "automation.deleted", "automation_rule", r.id);
  revalidatePath("/app/automations");
}

/** Run a rule now against the most recent matching entity (actions really execute — use for testing). */
export async function testRuleAction(_: AutoState, f: FormData): Promise<AutoState> {
  const ctx = await requireContext();
  assertCan(ctx, "integration:manage");
  const r = db().automationRules.find((x) => x.id === f.get("id") && x.organizationId === ctx.orgId);
  if (!r) return { error: "Rule not found." };
  const kind = r.trigger.split(".")[0];
  const pick = <T extends { organizationId: string }>(xs: T[]) => xs.filter((x) => x.organizationId === ctx.orgId).slice(-1)[0];
  const ent = kind === "finding" ? pick(db().findings) : kind === "mission" ? pick(db().missions) : kind === "inspection" ? pick(db().inspections) : undefined;
  const projectId = (ent as { projectId?: string } | undefined)?.projectId ?? db().projects.find((p) => p.organizationId === ctx.orgId)?.id;
  const runs = await runAutomations({ key: r.trigger, orgId: ctx.orgId, projectId, entityType: kind === "progress" ? "progress_record" : kind, entityId: (ent as { id?: string } | undefined)?.id ?? "test",
    title: `[Test] ${r.name}`, body: "Manual test run", severity: "info" }, { emit, deliverWebhook, analyze: analyzeProgress });
  const run = runs.find((x) => x.ruleId === r.id);
  revalidatePath("/app/automations");
  if (!run) return { ok: "Test event did not match this rule's conditions (nothing ran)." };
  return { ok: `Test run ${run.status}: ${run.steps.map((s) => `${s.ok ? "✓" : "✗"} ${s.detail}`).join(" · ") || "throttled"}` };
}
