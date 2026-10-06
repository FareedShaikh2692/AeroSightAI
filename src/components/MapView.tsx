"use client";
// 2D / satellite / terrain / 3D map (MapLibre GL). Symbology follows docs/08-UX/Design-System.md §11.
import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MLMap, type StyleSpecification, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LngLat, Polygon } from "@/lib/types";

export type Basemap = "streets" | "satellite" | "terrain";

export interface MapData {
  sites?: { id: string; name: string; boundary: Polygon; href?: string }[];
  noFly?: { id: string; name: string; geometry: Polygon }[];
  assets?: { id: string; name: string; tag: string; location: LngLat; footprint?: Polygon; heightM?: number; type: string }[];
  path?: LngLat[];
  waypoints?: { seq: number; lng: number; lat: number; bad?: boolean }[];
  findings?: { id: string; title: string; severity: string; location: LngLat }[];
  media?: { id: string; filename: string; location: LngLat }[];
  pins?: { id: string; label: string; location: LngLat; color?: string; href?: string }[];
  area?: Polygon;
}

const RASTER: Record<Basemap, { tiles: string[]; attribution: string; maxzoom: number }> = {
  streets: { tiles: ["a", "b", "c"].map((s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`), attribution: "© OpenStreetMap contributors © CARTO", maxzoom: 20 },
  satellite: { tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], attribution: "Imagery © Esri, Maxar, Earthstar Geographics", maxzoom: 19 },
  terrain: { tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"], attribution: "© Esri, HERE, Garmin, USGS, OpenStreetMap contributors", maxzoom: 19 },
};

function styleFor(b: Basemap): StyleSpecification {
  return {
    version: 8,
    sources: { base: { type: "raster", tiles: RASTER[b].tiles, tileSize: 256, attribution: RASTER[b].attribution, maxzoom: RASTER[b].maxzoom } },
    layers: [{ id: "base", type: "raster", source: "base", paint: b === "satellite" ? { "raster-saturation": -0.15 } : {} }],
  };
}

const SEV_COLOR: Record<string, string> = { critical: "#F87171", high: "#FB923C", medium: "#FBBF24", low: "#60A5FA" };

function fc(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection { return { type: "FeatureCollection", features }; }

function toGeo(d: MapData) {
  return {
    sites: fc((d.sites ?? []).map((s) => ({ type: "Feature", properties: { id: s.id, name: s.name }, geometry: { type: "Polygon", coordinates: [s.boundary] } }))),
    nofly: fc((d.noFly ?? []).map((z) => ({ type: "Feature", properties: { name: z.name }, geometry: { type: "Polygon", coordinates: [z.geometry] } }))),
    footprints: fc((d.assets ?? []).filter((a) => a.footprint).map((a) => ({ type: "Feature", properties: { name: a.name, height: a.heightM ?? 5, type: a.type }, geometry: { type: "Polygon", coordinates: [a.footprint!] } }))),
    assets: fc((d.assets ?? []).map((a) => ({ type: "Feature", properties: { name: `${a.tag} · ${a.name}` }, geometry: { type: "Point", coordinates: a.location } }))),
    path: fc(d.path && d.path.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: d.path } }] : []),
    waypoints: fc((d.waypoints ?? []).map((w) => ({ type: "Feature", properties: { seq: w.seq, bad: w.bad ? 1 : 0 }, geometry: { type: "Point", coordinates: [w.lng, w.lat] } }))),
    findings: fc((d.findings ?? []).map((f) => ({ type: "Feature", properties: { title: f.title, color: SEV_COLOR[f.severity] ?? "#9AABBD", severity: f.severity }, geometry: { type: "Point", coordinates: f.location } }))),
    media: fc((d.media ?? []).map((m) => ({ type: "Feature", properties: { name: m.filename }, geometry: { type: "Point", coordinates: m.location } }))),
    pins: fc((d.pins ?? []).map((p) => ({ type: "Feature", properties: { label: p.label, color: p.color ?? "#FFB020", href: p.href ?? "" }, geometry: { type: "Point", coordinates: p.location } }))),
    area: fc(d.area && d.area.length > 1 ? [{ type: "Feature", properties: {}, geometry: d.area.length >= 4 ? { type: "Polygon", coordinates: [d.area] } : { type: "LineString", coordinates: d.area } }] : []),
  };
}

export interface MapViewProps {
  data: MapData;
  center?: LngLat; zoom?: number; fitTo?: LngLat[];
  height?: number | string; initialBasemap?: Basemap; threeD?: boolean;
  drawMode?: boolean; onDrawChange?: (ring: LngLat[]) => void;
  drone?: { lng: number; lat: number; heading: number; stale?: boolean } | null;
  trail?: LngLat[];
  className?: string;
}

export default function MapView({ data, center, zoom = 15, fitTo, height = 420, initialBasemap = "streets", threeD = false, drawMode = false, onDrawChange, drone, trail, className }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const droneMarker = useRef<maplibregl.Marker | null>(null);
  const [basemap, setBasemap] = useState<Basemap>(initialBasemap);
  const [ready, setReady] = useState(false);
  const drawPts = useRef<LngLat[]>([]);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!el.current) return;
    let m: MLMap;
    try {
      m = new maplibregl.Map({
        container: el.current, style: styleFor(initialBasemap), center: center ?? [55.14, 25.08], zoom,
        pitch: threeD ? 58 : 0, bearing: threeD ? -20 : 0, attributionControl: { compact: true }, maxPitch: 75,
      });
    } catch {
      el.current.innerHTML = '<div style="padding:24px;color:#9AABBD;font-size:14px">Interactive map unavailable (WebGL not supported). Use the lists on this page instead.</div>';
      return;
    }
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    m.on("load", () => {
      addLayers(m, threeD);
      setReady(true);
      if (fitTo && fitTo.length) {
        const b = new maplibregl.LngLatBounds(fitTo[0], fitTo[0]);
        fitTo.forEach((p) => b.extend(p));
        m.fitBounds(b, { padding: 48, maxZoom: 17.5, duration: 0, pitch: threeD ? 58 : 0 });
      }
    });
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap switch: replace the raster source while keeping overlays.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const src = m.getSource("base") as maplibregl.RasterTileSource | undefined;
    if (src) {
      m.removeLayer("base");
      m.removeSource("base");
    }
    m.addSource("base", { type: "raster", tiles: RASTER[basemap].tiles, tileSize: 256, attribution: RASTER[basemap].attribution, maxzoom: RASTER[basemap].maxzoom });
    const firstOverlay = m.getStyle().layers.find((l) => l.id !== "base")?.id;
    m.addLayer({ id: "base", type: "raster", source: "base" }, firstOverlay);
  }, [basemap, ready]);

  // Data updates
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const g = toGeo(data);
    for (const [k, v] of Object.entries(g)) (m.getSource(k) as GeoJSONSource | undefined)?.setData(v);
  }, [data, ready]);

  // Trail
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("trail") as GeoJSONSource | undefined)?.setData(fc(trail && trail.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: trail } }] : []));
  }, [trail, ready]);

  // Live drone marker
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (!drone) { droneMarker.current?.remove(); droneMarker.current = null; return; }
    if (!droneMarker.current) {
      const node = document.createElement("div");
      node.innerHTML = `<svg width="34" height="34" viewBox="0 0 34 34" aria-label="Drone"><circle cx="17" cy="17" r="15" fill="rgba(34,211,238,.18)" stroke="#22D3EE" stroke-width="1.5"/><path d="M17 6 L23 24 L17 20 L11 24 Z" fill="#22D3EE"/></svg>`;
      droneMarker.current = new maplibregl.Marker({ element: node, rotationAlignment: "map" }).setLngLat([drone.lng, drone.lat]).addTo(m);
    }
    droneMarker.current.setLngLat([drone.lng, drone.lat]).setRotation(drone.heading);
    droneMarker.current.getElement().style.opacity = drone.stale ? "0.4" : "1";
  }, [drone, ready]);

  // Drawing
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !drawMode) return;
    m.getCanvas().style.cursor = "crosshair";
    const onClick = (e: maplibregl.MapMouseEvent) => {
      drawPts.current = [...drawPts.current, [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)]];
      onDrawChange?.(drawPts.current);
    };
    m.on("click", onClick);
    return () => { m.off("click", onClick); m.getCanvas().style.cursor = ""; };
  }, [drawMode, ready, onDrawChange]);

  // Keep the click buffer in sync with the parent's polygon (clear / undo).
  const areaKey = JSON.stringify(data.area ?? []);
  useEffect(() => {
    const a = data.area ?? [];
    const closed = a.length >= 4 && a[0][0] === a[a.length - 1][0] && a[0][1] === a[a.length - 1][1];
    drawPts.current = closed ? a.slice(0, -1) : [...a];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaKey]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-line ${className ?? ""}`} style={{ height }}>
      {/* Inline style: maplibre adds `.maplibregl-map { position: relative }`, which would override a class-based `absolute`. */}
      <div ref={el} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
      <div className="glass absolute left-3 top-3 flex gap-1 rounded-lg p-1 text-xs" role="group" aria-label="Basemap">
        {(["streets", "satellite", "terrain"] as Basemap[]).map((b) => (
          <button key={b} type="button" onClick={() => setBasemap(b)} className={`rounded-md px-2.5 py-1 capitalize ${basemap === b ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"}`}>
            {b === "streets" ? "2D" : b}
          </button>
        ))}
      </div>
    </div>
  );
}

function addLayers(m: MLMap, threeD: boolean) {
  const empty = fc([]);
  for (const id of ["sites", "nofly", "footprints", "assets", "path", "waypoints", "findings", "media", "pins", "area", "trail"]) m.addSource(id, { type: "geojson", data: empty });
  m.addLayer({ id: "sites-fill", type: "fill", source: "sites", paint: { "fill-color": "#22D3EE", "fill-opacity": 0.08 } });
  m.addLayer({ id: "sites-line", type: "line", source: "sites", paint: { "line-color": "#22D3EE", "line-width": 2 } });
  m.addLayer({ id: "nofly-fill", type: "fill", source: "nofly", paint: { "fill-color": "#F87171", "fill-opacity": 0.22 } });
  m.addLayer({ id: "nofly-line", type: "line", source: "nofly", paint: { "line-color": "#F87171", "line-width": 2 } });
  if (threeD) {
    m.addLayer({ id: "footprints-3d", type: "fill-extrusion", source: "footprints", paint: {
      "fill-extrusion-color": ["match", ["get", "type"], "building", "#9AABBD", "crane", "#FFB020", "bridge", "#C9D0D8", "stockpile", "#B45309", "#6B7C8F"],
      "fill-extrusion-height": ["get", "height"], "fill-extrusion-opacity": 0.85 } });
  } else {
    m.addLayer({ id: "footprints-fill", type: "fill", source: "footprints", paint: { "fill-color": "#9AABBD", "fill-opacity": 0.18 } });
  }
  m.addLayer({ id: "area-fill", type: "fill", source: "area", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#FFB020", "fill-opacity": 0.08 } });
  m.addLayer({ id: "area-line", type: "line", source: "area", paint: { "line-color": "#FFB020", "line-width": 2, "line-dasharray": [2, 1] } });
  m.addLayer({ id: "path", type: "line", source: "path", paint: { "line-color": "#22D3EE", "line-width": 1.5, "line-opacity": 0.8 } });
  m.addLayer({ id: "trail", type: "line", source: "trail", paint: { "line-color": "#34D399", "line-width": 3 } });
  m.addLayer({ id: "waypoints", type: "circle", source: "waypoints", paint: { "circle-radius": 3, "circle-color": ["case", ["==", ["get", "bad"], 1], "#F87171", "#22D3EE"], "circle-stroke-color": "#0A0F14", "circle-stroke-width": 1 } });
  m.addLayer({ id: "media", type: "circle", source: "media", paint: { "circle-radius": 4, "circle-color": "#A78BFA", "circle-stroke-color": "#0A0F14", "circle-stroke-width": 1 } });
  m.addLayer({ id: "assets", type: "circle", source: "assets", paint: { "circle-radius": 5, "circle-color": "#E8EEF4", "circle-stroke-color": "#0A0F14", "circle-stroke-width": 1.5 } });
  m.addLayer({ id: "findings", type: "circle", source: "findings", paint: { "circle-radius": 7, "circle-color": ["get", "color"], "circle-stroke-color": "#0A0F14", "circle-stroke-width": 2 } });
  m.addLayer({ id: "pins", type: "circle", source: "pins", paint: { "circle-radius": 8, "circle-color": ["get", "color"], "circle-stroke-color": "#0A0F14", "circle-stroke-width": 2 } });

  const popup = (layer: string, html: (p: Record<string, unknown>) => string) => {
    m.on("click", layer, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      if (layer === "pins" && f.properties?.href) { window.location.href = String(f.properties.href); return; }
      new maplibregl.Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(html(f.properties ?? {})).addTo(m);
    });
    m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
    m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
  };
  const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  popup("assets", (p) => `<b>${esc(p.name)}</b>`);
  popup("findings", (p) => `<b>${esc(p.title)}</b><br/>Severity: ${esc(p.severity)}`);
  popup("media", (p) => esc(p.name));
  popup("pins", (p) => esc(p.label));
  popup("sites-fill", (p) => `<b>${esc(p.name)}</b>`);
  popup("nofly-fill", (p) => `No-fly zone: ${esc(p.name)}`);
}
