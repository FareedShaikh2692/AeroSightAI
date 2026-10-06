"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { MapClient } from "@/components/MapClient";
import { FormError } from "@/components/ui";
import { previewMissionAction, createMissionAction } from "../../actions";
import type { LngLat, Polygon, Waypoint } from "@/lib/types";
import { fmtDuration } from "@/lib/format";

interface SiteOpt { id: string; name: string; boundary: Polygon; noFlyZones: { id: string; name: string; geometry: Polygon }[]; maxAltitudeM: number; centroid: LngLat }
interface Plan { waypoints: Waypoint[]; estimates: { durationS: number; distanceM: number; photoCount: number; gsdCm: number; batteries: number }; issues: { code: string; waypoints: number[]; message: string }[] }
type Opt = { id: string; label: string; disabled: boolean };

export function MissionPlanner({ sites, initialSiteId, drones, pilots }: { sites: SiteOpt[]; initialSiteId: string; drones: Opt[]; pilots: Opt[] }) {
  const [siteId, setSiteId] = useState(initialSiteId);
  const site = sites.find((s) => s.id === siteId)!;
  const [pts, setPts] = useState<LngLat[]>([]);
  const [template, setTemplate] = useState<"grid" | "orbit">("grid");
  const [type, setType] = useState("progress");
  const [name, setName] = useState("");
  const [alt, setAlt] = useState(80);
  const [speed, setSpeed] = useState(8);
  const [front, setFront] = useState(0.8);
  const [side, setSide] = useState(0.7);
  const [start, setStart] = useState(() => { const d = new Date(Date.now() + 86_400_000); d.setUTCHours(6, 0, 0, 0); return d.toISOString().slice(0, 16); });
  const [droneId, setDroneId] = useState("");
  const [pilotId, setPilotId] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const onDraw = useCallback((p: LngLat[]) => setPts([...p]), []);

  const payload = useMemo(() => JSON.stringify({ siteId, name, type, template, area: pts,
    params: { altitudeM: alt, speedMps: speed, frontOverlap: front, sideOverlap: side, gimbalPitch: -90 },
    scheduledStart: new Date(start + "Z").toISOString(), droneId, pilotId }), [siteId, name, type, template, pts, alt, speed, front, side, start, droneId, pilotId]);

  useEffect(() => {
    if (pts.length < 3) { setPlan(null); return; }
    const t = setTimeout(() => startTransition(async () => {
      const r = await previewMissionAction(payload);
      if (r.error) { setError(r.error); setPlan(null); } else { setError(null); setPlan(r.data as Plan); }
    }), 250);
    return () => clearTimeout(t);
  }, [payload, pts.length]);

  const bad = new Set(plan?.issues.flatMap((i) => i.waypoints) ?? []);
  const useSiteArea = () => setPts(site.boundary.slice(0, -1).map(([x, y]) => [x + (site.centroid[0] - x) * 0.12, y + (site.centroid[1] - y) * 0.12] as LngLat));

  const submit = () => startTransition(async () => {
    const r = await createMissionAction(payload);
    if (r?.error) setError(r.error);
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <div className="card h-fit space-y-4 p-5">
        <FormError error={error} />
        <div><label className="label" htmlFor="site">Site</label>
          <select id="site" className="input" value={siteId} onChange={(e) => { setSiteId(e.target.value); setPts([]); }}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label className="label" htmlFor="mname">Name</label><input id="mname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly progress capture" maxLength={160} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="type">Type</label><select id="type" className="input" value={type} onChange={(e) => setType(e.target.value)}>{["progress", "survey", "inspection", "video", "custom"].map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label className="label" htmlFor="tpl">Template</label><select id="tpl" className="input" value={template} onChange={(e) => setTemplate(e.target.value as "grid" | "orbit")}><option value="grid">Grid survey</option><option value="orbit">Orbit</option></select></div>
        </div>
        <div className="rounded-lg border border-line p-3 text-xs text-ink-2">
          Click the map to outline the capture area ({pts.length} points).
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn btn-secondary h-7 px-2 text-xs" onClick={useSiteArea}>Use site area</button>
            <button type="button" className="btn btn-secondary h-7 px-2 text-xs" onClick={() => setPts(pts.slice(0, -1))} disabled={!pts.length}>Undo</button>
            <button type="button" className="btn btn-secondary h-7 px-2 text-xs" onClick={() => setPts([])}>Clear</button>
          </div>
        </div>
        <Slider label="Altitude AGL" value={alt} min={20} max={150} step={5} unit="m" onChange={setAlt} warn={alt > site.maxAltitudeM ? `Above site limit (${site.maxAltitudeM} m)` : undefined} />
        <Slider label="Speed" value={speed} min={2} max={15} step={0.5} unit="m/s" onChange={setSpeed} />
        <Slider label="Front overlap" value={Math.round(front * 100)} min={60} max={90} step={5} unit="%" onChange={(v) => setFront(v / 100)} />
        <Slider label="Side overlap" value={Math.round(side * 100)} min={50} max={85} step={5} unit="%" onChange={(v) => setSide(v / 100)} />
        <div><label className="label" htmlFor="start">Scheduled start (UTC)</label><input id="start" type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><label className="label" htmlFor="drone">Drone</label><select id="drone" className="input" value={droneId} onChange={(e) => setDroneId(e.target.value)}>
          <option value="">Assign later</option>{drones.map((d) => <option key={d.id} value={d.id} disabled={d.disabled}>{d.label}{d.disabled ? " — unavailable" : ""}</option>)}</select></div>
        <div><label className="label" htmlFor="pilot">Pilot</label><select id="pilot" className="input" value={pilotId} onChange={(e) => setPilotId(e.target.value)}>
          <option value="">Assign later</option>{pilots.map((p) => <option key={p.id} value={p.id} disabled={p.disabled}>{p.label}{p.disabled ? " — license expired" : ""}</option>)}</select></div>
        <button type="button" className="btn btn-primary w-full justify-center" onClick={submit} disabled={pending || !plan || plan.issues.length > 0}>{pending ? "Working…" : "Create mission"}</button>
      </div>
      <div>
        <MapClient height={560} fitTo={site.boundary} initialBasemap="satellite" drawMode onDrawChange={onDraw} key={siteId}
          data={{ sites: [{ id: site.id, name: site.name, boundary: site.boundary }], noFly: site.noFlyZones, area: pts.length >= 3 ? [...pts, pts[0]] : pts,
            path: plan?.waypoints.map((w) => [w.lng, w.lat]), waypoints: plan?.waypoints.map((w) => ({ seq: w.seq, lng: w.lng, lat: w.lat, bad: bad.has(w.seq) })) }} />
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[["Duration", plan ? fmtDuration(plan.estimates.durationS) : "—"], ["Distance", plan ? `${(plan.estimates.distanceM / 1000).toFixed(2)} km` : "—"],
            ["Photos", plan ? String(plan.estimates.photoCount) : "—"], ["GSD", plan ? `${plan.estimates.gsdCm} cm/px` : "—"], ["Batteries", plan ? String(plan.estimates.batteries) : "—"]].map(([k, v]) => (
            <div key={k} className="card p-3"><div className="text-[10px] uppercase tracking-wider text-ink-3">{k}</div><div className="font-mono">{v}</div></div>
          ))}
        </div>
        {plan && (plan.issues.length ? (
          <div className="mt-4 space-y-2">{plan.issues.map((i) => <div key={i.code} className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{i.message} Offending waypoints are shown in red.</div>)}</div>
        ) : <div className="mt-4 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok">Plan is valid: inside the geofence, clear of no-fly zones and within altitude limits.</div>)}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, onChange, warn }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; warn?: string }) {
  const id = label.replace(/\s/g, "-").toLowerCase();
  return (
    <div>
      <div className="flex justify-between"><label className="label" htmlFor={id}>{label}</label><span className="font-mono text-xs">{value} {unit}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#FFB020]" />
      {warn && <p className="text-xs text-bad">{warn}</p>}
    </div>
  );
}
