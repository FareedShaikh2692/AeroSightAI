// Planned vs actual S-curve (server-rendered SVG, accessible with a data table fallback).
export function SCurve({ data, height = 240 }: { data: { date: string; plannedPct: number; actualPct: number | null }[]; height?: number }) {
  if (data.length < 2) return <p className="text-sm text-ink-2">Not enough data to draw a curve.</p>;
  const W = 720, H = height, P = { l: 40, r: 12, t: 12, b: 28 };
  const x = (i: number) => P.l + (i / (data.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / 100) * (H - P.t - P.b);
  const planned = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.plannedPct).toFixed(1)}`).join("");
  const actualPts = data.map((d, i) => (d.actualPct == null ? null : [x(i), y(d.actualPct)] as const)).filter(Boolean) as (readonly [number, number])[];
  const actual = actualPts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
  const todayIdx = data.findIndex((d) => d.actualPct == null);
  const ticks = [0, 25, 50, 75, 100];
  const labelEvery = Math.ceil(data.length / 6);
  const last = actualPts[actualPts.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="S-curve of planned versus actual progress">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#223040" strokeWidth="1" />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6B7C8F" fontFamily="var(--font-mono)">{t}%</text>
          </g>
        ))}
        {data.map((d, i) => i % labelEvery === 0 && (
          <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#6B7C8F" fontFamily="var(--font-mono)">{d.date.slice(2, 7)}</text>
        ))}
        {todayIdx > 0 && <line x1={x(todayIdx - 1)} x2={x(todayIdx - 1)} y1={P.t} y2={H - P.b} stroke="#9AABBD" strokeDasharray="3 4" strokeWidth="1" />}
        <path d={planned} fill="none" stroke="#22D3EE" strokeWidth="2" strokeDasharray="6 5" />
        <path d={actual} fill="none" stroke="#FFB020" strokeWidth="2.5" />
        {last && <circle cx={last[0]} cy={last[1]} r="4" fill="#FFB020" />}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-data" /> Planned</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-accent" /> Actual (approved)</span>
        <span className="text-ink-3">Dashed vertical line = today</span>
      </figcaption>
    </figure>
  );
}
