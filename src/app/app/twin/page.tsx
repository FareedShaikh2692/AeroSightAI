import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Badge, Card, Empty, Forbidden } from "@/components/ui";
import { MapClient } from "@/components/MapClient";

export default async function Twin({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "twin:read")) return <Forbidden perm="twin:read" />;
  const sites = repo.listSites(ctx);
  const { site: siteId } = await searchParams;
  const site = sites.find((s) => s.id === siteId) ?? sites[0];
  if (!site) return <Empty title="No sites available" />;
  const assets = repo.listAssets(ctx, site.id);
  const findings = can(ctx, "inspection:read", site) ? repo.listFindings(ctx, { siteId: site.id }) : [];
  const flown = can(ctx, "mission:read", site) ? repo.listMissions(ctx, { siteId: site.id }).find((m) => m.status === "completed" || m.status === "in_progress") : undefined;
  return (
    <>
      <PageHeader eyebrow="3D Digital Twin" title={<span className="flex items-center gap-3">{site.name} <Badge tone="info">Beta</Badge></span>}
        subtitle="Extruded asset models over satellite imagery with terrain tilt. Photogrammetry meshes, BIM and point clouds stream in Phase 3." />
      <div className="mb-4 flex flex-wrap gap-2">
        {sites.map((s) => <Link key={s.id} href={`/app/twin?site=${s.id}`} className={`rounded-full border px-3 py-1 text-xs ${s.id === site.id ? "border-accent text-accent" : "border-line text-ink-2 hover:text-ink"}`}>{s.name}</Link>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <MapClient key={site.id} height={620} threeD initialBasemap="satellite" fitTo={site.boundary} data={{
          sites: [{ id: site.id, name: site.name, boundary: site.boundary }], noFly: site.noFlyZones, assets,
          findings: findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity, location: f.location })),
          path: flown?.waypoints.map((w) => [w.lng, w.lat] as [number, number]),
        }} />
        <div className="space-y-4">
          <Card title="Scene">
            <ul className="space-y-2 text-sm text-ink-2">
              <li>{assets.length} asset models (extruded by height)</li>
              <li>{findings.length} inspection markers</li>
              <li>{flown ? `Flight path ${flown.code}` : "No flight path yet"}</li>
              <li>{site.noFlyZones.length} no-fly zone(s)</li>
            </ul>
          </Card>
          <Card title="Navigation">
            <p className="text-xs text-ink-2">Right-drag or Ctrl+drag to rotate and tilt. Scroll to zoom. Use the compass to reset north. If your device lacks WebGL, use the 2D site map.</p>
            <Link href={`/app/sites/${site.id}`} className="btn btn-secondary mt-3 w-full justify-center">Open 2D site map</Link>
          </Card>
        </div>
      </div>
    </>
  );
}
