// Phase 4 tests: predictive analytics, rules engine, site intelligence (weather + schedules), BIM 4D/5D, ecosystem.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/store.ts";
import { forecastDelay, riskScore } from "../src/lib/predict.ts";
import { evaluate, runAutomations, validateRule, saveRule, MAX_RUNS_PER_RULE_PER_HOUR } from "../src/lib/automation.ts";
import { assess } from "../src/lib/weather.ts";
import { nextOccurrence, runSchedule } from "../src/lib/schedules.ts";
import { elementState, evm, deviations } from "../src/lib/bim.ts";
import { registerDrone } from "../src/lib/repo.ts";
import { adapter } from "../src/lib/adapters.ts";
import type { AuthContext, Milestone, ProgressRecord, Finding } from "../src/lib/types.ts";
import type { DomainEvent } from "../src/lib/events.ts";

const DAY = 86_400_000;
function ctxFor(slug: string, role: string): AuthContext {
  const org = db().organizations.find((o) => o.slug === slug)!;
  const m = db().memberships.find((x) => x.organizationId === org.id && x.role === role)!;
  return { userId: m.userId, orgId: org.id, role: m.role, isPlatformStaff: false, sessionId: "t" };
}
const d10 = (t: number) => new Date(t).toISOString().slice(0, 10);

/** A single-milestone project running linearly over 200 days; actual = plan × lag, measured weekly. */
function synth(lag: number, nowMs: number) {
  const start = nowMs - 100 * DAY, end = nowMs + 100 * DAY;
  const ms: Milestone[] = [{ id: "m1", organizationId: "o", projectId: "p", name: "Work", plannedStart: d10(start), plannedEnd: d10(end), weight: 1, sortOrder: 0 }];
  const rs: ProgressRecord[] = [];
  for (let t = start + 7 * DAY, k = 0; t <= nowMs; t += 7 * DAY, k++)
    rs.push({ id: `r${k}`, organizationId: "o", projectId: "p", milestoneId: "m1", recordDate: d10(t), percentComplete: Math.round(((t - start) / (end - start)) * 100 * lag), source: "manual", approvalStatus: "approved", notes: "", evidenceMediaIds: [], createdAt: new Date(t).toISOString() });
  return { project: { startDate: d10(start), endDate: d10(end) }, ms, rs };
}

test("@tc:TC-PRED-001 on-schedule project forecasts on time; a lagging one forecasts a delay", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");
  const ok = synth(1, now), late = synth(0.8, now);
  const f1 = forecastDelay(ok.project, ok.ms, ok.rs, now), f2 = forecastDelay(late.project, late.ms, late.rs, now);
  assert.ok(Math.abs(f1.delayDaysP50 ?? 99) <= 8, `on-time delay ${f1.delayDaysP50}`);
  assert.ok((f1.onTimeProbability ?? 0) >= 0.3);
  assert.ok((f2.delayDaysP50 ?? 0) > 20, `late delay ${f2.delayDaysP50}`);
  assert.ok((f2.spiTime ?? 1) < 0.9);
  assert.ok((f2.onTimeProbability ?? 1) < 0.2);
  assert.ok(Date.parse(f2.p10!) <= Date.parse(f2.p50!) && Date.parse(f2.p50!) <= Date.parse(f2.p90!), "P10 ≤ P50 ≤ P90");
  const empty = forecastDelay(ok.project, ok.ms, [], now);
  assert.equal(empty.p50, null);
});

test("@tc:TC-PRED-002 risk score is the sum of bounded, explainable factors", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");
  const late = synth(0.7, now);
  const fc = forecastDelay(late.project, late.ms, late.rs, now);
  const f = (sev: Finding["severity"], category: string, overdue: boolean): Finding => ({ id: Math.random().toString(), organizationId: "o", projectId: "p", siteId: "s", inspectionId: "i", code: "F", title: "t", description: "",
    category, severity: sev, status: "open", location: [0, 0], dueDate: d10(now + (overdue ? -2 : 5) * DAY), aiGenerated: false, createdAt: new Date(now - 10 * DAY).toISOString() });
  const r = riskScore({ forecast: fc, scheduleVariancePct: -15, findings: [f("critical", "safety", true), f("high", "quality", false)], inspections: [], missions: [], nowMs: now });
  assert.equal(r.score, r.factors.reduce((s, x) => s + x.points, 0));
  for (const x of r.factors) assert.ok(x.points >= 0 && x.points <= x.max);
  assert.ok(r.band === "high" || r.band === "critical");
  const calm = riskScore({ forecast: { ...fc, onTimeProbability: 1 }, scheduleVariancePct: 2, findings: [], inspections: [], missions: [], lastCaptureAt: new Date(now - DAY).toISOString(), nowMs: now });
  assert.equal(calm.band, "low");
});

test("@tc:TC-AUTO-001 condition operators", () => {
  const facts = { "finding.severity": "critical", "progress.percent": "42", "finding.category": "Safety" };
  assert.ok(evaluate([{ field: "finding.severity", op: "eq", value: "critical" }], facts));
  assert.ok(evaluate([{ field: "finding.severity", op: "in", value: "high, critical" }], facts));
  assert.ok(evaluate([{ field: "progress.percent", op: "gte", value: "40" }, { field: "progress.percent", op: "lte", value: "50" }], facts));
  assert.ok(evaluate([{ field: "finding.category", op: "contains", value: "safe" }], facts));
  assert.ok(!evaluate([{ field: "finding.severity", op: "neq", value: "critical" }], facts));
  assert.ok(!evaluate([{ field: "missing", op: "eq", value: "" }], facts), "unknown fields never match");
});

test("@tc:TC-AUTO-002 critical-finding rule notifies, sets the due date and schedules an inspection; automation events are not re-processed", async () => {
  const admin = ctxFor("atlas", "org_admin");
  const f = db().findings.find((x) => x.organizationId === admin.orgId)!;
  const prevSev = f.severity; f.severity = "critical";
  const emitted: DomainEvent[] = [];
  const before = db().inspections.length;
  const ev: DomainEvent = { key: "finding.created", orgId: admin.orgId, projectId: f.projectId, entityType: "finding", entityId: f.id, title: "Critical finding", body: f.title, severity: "critical" };
  const runs = await runAutomations(ev, { emit: (e) => emitted.push(e), deliverWebhook: async () => {} });
  const run = runs.find((r) => r.ruleId.length)!;
  assert.equal(run.status, "succeeded", JSON.stringify(run.steps));
  assert.equal(emitted[0].key, "automation.notification");
  assert.equal(emitted[0].data?._automation, true);
  assert.equal(f.dueDate, d10(Date.parse(f.createdAt) + DAY));
  assert.equal(db().inspections.length, before + 1);
  assert.deepEqual(await runAutomations({ ...ev, data: { _automation: true } }, { emit: () => {}, deliverWebhook: async () => {} }), []);
  // Non-matching condition → no run.
  f.severity = "low";
  assert.equal((await runAutomations(ev, { emit: () => {}, deliverWebhook: async () => {} })).length, 0);
  f.severity = prevSev;
});

test("@tc:TC-AUTO-003 rules are throttled, validated, and fail safely when the creator loses access", async () => {
  const admin = ctxFor("borealis", "org_admin");
  assert.throws(() => validateRule(admin, { name: "x", trigger: "mission.completed", conditions: [], actions: [{ type: "set_finding_due", params: { days: "1" } }] }), /can't be used/);
  assert.throws(() => validateRule(admin, { name: "x", trigger: "nope", conditions: [], actions: [{ type: "notify_roles", params: { roles: "viewer" } }] }), /trigger/);
  assert.throws(() => validateRule(ctxFor("borealis", "viewer"), { name: "x", trigger: "report.published", conditions: [], actions: [{ type: "notify_roles", params: { roles: "viewer" } }] }));
  const r = saveRule(admin, { name: "Reports", trigger: "report.published", conditions: [], actions: [{ type: "notify_roles", params: { roles: "viewer" } }], enabled: true });
  const ev: DomainEvent = { key: "report.published", orgId: admin.orgId, entityType: "report", entityId: "r", title: "t", body: "b" };
  for (let i = 0; i < MAX_RUNS_PER_RULE_PER_HOUR; i++) await runAutomations(ev, { emit: () => {}, deliverWebhook: async () => {} });
  const last = (await runAutomations(ev, { emit: () => {}, deliverWebhook: async () => {} })).find((x) => x.ruleId === r.id)!;
  assert.equal(last.status, "throttled");
  db().automationRuns = db().automationRuns.filter((x) => x.ruleId !== r.id);
  const m = db().memberships.find((x) => x.organizationId === admin.orgId && x.userId === admin.userId)!;
  m.status = "deactivated";
  const failed = (await runAutomations(ev, { emit: () => {}, deliverWebhook: async () => {} })).find((x) => x.ruleId === r.id)!;
  m.status = "active";
  assert.equal(failed.status, "failed");
});

test("@tc:TC-SITE-001 weather go/no-go thresholds scale wind to flight altitude", () => {
  assert.equal(assess({ wind10: 4, gust10: 6, precipProb: 10, precipMm: 0, tempC: 30 }).verdict, "go");
  const windy = assess({ wind10: 8.5, gust10: 9, precipProb: 0, precipMm: 0, tempC: 20 }, 80);
  assert.ok(windy.windMps > 10 && windy.verdict === "no_go", JSON.stringify(windy));
  assert.equal(assess({ wind10: 8.5, gust10: 9, precipProb: 0, precipMm: 0, tempC: 20 }, 10).verdict, "marginal");
  assert.equal(assess({ wind10: 2, gust10: 3, precipProb: 90, precipMm: 1.2, tempC: 15 }).verdict, "no_go");
  assert.equal(assess({ wind10: 2, gust10: 3, precipProb: 0, precipMm: 0, tempC: 47 }).verdict, "no_go");
});

test("@tc:TC-SITE-002 schedules compute the next local occurrence across timezones", () => {
  const after = Date.parse("2026-10-06T12:00:00Z"); // Tuesday
  assert.equal(new Date(nextOccurrence({ cadence: "weekly", weekday: 4, timeLocal: "10:00" }, "Asia/Dubai", after)).toISOString(), "2026-10-08T06:00:00.000Z");
  assert.equal(new Date(nextOccurrence({ cadence: "daily", weekday: 0, timeLocal: "09:30" }, "Europe/Berlin", after)).toISOString(), "2026-10-07T07:30:00.000Z");
  // Across the DST change (Berlin leaves CEST on 25 Oct 2026).
  assert.equal(new Date(nextOccurrence({ cadence: "weekly", weekday: 1, timeLocal: "09:00" }, "Europe/Berlin", Date.parse("2026-10-24T00:00:00Z"))).toISOString(), "2026-10-26T08:00:00.000Z");
  assert.equal(new Date(nextOccurrence({ cadence: "monthly", weekday: 15, timeLocal: "08:00" }, "Asia/Dubai", after)).toISOString(), "2026-10-15T04:00:00.000Z");
});

test("@tc:TC-SITE-003 running a schedule generates a planned mission from the template and advances the schedule", async () => {
  const pm = ctxFor("atlas", "project_manager");
  const s = db().captureSchedules.find((x) => x.organizationId === pm.orgId)!;
  s.nextRunAt = new Date(Date.now() + 20 * DAY).toISOString(); // beyond the forecast horizon → no network call
  const prev = s.nextRunAt;
  const { mission } = await runSchedule(pm, s);
  assert.equal(mission.scheduleId, s.id);
  assert.equal(mission.status, "planned");
  assert.equal(mission.scheduledStart, prev);
  assert.ok(Date.parse(s.nextRunAt) > Date.parse(prev));
  assert.equal(mission.isSimulated, true);
  const tpl = db().missions.find((m) => m.id === s.templateMissionId)!;
  assert.equal(mission.waypoints.length, tpl.waypoints.length);
  assert.ok(db().missionEvents.some((e) => e.missionId === mission.id && e.type === "schedule"));
});

test("@tc:TC-BIM-001 4D element status and 5D earned value", () => {
  const ms: Milestone = { id: "m", organizationId: "o", projectId: "p", name: "Frame", plannedStart: "2026-01-01", plannedEnd: "2026-01-11", weight: 1, sortOrder: 0 };
  const els = [0, 1, 2, 3, 4].map((i) => ({ id: `e${i}`, organizationId: "o", projectId: "p", siteId: "s", assetId: "a", milestoneId: "m", guid: "g", name: `L${i}`, ifcClass: "IfcSlab" as const,
    level: i, sequence: i, baseZ: i * 4, topZ: (i + 1) * 4, footprint: [], budgetCost: 100, currency: "EUR" }));
  const rec = (pct: number): ProgressRecord[] => [{ id: "r", organizationId: "o", projectId: "p", milestoneId: "m", recordDate: "2026-01-01", percentComplete: pct, source: "manual", approvalStatus: "approved", notes: "", evidenceMediaIds: [], createdAt: "" }];
  // On 2026-01-07 the plan has ~60 % done: elements 0–2 complete, 3 in progress.
  assert.equal(elementState(els[0], els, ms, rec(60), "2026-01-07").status, "complete");
  assert.equal(elementState(els[2], els, ms, rec(20), "2026-01-07").status, "behind");
  assert.equal(elementState(els[4], els, ms, rec(100), "2026-01-07").status, "ahead");
  assert.equal(elementState(els[4], els, ms, rec(0), "2026-01-02").status, "not_started");
  const project = { id: "p", organizationId: "o", code: "", name: "", type: "", clientName: "", status: "active" as const, startDate: "2026-01-01", endDate: "2026-01-11", location: [0, 0] as [number, number], description: "", timezone: "UTC", createdAt: "", budget: { bac: 1000, currency: "EUR" } };
  const e = evm(project, [ms], rec(40), [{ id: "c", organizationId: "o", projectId: "p", milestoneId: "m", date: "2026-01-05", amount: 500, description: "", source: "manual" }], "2026-01-06");
  assert.equal(e.pv, 500); assert.equal(e.ev, 400); assert.equal(e.ac, 500);
  assert.equal(e.spi, 0.8); assert.equal(e.cpi, 0.8); assert.equal(e.eac, 1250); assert.equal(e.vac, -250);
  const dv = deviations(els, [{ id: "x", organizationId: "o", projectId: "p", elementId: "e0", measuredTopZ: 4.04, measuredAt: "", method: "survey_dsm", synthetic: true },
    { id: "y", organizationId: "o", projectId: "p", elementId: "e1", measuredTopZ: 7.99, measuredAt: "", method: "survey_dsm", synthetic: true }]);
  assert.equal(dv[0].withinTolerance, false); assert.equal(dv[0].deviationM, 0.04); assert.equal(dv[1].withinTolerance, true);
});

test("@tc:TC-BIM-002 seeded BIM elements are tenant-scoped and every as-built check references a real element", () => {
  const ids = new Set(db().bimElements.map((e) => e.id));
  for (const m of db().asBuilt) {
    assert.ok(ids.has(m.elementId));
    const el = db().bimElements.find((e) => e.id === m.elementId)!;
    assert.equal(el.organizationId, m.organizationId);
  }
  for (const p of db().projects) assert.ok(p.budget && p.budget.bac > 0);
});

test("@tc:TC-ECO-001 drones can only be registered on enabled adapters; command capability follows verification", () => {
  const owner = ctxFor("borealis", "org_owner");
  const input = { name: "Skydio-01", manufacturer: "Skydio", model: "X10", serialNumber: "SKY-TEST-1", registrationNumber: "R", registrationExpiresAt: "2027-12-31", providerKey: "skydio" as const };
  assert.throws(() => registerDrone(owner, input), /Enable the Skydio Cloud adapter/);
  db().orgAdapters.push({ organizationId: owner.orgId, adapterKey: "skydio", enabledAt: "", enabledBy: owner.userId });
  const d = registerDrone(owner, input);
  assert.equal(d.missionControlVerified, false);
  assert.equal(adapter("simulator")?.capabilities.missionControl, "verified");
  assert.throws(() => registerDrone(owner, { ...input, serialNumber: "X2", providerKey: "nope" as never }), /Unknown provider/);
});
