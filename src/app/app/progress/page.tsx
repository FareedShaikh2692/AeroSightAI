import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Card, Kpi, StatusBadge, Progress, Empty } from "@/components/ui";
import { SCurve } from "@/components/SCurve";
import { series } from "@/lib/progress";
import { decideProgressAction } from "../actions";
import { RecordProgress } from "./RecordProgress";
import { fmtDate } from "@/lib/format";

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ project?: string; asOf?: string }> }) {
  const ctx = await requireContext();
  const projects = repo.listProjects(ctx);
  if (!projects.length) return <Empty title="No projects" />;
  const sp = await searchParams;
  const p = projects.find((x) => x.id === sp.project) ?? projects[0];
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(sp.asOf ?? "") ? sp.asOf! : new Date().toISOString().slice(0, 10);
  const prog = repo.projectProgress(ctx, p.id, asOf);
  const pending = prog.records.filter((r) => r.approvalStatus === "pending_approval");
  const canApprove = can(ctx, "progress:approve", p);
  const recent = [...prog.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  return (
    <>
      <PageHeader eyebrow="Data" title="Progress" subtitle="Weighted milestones and approved, evidence-backed records. The same calculation powers dashboards, the API and reports." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {projects.map((x) => <Link key={x.id} href={`/app/progress?project=${x.id}`} className={`rounded-full border px-3 py-1 text-xs ${x.id === p.id ? "border-accent text-accent" : "border-line text-ink-2 hover:text-ink"}`}>{x.name}</Link>)}
        <form className="ml-auto flex items-center gap-2"><input type="hidden" name="project" value={p.id} /><label className="text-xs text-ink-3" htmlFor="asOf">As of</label>
          <input id="asOf" type="date" name="asOf" defaultValue={asOf} className="input h-8 w-40" /><button className="btn btn-secondary h-8">Go</button></form>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Actual" value={`${prog.actualPct}%`} tone="accent" />
        <Kpi label="Planned" value={`${prog.plannedPct}%`} />
        <Kpi label="Variance" value={`${prog.scheduleVariancePct > 0 ? "+" : ""}${prog.scheduleVariancePct}%`} tone={prog.status === "delayed" ? "bad" : prog.status === "at_risk" ? "warn" : "ok"} hint={prog.status.replace("_", " ")} />
        <Kpi label="Forecast" value={prog.forecastCompletion ? fmtDate(prog.forecastCompletion) : "—"} hint={`plan ${fmtDate(p.endDate)}`} />
        <Kpi label="Delayed milestones" value={prog.milestonesDelayed} tone={prog.milestonesDelayed ? "bad" : undefined} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title="S-curve"><SCurve data={series(prog.milestonesList, prog.records, p.startDate, p.endDate, 14)} /></Card>
        {can(ctx, "progress:update", p) ? <Card title="Record progress"><RecordProgress projectId={p.id} milestones={prog.milestones.map((m) => ({ id: m.milestone.id, name: m.milestone.name, actual: m.actualPct }))} willAutoApprove={canApprove} /></Card>
          : <Card title="Record progress"><p className="text-sm text-ink-2">Your role can view progress but not record it.</p></Card>}
      </div>
      <Card title="Milestones" className="mt-6" pad={false}>
        <table className="table"><thead><tr><th>Milestone</th><th>Weight</th><th>Planned window</th><th className="w-56">Actual</th><th>Planned</th><th>Status</th></tr></thead><tbody>
          {prog.milestones.map((m) => <tr key={m.milestone.id}><td>{m.milestone.name}</td><td className="font-mono text-xs">{m.normalizedWeightPct}%</td>
            <td className="text-xs text-ink-2">{fmtDate(m.milestone.plannedStart)} → {fmtDate(m.milestone.plannedEnd)}</td>
            <td><div className="flex items-center gap-2"><Progress value={m.actualPct} tone={m.status === "delayed" ? "bad" : m.status === "at_risk" ? "warn" : "ok"} /><span className="w-12 text-right font-mono text-xs">{m.actualPct}%</span></div></td>
            <td className="font-mono text-xs">{m.plannedPct}%</td><td><StatusBadge status={m.status} /></td></tr>)}
        </tbody></table>
      </Card>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title={`Pending approval (${pending.length})`}>
          {pending.length === 0 ? <p className="text-sm text-ink-2">Nothing awaiting approval.</p> : (
            <ul className="space-y-3">{pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div><div>{prog.milestonesList.find((m) => m.id === r.milestoneId)?.name} → <span className="font-mono">{r.percentComplete}%</span></div>
                  <div className="text-xs text-ink-3">{fmtDate(r.recordDate)} · by {repo.userName(r.createdBy)} · {r.notes || "no notes"}</div></div>
                {canApprove && (
                  <div className="flex gap-1">
                    {(["approve", "reject"] as const).map((d) => (
                      <form key={d} action={decideProgressAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value={d} />
                        <button className={`btn h-8 px-3 text-xs ${d === "approve" ? "btn-primary" : "btn-danger"}`}>{d}</button></form>
                    ))}
                  </div>
                )}
              </li>
            ))}</ul>
          )}
        </Card>
        <Card title="Recent records">
          <ul className="space-y-2 text-sm">{recent.map((r) => (
            <li key={r.id} className="flex justify-between gap-3"><span className="truncate">{prog.milestonesList.find((m) => m.id === r.milestoneId)?.name}</span>
              <span className="flex shrink-0 items-center gap-2"><span className="font-mono text-xs">{r.percentComplete}%</span><StatusBadge status={r.approvalStatus === "pending_approval" ? "pending" : r.approvalStatus} /></span></li>
          ))}</ul>
          <p className="mt-3 text-xs text-ink-3">Approved records are immutable. Corrections are recorded as new entries.</p>
        </Card>
      </div>
    </>
  );
}
