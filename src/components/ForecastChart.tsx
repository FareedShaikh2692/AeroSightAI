// Server-rendered SVG: planned vs actual progress history and the P10–P90 completion fan.
import type { DelayForecast } from "@/lib/predict";

export function ForecastChart({ f, start }: { f: DelayForecast; start: string }) {
  const W = 560, H = 180, pad = { l: 34, r: 10, t: 10, b: 22 };
  const t0 = Math.min(Date.parse(start), Date.parse(f.history[0]?.date ?? start));
  const ends = [f.plannedEnd, f.p90, f.p50].filter(Boolean).map((d) => Date.parse(d!));
  const t1 = Math.max(...ends, Date.now() + 30 * 86_400_000);
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (p: number) => pad.t + (1 - p / 100) * (H - pad.t - pad.b);
  const now = Date.now();
  const path = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? "L" : "M"}${x(a).toFixed(1)},${y(b).toFixed(1)}`).join(" ");
  const hist = f.history.map((h) => [Date.parse(h.date), h.pct] as [number, number]);
  const plan = f.history.map((h) => [Date.parse(h.date), h.planned] as [number, number]);
  const fan = f.p10 && f.p90 ? `M${x(now)},${y(f.actualPct)} L${x(Date.parse(f.p10))},${y(100)} L${x(Date.parse(f.p90))},${y(100)} Z` : null;
  const yr = (t: number) => new Date(t).toISOString().slice(0, 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Forecast: P50 completion ${f.p50 ?? "unknown"}, planned ${f.plannedEnd}`}>
      {[0, 25, 50, 75, 100].map((p) => <g key={p}><line x1={pad.l} x2={W - pad.r} y1={y(p)} y2={y(p)} stroke="currentColor" opacity={0.08} /><text x={pad.l - 6} y={y(p) + 3} fontSize={9} textAnchor="end" fill="currentColor" opacity={0.5}>{p}%</text></g>)}
      {fan && <path d={fan} fill="var(--color-data, #38BDF8)" opacity={0.15} />}
      {f.p50 && <line x1={x(now)} y1={y(f.actualPct)} x2={x(Date.parse(f.p50))} y2={y(100)} stroke="var(--color-data, #38BDF8)" strokeDasharray="4 3" strokeWidth={1.5} />}
      <path d={path(plan)} fill="none" stroke="currentColor" opacity={0.45} strokeWidth={1.5} />
      <path d={path(hist)} fill="none" stroke="var(--color-accent, #FFB020)" strokeWidth={2} />
      <line x1={x(Date.parse(f.plannedEnd))} x2={x(Date.parse(f.plannedEnd))} y1={pad.t} y2={H - pad.b} stroke="var(--color-ok, #22C55E)" strokeDasharray="2 3" />
      <text x={x(Date.parse(f.plannedEnd)) + 3} y={pad.t + 9} fontSize={9} fill="var(--color-ok, #22C55E)">planned end</text>
      {f.p50 && <text x={Math.min(W - 40, x(Date.parse(f.p50)) + 3)} y={y(100) + 12} fontSize={9} fill="var(--color-data, #38BDF8)">P50</text>}
      <line x1={x(now)} x2={x(now)} y1={pad.t} y2={H - pad.b} stroke="currentColor" opacity={0.25} />
      <text x={pad.l} y={H - 6} fontSize={9} fill="currentColor" opacity={0.5}>{yr(t0)}</text>
      <text x={W - pad.r} y={H - 6} fontSize={9} textAnchor="end" fill="currentColor" opacity={0.5}>{yr(t1)}</text>
    </svg>
  );
}
