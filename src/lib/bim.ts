// BIM 4D/5D (Roadmap Phase 4: schedule- and cost-linked models, BIM-vs-as-built deviation).
// 4D: each model element is linked to a milestone; its planned window is its share of the milestone's dates in
//     construction sequence, and its as-built state comes from the milestone's approved progress.
// 5D: earned value management — PV/EV from milestone budgets (BAC × weight share), AC from cost entries.
// Deviation: as-built top elevations (survey DSM / total station) vs design, against a tolerance.
// IFC import needs an IFC parsing service (web-ifc / IfcOpenShell) — Integration Required; elements are seeded.
import type { AsBuiltMeasurement, BimElement, CostEntry, Milestone, ProgressRecord, Project } from "./types";
import { officialPct, plannedPct } from "./progress";

export type Status4D = "not_started" | "on_track" | "ahead" | "behind" | "complete";

export function elementState(el: BimElement, siblings: BimElement[], ms: Milestone, records: ProgressRecord[], asOf: string) {
  const group = siblings.filter((s) => s.milestoneId === el.milestoneId).sort((a, b) => a.sequence - b.sequence);
  const K = group.length, i = group.findIndex((g) => g.id === el.id);
  const s = Date.parse(ms.plannedStart), e = Date.parse(ms.plannedEnd), t = Date.parse(asOf);
  const ws = s + ((e - s) * i) / K, we = s + ((e - s) * (i + 1)) / K;
  const planned = Math.max(0, Math.min(1, (t - ws) / Math.max(1, we - ws)));
  const built = Math.max(0, Math.min(1, (officialPct(ms, records, asOf) / 100) * K - i));
  const status: Status4D = built >= 1 && planned >= 1 ? "complete" : built === 0 && planned === 0 ? "not_started" : built > planned + 0.05 ? "ahead" : built < planned - 0.05 ? "behind" : "on_track";
  return { planned, built, status, plannedStart: new Date(ws).toISOString().slice(0, 10), plannedEnd: new Date(we).toISOString().slice(0, 10) };
}

export interface Evm { asOf: string; bac: number; pv: number; ev: number; ac: number; sv: number; cv: number; spi: number | null; cpi: number | null; eac: number | null; etc: number | null; vac: number | null; tcpi: number | null; currency: string }

export function evm(project: Project, milestones: Milestone[], records: ProgressRecord[], costs: CostEntry[], asOf: string): Evm {
  const bac = project.budget?.bac ?? 0;
  const totalW = milestones.reduce((s, m) => s + m.weight, 0) || 1;
  const approved = records.filter((r) => r.approvalStatus === "approved");
  const pv = milestones.reduce((s, m) => s + (bac * m.weight / totalW) * plannedPct(m, asOf) / 100, 0);
  const ev = milestones.reduce((s, m) => s + (bac * m.weight / totalW) * officialPct(m, approved, asOf) / 100, 0);
  const ac = costs.filter((c) => c.date <= asOf).reduce((s, c) => s + c.amount, 0);
  const spi = pv > 0 ? ev / pv : null, cpi = ac > 0 ? ev / ac : null;
  const eac = cpi ? bac / cpi : null;
  return { asOf, bac, pv: Math.round(pv), ev: Math.round(ev), ac: Math.round(ac), sv: Math.round(ev - pv), cv: Math.round(ev - ac),
    spi: spi === null ? null : +spi.toFixed(3), cpi: cpi === null ? null : +cpi.toFixed(3), eac: eac === null ? null : Math.round(eac),
    etc: eac === null ? null : Math.round(eac - ac), vac: eac === null ? null : Math.round(bac - eac), tcpi: bac - ac > 0 ? +((bac - ev) / (bac - ac)).toFixed(3) : null,
    currency: project.budget?.currency ?? "" };
}

/** Monthly PV / EV / AC curve from project start to `asOf` (PV continues to the planned end). */
export function evmSeries(project: Project, milestones: Milestone[], records: ProgressRecord[], costs: CostEntry[], asOf: string) {
  const out: { date: string; pv: number; ev: number | null; ac: number | null }[] = [];
  const end = Date.parse(project.endDate), now = Date.parse(asOf);
  for (let t = Date.parse(project.startDate); t <= end + 15 * 86_400_000; t += 30 * 86_400_000) {
    const d = new Date(Math.min(t, end)).toISOString().slice(0, 10);
    const e = evm(project, milestones, records, costs, d);
    out.push({ date: d, pv: e.pv, ev: t <= now ? e.ev : null, ac: t <= now ? e.ac : null });
  }
  return out;
}

export const DEFAULT_TOLERANCE_M = 0.025;

export function deviations(elements: BimElement[], measurements: AsBuiltMeasurement[], toleranceM = DEFAULT_TOLERANCE_M) {
  return measurements.map((m) => {
    const el = elements.find((e) => e.id === m.elementId);
    if (!el) return null;
    const dev = +(m.measuredTopZ - el.topZ).toFixed(3);
    return { measurement: m, element: el, deviationM: dev, withinTolerance: Math.abs(dev) <= toleranceM };
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => Math.abs(b.deviationM) - Math.abs(a.deviationM));
}
