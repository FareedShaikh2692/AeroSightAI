import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, StatusBadge, Empty, SimulatedBadge, Forbidden } from "@/components/ui";
import { fmtDateTime, fmtDuration } from "@/lib/format";

const GROUPS: [string, string[]][] = [
  ["In progress", ["in_progress", "paused"]],
  ["Upcoming", ["draft", "planned", "pending_approval", "approved", "ready", "rejected"]],
  ["History", ["completed", "aborted", "failed", "cancelled"]],
];

export default async function Missions({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "mission:read")) return <Forbidden perm="mission:read" />;
  const { mine } = await searchParams;
  const missions = repo.listMissions(ctx, { mine: mine === "1" });
  const sites = new Map(repo.listSites(ctx).map((s) => [s.id, s]));
  const drones = new Map(repo.listDrones(ctx).map((d) => [d.id, d]));
  const pilots = new Map(repo.listPilots(ctx).map((p) => [p.id, p]));
  return (
    <>
      <PageHeader eyebrow="Operations" title="Missions" subtitle="Plan, approve, fly and record drone flights."
        actions={<>
          <Link href={mine === "1" ? "/app/missions" : "/app/missions?mine=1"} className="btn btn-secondary">{mine === "1" ? "All missions" : "My missions"}</Link>
          {can(ctx, "mission:create") && <Link href="/app/missions/new" className="btn btn-primary">New mission</Link>}
        </>} />
      {missions.length === 0 ? <Empty title="No missions" body={mine ? "No missions are assigned to you." : "Plan a mission from a site."} /> : GROUPS.map(([title, statuses]) => {
        const rows = missions.filter((m) => statuses.includes(m.status));
        if (!rows.length) return null;
        const ordered = title === "Upcoming" ? [...rows].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)) : rows;
        return (
          <section key={title} className="mb-8">
            <h2 className="mb-2 text-sm font-semibold text-ink-2">{title} <span className="text-ink-3">({rows.length})</span></h2>
            <div className="card overflow-x-auto"><table className="table">
              <thead><tr><th>Mission</th><th>Site</th><th>Scheduled</th><th>Drone · Pilot</th><th>Estimate</th><th>Status</th></tr></thead>
              <tbody>
                {ordered.map((m) => {
                  const s = sites.get(m.siteId);
                  return (
                    <tr key={m.id}>
                      <td><Link href={`/app/missions/${m.id}`} className="hover:text-accent">{m.name}</Link><div className="font-mono text-[11px] text-ink-3">{m.code} · {m.template}</div></td>
                      <td className="text-ink-2">{s?.name}</td>
                      <td className="whitespace-nowrap text-xs">{fmtDateTime(m.scheduledStart, s?.timezone)}</td>
                      <td className="text-xs text-ink-2">{drones.get(m.droneId ?? "")?.name ?? "—"} · {pilots.get(m.pilotId ?? "")?.fullName ?? "—"}</td>
                      <td className="font-mono text-xs">{fmtDuration(m.estimates.durationS)} · {m.estimates.photoCount} photos</td>
                      <td><div className="flex gap-1.5">{m.isSimulated && <SimulatedBadge />}<StatusBadge status={m.status} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </section>
        );
      })}
    </>
  );
}
