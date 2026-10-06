import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { PageHeader, Tabs, Kpi, Card, StatusBadge, Progress, Empty, SimulatedBadge } from "@/components/ui";
import { MapClient } from "@/components/MapClient";
import { SCurve } from "@/components/SCurve";
import { series } from "@/lib/progress";
import { fmtArea, fmtDate, fmtDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";

export default async function ProjectDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const p = repo.getProject(ctx, id);
  if (!p) notFound();
  const prog = repo.projectProgress(ctx, p.id);
  const sites = repo.listSites(ctx, p.id);
  const missions = can(ctx, "mission:read", p) ? repo.listMissions(ctx).filter((m) => m.projectId === p.id) : [];
  const findings = can(ctx, "inspection:read", p) ? repo.listFindings(ctx).filter((f) => f.projectId === p.id) : [];
  const media = repo.listMedia(ctx).filter((m) => m.projectId === p.id);
  const reports = repo.listReports(ctx).filter((r) => r.projectId === p.id);
  const team = db().projectMembers.filter((m) => m.projectId === p.id && m.organizationId === ctx.orgId);
  const next = prog.milestones.find((m) => m.actualPct < 100);
  const base = `/app/projects/${p.id}`;
  const tabs = [
    { key: "overview", label: "Overview", href: base }, { key: "sites", label: `Sites (${sites.length})`, href: `${base}?tab=sites` },
    { key: "progress", label: "Milestones & progress", href: `${base}?tab=progress` }, { key: "missions", label: `Missions (${missions.length})`, href: `${base}?tab=missions` },
    { key: "team", label: `Team (${team.length})`, href: `${base}?tab=team` }, { key: "reports", label: `Reports (${reports.length})`, href: `${base}?tab=reports` },
  ];
  const allPoints = sites.flatMap((s) => s.boundary);

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{p.code}</span>} title={p.name}
        subtitle={<>{p.clientName} · {p.type} · {fmtDate(p.startDate)} → {fmtDate(p.endDate)} · <StatusBadge status={p.status} /></>}
        actions={<>
          {can(ctx, "site:create", p) && <Link href={`${base}/sites/new`} className="btn btn-secondary">Add site</Link>}
          {can(ctx, "report:generate", p) && <Link href={`/app/reports?project=${p.id}`} className="btn btn-primary">Generate report</Link>}
        </>} />
      <Tabs items={tabs} active={tab} />

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Kpi label="Actual complete" value={`${prog.actualPct}%`} tone="accent" />
            <Kpi label="Planned" value={`${prog.plannedPct}%`} />
            <Kpi label="Schedule variance" value={`${prog.scheduleVariancePct > 0 ? "+" : ""}${prog.scheduleVariancePct}%`} tone={prog.status === "delayed" ? "bad" : prog.status === "at_risk" ? "warn" : "ok"} hint={prog.status.replace("_", " ")} />
            <Kpi label="Forecast completion" value={prog.forecastCompletion ? fmtDate(prog.forecastCompletion) : "—"} hint={`plan ${fmtDate(p.endDate)}`} />
            <Kpi label="Open findings" value={findings.filter((f) => !["closed", "verified", "resolved"].includes(f.status)).length} hint={`${media.length} media items`} />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card title="Sites" className="xl:col-span-2" pad={false}>
              {sites.length ? <MapClient height={360} fitTo={allPoints} data={{ sites: sites.map((s) => ({ id: s.id, name: s.name, boundary: s.boundary })), noFly: sites.flatMap((s) => s.noFlyZones),
                assets: repo.listAssets(ctx).filter((a) => a.projectId === p.id), findings: findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity, location: f.location })) }} />
                : <div className="p-5"><Empty title="No sites yet" body="Add a site and draw its boundary to anchor flights and data." /></div>}
            </Card>
            <Card title="Next milestone">
              {next ? <>
                <div className="font-medium">{next.milestone.name}</div>
                <div className="mt-1 text-xs text-ink-3">{fmtDate(next.milestone.plannedStart)} → {fmtDate(next.milestone.plannedEnd)} · weight {next.normalizedWeightPct}%</div>
                <div className="mt-3"><Progress value={next.actualPct} /></div>
                <div className="mt-1 flex justify-between font-mono text-xs text-ink-2"><span>{next.actualPct}%</span><span>plan {next.plannedPct}%</span></div>
                <div className="mt-3"><StatusBadge status={next.status} /></div>
              </> : <p className="text-sm text-ink-2">All milestones complete.</p>}
            </Card>
          </div>
          <Card title="Progress — S-curve" className="mt-6"><SCurve data={series(prog.milestonesList, prog.records, p.startDate, p.endDate, 14)} /></Card>
        </>
      )}

      {tab === "sites" && (
        sites.length === 0 ? <Empty title="No sites" action={can(ctx, "site:create", p) ? <Link href={`${base}/sites/new`} className="btn btn-primary">Add site</Link> : undefined} /> :
        <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Code</th><th>Name</th><th>Area</th><th>Address</th><th>Max altitude</th><th>Status</th></tr></thead><tbody>
          {sites.map((s) => <tr key={s.id}><td className="font-mono">{s.code}</td><td><Link href={`/app/sites/${s.id}`} className="hover:text-accent">{s.name}</Link></td><td className="font-mono">{fmtArea(s.areaM2)}</td><td className="text-ink-2">{s.address}</td><td className="font-mono">{s.maxAltitudeM} m</td><td><StatusBadge status={s.status} /></td></tr>)}
        </tbody></table></div>
      )}

      {tab === "progress" && (
        <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Milestone</th><th>Weight</th><th>Planned window</th><th className="w-48">Actual</th><th>Planned</th><th>Status</th></tr></thead><tbody>
          {prog.milestones.map((m) => <tr key={m.milestone.id}><td>{m.milestone.name}</td><td className="font-mono">{m.normalizedWeightPct}%</td><td className="text-xs text-ink-2">{fmtDate(m.milestone.plannedStart)} → {fmtDate(m.milestone.plannedEnd)}</td>
            <td><div className="flex items-center gap-2"><Progress value={m.actualPct} /><span className="w-12 text-right font-mono text-xs">{m.actualPct}%</span></div></td><td className="font-mono text-xs">{m.plannedPct}%</td><td><StatusBadge status={m.status} /></td></tr>)}
        </tbody></table>
        <div className="p-4"><Link href={`/app/progress?project=${p.id}`} className="btn btn-secondary">Record progress</Link></div></div>
      )}

      {tab === "missions" && (
        missions.length === 0 ? <Empty title="No missions" /> :
        <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Code</th><th>Mission</th><th>Scheduled</th><th>Status</th></tr></thead><tbody>
          {missions.map((m) => <tr key={m.id}><td className="font-mono text-xs">{m.code}</td><td><Link href={`/app/missions/${m.id}`} className="hover:text-accent">{m.name}</Link> {m.isSimulated && <SimulatedBadge />}</td><td className="text-xs text-ink-2">{fmtDateTime(m.scheduledStart, p.timezone)}</td><td><StatusBadge status={m.status} /></td></tr>)}
        </tbody></table></div>
      )}

      {tab === "team" && (
        <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Member</th><th>Project role</th></tr></thead><tbody>
          {team.map((m) => <tr key={m.userId}><td>{repo.userName(m.userId)}</td><td>{ROLE_LABELS[m.role]}</td></tr>)}
          <tr><td colSpan={2} className="text-xs text-ink-3">Owners and Admins have access to every project automatically.</td></tr>
        </tbody></table></div>
      )}

      {tab === "reports" && (
        reports.length === 0 ? <Empty title="No reports" /> :
        <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Report</th><th>Period</th><th>Version</th><th>Status</th></tr></thead><tbody>
          {reports.map((r) => <tr key={r.id}><td><Link href={`/app/reports/${r.id}`} className="hover:text-accent">{r.title}</Link></td><td className="text-xs text-ink-2">{fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}</td><td className="font-mono">v{r.version}</td><td><StatusBadge status={r.status} /></td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}
