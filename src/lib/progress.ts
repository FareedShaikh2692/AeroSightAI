// ProgressCalculator — single implementation used by dashboard, API and reports (PROGRESS-006,
// docs/02-PRD/Features/Construction-Progress-Monitoring.md §3).
import type { Milestone, ProgressRecord } from "./types";

const DAY = 86_400_000;
const t = (d: string) => Date.parse(`${d}T00:00:00Z`);

export function plannedPct(m: Milestone, asOf: string): number {
  const d = t(asOf), s = t(m.plannedStart), e = t(m.plannedEnd);
  if (d < s) return 0;
  if (d >= e) return 100;
  return ((d - s) / (e - s)) * 100;
}

/** Latest approved record on/before asOf. */
export function officialPct(m: Milestone, records: ProgressRecord[], asOf: string): number {
  const rs = records
    .filter((r) => r.milestoneId === m.id && r.approvalStatus === "approved" && r.recordDate <= asOf)
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.createdAt.localeCompare(b.createdAt));
  return rs.length ? rs[rs.length - 1].percentComplete : 0;
}

export type ScheduleStatus = "on_track" | "at_risk" | "delayed" | "not_started";

export function statusFor(sv: number, planned: number): ScheduleStatus {
  if (planned === 0) return "not_started";
  if (sv >= -2) return "on_track";
  if (sv >= -10) return "at_risk";
  return "delayed";
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeProgress(milestones: Milestone[], records: ProgressRecord[], asOf: string) {
  const totalW = milestones.reduce((s, m) => s + m.weight, 0) || 1;
  const rows = milestones.map((m) => {
    const p = plannedPct(m, asOf);
    const a = officialPct(m, records, asOf);
    return { milestone: m, normalizedWeightPct: r2((m.weight / totalW) * 100), plannedPct: r2(p), actualPct: r2(a), status: statusFor(a - p, p) };
  });
  const actual = r2(rows.reduce((s, r) => s + r.milestone.weight * r.actualPct, 0) / totalW);
  const planned = r2(rows.reduce((s, r) => s + r.milestone.weight * r.plannedPct, 0) / totalW);
  const sv = r2(actual - planned);
  return { asOf, actualPct: actual, plannedPct: planned, scheduleVariancePct: sv, status: statusFor(sv, planned), milestones: rows,
    milestonesDelayed: rows.filter((r) => r.status === "delayed").length,
    pendingApprovals: records.filter((r) => r.approvalStatus === "pending_approval" && milestones.some((m) => m.id === r.milestoneId)).length,
    forecastCompletion: forecast(milestones, records, asOf, actual) };
}

function forecast(milestones: Milestone[], records: ProgressRecord[], asOf: string, actualNow: number): string | null {
  const past = new Date(t(asOf) - 30 * DAY).toISOString().slice(0, 10);
  const prev = computeSimple(milestones, records, past);
  const rate = (actualNow - prev) / 30; // %/day
  if (rate <= 0.01) return null;
  return new Date(t(asOf) + ((100 - actualNow) / rate) * DAY).toISOString().slice(0, 10);
}

function computeSimple(milestones: Milestone[], records: ProgressRecord[], asOf: string) {
  const totalW = milestones.reduce((s, m) => s + m.weight, 0) || 1;
  return milestones.reduce((s, m) => s + m.weight * officialPct(m, records, asOf), 0) / totalW;
}

/** S-curve series (planned vs actual) at weekly intervals. */
export function series(milestones: Milestone[], records: ProgressRecord[], from: string, to: string, stepDays = 7) {
  const out: { date: string; plannedPct: number; actualPct: number | null }[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (let d = t(from); d <= t(to); d += stepDays * DAY) {
    const ds = new Date(d).toISOString().slice(0, 10);
    const c = computeProgress(milestones, records, ds);
    out.push({ date: ds, plannedPct: c.plannedPct, actualPct: ds <= today ? c.actualPct : null });
  }
  return out;
}
