// Predictive analytics (docs/13-Product/Roadmap.md Phase 4; Future-Scope §1). Transparent statistical models,
// not trained ML: production ML needs ≥ 12 months of multi-project history (Future-Scope prerequisites).
//  • Delay forecast: weighted least-squares velocity of approved progress (recent weeks weigh more), with an
//    uncertainty band from the residual spread → P10 / P50 / P90 completion dates and P(on time).
//  • Risk score: 0–100, sum of explainable factor points (schedule, quality, safety, operations, data freshness).
import type { Finding, Inspection, Milestone, Mission, ProgressRecord, Project } from "./types";
import { computeProgress } from "./progress";

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export interface DelayForecast {
  actualPct: number; plannedPct: number; velocityPctPerWeek: number; plannedVelocityPctPerWeek: number; spiTime: number | null; samples: number;
  earnedScheduleDate: string | null; p10: string | null; p50: string | null; p90: string | null; plannedEnd: string; delayDaysP50: number | null;
  onTimeProbability: number | null; confidence: "low" | "medium" | "high"; history: { date: string; pct: number; planned: number }[]; note?: string;
}

/** Normal CDF (Abramowitz–Stegun 7.1.26). */
function phi(z: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Weighted least-squares slope (per week) with standard error; weights grow toward the present. */
function slope(xs: number[], ys: number[]) {
  const ws = xs.map((_, i) => i + 1), W = ws.reduce((a, b) => a + b, 0);
  const mx = xs.reduce((s, x, i) => s + ws[i] * x, 0) / W, my = ys.reduce((s, y, i) => s + ws[i] * y, 0) / W;
  const sxx = xs.reduce((s, x, i) => s + ws[i] * (x - mx) ** 2, 0), sxy = xs.reduce((s, x, i) => s + ws[i] * (x - mx) * (ys[i] - my), 0);
  const b = sxx ? sxy / sxx : 0;
  const sigma = Math.sqrt(xs.reduce((s, x, i) => s + ws[i] * (ys[i] - (my + b * (x - mx))) ** 2, 0) / Math.max(1, W - 2));
  return { b, se: sxx ? sigma / Math.sqrt(sxx) : 0 };
}

/**
 * Earned Schedule forecast (Lipke): ES = the date on the planned curve that matches today's actual %;
 * SPI(t) = ES / actual time. Remaining planned duration is projected at a blend of cumulative and recent SPI(t);
 * the band comes from the uncertainty of the recent actual-vs-planned velocity ratio.
 */
export function forecastDelay(project: Pick<Project, "startDate" | "endDate">, milestones: Milestone[], records: ProgressRecord[], nowMs = Date.now(), weeks = 16): DelayForecast {
  const approved = records.filter((r) => r.approvalStatus === "approved");
  const at = (t: number) => computeProgress(milestones, approved, iso(t));
  const t0 = Date.parse(project.startDate), tEnd = Date.parse(project.endDate);
  const history: { date: string; pct: number; planned: number; t: number }[] = [];
  for (let t = Math.max(t0, nowMs - weeks * 7 * DAY); t < nowMs; t += 7 * DAY) { const c = at(t); history.push({ date: iso(t), t, pct: c.actualPct, planned: c.plannedPct }); }
  const now = at(nowMs);
  history.push({ date: iso(nowMs), t: nowMs, pct: now.actualPct, planned: now.plannedPct });
  const base: DelayForecast = { actualPct: now.actualPct, plannedPct: now.plannedPct, velocityPctPerWeek: 0, plannedVelocityPctPerWeek: 0, spiTime: null, samples: history.length,
    earnedScheduleDate: null, p10: null, p50: null, p90: null, plannedEnd: project.endDate, delayDaysP50: null, onTimeProbability: null, confidence: "low",
    history: history.map(({ date, pct, planned }) => ({ date, pct, planned })) };
  if (now.actualPct >= 100) return { ...base, p10: iso(nowMs), p50: iso(nowMs), p90: iso(nowMs), delayDaysP50: 0, onTimeProbability: 1, confidence: "high", note: "Complete." };
  if (now.actualPct === 0) return { ...base, note: "No approved progress yet — nothing to forecast from." };
  if (history.length < 4 || nowMs <= t0) return { ...base, note: "Not enough progress history yet (need 4+ weekly points)." };

  // Data date: performance is measured as of the latest approved measurement, not "now" (EVM practice) —
  // otherwise reporting lag reads as schedule slippage.
  const dataDate = Math.min(nowMs, Math.max(t0 + DAY, ...approved.map((r) => Date.parse(r.recordDate) + DAY - 1)));
  // Earned schedule: binary search the planned curve (monotonic) for the actual % at the data date.
  let lo = t0, hi = Math.max(tEnd, nowMs);
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (at(mid).plannedPct < now.actualPct) lo = mid; else hi = mid; }
  const es = hi;
  const spiCum = (es - t0) / Math.max(DAY, dataDate - t0);
  const xs = history.map((h) => (h.t - nowMs) / (7 * DAY));
  if (dataDate < nowMs - DAY) history[history.length - 1].planned = at(dataDate).plannedPct; // compare like with like
  const act = slope(xs, history.map((h) => h.pct)), pln = slope(xs, history.map((h) => h.planned));
  const spiRecent = pln.b > 0.05 ? act.b / pln.b : spiCum;
  const spi = Math.max(0.05, 0.5 * spiCum + 0.5 * spiRecent);
  const seSpi = Math.max(0.05 * spi, pln.b > 0.05 ? act.se / pln.b : 0.15 * spi);
  const remainingPlanned = Math.max(0, tEnd - es); // ms of planned work left
  const finish = (k: number) => (k > 0.02 ? iso(dataDate + remainingPlanned / k) : null);
  const p50 = finish(spi);
  const requiredSpi = tEnd > dataDate ? remainingPlanned / (tEnd - dataDate) : Infinity;
  const onTime = requiredSpi === Infinity ? 0 : 1 - phi((requiredSpi - spi) / seSpi);
  const rel = seSpi / spi;
  return {
    ...base, velocityPctPerWeek: +act.b.toFixed(2), plannedVelocityPctPerWeek: +pln.b.toFixed(2), spiTime: +spi.toFixed(2), earnedScheduleDate: iso(es),
    p10: finish(spi + 1.2816 * seSpi), p50, p90: finish(spi - 1.2816 * seSpi),
    delayDaysP50: p50 ? Math.round((Date.parse(p50) - tEnd) / DAY) : null, onTimeProbability: +Math.max(0, Math.min(1, onTime)).toFixed(2),
    confidence: history.length >= 10 && rel < 0.1 ? "high" : history.length >= 6 && rel < 0.25 ? "medium" : "low",
    note: spi - 1.2816 * seSpi <= 0.02 ? "Schedule performance is very uncertain; P90 is unbounded." : undefined,
  };
}

export interface RiskFactor { key: "schedule" | "quality" | "safety" | "operations" | "freshness"; label: string; points: number; max: number; detail: string }
export interface RiskScore { score: number; band: "low" | "medium" | "high" | "critical"; factors: RiskFactor[] }

const OPEN = (f: Finding) => !f.resolvedAt && !["resolved", "verified", "closed", "wont_fix"].includes(f.status);

export function riskScore(input: {
  forecast: DelayForecast; scheduleVariancePct: number; findings: Finding[]; inspections: Inspection[]; missions: Mission[]; lastCaptureAt?: string; nowMs?: number;
}): RiskScore {
  const now = input.nowMs ?? Date.now();
  const f: RiskFactor[] = [];
  // Schedule (max 35): variance today + probability of missing the planned end.
  const sv = Math.min(20, Math.max(0, -input.scheduleVariancePct) * 1.5);
  const miss = input.forecast.onTimeProbability === null ? 7 : (1 - input.forecast.onTimeProbability) * 15;
  f.push({ key: "schedule", label: "Schedule", max: 35, points: Math.round(sv + miss),
    detail: `SV ${input.scheduleVariancePct > 0 ? "+" : ""}${input.scheduleVariancePct.toFixed(1)} pts; on-time probability ${input.forecast.onTimeProbability === null ? "unknown" : `${Math.round(input.forecast.onTimeProbability * 100)}%`}` });
  // Quality (max 25): open findings weighted by severity, overdue ones double.
  const W = { critical: 8, high: 4, medium: 1.5, low: 0.5 } as const;
  const open = input.findings.filter(OPEN);
  const q = open.reduce((s, x) => s + W[x.severity] * (Date.parse(x.dueDate) < now ? 2 : 1), 0);
  f.push({ key: "quality", label: "Quality", max: 25, points: Math.round(Math.min(25, q)),
    detail: `${open.length} open finding(s), ${open.filter((x) => x.severity === "critical").length} critical, ${open.filter((x) => Date.parse(x.dueDate) < now).length} overdue` });
  // Safety (max 15): open safety-category findings.
  const safety = open.filter((x) => x.category === "safety");
  f.push({ key: "safety", label: "Safety", max: 15, points: Math.min(15, safety.reduce((s, x) => s + (x.severity === "critical" || x.severity === "high" ? 6 : 2), 0)),
    detail: `${safety.length} open safety finding(s)` });
  // Operations (max 15): aborted flights (last 90 days) and overdue inspections.
  const recent = input.missions.filter((m) => m.actualStart && now - Date.parse(m.actualStart) < 90 * DAY);
  const aborted = recent.filter((m) => m.status === "aborted").length;
  const overdueInsp = input.inspections.filter((i) => !["approved", "closed"].includes(i.status) && Date.parse(i.dueDate) < now).length;
  f.push({ key: "operations", label: "Operations", max: 15, points: Math.min(15, aborted * 4 + overdueInsp * 3), detail: `${aborted} aborted flight(s) in 90 days, ${overdueInsp} overdue inspection(s)` });
  // Data freshness (max 10): days since the last completed capture.
  const days = input.lastCaptureAt ? (now - Date.parse(input.lastCaptureAt)) / DAY : Infinity;
  f.push({ key: "freshness", label: "Data freshness", max: 10, points: days === Infinity ? 10 : days <= 7 ? 0 : days <= 14 ? 3 : days <= 30 ? 6 : 10,
    detail: days === Infinity ? "No completed capture yet" : `Last capture ${Math.round(days)} day(s) ago` });
  const score = Math.min(100, f.reduce((s, x) => s + x.points, 0));
  return { score, band: score >= 60 ? "critical" : score >= 40 ? "high" : score >= 20 ? "medium" : "low", factors: f };
}
