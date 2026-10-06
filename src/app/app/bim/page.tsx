import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { PageHeader, Card, Badge, Forbidden, Kpi, Empty } from "@/components/ui";
import { elementState, evm, evmSeries, deviations, DEFAULT_TOLERANCE_M, type Status4D } from "@/lib/bim";
import { EvmChart } from "@/components/EvmChart";
import { raiseDeviationAction } from "./actions";

const TONE: Record<Status4D, "ok" | "info" | "warn" | "bad" | "neutral"> = { complete: "ok", ahead: "info", on_track: "ok", behind: "bad", not_started: "neutral" };
const money = (v: number | null, c: string) => (v === null ? "—" : `${c} ${Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}k`}`);

export default async function Bim({ searchParams }: { searchParams: Promise<{ project?: string; asOf?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "progress:read")) return <Forbidden perm="progress:read" />;
  const projects = repo.listProjects(ctx).filter((p) => can(ctx, "progress:read", p));
  const sp = await searchParams;
  const project = projects.find((p) => p.id === sp.project) ?? projects[0];
  if (!project) return <Empty title="No projects available" />;
  const today = new Date().toISOString().slice(0, 10);
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(sp.asOf ?? "") ? sp.asOf! : today;
  const prog = repo.projectProgress(ctx, project.id, asOf);
  const ms = prog.milestonesList;
  const elements = db().bimElements.filter((e) => e.projectId === project.id && e.organizationId === ctx.orgId).sort((a, b) => a.sequence - b.sequence);
  const rows = elements.map((e) => ({ e, ms: ms.find((m) => m.id === e.milestoneId)!, ...elementState(e, elements, ms.find((m) => m.id === e.milestoneId)!, prog.records, asOf) }));
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {} as Record<string, number>);
  const showCost = can(ctx, "analytics:read");
  const costs = db().costEntries.filter((c) => c.projectId === project.id && c.organizationId === ctx.orgId);
  const e = evm(project, ms, prog.records, costs, asOf);
  const devs = can(ctx, "inspection:read") ? deviations(elements, db().asBuilt.filter((m) => m.projectId === project.id && m.organizationId === ctx.orgId)) : [];
  const out = devs.filter((d) => !d.withinTolerance);
  const canRaise = can(ctx, "finding:create") && can(ctx, "inspection:create");
  return (
    <>
      <PageHeader eyebrow="Work" title={<span className="flex items-center gap-3">BIM 4D/5D <Badge tone="info">Beta</Badge></span>}
        subtitle="Model elements linked to the schedule (4D) and budget (5D): planned vs as-built status, earned value, and as-built deviation against design." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {projects.map((p) => <Link key={p.id} href={`/app/bim?project=${p.id}`} className={`rounded-full border px-3 py-1 text-xs ${p.id === project.id ? "border-accent text-accent" : "border-line text-ink-2 hover:text-ink"}`}>{p.name}</Link>)}
        <form className="ml-auto flex items-center gap-2 text-xs" method="get"><input type="hidden" name="project" value={project.id} />
          <label htmlFor="asOf" className="text-ink-3">As of</label><input id="asOf" name="asOf" type="date" defaultValue={asOf} min={project.startDate} max={project.endDate} className="input h-8 w-40" />
          <button className="btn btn-secondary h-8 text-xs">Apply</button></form>
      </div>

      {showCost && project.budget && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Kpi label="Budget (BAC)" value={money(e.bac, e.currency)} />
          <Kpi label="Earned value" value={money(e.ev, e.currency)} hint={`planned ${money(e.pv, e.currency)}`} />
          <Kpi label="Actual cost" value={money(e.ac, e.currency)} />
          <Kpi label="SPI" value={e.spi ?? "—"} tone={e.spi !== null && e.spi < 0.95 ? "bad" : undefined} hint="EV ÷ PV" />
          <Kpi label="CPI" value={e.cpi ?? "—"} tone={e.cpi !== null && e.cpi < 0.95 ? "bad" : undefined} hint="EV ÷ AC" />
          <Kpi label="Forecast at completion" value={money(e.eac, e.currency)} tone={(e.vac ?? 0) < 0 ? "warn" : undefined} hint={`VAC ${money(e.vac, e.currency)} · TCPI ${e.tcpi ?? "—"}`} />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {showCost && project.budget && (
          <Card title="Earned value (5D)">
            <EvmChart data={evmSeries(project, ms, prog.records, costs, asOf)} bac={e.bac} />
            <div className="mt-2 flex gap-4 text-[11px] text-ink-3"><span><span className="mr-1 inline-block h-0.5 w-4 bg-ink-3 align-middle" />planned value</span><span><span className="mr-1 inline-block h-0.5 w-4 bg-ok align-middle" />earned value</span><span><span className="mr-1 inline-block h-0.5 w-4 bg-bad align-middle" />actual cost (ERP import, synthetic)</span></div>
          </Card>
        )}
        <Card title={`4D status — ${elements.length} model elements`} className="xl:col-span-2" actions={<Link href={`/app/twin?site=${elements[0]?.siteId ?? ""}&mode=4d`} className="btn btn-secondary h-8 text-xs">View in 3D twin</Link>}>
          <div className="mb-3 flex flex-wrap gap-2">{(["complete", "on_track", "ahead", "behind", "not_started"] as Status4D[]).map((k) => <Badge key={k} tone={TONE[k]}>{k.replace("_", " ")} {counts[k] ?? 0}</Badge>)}</div>
          {elements.length === 0 ? <p className="text-sm text-ink-2">No model elements for this project.</p> : (
            <div className="max-h-[360px] overflow-y-auto"><table className="table text-xs"><thead><tr><th>Element</th><th>Milestone</th><th>Planned window</th><th>Plan / built</th><th>Status</th>{showCost && <th>Budget</th>}</tr></thead><tbody>
              {rows.map((r) => <tr key={r.e.id}><td>{r.e.name}<div className="font-mono text-[10px] text-ink-3">{r.e.ifcClass} · {r.e.guid.slice(0, 10)}</div></td><td>{r.ms.name}</td>
                <td className="whitespace-nowrap font-mono">{r.plannedStart} → {r.plannedEnd}</td><td className="font-mono">{Math.round(r.planned * 100)}% / {Math.round(r.built * 100)}%</td>
                <td><Badge tone={TONE[r.status]}>{r.status.replace("_", " ")}</Badge></td>{showCost && <td className="font-mono">{money(r.e.budgetCost, r.e.currency)}</td>}</tr>)}
            </tbody></table></div>
          )}
        </Card>
        <Card title={`As-built deviation — ${out.length} of ${devs.length} outside ±${DEFAULT_TOLERANCE_M * 1000} mm`} className="xl:col-span-2" pad={false}>
          {devs.length === 0 ? <p className="p-5 text-sm text-ink-2">No as-built measurements yet.</p> : (
            <table className="table text-sm"><thead><tr><th>Element</th><th>Design top</th><th>Measured</th><th>Deviation</th><th>Source</th><th /></tr></thead><tbody>
              {devs.slice(0, 15).map((d) => <tr key={d.measurement.id}><td>{d.element.name}<div className="font-mono text-[10px] text-ink-3">{d.element.ifcClass}</div></td>
                <td className="font-mono text-xs">{d.element.topZ.toFixed(3)} m</td><td className="font-mono text-xs">{d.measurement.measuredTopZ.toFixed(3)} m</td>
                <td className={`font-mono text-xs ${d.withinTolerance ? "text-ok" : "text-bad"}`}>{d.deviationM > 0 ? "+" : ""}{Math.round(d.deviationM * 1000)} mm</td>
                <td className="text-xs">{d.measurement.method.replace("_", " ")}{d.measurement.synthetic && <Badge className="ml-1">synthetic</Badge>}</td>
                <td>{!d.withinTolerance && (d.measurement.findingId ? <span className="text-xs text-ok">Finding raised</span> : canRaise && <form action={raiseDeviationAction}><input type="hidden" name="id" value={d.measurement.id} /><button className="btn btn-ghost h-7 text-xs">Raise finding</button></form>)}</td></tr>)}
            </tbody></table>
          )}
        </Card>
      </div>
      <Card title="Model source" className="mt-6">
        <p className="text-sm text-ink-2">Elements are linked to milestones (4D) and carry budget (5D). This demo uses a seeded element set; <strong>IFC import</strong> (IFC2x3 / IFC4 via an IfcOpenShell / web-ifc processing service) and cost import from ERP (SAP, Oracle Primavera) are <Badge tone="accent">Integration Required</Badge>. As-built elevations here are synthetic survey-DSM samples.</p>
      </Card>
    </>
  );
}
