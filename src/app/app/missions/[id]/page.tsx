import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can, restriction } from "@/lib/policy";
import { availableActions } from "@/lib/mission";
import { db } from "@/lib/store";
import { PageHeader, Card, StatusBadge, SimulatedBadge } from "@/components/ui";
import { MapClient } from "@/components/MapClient";
import { LiveTelemetry } from "@/components/LiveTelemetry";
import { MissionActions } from "./MissionActions";
import { flightWeather } from "@/lib/weather";
import { WeatherSummary } from "@/components/WeatherBadge";
import { checklistAction } from "../../actions";
import { fmtDateTime, fmtDuration } from "@/lib/format";
import type { Permission } from "@/lib/permissions";
import { MediaThumb } from "@/components/MediaThumb";

const STEPS = ["draft", "planned", "pending_approval", "approved", "ready", "in_progress", "completed"];
const PERM: Record<string, Permission> = { plan: "mission:update", submit: "mission:update", revise: "mission:update", markReady: "mission:update", cancel: "mission:update",
  approve: "mission:approve", reject: "mission:approve", start: "mission:start", pause: "mission:start", resume: "mission:start", stop: "mission:start", abort: "mission:abort", rth: "mission:start" };

export default async function MissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  const m = repo.getMission(ctx, id);
  if (!m) notFound();
  const site = repo.getSite(ctx, m.siteId)!;
  const drone = db().drones.find((d) => d.id === m.droneId);
  const pilot = db().pilots.find((p) => p.id === m.pilotId);
  const isAssignedPilot = pilot?.userId === ctx.userId;
  const live = m.status === "in_progress" || m.status === "paused";
  const channel = live ? repo.commandChannel(ctx, m) : undefined;
  const actions = availableActions(m.status).filter((a) => a !== "rth" || (channel?.mode === "provider" && !m.control?.rthAt)).filter((a) => a !== "pause" || !m.control?.rthAt).map((a) => {
    const perm = PERM[a];
    let allowed = can(ctx, perm, m);
    let why = allowed ? undefined : `Requires ${perm}`;
    if (allowed && restriction(ctx, perm, m.projectId) === "A" && !isAssignedPilot) { allowed = false; why = "Only the assigned pilot can do this"; }
    return { action: a, allowed, why };
  });
  const canChecklist = can(ctx, "mission:start", m) && (restriction(ctx, "mission:start", m.projectId) !== "A" || isAssignedPilot) && ["planned", "approved", "ready"].includes(m.status);
  const events = repo.missionEvents(ctx, m.id);
  const upcoming = ["draft", "planned", "pending_approval", "approved", "ready"].includes(m.status);
  const weather = upcoming ? await flightWeather(site.centroid[0], site.centroid[1], m.scheduledStart, m.params.altitudeM) ?? m.weather ?? null : m.weather ?? null;
  const media = repo.listMedia(ctx, { missionId: m.id });
  const stepIdx = STEPS.indexOf(m.status);

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{m.code}</span>} title={<span className="flex flex-wrap items-center gap-3">{m.name} {m.isSimulated && <SimulatedBadge />}</span>}
        subtitle={<><Link href={`/app/sites/${site.id}`} className="hover:text-accent">{site.name}</Link> · {m.type} · {m.template} template · scheduled {fmtDateTime(m.scheduledStart, site.timezone)}</>}
        actions={<><a href={`/api/v1/missions/${m.id}/export?format=kml`} className="btn btn-secondary">Export KML</a><StatusBadge status={m.status} /></>} />

      <ol className="mb-6 flex flex-wrap gap-1 text-[11px]" aria-label="Mission lifecycle">
        {STEPS.map((s, i) => <li key={s} className={`rounded-full px-2.5 py-1 ${s === m.status ? "bg-accent text-accent-ink" : i < stepIdx ? "bg-ok/15 text-ok" : "bg-white/5 text-ink-3"}`}>{s.replace("_", " ")}</li>)}
        {["aborted", "rejected", "cancelled", "paused"].includes(m.status) && <li className="rounded-full bg-bad/15 px-2.5 py-1 text-bad">{m.status}</li>}
      </ol>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {live ? (
            <Card title="Live flight"><LiveTelemetry missionId={m.id} fitTo={site.boundary} height={460} compact
              data={{ sites: [{ id: site.id, name: site.name, boundary: site.boundary }], noFly: site.noFlyZones, path: m.waypoints.map((w) => [w.lng, w.lat]) }} /></Card>
          ) : (
            <Card title="Flight plan" pad={false}>
              <MapClient height={460} fitTo={site.boundary} initialBasemap="satellite" data={{ sites: [{ id: site.id, name: site.name, boundary: site.boundary }], noFly: site.noFlyZones,
                area: m.area, path: m.waypoints.map((w) => [w.lng, w.lat]), waypoints: m.waypoints.map((w) => ({ seq: w.seq, lng: w.lng, lat: w.lat })) }} />
            </Card>
          )}
          {media.length > 0 && (
            <Card title={`Captured media (${media.length})`}>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{media.map((x) => <MediaThumb key={x.id} media={x} />)}</div>
            </Card>
          )}
          <Card title="Events">
            <ul className="space-y-2 text-sm">{events.map((e) => <li key={e.id} className="flex gap-3"><span className="w-32 shrink-0 text-xs text-ink-3">{fmtDateTime(e.at, site.timezone)}</span><span>{e.text} <span className="text-ink-3">· {repo.userName(e.actorId)}</span></span></li>)}</ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Actions"><MissionActions id={m.id} actions={actions} checklistDone={m.checklist.every((c) => c.checked)} channel={channel} />
            {m.control?.rthAt && <p className="mt-3 text-sm text-warn">Return-to-home commanded — the drone is flying back to the launch point. Complete the mission once it has landed.</p>}
            {m.rejectionReason && <p className="mt-3 text-sm text-bad">Rejected: {m.rejectionReason}</p>}
            {m.abortReason && <p className="mt-3 text-sm text-bad">Aborted: {m.abortReason}</p>}
          </Card>
          {(upcoming || m.weather) && <Card title="Flight weather"><WeatherSummary w={weather} />
            {m.scheduleId && <p className="mt-2 text-[11px] text-ink-3">Generated by a capture schedule.</p>}</Card>}
          <Card title="Pre-flight checklist">
            <ul className="space-y-2">
              {m.checklist.map((c) => (
                <li key={c.id}>
                  <form action={checklistAction} className="flex items-center gap-2 text-sm">
                    <input type="hidden" name="id" value={m.id} /><input type="hidden" name="item" value={c.id} /><input type="hidden" name="checked" value={String(!c.checked)} />
                    <button className={`grid h-5 w-5 place-items-center rounded border ${c.checked ? "border-ok bg-ok/20 text-ok" : "border-line-strong"}`} disabled={!canChecklist} aria-label={`${c.checked ? "Uncheck" : "Check"} ${c.label}`}>{c.checked ? "✓" : ""}</button>
                    <span className={c.checked ? "text-ink" : "text-ink-2"}>{c.label}</span>
                  </form>
                </li>
              ))}
            </ul>
            {!canChecklist && <p className="mt-3 text-xs text-ink-3">The assigned pilot completes the checklist before the flight.</p>}
          </Card>
          <Card title="Details">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-ink-3">Drone</dt><dd>{drone ? `${drone.name} (${drone.model})` : "—"}</dd>
              <dt className="text-ink-3">Pilot</dt><dd>{pilot ? repo.userName(pilot.userId) : "—"}</dd>
              <dt className="text-ink-3">Altitude</dt><dd className="font-mono">{m.params.altitudeM} m AGL</dd>
              <dt className="text-ink-3">Speed</dt><dd className="font-mono">{m.params.speedMps} m/s</dd>
              <dt className="text-ink-3">Overlap</dt><dd className="font-mono">{Math.round(m.params.frontOverlap * 100)}/{Math.round(m.params.sideOverlap * 100)}%</dd>
              <dt className="text-ink-3">Waypoints</dt><dd className="font-mono">{m.waypoints.length}</dd>
              <dt className="text-ink-3">Estimate</dt><dd className="font-mono">{fmtDuration(m.estimates.durationS)} · {m.estimates.photoCount} photos</dd>
              <dt className="text-ink-3">GSD</dt><dd className="font-mono">{m.estimates.gsdCm} cm/px</dd>
              {m.summary && <><dt className="text-ink-3">Flown</dt><dd className="font-mono">{fmtDuration(m.summary.durationS)} · {(m.summary.distanceM / 1000).toFixed(2)} km · min battery {m.summary.minBattery}%</dd></>}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
