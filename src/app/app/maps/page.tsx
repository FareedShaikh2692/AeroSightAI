import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Empty } from "@/components/ui";
import { MapsWorkspace } from "./MapsWorkspace";

export default async function Maps({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const ctx = await requireContext();
  const sites = repo.listSites(ctx);
  if (!sites.length) return <Empty title="No sites to map" />;
  const { site: sid } = await searchParams;
  const site = sites.find((s) => s.id === sid) ?? sites[0];
  const missions = can(ctx, "mission:read", site) ? repo.listMissions(ctx, { siteId: site.id }) : [];
  const flown = missions.find((m) => m.status === "completed");
  return (
    <>
      <PageHeader eyebrow="Work" title="Maps" subtitle="Layers, measurement and comparison for a site." />
      <div className="mb-4 flex flex-wrap gap-2">
        {sites.map((s) => <Link key={s.id} href={`/app/maps?site=${s.id}`} className={`rounded-full border px-3 py-1 text-xs ${s.id === site.id ? "border-accent text-accent" : "border-line text-ink-2 hover:text-ink"}`}>{s.name}</Link>)}
      </div>
      <MapsWorkspace key={site.id} site={{ id: site.id, name: site.name, boundary: site.boundary, noFlyZones: site.noFlyZones }}
        assets={repo.listAssets(ctx, site.id)}
        findings={can(ctx, "inspection:read", site) ? repo.listFindings(ctx, { siteId: site.id }).map((f) => ({ id: f.id, title: f.title, severity: f.severity, location: f.location })) : []}
        media={repo.listMedia(ctx, { siteId: site.id }).map((m) => ({ id: m.id, filename: m.filename, location: m.location }))}
        path={flown?.waypoints.map((w) => [w.lng, w.lat] as [number, number]) ?? []} />
    </>
  );
}
