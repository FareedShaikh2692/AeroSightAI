import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { series } from "@/lib/progress";
import { PageHeader, Badge, Empty, Forbidden } from "@/components/ui";
import { MapClient } from "@/components/MapClient";
import { Twin3D, type TwinData } from "@/components/Twin3D";
import { saveViewpointAction } from "./actions";
import type { Asset, LngLat } from "@/lib/types";

/** Assets without a surveyed footprint get a square sized by type around their location. */
function footprint(a: Asset): LngLat[] {
  if (a.footprint?.length) return a.footprint;
  const half = (a.type === "building" || a.type === "tower" ? 14 : a.type === "tank" ? 9 : 6) / 2;
  const dLat = half / 110_540, dLng = half / (111_320 * Math.cos((a.location[1] * Math.PI) / 180));
  const [x, y] = a.location;
  return [[x - dLng, y - dLat], [x + dLng, y - dLat], [x + dLng, y + dLat], [x - dLng, y + dLat], [x - dLng, y - dLat]];
}

export default async function Twin({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "twin:read")) return <Forbidden perm="twin:read" />;
  const sites = repo.listSites(ctx);
  const { site: siteId } = await searchParams;
  const site = sites.find((s) => s.id === siteId) ?? sites[0];
  if (!site) return <Empty title="No sites available" />;
  const assets = repo.listAssets(ctx, site.id);
  const findings = can(ctx, "inspection:read", site) ? repo.listFindings(ctx, { siteId: site.id }) : [];
  const missions = can(ctx, "mission:read", site) ? repo.listMissions(ctx, { siteId: site.id }) : [];
  const flown = missions.filter((m) => m.status === "completed").sort((a, b) => (b.actualEnd ?? "").localeCompare(a.actualEnd ?? ""))[0];
  const planned = missions.find((m) => ["ready", "approved", "planned"].includes(m.status)) ?? flown;
  const live = can(ctx, "telemetry:read", site) ? missions.find((m) => m.status === "in_progress" || m.status === "paused") : undefined;
  const project = repo.getProject(ctx, site.projectId);
  const prog = project && can(ctx, "progress:read", project) ? repo.projectProgress(ctx, project.id) : null;
  const today = new Date().toISOString().slice(0, 10);
  const timeline = project && prog
    ? series(prog.milestonesList, prog.records, project.startDate, project.endDate < today ? project.endDate : today, 14).filter((p) => p.actualPct !== null).map((p) => ({ date: p.date, pct: p.actualPct ?? 0 }))
    : [{ date: today, pct: 100 }];
  const viewpoints = db().viewpoints.filter((v) => v.organizationId === ctx.orgId && v.siteId === site.id && (v.createdBy === ctx.userId || v.visibility === "project"))
    .map((v) => ({ id: v.id, name: v.name, camera: v.camera, mine: v.createdBy === ctx.userId }));
  const path = (m?: typeof flown) => m && m.waypoints.length ? { code: m.code, points: m.waypoints.map((w) => [w.lng, w.lat, w.altM] as [number, number, number]) } : undefined;
  const data: TwinData = {
    boundary: site.boundary, noFly: site.noFlyZones.map((z) => ({ name: z.name, geometry: z.geometry })),
    assets: assets.map((a) => ({ id: a.id, name: a.name, type: a.type, tag: a.tag, heightM: a.heightM, footprint: footprint(a), conditionRating: a.conditionRating, status: a.status })),
    findings: findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity, status: f.status, location: f.location })),
    planned: planned && planned !== flown ? path(planned) : undefined, flown: path(flown),
    live: live ? { missionId: live.id, code: live.code, drone: db().drones.find((d) => d.id === live.droneId)?.name ?? "Drone" } : undefined,
    timeline,
  };
  return (
    <>
      <PageHeader eyebrow="3D Digital Twin" title={<span className="flex items-center gap-3">{site.name} <Badge tone="info">Beta</Badge></span>}
        subtitle="Asset models that grow with approved progress, synthetic point cloud, flight paths, findings and live drones in a 3D globe." />
      <div className="mb-4 flex flex-wrap gap-2">
        {sites.map((s) => <Link key={s.id} href={`/app/twin?site=${s.id}`} className={`rounded-full border px-3 py-1 text-xs ${s.id === site.id ? "border-accent text-accent" : "border-line text-ink-2 hover:text-ink"}`}>{s.name}</Link>)}
      </div>
      <Twin3D key={site.id} data={data} viewpoints={viewpoints} onSaveViewpoint={saveViewpointAction.bind(null, site.id)}
        fallback={<MapClient height={560} initialBasemap="satellite" fitTo={site.boundary} data={{
          sites: [{ id: site.id, name: site.name, boundary: site.boundary }], noFly: site.noFlyZones, assets,
          findings: findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity, location: f.location })),
          path: flown?.waypoints.map((w) => [w.lng, w.lat] as [number, number]),
        }} />} />
    </>
  );
}
