import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Card, Kpi, Forbidden, Progress } from "@/components/ui";
import { fmtBytes } from "@/lib/format";
import { db } from "@/lib/store";
import { analyticsData } from "@/lib/analytics-data";
import { Download } from "lucide-react";

const fmtH = (h: number | null) => (h === null ? "—" : h >= 48 ? `${(h / 24).toFixed(1)} d` : `${h.toFixed(1)} h`);

export default async function Analytics({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "analytics:read")) return <Forbidden perm="analytics:read" />;
  const days = [30, 90, 365].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 90;
  // ANALYTICS-006: every aggregate below is computed only over projects the user can access.
  const { projects, missions, findings, bench, sla, fleet } = analyticsData(ctx, days);
  const media = repo.listMedia(ctx);
  const done = missions.filter((m) => m.status === "completed");
  const hours = done.reduce((s, m) => s + (m.summary?.durationS ?? 0), 0) / 3600;
  const aborted = missions.filter((m) => m.status === "aborted").length;
  const sev = (["critical", "high", "medium", "low"] as const).map((s) => [s, findings.filter((f) => f.severity === s && !["closed", "verified"].includes(f.status)).length] as const);
  const maxSev = Math.max(1, ...sev.map(([, n]) => n));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - i * 7 * 86_400_000, start = end - 7 * 86_400_000;
    return { label: new Date(start).toISOString().slice(5, 10), n: missions.filter((m) => m.actualStart && Date.parse(m.actualStart) >= start && Date.parse(m.actualStart) < end).length };
  }).reverse();
  const maxW = Math.max(1, ...weeks.map((w) => w.n));
  const storage = db().media.filter((m) => m.organizationId === ctx.orgId).reduce((s, m) => s + m.sizeBytes, 0);
  return (
    <>
      <PageHeader eyebrow="Overview" title="Analytics" subtitle={`Computed across ${projects.length} accessible project(s). Data as of ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.`} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-line p-1 text-xs" role="group" aria-label="Period">
          {[30, 90, 365].map((d) => <a key={d} href={`/app/analytics?days=${d}`} className={`rounded-md px-3 py-1 ${d === days ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"}`} aria-current={d === days ? "true" : undefined}>{d === 365 ? "12 months" : `${d} days`}</a>)}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["benchmark", "findings", "fleet"] as const).map((k) => <a key={k} href={`/api/v1/analytics/export?dataset=${k}&days=${days}`} className="btn btn-secondary h-8 text-xs"><Download size={14} /> {k === "benchmark" ? "Projects" : k === "findings" ? "Findings & SLA" : "Fleet"} CSV</a>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Flights completed" value={done.length} /><Kpi label="Flight hours" value={hours.toFixed(1)} /><Kpi label="Abort rate" value={missions.length ? `${((aborted / missions.length) * 100).toFixed(0)}%` : "—"} />
        <Kpi label="Media items" value={media.length} /><Kpi label="Storage used (org)" value={fmtBytes(storage)} hint="plan limit 2 TB" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Flights per week">
          <div className="flex h-40 items-end gap-2">{weeks.map((w) => (
            <div key={w.label} className="flex flex-1 flex-col items-center gap-1"><span className="font-mono text-[10px] text-ink-3">{w.n}</span>
              <div className="w-full rounded-t bg-data/70" style={{ height: `${(w.n / maxW) * 100}%`, minHeight: 2 }} /><span className="font-mono text-[10px] text-ink-3">{w.label}</span></div>
          ))}</div>
        </Card>
        <Card title="Open findings by severity">
          <div className="space-y-3">{sev.map(([s, n]) => (
            <div key={s} className="flex items-center gap-3 text-sm"><span className="w-16 capitalize text-ink-2">{s}</span>
              <div className="h-3 flex-1 rounded bg-white/5"><div className={`h-3 rounded ${s === "critical" ? "bg-bad" : s === "high" ? "bg-high" : s === "medium" ? "bg-warn" : "bg-info"}`} style={{ width: `${(n / maxSev) * 100}%` }} /></div>
              <span className="w-6 text-right font-mono">{n}</span></div>
          ))}</div>
        </Card>
        <Card title="Finding SLA compliance">
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div><div className="font-mono text-2xl">{sla.compliancePct === null ? "—" : `${sla.compliancePct}%`}</div><div className="text-[11px] text-ink-3">within SLA</div></div>
            <div><div className="font-mono text-2xl">{fmtH(sla.mttrHours)}</div><div className="text-[11px] text-ink-3">mean time to resolve</div></div>
            <div><div className={`font-mono text-2xl ${sla.breachedOpen ? "text-bad" : ""}`}>{sla.breachedOpen}</div><div className="text-[11px] text-ink-3">open & breached</div></div>
          </div>
          <table className="table text-sm"><thead><tr><th>Severity</th><th>Target</th><th>Resolved</th><th>MTTR</th><th>Open (breached)</th></tr></thead><tbody>
            {sla.bySeverity.map((r) => <tr key={r.severity}><td className="capitalize">{r.severity}</td><td className="font-mono text-xs">{fmtH(r.targetHours)}</td><td className="font-mono">{r.resolved}</td><td className="font-mono text-xs">{fmtH(r.mttrHours)}</td>
              <td className="font-mono">{r.open}{r.breachedOpen ? <span className="text-bad"> ({r.breachedOpen})</span> : ""}</td></tr>)}
          </tbody></table>
        </Card>
        <Card title={`Fleet utilization · last ${days === 365 ? "12 months" : `${days} days`}`}>
          {fleet.length === 0 ? <p className="text-sm text-ink-2">No drones visible to your role.</p> : (
            <div className="space-y-3">{fleet.map((d) => (
              <div key={d.droneId} className="text-sm"><div className="mb-1 flex justify-between"><span>{d.name} <span className="text-xs text-ink-3">{d.model}</span></span>
                <span className="font-mono text-xs text-ink-2">{d.hours} h · {d.flights} flights{d.aborted ? ` · ${d.aborted} aborted` : ""} · {d.utilizationPct}%</span></div>
                <Progress value={d.utilizationPct} tone={d.utilizationPct > 60 ? "warn" : "ok"} /></div>
            ))}
            <p className="text-[11px] text-ink-3">Utilization = flight hours ÷ (8 duty hours × days in period).</p></div>
          )}
        </Card>
        <Card title="Project benchmarking" className="xl:col-span-2" pad={false}>
          <div className="overflow-x-auto"><table className="table text-sm"><thead><tr><th>Project</th><th>Actual / plan</th><th>SV</th><th>Flights</th><th>Flight h</th><th>Abort rate</th><th>Open findings</th><th>MTTR</th><th>SLA</th></tr></thead><tbody>
            {[...bench].sort((a, b) => a.svPct - b.svPct).map((r) => <tr key={r.projectId}>
              <td>{r.name}<div className="font-mono text-[11px] text-ink-3">{r.code} · {r.type}</div></td>
              <td className="font-mono text-xs">{r.actualPct}% / {r.plannedPct}%</td>
              <td className={`font-mono text-xs ${r.svPct < -5 ? "text-bad" : r.svPct < 0 ? "text-warn" : "text-ok"}`}>{r.svPct > 0 ? "+" : ""}{r.svPct}</td>
              <td className="font-mono">{r.flights}</td><td className="font-mono">{r.flightHours}</td><td className="font-mono text-xs">{r.abortRatePct === null ? "—" : `${r.abortRatePct}%`}</td>
              <td className="font-mono">{r.openFindings}{r.criticalOpen ? <span className="text-bad"> ({r.criticalOpen} crit)</span> : ""}</td>
              <td className="font-mono text-xs">{fmtH(r.mttrHours)}</td><td className="font-mono text-xs">{r.slaPct === null ? "—" : `${r.slaPct}%`}</td></tr>)}
          </tbody></table></div>
          <p className="px-5 pb-4 pt-2 text-[11px] text-ink-3">Sorted by schedule variance (most behind first). Benchmarks only include projects you can access.</p>
        </Card>
        <Card title="Project progress vs plan" className="xl:col-span-2">
          <div className="space-y-4">{projects.map((p) => { const pr = repo.projectProgress(ctx, p.id); return (
            <div key={p.id}><div className="mb-1 flex justify-between text-sm"><span>{p.name}</span><span className="font-mono text-xs text-ink-2">{pr.actualPct}% / plan {pr.plannedPct}%</span></div>
              <div className="relative"><Progress value={pr.actualPct} tone={pr.status === "delayed" ? "bad" : pr.status === "at_risk" ? "warn" : "ok"} />
                <div className="absolute top-[-3px] h-3 w-0.5 bg-data" style={{ left: `${pr.plannedPct}%` }} title="Planned" /></div></div>
          ); })}</div>
        </Card>
      </div>
    </>
  );
}
