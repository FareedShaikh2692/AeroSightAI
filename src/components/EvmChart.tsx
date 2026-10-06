// Server-rendered SVG: planned value, earned value and actual cost over time.
export function EvmChart({ data, bac }: { data: { date: string; pv: number; ev: number | null; ac: number | null }[]; bac: number }) {
  const W = 560, H = 200, pad = { l: 44, r: 10, t: 10, b: 22 };
  if (data.length < 2) return null;
  const max = Math.max(bac, ...data.map((d) => Math.max(d.pv, d.ev ?? 0, d.ac ?? 0))) * 1.05;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = (k: "pv" | "ev" | "ac") => data.map((d, i) => [i, d[k]] as const).filter(([, v]) => v !== null).map(([i, v], j) => `${j ? "L" : "M"}${x(i).toFixed(1)},${y(v!).toFixed(1)}`).join(" ");
  const fmt = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${Math.round(v / 1e3)}k`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Earned value curves">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" opacity={0.08} /><text x={pad.l - 6} y={y(max * f) + 3} fontSize={9} textAnchor="end" fill="currentColor" opacity={0.5}>{fmt(max * f)}</text></g>)}
      <line x1={pad.l} x2={W - pad.r} y1={y(bac)} y2={y(bac)} stroke="currentColor" strokeDasharray="3 3" opacity={0.35} /><text x={W - pad.r} y={y(bac) - 3} fontSize={9} textAnchor="end" fill="currentColor" opacity={0.6}>BAC</text>
      <path d={line("pv")} fill="none" stroke="currentColor" opacity={0.5} strokeWidth={1.5} />
      <path d={line("ev")} fill="none" stroke="var(--color-ok, #22C55E)" strokeWidth={2} />
      <path d={line("ac")} fill="none" stroke="var(--color-bad, #EF4444)" strokeWidth={2} />
      <text x={pad.l} y={H - 6} fontSize={9} fill="currentColor" opacity={0.5}>{data[0].date.slice(0, 7)}</text>
      <text x={W - pad.r} y={H - 6} fontSize={9} textAnchor="end" fill="currentColor" opacity={0.5}>{data[data.length - 1].date.slice(0, 7)}</text>
    </svg>
  );
}
