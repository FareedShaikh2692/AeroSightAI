import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Empty, Forbidden, SimulatedBadge, StatusBadge, Card } from "@/components/ui";
import { LiveTelemetry } from "@/components/LiveTelemetry";
import { fmtDateTime } from "@/lib/format";

export default async function LiveOps({ searchParams }: { searchParams: Promise<{ mission?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "telemetry:read")) return <Forbidden perm="telemetry:read" />;
  const active = repo.listMissions(ctx).filter((m) => m.status === "in_progress" && can(ctx, "telemetry:read", m));
  const { mission: mid } = await searchParams;
  const sel = active.find((m) => m.id === mid) ?? active[0];
  const site = sel ? repo.getSite(ctx, sel.siteId) : null;
  const drones = can(ctx, "drone:read") ? repo.listDrones(ctx) : [];
  return (
    <>
      <PageHeader eyebrow="Operations" title="Live Operations" subtitle="Active flights in projects you can access. The pilot in command retains control of every aircraft." />
      {!sel || !site ? (
        <Empty title="No flights in progress" body="When a mission is started, its live position and telemetry appear here." action={<Link href="/app/missions" className="btn btn-secondary">Go to missions</Link>} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <Card title={`Active (${active.length})`} pad={false}>
            <ul>
              {active.map((m) => (
                <li key={m.id}>
                  <Link href={`/app/live?mission=${m.id}`} className={`block border-l-2 px-4 py-3 text-sm ${m.id === sel.id ? "border-accent bg-raised" : "border-transparent hover:bg-raised"}`}>
                    <div className="font-medium">{m.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-ink-3">{drones.find((d) => d.id === m.droneId)?.name ?? "Drone"} {m.isSimulated && <SimulatedBadge />}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <Link href={`/app/missions/${sel.id}`} className="font-semibold hover:text-accent">{sel.code}</Link>
              <StatusBadge status={sel.status} /><span className="text-ink-2">{site.name}</span>
              <span className="text-ink-3">started {fmtDateTime(sel.actualStart, site.timezone)}</span>
            </div>
            <LiveTelemetry missionId={sel.id} fitTo={site.boundary} data={{
              sites: [{ id: site.id, name: site.name, boundary: site.boundary }], noFly: site.noFlyZones,
              path: sel.waypoints.map((w) => [w.lng, w.lat]) }} />
            <p className="mt-3 text-xs text-ink-3">Live video requires a drone provider with live-video capability (Phase 2). Alerts: battery ≤ 30% / 20%, geofence breach, altitude limit, GPS degradation.</p>
          </div>
        </div>
      )}
    </>
  );
}
