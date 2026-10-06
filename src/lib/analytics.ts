// Analytics v2 (docs/13-Product/Product-Requirements.md ANALYTICS-007..012): project benchmarking, finding SLA
// compliance, mean time to resolve, fleet utilization and CSV export. Pure functions over rows the caller has
// already scoped through repo.ts, so tenant and project isolation (ANALYTICS-006) is inherited.
import type { Drone, Finding, Mission, Project, Severity } from "./types";

/** Resolution targets per severity, in hours (docs/09-QA/Inspection-Workflow.md §7). */
export const SLA_HOURS: Record<Severity, number> = { critical: 24, high: 7 * 24, medium: 30 * 24, low: 60 * 24 };
const H = 3_600_000;

export function findingSla(findings: Finding[], nowMs = Date.now()) {
  const resolved = findings.filter((f) => f.resolvedAt);
  const ttr = resolved.map((f) => (Date.parse(f.resolvedAt!) - Date.parse(f.createdAt)) / H).filter((h) => h >= 0);
  const metOnResolved = resolved.filter((f) => (Date.parse(f.resolvedAt!) - Date.parse(f.createdAt)) / H <= SLA_HOURS[f.severity]).length;
  const open = findings.filter((f) => !f.resolvedAt && !["closed", "wont_fix", "verified"].includes(f.status));
  const breachedOpen = open.filter((f) => (nowMs - Date.parse(f.createdAt)) / H > SLA_HOURS[f.severity]).length;
  const judged = resolved.length + breachedOpen; // open findings still inside their window are not judged yet
  const bySeverity = (["critical", "high", "medium", "low"] as Severity[]).map((s) => {
    const r = resolved.filter((f) => f.severity === s);
    const hrs = r.map((f) => (Date.parse(f.resolvedAt!) - Date.parse(f.createdAt)) / H);
    return { severity: s, targetHours: SLA_HOURS[s], resolved: r.length, open: open.filter((f) => f.severity === s).length,
      breachedOpen: open.filter((f) => f.severity === s && (nowMs - Date.parse(f.createdAt)) / H > SLA_HOURS[s]).length,
      mttrHours: hrs.length ? round1(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null };
  });
  return {
    resolved: resolved.length, open: open.length, breachedOpen,
    mttrHours: ttr.length ? round1(ttr.reduce((a, b) => a + b, 0) / ttr.length) : null,
    medianTtrHours: ttr.length ? round1(median(ttr)) : null,
    compliancePct: judged ? round1(((metOnResolved) / judged) * 100) : null,
    bySeverity,
  };
}

export function fleetUtilization(drones: Drone[], missions: Mission[], days: number, nowMs = Date.now(), dutyHoursPerDay = 8) {
  const from = nowMs - days * 86_400_000;
  const capacityH = days * dutyHoursPerDay;
  return drones.filter((d) => d.status !== "retired").map((d) => {
    const flights = missions.filter((m) => m.droneId === d.id && m.actualStart && Date.parse(m.actualStart) >= from && (m.status === "completed" || m.status === "aborted"));
    const hours = flights.reduce((s, m) => s + (m.summary?.durationS ?? (m.actualEnd ? (Date.parse(m.actualEnd) - Date.parse(m.actualStart!)) / 1000 : 0)), 0) / 3600;
    return { droneId: d.id, name: d.name, model: `${d.manufacturer} ${d.model}`, status: d.status, flights: flights.length, hours: round1(hours),
      utilizationPct: round1(Math.min(100, (hours / capacityH) * 100)), aborted: flights.filter((m) => m.status === "aborted").length };
  });
}

export interface BenchmarkRow {
  projectId: string; code: string; name: string; type: string; actualPct: number; plannedPct: number; svPct: number; status: string;
  flights: number; flightHours: number; abortRatePct: number | null; openFindings: number; criticalOpen: number; mttrHours: number | null; slaPct: number | null;
}

export function benchmark(projects: (Project & { progress: { actualPct: number; plannedPct: number; scheduleVariancePct: number; status: string } })[], missions: Mission[], findings: Finding[]): BenchmarkRow[] {
  return projects.map((p) => {
    const ms = missions.filter((m) => m.projectId === p.id);
    const done = ms.filter((m) => m.status === "completed"), ab = ms.filter((m) => m.status === "aborted");
    const fs = findings.filter((f) => f.projectId === p.id);
    const sla = findingSla(fs);
    return { projectId: p.id, code: p.code, name: p.name, type: p.type, actualPct: p.progress.actualPct, plannedPct: p.progress.plannedPct, svPct: p.progress.scheduleVariancePct,
      status: p.progress.status, flights: done.length, flightHours: round1(done.reduce((s, m) => s + (m.summary?.durationS ?? 0), 0) / 3600),
      abortRatePct: done.length + ab.length ? round1((ab.length / (done.length + ab.length)) * 100) : null,
      openFindings: sla.open, criticalOpen: fs.filter((f) => f.severity === "critical" && !f.resolvedAt && !["closed", "wont_fix", "verified"].includes(f.status)).length,
      mttrHours: sla.mttrHours, slaPct: sla.compliancePct };
  });
}

/** RFC 4180 CSV with spreadsheet formula-injection protection (OWASP CSV injection). */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const round1 = (n: number) => Math.round(n * 10) / 10;
