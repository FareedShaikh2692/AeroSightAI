"use client";
// 3D Digital Twin (docs/04-Architecture/Digital-Twin-Architecture.md). CesiumJS is loaded from the jsDelivr CDN at
// runtime (no Cesium ion token: Esri imagery + WGS84 ellipsoid). Scene: procedural asset models that grow with the
// project's approved progress history, a synthetic point cloud, planned and flown paths, findings, a live drone,
// click-to-identify, 3D distance/height measurement and saved viewpoints. Falls back to `fallback` without WebGL.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Crosshair, Eye, EyeOff, Ruler, X } from "lucide-react";
import { assetFraction } from "@/lib/twin";

const CESIUM_VERSION = "1.121.0";
const BASE = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;

type LngLat = [number, number];
export interface TwinAsset { id: string; name: string; type: string; tag: string; heightM: number; footprint: LngLat[]; conditionRating: number; status: string }
export interface TwinFinding { id: string; title: string; severity: string; status: string; location: LngLat }
export interface Camera { lng: number; lat: number; height: number; heading: number; pitch: number; roll: number }
export interface TwinData {
  boundary: LngLat[]; noFly: { name: string; geometry: LngLat[] }[]; assets: TwinAsset[]; findings: TwinFinding[];
  planned?: { code: string; points: [number, number, number][] }; flown?: { code: string; points: [number, number, number][] };
  live?: { missionId: string; code: string; drone: string };
  timeline: { date: string; pct: number }[];
  /** 4D: BIM elements with a status code per timeline step (n not started, o on track, a ahead, b behind, c complete). */
  bim?: { id: string; name: string; ifcClass: string; milestone: string; baseZ: number; topZ: number; footprint: LngLat[]; codes: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
declare global { interface Window { Cesium?: Any; CESIUM_BASE_URL?: string } }

let loading: Promise<Any> | null = null;
function loadCesium(): Promise<Any> {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (loading) return loading;
  window.CESIUM_BASE_URL = BASE;
  loading = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[data-cesium]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = `${BASE}Widgets/widgets.css`; css.dataset.cesium = "1";
      document.head.appendChild(css);
    }
    const s = document.createElement("script");
    s.src = `${BASE}Cesium.js`; s.async = true; s.crossOrigin = "anonymous";
    s.onload = () => (window.Cesium ? resolve(window.Cesium) : reject(new Error("Cesium did not initialise")));
    s.onerror = () => { loading = null; reject(new Error("Could not load the 3D engine")); };
    document.head.appendChild(s);
  });
  return loading;
}

function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

function inRing([x, y]: LngLat, ring: LngLat[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Deterministic PRNG so the synthetic cloud is identical on every load.
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

const TYPE_COLOR: Record<string, string> = { building: "#7DD3FC", tower: "#7DD3FC", bridge: "#FCD34D", road: "#A3A3A3", pier: "#FCD34D", tank: "#C4B5FD", crane: "#FB923C" };
const SEV_COLOR: Record<string, string> = { critical: "#EF4444", high: "#F97316", medium: "#EAB308", low: "#22C55E" };


interface Selected { kind: string; title: string; rows: [string, string][] }

const CODE_COLOR: Record<string, [string, number]> = { o: ["#22C55E", 0.85], a: ["#38BDF8", 0.85], c: ["#94A3B8", 0.8], b: ["#EF4444", 0.35] };
const CODE_LABEL: Record<string, string> = { n: "not started", o: "on track", a: "ahead of plan", b: "behind plan (planned, not built)", c: "complete" };

export function Twin3D({ data, viewpoints, height = 620, onSaveViewpoint, fallback, initial4d }: {
  data: TwinData; viewpoints: { id: string; name: string; camera: Camera; mine: boolean }[]; height?: number; initial4d?: boolean;
  onSaveViewpoint?: (name: string, camera: Camera, shared: boolean) => Promise<{ error?: string } | void>; fallback: ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Any>(null);
  const [mode, setMode] = useState<"loading" | "ready" | "fallback">("loading");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(Math.max(0, data.timeline.length - 1));
  const stepRef = useRef(step);
  const [layers, setLayers] = useState({ assets: !initial4d, bim: !!initial4d, cloud: !initial4d, planned: true, flown: true, findings: true, live: true });
  const [measuring, setMeasuring] = useState(false);
  const measuringRef = useRef(false);
  const [measure, setMeasure] = useState<{ d: number; h: number; dz: number } | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [live, setLive] = useState<{ alt: number; speed: number; battery: number; simulated: boolean } | null>(null);
  const [vpName, setVpName] = useState("");
  const [vpShared, setVpShared] = useState(false);
  const [vpMsg, setVpMsg] = useState<string | null>(null);
  const groups = useRef<Record<string, Any[]>>({});
  const cloudRef = useRef<{ coll: Any; assetPts: { p: Any; z: number; asset: number }[] } | null>(null);

  // Rebuild the scene only when the scene data really changes (not on every server re-render).
  const dataKey = useMemo(() => JSON.stringify(data), [data]);
  const pct = data.timeline[step]?.pct ?? 0;
  const date = data.timeline[step]?.date;
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { measuringRef.current = measuring; }, [measuring]);

  const center = useMemo(() => {
    const xs = data.boundary.map((p) => p[0]), ys = data.boundary.map((p) => p[1]);
    return { lng: (Math.min(...xs) + Math.max(...xs)) / 2, lat: (Math.min(...ys) + Math.max(...ys)) / 2, spanM: Math.max((Math.max(...xs) - Math.min(...xs)) * 111_320 * Math.cos((ys[0] * Math.PI) / 180), (Math.max(...ys) - Math.min(...ys)) * 110_540) };
  }, [data.boundary]);

  useEffect(() => {
    if (!hasWebGL()) { setMode("fallback"); setError("This device does not support WebGL."); return; }
    let disposed = false;
    let es: EventSource | null = null;
    loadCesium().then((C) => {
      if (disposed || !el.current) return;
      const viewer = new C.Viewer(el.current, {
        baseLayer: new C.ImageryLayer(new C.UrlTemplateImageryProvider({
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", maximumLevel: 19, credit: "Esri, Maxar, Earthstar Geographics",
        })),
        terrainProvider: new C.EllipsoidTerrainProvider(),
        baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false, animation: false, timeline: false,
        fullscreenButton: false, infoBox: false, selectionIndicator: false, requestRenderMode: false,
      });
      viewerRef.current = viewer;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.backgroundColor = C.Color.fromCssColorString("#0B0F14");
      const g: Record<string, Any[]> = { assets: [], bim: [], planned: [], flown: [], findings: [], live: [], boundary: [] };
      const info = new Map<Any, Selected>();
      const col = (css: string, a = 1) => C.Color.fromCssColorString(css).withAlpha(a);

      // Site boundary + no-fly zones
      g.boundary.push(viewer.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(data.boundary.flat()), width: 2, material: col("#FFB020"), clampToGround: true } }));
      for (const z of data.noFly) {
        const e = viewer.entities.add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(z.geometry.flat()), height: 0, extrudedHeight: 120, material: col("#EF4444", 0.12), outline: true, outlineColor: col("#EF4444", 0.7) } });
        info.set(e, { kind: "No-fly zone", title: z.name, rows: [["Ceiling", "120 m (display)"]] });
      }

      // Assets: extruded footprints whose height follows the construction-history slider.
      data.assets.forEach((a, i) => {
        const color = TYPE_COLOR[a.type] ?? "#93C5FD";
        const e = viewer.entities.add({
          polygon: {
            hierarchy: C.Cartesian3.fromDegreesArray(a.footprint.flat()), height: 0,
            extrudedHeight: new C.CallbackProperty(() => Math.max(0.3, a.heightM * assetFraction(i, data.assets.length, data.timeline[stepRef.current]?.pct ?? 100)), false),
            material: col(color, 0.78), outline: true, outlineColor: col("#0B0F14", 0.9),
          },
        });
        info.set(e, { kind: "Asset", title: a.name, rows: [["Tag", a.tag], ["Type", a.type], ["Design height", `${a.heightM} m`], ["Condition", `${a.conditionRating}/5`], ["Status", a.status]] });
        g.assets.push(e);
      });

      // 4D: BIM elements coloured by planned-vs-as-built status at the slider date.
      for (const b of data.bim ?? []) {
        const code = () => b.codes[stepRef.current] ?? "n";
        const e = viewer.entities.add({ polygon: {
          hierarchy: C.Cartesian3.fromDegreesArray(b.footprint.flat()), height: b.baseZ, extrudedHeight: Math.max(b.topZ, b.baseZ + 0.2),
          show: new C.CallbackProperty(() => code() !== "n", false),
          material: new C.ColorMaterialProperty(new C.CallbackProperty(() => { const [c, a] = CODE_COLOR[code()] ?? ["#94A3B8", 0.5]; return col(c, a); }, false)),
          outline: true, outlineColor: col("#0B0F14", 0.6) } });
        info.set(e, { kind: "BIM element (4D)", title: b.name, rows: [["Class", b.ifcClass], ["Milestone", b.milestone], ["Elevation", `${b.baseZ.toFixed(1)} → ${b.topZ.toFixed(1)} m`]] });
        (e as Any)._bimCode = code;
        g.bim.push(e);
      }

      // Synthetic point cloud: ground returns inside the boundary + returns on asset surfaces (shown up to built height).
      const coll = viewer.scene.primitives.add(new C.PointPrimitiveCollection());
      const rand = rng(Math.round(center.lng * 1e4 + center.lat * 1e3));
      const xs = data.boundary.map((p) => p[0]), ys = data.boundary.map((p) => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      for (let n = 0, tries = 0; n < 3500 && tries < 12000; tries++) {
        const p: LngLat = [x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0)];
        if (!inRing(p, data.boundary)) continue;
        const shade = 0.45 + rand() * 0.35;
        coll.add({ position: C.Cartesian3.fromDegrees(p[0], p[1], 0.15 + rand() * 0.4), pixelSize: 2, color: new C.Color(shade * 0.95, shade * 0.85, shade * 0.7, 0.9) });
        n++;
      }
      const assetPts: { p: Any; z: number; asset: number }[] = [];
      data.assets.forEach((a, ai) => {
        const ring = a.footprint;
        for (let k = 0; k < 450; k++) {
          const s = Math.floor(rand() * (ring.length - 1)), f = rand();
          const [lng, lat] = [ring[s][0] + (ring[s + 1][0] - ring[s][0]) * f, ring[s][1] + (ring[s + 1][1] - ring[s][1]) * f];
          const z = rand() * a.heightM;
          const t = z / Math.max(1, a.heightM);
          assetPts.push({ p: coll.add({ position: C.Cartesian3.fromDegrees(lng, lat, z), pixelSize: 2.5, color: new C.Color(0.3 + 0.6 * t, 0.75 - 0.3 * t, 1 - 0.7 * t, 0.95) }), z, asset: ai });
        }
      });
      cloudRef.current = { coll, assetPts };

      // Planned path (dashed) and flown path (solid) at flight altitude.
      if (data.planned?.points.length) g.planned.push(viewer.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArrayHeights(data.planned.points.flat()), width: 2,
        material: new C.PolylineDashMaterialProperty({ color: col("#38BDF8"), dashLength: 12 }) } }));
      if (data.flown?.points.length) g.flown.push(viewer.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArrayHeights(data.flown.points.flat()), width: 3,
        material: new C.PolylineGlowMaterialProperty({ color: col("#22C55E"), glowPower: 0.2 }) } }));

      // Findings
      for (const f of data.findings) {
        const e = viewer.entities.add({ position: C.Cartesian3.fromDegrees(f.location[0], f.location[1], 3),
          point: { pixelSize: 12, color: col(SEV_COLOR[f.severity] ?? "#EAB308"), outlineColor: C.Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: f.title.length > 28 ? `${f.title.slice(0, 27)}…` : f.title, font: "12px Inter, sans-serif", pixelOffset: new C.Cartesian2(0, -18), showBackground: true,
            backgroundColor: col("#0B0F14", 0.75), scale: 0.9, distanceDisplayCondition: new C.DistanceDisplayCondition(0, 900), disableDepthTestDistance: Number.POSITIVE_INFINITY } });
        info.set(e, { kind: "Finding", title: f.title, rows: [["Severity", f.severity], ["Status", f.status]] });
        g.findings.push(e);
      }

      // Live drone over SSE
      if (data.live) {
        const trail: Any[] = [];
        let pos: Any = null;
        const drone = viewer.entities.add({
          position: new C.CallbackProperty(() => pos, false),
          point: { pixelSize: 14, color: col("#FFB020"), outlineColor: C.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: data.live.drone, font: "12px Inter, sans-serif", pixelOffset: new C.Cartesian2(0, -20), showBackground: true, backgroundColor: col("#0B0F14", 0.75), disableDepthTestDistance: Number.POSITIVE_INFINITY },
        });
        const tail = viewer.entities.add({ polyline: { positions: new C.CallbackProperty(() => trail.slice(), false), width: 2, material: col("#FFB020", 0.6) } });
        info.set(drone, { kind: "Live drone", title: `${data.live.drone} · ${data.live.code}`, rows: [] });
        g.live.push(drone, tail);
        es = new EventSource(`/api/v1/missions/${data.live.missionId}/telemetry/stream`);
        es.addEventListener("telemetry", (ev) => {
          const t = JSON.parse((ev as MessageEvent).data);
          pos = C.Cartesian3.fromDegrees(t.longitude, t.latitude, t.relativeAltitude);
          trail.push(pos); if (trail.length > 120) trail.shift();
          setLive({ alt: t.relativeAltitude, speed: t.speed, battery: t.battery, simulated: t.simulated !== false });
        });
      }
      groups.current = g;

      // Click: identify, or measure when the ruler is active.
      const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
      let mPts: Any[] = [];
      let mEnts: Any[] = [];
      const pickPoint = (screen: Any) => (viewer.scene.pickPositionSupported ? viewer.scene.pickPosition(screen) : undefined) ?? viewer.camera.pickEllipsoid(screen, viewer.scene.globe.ellipsoid);
      handler.setInputAction((click: Any) => {
        if (measuringRef.current) {
          const p = pickPoint(click.position);
          if (!p) return;
          if (mPts.length === 2) { mEnts.forEach((e) => viewer.entities.remove(e)); mEnts = []; mPts = []; setMeasure(null); }
          mPts.push(p);
          mEnts.push(viewer.entities.add({ position: p, point: { pixelSize: 8, color: C.Color.YELLOW, disableDepthTestDistance: Number.POSITIVE_INFINITY } }));
          if (mPts.length === 2) {
            const d = C.Cartesian3.distance(mPts[0], mPts[1]);
            const h0 = C.Cartographic.fromCartesian(mPts[0]).height, h1 = C.Cartographic.fromCartesian(mPts[1]).height;
            const dz = h1 - h0;
            setMeasure({ d, dz, h: Math.sqrt(Math.max(0, d * d - dz * dz)) });
            mEnts.push(viewer.entities.add({ polyline: { positions: [mPts[0], mPts[1]], width: 3, material: C.Color.YELLOW, depthFailMaterial: col("#FACC15", 0.4) } }));
          }
          return;
        }
        const picked = viewer.scene.pick(click.position);
        const ent = picked?.id;
        const sel = ent ? info.get(ent) : undefined;
        if (sel && ent?._bimCode) setSelected({ ...sel, rows: [...sel.rows, ["Status", CODE_LABEL[ent._bimCode()] ?? "—"]] });
        else if (sel) setSelected(sel);
        else if (picked?.primitive && picked.collection === coll) {
          const c = C.Cartographic.fromCartesian(picked.primitive.position);
          setSelected({ kind: "Point (synthetic cloud)", title: "Point sample", rows: [["Longitude", C.Math.toDegrees(c.longitude).toFixed(6)], ["Latitude", C.Math.toDegrees(c.latitude).toFixed(6)], ["Height", `${c.height.toFixed(1)} m`]] });
        } else setSelected(null);
      }, C.ScreenSpaceEventType.LEFT_CLICK);

      viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(center.lng, center.lat, 0), Math.max(120, center.spanM / 2)),
        { offset: new C.HeadingPitchRange(C.Math.toRadians(20), C.Math.toRadians(-35), Math.max(300, center.spanM * 1.4)), duration: 0 });
      setMode("ready");
    }).catch((e: Error) => { if (!disposed) { setMode("fallback"); setError(e.message); } });
    return () => {
      disposed = true;
      es?.close();
      if (viewerRef.current && !viewerRef.current.isDestroyed()) viewerRef.current.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  // Layer visibility
  useEffect(() => {
    const g = groups.current;
    for (const [k, on] of Object.entries(layers)) (g[k] ?? []).forEach((e) => { e.show = on; });
    if (cloudRef.current) cloudRef.current.coll.show = layers.cloud;
  }, [layers, mode]);

  // Point cloud follows the construction-history slider.
  useEffect(() => {
    const c = cloudRef.current;
    if (!c) return;
    for (const p of c.assetPts) p.p.show = p.z <= data.assets[p.asset].heightM * assetFraction(p.asset, data.assets.length, pct);
  }, [pct, mode, data.assets]);

  function flyTo(cam: Camera) {
    const C = window.Cesium, v = viewerRef.current;
    if (!C || !v) return;
    v.camera.flyTo({ destination: C.Cartesian3.fromDegrees(cam.lng, cam.lat, cam.height), orientation: { heading: cam.heading, pitch: cam.pitch, roll: cam.roll }, duration: 1.2 });
  }
  async function save() {
    const C = window.Cesium, v = viewerRef.current;
    if (!C || !v || !onSaveViewpoint) return;
    const c = v.camera.positionCartographic;
    const cam: Camera = { lng: C.Math.toDegrees(c.longitude), lat: C.Math.toDegrees(c.latitude), height: c.height, heading: v.camera.heading, pitch: v.camera.pitch, roll: v.camera.roll };
    const r = await onSaveViewpoint(vpName.trim() || `View ${viewpoints.length + 1}`, cam, vpShared);
    setVpMsg(r && "error" in r && r.error ? r.error : "Viewpoint saved.");
    if (!(r && r.error)) setVpName("");
  }

  if (mode === "fallback") {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-warn/10 px-3 py-2 text-sm text-warn">3D view unavailable ({error}). Showing the 2D map instead.</p>
        {fallback}
      </div>
    );
  }

  const LAYER_LABELS: [keyof typeof layers, string][] = [["bim", "BIM 4D (plan vs as-built)"], ["assets", "Asset models"], ["cloud", "Point cloud (synthetic)"], ["planned", "Planned path"], ["flown", "Flown path"], ["findings", "Findings"], ["live", "Live drone"]];
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-xl border border-line" style={{ height }}>
          <div ref={el} style={{ position: "absolute", inset: 0 }} />
          {mode === "loading" && <div className="absolute inset-0 grid place-items-center bg-surface text-sm text-ink-2">Loading 3D engine…</div>}
          <div className="absolute left-3 top-3 flex gap-2">
            <button type="button" className={`btn h-8 text-xs ${measuring ? "btn-primary" : "btn-secondary"}`} onClick={() => { setMeasuring(!measuring); setMeasure(null); }} aria-pressed={measuring}>
              <Ruler size={14} /> {measuring ? "Measuring — click two points" : "Measure 3D"}</button>
          </div>
          {measure && (
            <div className="absolute bottom-3 left-3 rounded-lg bg-black/75 px-3 py-2 font-mono text-xs text-white">
              3D {measure.d.toFixed(1)} m · horizontal {measure.h.toFixed(1)} m · Δheight {measure.dz >= 0 ? "+" : ""}{measure.dz.toFixed(1)} m
            </div>
          )}
          {selected && (
            <div className="absolute right-3 top-3 w-64 rounded-lg border border-line bg-surface/95 p-3 text-sm shadow-lg">
              <div className="flex items-start justify-between gap-2"><div><div className="text-[11px] uppercase tracking-wide text-ink-3">{selected.kind}</div><div className="font-semibold">{selected.title}</div></div>
                <button type="button" className="text-ink-3 hover:text-ink" onClick={() => setSelected(null)} aria-label="Close"><X size={14} /></button></div>
              {selected.rows.length > 0 && <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs">{selected.rows.map(([k, v]) => <Fragment key={k}><dt className="text-ink-3">{k}</dt><dd className="capitalize">{v}</dd></Fragment>)}</dl>}
            </div>
          )}
          {live && layers.live && (
            <div className="absolute bottom-3 right-3 rounded-lg bg-black/75 px-3 py-2 font-mono text-xs text-white">
              <Crosshair size={12} className="mr-1 inline" />{data.live?.drone} · {live.alt.toFixed(0)} m · {live.speed.toFixed(1)} m/s · {live.battery.toFixed(0)}%{live.simulated ? " · SIMULATED" : ""}
            </div>
          )}
        </div>
        {data.timeline.length > 1 && (
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium">Construction history</span>
              <span className="font-mono text-xs text-ink-2">{date} · {pct.toFixed(1)}% complete (approved progress)</span></div>
            <input type="range" min={0} max={data.timeline.length - 1} value={step} onChange={(e) => setStep(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" aria-label="Construction history date" />
            <div className="mt-1 flex justify-between text-[11px] text-ink-3"><span>{data.timeline[0].date}</span><span>{data.timeline[data.timeline.length - 1].date}</span></div>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-2 text-sm font-semibold">Layers</div>
          <ul className="space-y-1">
            {LAYER_LABELS.filter(([k]) => k !== "bim" || data.bim?.length).filter(([k]) => k !== "live" || data.live).filter(([k]) => k !== "flown" || data.flown).filter(([k]) => k !== "planned" || data.planned).map(([k, label]) => (
              <li key={k}><button type="button" className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-raised" onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} aria-pressed={layers[k]}>
                <span className={layers[k] ? "" : "text-ink-3"}>{label}</span>{layers[k] ? <Eye size={14} /> : <EyeOff size={14} className="text-ink-3" />}</button></li>
            ))}
          </ul>
          {layers.bim && !!data.bim?.length && (
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">{(["o", "a", "b", "c"] as const).map((k) => <span key={k} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CODE_COLOR[k][0], opacity: CODE_COLOR[k][1] }} />{CODE_LABEL[k]}</span>)}</div>
          )}
          <p className="mt-2 text-[11px] text-ink-3">Asset models are procedural (footprint × height). The point cloud is synthetic demo data — photogrammetry meshes and LAS/LAZ clouds stream once processing is connected.</p>
        </div>
        <div className="card p-4">
          <div className="mb-2 text-sm font-semibold">Saved viewpoints</div>
          <ul className="mb-3 space-y-1">
            {viewpoints.map((v) => <li key={v.id}><button type="button" className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-raised" onClick={() => flyTo(v.camera)}>{v.name}{!v.mine && <span className="ml-1 text-[11px] text-ink-3">(shared)</span>}</button></li>)}
            {viewpoints.length === 0 && <li className="text-xs text-ink-3">None yet.</li>}
          </ul>
          {onSaveViewpoint && (
            <div className="space-y-2">
              <input className="input" placeholder="Name this view" value={vpName} onChange={(e) => setVpName(e.target.value)} maxLength={60} aria-label="Viewpoint name" />
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={vpShared} onChange={(e) => setVpShared(e.target.checked)} /> Share with project</label>
              <button type="button" className="btn btn-secondary w-full justify-center" onClick={save} disabled={mode !== "ready"}>Save current view</button>
              {vpMsg && <p className="text-xs text-ink-2">{vpMsg}</p>}
            </div>
          )}
        </div>
        <div className="card p-4 text-xs text-ink-2">Left-drag to pan · right-drag or Ctrl+drag to tilt · scroll to zoom. Click any object to identify it.</div>
      </div>
    </div>
  );
}
