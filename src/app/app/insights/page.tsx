import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/policy";
import { PageHeader, Card, Badge, Forbidden, Kpi } from "@/components/ui";
import { insightsFor } from "@/lib/insights";
import { ForecastChart } from "@/components/ForecastChart";
import { fmtDate } from "@/lib/format";

const BAND_TONE = { low: "ok", medium: "info", high: "warn", critical: "bad" } as const;

export default async function Insights({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "analytics:read")) return <Forbidden perm="analytics:read" />;
  const rows = insightsFor(ctx);
  const { project } = await searchParams;
  const sel = rows.find((r) => r.project.id === project) ?? rows[0];
  const late = rows.filter((r) => (r.forecast.delayDaysP50 ?? 0) > 14).length;
  return (
    <>
      <PageHeader eyebrow="Overview" title={<span className="flex items-center gap-3">Predictive Insights <Badge tone="info">Beta</Badge></span>}
        subtitle="Delay forecasts (Earned Schedule with uncertainty bands) and explainable risk scores for every project you can access." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Projects" value={rows.length} />
        <Kpi label="High / critical risk" value={rows.filter((r) => r.risk.band === "high" || r.risk.band === "critical").length} tone={rows.some((r) => r.risk.band === "critical") ? "bad" : undefined} />
        <Kpi label="Forecast > 2 weeks late" value={late} tone={late ? "warn" : undefined} />
        <Kpi label="Avg. on-time probability" value={rows.length ? `${Math.round((rows.reduce((s, r) => s + (r.forecast.onTimeProbability ?? 0), 0) / rows.length) * 100)}%` : "—"} />
      </div>

      <Card title="Portfolio risk" className="mt-6" pad={false}>
        <div className="overflow-x-auto"><table className="table text-sm"><thead><tr><th>Project</th><th>Risk</th><th>Progress (plan)</th><th>SPI(t)</th><th>Forecast finish P10 · P50 · P90</th><th>Planned end</th><th>Delay (P50)</th><th>On time</th></tr></thead><tbody>
          {rows.map((r) => (
            <tr key={r.project.id} className={r.project.id === sel?.project.id ? "bg-white/[0.03]" : ""}>
              <td><Link href={`/app/insights?project=${r.project.id}`} className="hover:text-accent">{r.project.name}</Link><div className="font-mono text-[11px] text-ink-3">{r.project.code}</div></td>
              <td><Badge tone={BAND_TONE[r.risk.band]}>{r.risk.score} · {r.risk.band}</Badge></td>
              <td className="font-mono text-xs">{r.forecast.actualPct}% ({r.forecast.plannedPct}%)</td>
              <td className={`font-mono text-xs ${(r.forecast.spiTime ?? 1) < 0.9 ? "text-bad" : (r.forecast.spiTime ?? 1) < 0.97 ? "text-warn" : "text-ok"}`}>{r.forecast.spiTime ?? "—"}</td>
              <td className="font-mono text-xs">{r.forecast.p10 ?? "—"} · <strong>{r.forecast.p50 ?? "—"}</strong> · {r.forecast.p90 ?? "—"}</td>
              <td className="font-mono text-xs">{r.forecast.plannedEnd}</td>
              <td className={`font-mono text-xs ${(r.forecast.delayDaysP50 ?? 0) > 14 ? "text-bad" : (r.forecast.delayDaysP50 ?? 0) > 0 ? "text-warn" : "text-ok"}`}>{r.forecast.delayDaysP50 === null ? "—" : `${r.forecast.delayDaysP50 > 0 ? "+" : ""}${r.forecast.delayDaysP50} d`}</td>
              <td className="font-mono text-xs">{r.forecast.onTimeProbability === null ? "—" : `${Math.round(r.forecast.onTimeProbability * 100)}%`}</td>
            </tr>
          ))}
        </tbody></table></div>
      </Card>

      {sel && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card title={`Delay forecast — ${sel.project.name}`}>
            <ForecastChart f={sel.forecast} start={sel.project.startDate} />
            <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-ink-3">
              <span><span className="mr-1 inline-block h-0.5 w-4 bg-accent align-middle" />actual (approved)</span><span><span className="mr-1 inline-block h-0.5 w-4 bg-ink-3 align-middle" />planned</span>
              <span><span className="mr-1 inline-block h-2 w-4 bg-data/30 align-middle" />P10–P90 completion</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
              <dt className="text-ink-3">Earned schedule</dt><dd className="font-mono text-xs">{sel.forecast.earnedScheduleDate ? fmtDate(sel.forecast.earnedScheduleDate) : "—"}</dd>
              <dt className="text-ink-3">Velocity</dt><dd className="font-mono text-xs">{sel.forecast.velocityPctPerWeek} %/wk (plan {sel.forecast.plannedVelocityPctPerWeek})</dd>
              <dt className="text-ink-3">Confidence</dt><dd className="capitalize">{sel.forecast.confidence}</dd>
              <dt className="text-ink-3">History</dt><dd className="font-mono text-xs">{sel.forecast.samples} weekly points</dd>
            </dl>
            {sel.forecast.note && <p className="mt-3 text-xs text-warn">{sel.forecast.note}</p>}
          </Card>
          <Card title={`Risk score — ${sel.risk.score}/100`} actions={<Badge tone={BAND_TONE[sel.risk.band]}>{sel.risk.band}</Badge>}>
            <ul className="space-y-3">{sel.risk.factors.map((f) => (
              <li key={f.key}><div className="mb-1 flex justify-between text-sm"><span>{f.label}</span><span className="font-mono text-xs">{f.points} / {f.max}</span></div>
                <div className="h-2 rounded bg-white/5"><div className={`h-2 rounded ${f.points / f.max > 0.6 ? "bg-bad" : f.points / f.max > 0.3 ? "bg-warn" : "bg-ok"}`} style={{ width: `${(f.points / f.max) * 100}%` }} /></div>
                <div className="mt-1 text-[11px] text-ink-3">{f.detail}</div></li>
            ))}</ul>
          </Card>
        </div>
      )}
      <p className="mt-6 text-xs text-ink-3">Method: Earned Schedule (SPI(t) blended from cumulative and recent 16-week performance) with a normal-approximation band; risk is a transparent weighted sum. These are statistical forecasts, not trained ML models — ML requires ≥ 12 months of multi-project history. A daily job alerts project managers when a project’s risk rises to high or critical (workflow trigger “Project risk became high”).</p>
    </>
  );
}
