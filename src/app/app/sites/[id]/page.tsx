import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Card, StatusBadge, Kpi, Badge } from "@/components/ui";
import { MapClient } from "@/components/MapClient";
import { fmtArea, fmtDate, fmtDateTime } from "@/lib/format";

export default async function SiteDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  const site = repo.getSite(ctx, id);
  if (!site) notFound();
  const project = repo.getProject(ctx, site.projectId)!;
  const assets = repo.listAssets(ctx, site.id);
  const missions = can(ctx, "mission:read", site) ? repo.listMissions(ctx, { siteId: site.id }) : [];
  const findings = can(ctx, "inspection:read", site) ? repo.listFindings(ctx, { siteId: site.id }) : [];
  const media = repo.listMedia(ctx, { siteId: site.id });
  const surveys = repo.listSurveys(ctx, site.id);

  // Site timeline (SITE-009): group events by day
  const events = [
    ...missions.filter((m) => m.actualStart).map((m) => ({ at: m.actualStart!, text: `Flight ${m.code} — ${m.status.replace("_", " ")}`, href: `/app/missions/${m.id}` })),
    ...surveys.map((s) => ({ at: `${s.captureDate}T09:00:00Z`, text: `Survey capture: ${s.type} (${s.status})`, href: "/app/surveys" })),
    ...findings.map((f) => ({ at: f.createdAt, text: `Finding ${f.code}: ${f.title}`, href: `/app/inspections/${f.inspectionId}` })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);

  return (
    <>
      <PageHeader eyebrow={<Link href={`/app/projects/${project.id}`} className="hover:text-accent">{project.name}</Link>} title={site.name}
        subtitle={`${site.code} · ${site.address} · ${fmtArea(site.areaM2)} · max altitude ${site.maxAltitudeM} m · geofence buffer ${site.geofenceBufferM} m`}
        actions={<>
          {can(ctx, "twin:read", site) && <Link href={`/app/twin?site=${site.id}`} className="btn btn-secondary">Open in 3D</Link>}
          {can(ctx, "mission:create", site) && <Link href={`/app/missions/new?site=${site.id}`} className="btn btn-primary">Plan mission</Link>}
        </>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Assets" value={assets.length} />
        <Kpi label="Missions" value={missions.length} hint={`${missions.filter((m) => m.status === "completed").length} completed`} />
        <Kpi label="Media" value={media.length} />
        <Kpi label="Open findings" value={findings.filter((f) => ["open", "in_progress"].includes(f.status)).length} tone={findings.some((f) => f.severity === "critical" && f.status === "open") ? "bad" : undefined} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card pad={false} className="xl:col-span-2">
          <MapClient height={520} fitTo={site.boundary} initialBasemap="satellite" data={{
            sites: [{ id: site.id, name: site.name, boundary: site.boundary }], noFly: site.noFlyZones, assets,
            findings: findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity, location: f.location })),
            media: media.map((m) => ({ id: m.id, filename: m.filename, location: m.location })),
          }} />
          <div className="flex flex-wrap gap-3 border-t border-line px-4 py-2 text-xs text-ink-2">
            <span><span className="text-data">▬</span> Boundary</span><span><span className="text-bad">■</span> No-fly zone</span><span>● Asset</span>
            <span><span className="text-[#A78BFA]">●</span> Media capture</span><span><span className="text-bad">●</span>/<span className="text-warn">●</span> Findings by severity</span>
          </div>
        </Card>
        <Card title="Site timeline">
          {events.length === 0 ? <p className="text-sm text-ink-2">No activity yet.</p> : (
            <ol className="space-y-3 border-l border-line pl-4 text-sm">
              {events.map((e, i) => <li key={i}><div className="text-xs text-ink-3">{fmtDateTime(e.at, site.timezone)}</div><Link href={e.href} className="hover:text-accent">{e.text}</Link></li>)}
            </ol>
          )}
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title={`Assets (${assets.length})`} pad={false}>
          <table className="table"><thead><tr><th>Tag</th><th>Asset</th><th>Type</th><th>Condition</th></tr></thead><tbody>
            {assets.map((a) => <tr key={a.id}><td className="font-mono text-xs">{a.tag}</td><td>{a.name}</td><td className="text-ink-2">{a.type.replace("_", " ")}</td><td><Badge tone={a.conditionRating >= 4 ? "ok" : a.conditionRating === 3 ? "warn" : "bad"}>{a.conditionRating}/5</Badge></td></tr>)}
          </tbody></table>
        </Card>
        <Card title={`Surveys (${surveys.length})`} pad={false}>
          <table className="table"><thead><tr><th>Capture</th><th>Type</th><th>GSD</th><th>Status</th></tr></thead><tbody>
            {surveys.map((s) => <tr key={s.id}><td>{fmtDate(s.captureDate)}</td><td className="text-ink-2">{s.type}</td><td className="font-mono text-xs">{s.gsdCm.toFixed(1)} cm/px</td><td><StatusBadge status={s.status} /></td></tr>)}
          </tbody></table>
        </Card>
      </div>
    </>
  );
}
