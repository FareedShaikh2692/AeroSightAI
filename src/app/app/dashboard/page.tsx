import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Kpi, Card, StatusBadge, Progress, Empty, SimulatedBadge } from "@/components/ui";
import { MapClient } from "@/components/MapClient";
import { fmtDateTime, fmtBytes, relTime } from "@/lib/format";
import { db } from "@/lib/store";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const ctx = await requireContext();
  const { welcome } = await searchParams;
  const user = repo.currentUser(ctx);
  const projects = repo.listProjects(ctx);
  const progress = projects.map((p) => ({ p, prog: repo.projectProgress(ctx, p.id) }));
  const missions = can(ctx, "mission:read") ? repo.listMissions(ctx) : [];
  const findings = can(ctx, "inspection:read") ? repo.listFindings(ctx) : [];
  const media = repo.listMedia(ctx);
  const openCritical = findings.filter((f) => ["open", "in_progress"].includes(f.status) && (f.severity === "critical" || f.severity === "high"));
  const portfolio = progress.length ? progress.reduce((s, x) => s + x.prog.actualPct, 0) / progress.length : 0;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const flightsWeek = missions.filter((m) => m.actualStart && Date.parse(m.actualStart) > weekAgo).length;
  const upcoming = missions.filter((m) => ["planned", "approved", "ready", "pending_approval"].includes(m.status)).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)).slice(0, 5);
  const pending = progress.reduce((s, x) => s + x.prog.pendingApprovals, 0);
  const atRisk = progress.flatMap((x) => x.prog.milestones.filter((m) => m.status === "delayed").map((m) => ({ project: x.p, m })));
  const pilots = can(ctx, "drone:read") ? repo.listPilots(ctx) : [];
  const drones = can(ctx, "drone:read") ? repo.listDrones(ctx) : [];
  const expiring = [
    ...drones.filter((d) => Date.parse(d.registrationExpiresAt) - Date.now() < 30 * 86_400_000).map((d) => `${d.name} registration expires ${d.registrationExpiresAt}`),
    ...pilots.filter((p) => Date.parse(p.licenseExpiresAt) - Date.now() < 30 * 86_400_000).map((p) => `${p.fullName}'s license expires ${p.licenseExpiresAt}`),
  ];
  const storage = db().media.filter((m) => m.organizationId === ctx.orgId).reduce((s, m) => s + m.sizeBytes, 0);
  const sites = repo.listSites(ctx);

  return (
    <>
      <PageHeader eyebrow="Dashboard" title={`Good to see you, ${user.fullName.split(" ")[0]}`} subtitle="Portfolio status across the projects you can access."
        actions={can(ctx, "project:create") ? <Link href="/app/projects/new" className="btn btn-primary">New project</Link> : undefined} />
      {welcome && projects.length === 0 && (
        <Card title="Getting started" className="mb-6">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
            <li><Link href="/app/projects/new" className="text-accent hover:underline">Create your first project</Link> and draw a site boundary.</li>
            <li><Link href="/app/fleet" className="text-accent hover:underline">Register a drone</Link> (choose “Simulator” to try live operations).</li>
            <li><Link href="/app/team" className="text-accent hover:underline">Invite your team</Link> with the right roles.</li>
          </ol>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Active projects" value={projects.filter((p) => p.status === "active").length} hint={`${sites.length} sites`} />
        <Kpi label="Portfolio complete" value={`${portfolio.toFixed(1)}%`} hint="weighted, approved records" tone="accent" />
        <Kpi label="Flights · 7 days" value={flightsWeek} hint={`${missions.filter((m) => m.status === "in_progress").length} in progress`} />
        <Kpi label="Open critical/high" value={openCritical.length} tone={openCritical.length ? "bad" : "ok"} hint="findings" />
        <Kpi label="Media stored" value={fmtBytes(storage)} hint={`${media.length} items visible to you`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Portfolio map" className="xl:col-span-2" pad={false}>
          <MapClient height={380} fitTo={projects.map((p) => p.location)}
            data={{ pins: progress.map(({ p, prog }) => ({ id: p.id, label: `${p.name} — ${prog.actualPct}%`, location: p.location, href: `/app/projects/${p.id}`,
              color: prog.status === "delayed" ? "#F87171" : prog.status === "at_risk" ? "#FBBF24" : "#34D399" })),
              sites: sites.map((s) => ({ id: s.id, name: s.name, boundary: s.boundary })) }} />
        </Card>
        <Card title="Needs attention">
          {openCritical.length + pending + atRisk.length + expiring.length === 0 ? <p className="text-sm text-ink-2">Nothing needs your attention right now.</p> : (
            <ul className="space-y-3 text-sm">
              {openCritical.slice(0, 4).map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3"><Link href={`/app/inspections/${f.inspectionId}`} className="hover:text-accent">{f.title}</Link><StatusBadge status={f.severity} /></li>
              ))}
              {pending > 0 && <li><Link href="/app/progress" className="text-warn hover:underline">{pending} progress record(s) awaiting approval</Link></li>}
              {atRisk.slice(0, 3).map(({ project, m }) => <li key={m.milestone.id} className="text-ink-2"><span className="text-bad">Delayed:</span> {m.milestone.name} · {project.code}</li>)}
              {expiring.map((x) => <li key={x} className="text-ink-2"><span className="text-warn">Expiring:</span> {x}</li>)}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Projects">
          {progress.length === 0 ? <Empty title="No projects yet" body="Projects you create or are added to appear here." /> : (
            <div className="space-y-4">
              {progress.map(({ p, prog }) => (
                <Link key={p.id} href={`/app/projects/${p.id}`} className="block rounded-lg p-2 hover:bg-raised">
                  <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{p.name}</span><StatusBadge status={prog.status} /></div>
                  <div className="mt-2"><Progress value={prog.actualPct} tone={prog.status === "delayed" ? "bad" : prog.status === "at_risk" ? "warn" : "ok"} /></div>
                  <div className="mt-1 flex justify-between font-mono text-xs text-ink-2"><span>{prog.actualPct}% actual</span><span>{prog.plannedPct}% planned</span></div>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card title="Upcoming missions" actions={<Link href="/app/missions" className="text-xs text-accent">All missions</Link>}>
          {upcoming.length === 0 ? <p className="text-sm text-ink-2">No upcoming missions.</p> : (
            <ul className="divide-y divide-line text-sm">
              {upcoming.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><Link href={`/app/missions/${m.id}`} className="block truncate hover:text-accent">{m.name}</Link><div className="text-xs text-ink-3">{fmtDateTime(m.scheduledStart)} · {m.code}</div></div>
                  <div className="flex shrink-0 gap-1.5">{m.isSimulated && <SimulatedBadge />}<StatusBadge status={m.status} /></div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 text-xs text-ink-3">Latest capture: {media[0] ? relTime(media[0].capturedAt) : "—"}</div>
        </Card>
      </div>
    </>
  );
}
