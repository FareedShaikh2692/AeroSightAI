import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Forbidden, Empty } from "@/components/ui";
import { MissionPlanner } from "./MissionPlanner";

export default async function NewMission({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "mission:create")) return <Forbidden perm="mission:create" />;
  const { site } = await searchParams;
  const sites = repo.listSites(ctx).filter((s) => can(ctx, "mission:create", s));
  if (!sites.length) return <Empty title="No sites available" body="You need mission:create on at least one project with a site." />;
  const today = new Date().toISOString().slice(0, 10);
  const drones = repo.listDrones(ctx).map((d) => ({ id: d.id, label: `${d.name} · ${d.model}${d.providerKey === "simulator" ? " (Simulated)" : ""}`, disabled: d.status === "maintenance" || d.status === "retired" || d.registrationExpiresAt < today, status: d.status }));
  const pilots = repo.listPilots(ctx).map((p) => ({ id: p.id, label: `${p.fullName} · ${p.licenseType}`, disabled: p.licenseExpiresAt < today }));
  return (
    <>
      <PageHeader eyebrow="Missions" title="Plan a mission" subtitle="Draw the capture area; waypoints and estimates are generated and validated on the server." />
      <MissionPlanner sites={sites.map((s) => ({ id: s.id, name: s.name, boundary: s.boundary, noFlyZones: s.noFlyZones, maxAltitudeM: s.maxAltitudeM, centroid: s.centroid }))}
        initialSiteId={sites.find((s) => s.id === site)?.id ?? sites[0].id} drones={drones} pilots={pilots} />
    </>
  );
}
