import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { PageHeader, Card, Badge, Forbidden } from "@/components/ui";
import { listSchedules } from "@/lib/schedules";
import { flightWeather } from "@/lib/weather";
import { WeatherSummary } from "@/components/WeatherBadge";
import { fmtDateTime } from "@/lib/format";
import { ScheduleForm, RunNow } from "./ScheduleForms";
import { toggleScheduleAction } from "./actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function Schedules() {
  const ctx = await requireContext();
  if (!can(ctx, "mission:read")) return <Forbidden perm="mission:read" />;
  const sites = repo.listSites(ctx);
  const schedules = listSchedules(ctx).filter((s) => sites.some((x) => x.id === s.siteId));
  const withWeather = await Promise.all(schedules.map(async (s) => {
    const site = sites.find((x) => x.id === s.siteId)!;
    return { s, site, w: s.enabled ? await flightWeather(site.centroid[0], site.centroid[1], s.nextRunAt) : null,
      generated: db().missions.filter((m) => m.scheduleId === s.id).sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart)).slice(0, 3) };
  }));
  const canCreate = can(ctx, "mission:create");
  const templates = repo.listMissions(ctx).filter((m) => m.area && ["completed", "approved", "ready", "planned"].includes(m.status) && !m.scheduleId && can(ctx, "mission:create", m))
    .map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }));
  return (
    <>
      <PageHeader eyebrow="Operations" title={<span className="flex items-center gap-3">Capture Schedules <Badge tone="info">Beta</Badge></span>}
        subtitle="Automated site intelligence: recurring flights are generated ahead of time with a weather go/no-go, and completed captures are analyzed automatically." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          {withWeather.length === 0 && <Card title="No schedules"><p className="text-sm text-ink-2">Create one to capture a site on a regular cadence.</p></Card>}
          {withWeather.map(({ s, site, w, generated }) => (
            <Card key={s.id} title={s.name} actions={s.enabled ? <Badge tone="ok">active</Badge> : <Badge>paused</Badge>}>
              <dl className="grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
                <dt className="text-ink-3">Site</dt><dd><Link href={`/app/sites/${site.id}`} className="hover:text-accent">{site.name}</Link></dd>
                <dt className="text-ink-3">Cadence</dt><dd className="capitalize">{s.cadence}{s.cadence === "weekly" || s.cadence === "biweekly" ? ` · ${DAYS[s.weekday]}` : s.cadence === "monthly" ? ` · day ${s.weekday}` : ""} {s.timeLocal}</dd>
                <dt className="text-ink-3">Next flight</dt><dd>{fmtDateTime(s.nextRunAt, site.timezone)}</dd>
                <dt className="text-ink-3">Automation</dt><dd className="text-xs">{[s.weatherGate && "weather gate", s.autoAnalyze && "auto-analysis"].filter(Boolean).join(" · ") || "—"}</dd>
              </dl>
              <div className="mt-3"><div className="mb-1 text-[11px] uppercase tracking-wide text-ink-3">Flight weather at next run</div><WeatherSummary w={w} /></div>
              {s.lastResult && <p className="mt-3 text-xs text-ink-2">Last run: {s.lastResult}</p>}
              {generated.length > 0 && <p className="mt-2 text-xs">Generated: {generated.map((m) => <Link key={m.id} href={`/app/missions/${m.id}`} className="mr-2 font-mono text-accent hover:underline">{m.code}</Link>)}</p>}
              {canCreate && <div className="mt-3 flex flex-wrap items-start gap-2"><RunNow id={s.id} />
                <form action={toggleScheduleAction}><input type="hidden" name="id" value={s.id} /><button className="btn btn-ghost h-7 text-xs">{s.enabled ? "Pause" : "Resume"}</button></form></div>}
            </Card>
          ))}
          <p className="text-xs text-ink-3">A daily job generates each flight up to 36 hours ahead. A pilot completes the checklist and starts it; fully autonomous dock launches require a dock provider integration (DJI Dock, Skydio Dock — Integration Required). Weather: Open-Meteo forecast, wind scaled to flight altitude; limits wind 10 m/s, gusts 12 m/s, rain 0.3 mm/h.</p>
        </div>
        {canCreate && <Card title="New schedule"><ScheduleForm templates={templates}
          drones={repo.listDrones(ctx).filter((d) => d.status !== "retired").map((d) => ({ value: d.id, label: d.name }))}
          pilots={repo.listPilots(ctx).map((p) => ({ value: p.id, label: p.fullName }))} /></Card>}
      </div>
    </>
  );
}
