"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { MapClient } from "@/components/MapClient";
import type { MapData } from "@/components/MapView";
import type { Asset, LngLat, Polygon } from "@/lib/types";
import { haversine, polygonArea, elevationProfile, volumeAnalysis } from "@/lib/geo";
import { fmtArea } from "@/lib/format";

type Layer = "boundary" | "nofly" | "assets" | "findings" | "media" | "path";
type Tool = "none" | "distance" | "area" | "profile" | "volume";
const LABELS: Record<Layer, string> = { boundary: "Site boundary", nofly: "No-fly zones", assets: "Assets", findings: "Inspection findings", media: "Media capture points", path: "Last flight path" };
const EXAG = 1; // must match TERRAIN_EXAGGERATION in MapView

export function MapsWorkspace({ site, assets, findings, media, path }: {
  site: { id: string; name: string; boundary: Polygon; noFlyZones: { id: string; name: string; geometry: Polygon }[] };
  assets: Asset[]; findings: NonNullable<MapData["findings"]>; media: NonNullable<MapData["media"]>; path: LngLat[];
}) {
  const [on, setOn] = useState<Record<Layer, boolean>>({ boundary: true, nofly: true, assets: true, findings: true, media: false, path: true });
  const [tool, setTool] = useState<Tool>("none");
  const [terrain, setTerrain] = useState(false);
  const [pts, setPts] = useState<LngLat[]>([]);
  const [result, setResult] = useState<ReturnType<typeof elevationProfile> | ReturnType<typeof volumeAnalysis> | null | "nodata">(null);
  const mapRef = useRef<MLMap | null>(null);
  const onDraw = useCallback((p: LngLat[]) => { setPts([...p]); setResult(null); }, []);
  const onReady = useCallback((m: MLMap) => { mapRef.current = m; }, []);

  const distance = pts.reduce((s, p, i) => (i ? s + haversine(pts[i - 1], p) : 0), 0);
  const area = pts.length >= 3 ? polygonArea([...pts, pts[0]]) : 0;
  const polyTool = tool === "area" || tool === "volume";
  const data: MapData = useMemo(() => ({
    sites: on.boundary ? [{ id: site.id, name: site.name, boundary: site.boundary }] : [], noFly: on.nofly ? site.noFlyZones : [],
    assets: on.assets ? assets : [], findings: on.findings ? findings : [], media: on.media ? media : [], path: on.path ? path : [],
    area: polyTool && pts.length >= 3 ? [...pts, pts[0]] : tool !== "none" ? pts : undefined,
  }), [on, site, assets, findings, media, path, tool, pts, polyTool]);

  const sampler = (p: LngLat) => {
    const z = mapRef.current?.queryTerrainElevation(p);
    return z === null || z === undefined ? null : z / EXAG;
  };
  const compute = () => {
    if (!terrain || !mapRef.current) return;
    const r = tool === "profile" ? elevationProfile(pts, sampler) : volumeAnalysis([...pts, pts[0]], sampler);
    setResult(r ?? "nodata");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Layers</div>
          {(Object.keys(LABELS) as Layer[]).map((k) => (
            <label key={k} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={on[k]} onChange={() => setOn({ ...on, [k]: !on[k] })} /> {LABELS[k]}</label>
          ))}
          <label className="mt-2 flex items-center gap-2 border-t border-line pt-2 text-sm"><input type="checkbox" checked={terrain} onChange={() => { setTerrain(!terrain); setResult(null); }} /> 3D terrain (real elevation)</label>
        </div>
        <div className="card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Tools</div>
          <div className="grid grid-cols-3 gap-1">
            {(["none", "distance", "area", "profile", "volume"] as Tool[]).map((t) => (
              <button key={t} type="button" onClick={() => { setTool(t); setPts([]); setResult(null); if ((t === "profile" || t === "volume") && !terrain) setTerrain(true); }}
                className={`btn h-8 justify-center px-1 text-xs capitalize ${tool === t ? "btn-primary" : "btn-secondary"}`}>{t === "none" ? "Off" : t}</button>
            ))}
          </div>
          {tool !== "none" && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-xs text-ink-3">{polyTool ? "Click at least 3 points to outline an area." : "Click points to draw a line."}</p>
              {tool === "distance" && <div className="font-mono">{distance >= 1000 ? `${(distance / 1000).toFixed(3)} km` : `${distance.toFixed(1)} m`}</div>}
              {tool === "area" && <div className="font-mono">{area ? fmtArea(area) : "—"}</div>}
              {(tool === "profile" || tool === "volume") && (
                <button type="button" className="btn btn-primary h-8 w-full justify-center text-xs" onClick={compute}
                  disabled={tool === "profile" ? pts.length < 2 : pts.length < 3}>Compute {tool === "profile" ? "elevation profile" : "cut / fill volume"}</button>
              )}
              <button type="button" className="btn btn-ghost h-7 px-2 text-xs" onClick={() => { setPts([]); setResult(null); }}>Reset</button>
            </div>
          )}
        </div>
        {result && <ResultPanel tool={tool} result={result} />}
        {(tool === "profile" || tool === "volume") && <p className="text-[11px] leading-snug text-ink-3">Uses public terrain elevation (≈30 m resolution, bare earth). Survey-grade volumes need a DSM from a processed survey (NodeODM / photogrammetry integration).</p>}
      </div>
      <MapClient height={640} fitTo={site.boundary} initialBasemap="satellite" data={data} drawMode={tool !== "none"} onDrawChange={onDraw} terrain={terrain} onReady={onReady} />
    </div>
  );
}

function ResultPanel({ tool, result }: { tool: Tool; result: NonNullable<ReturnType<typeof elevationProfile>> | NonNullable<ReturnType<typeof volumeAnalysis>> | "nodata" }) {
  if (result === "nodata") return <div className="card p-4 text-sm text-warn">No elevation data loaded for this area yet. Zoom so the whole shape is visible with terrain on, then compute again.</div>;
  if (tool === "profile" && "points" in result) {
    const W = 260, H = 110, zs = result.points.map((p) => p.z ?? result.min);
    const span = Math.max(1, result.max - result.min);
    const d = zs.map((z, i) => `${i ? "L" : "M"}${((i / (zs.length - 1)) * W).toFixed(1)},${(H - ((z - result.min) / span) * (H - 10) - 5).toFixed(1)}`).join("");
    return (
      <div className="card p-4 text-sm">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Elevation profile"><path d={`${d}L${W},${H}L0,${H}Z`} fill="rgba(34,211,238,.15)" /><path d={d} fill="none" stroke="#22D3EE" strokeWidth="1.5" /></svg>
        <dl className="mt-2 grid grid-cols-2 gap-y-1 font-mono text-xs">
          <dt className="text-ink-3">Length</dt><dd>{result.lengthM.toFixed(0)} m</dd><dt className="text-ink-3">Min / max</dt><dd>{result.min.toFixed(1)} / {result.max.toFixed(1)} m</dd>
          <dt className="text-ink-3">Gain / loss</dt><dd>+{result.gain.toFixed(1)} / −{result.loss.toFixed(1)} m</dd><dt className="text-ink-3">Avg slope</dt><dd>{result.avgSlopePct.toFixed(2)}%</dd>
        </dl>
      </div>
    );
  }
  if ("cutM3" in result) {
    return (
      <div className="card p-4 text-sm">
        <dl className="grid grid-cols-2 gap-y-1 font-mono text-xs">
          <dt className="text-ink-3">Area</dt><dd>{fmtArea(result.areaM2)}</dd><dt className="text-ink-3">Base plane</dt><dd>{result.baseElevationM.toFixed(2)} m (avg edge)</dd>
          <dt className="text-ink-3">Cut</dt><dd className="text-bad">{Math.round(result.cutM3).toLocaleString()} m³</dd><dt className="text-ink-3">Fill</dt><dd className="text-info">{Math.round(result.fillM3).toLocaleString()} m³</dd>
          <dt className="text-ink-3">Net</dt><dd>{Math.round(result.netM3).toLocaleString()} m³</dd><dt className="text-ink-3">Grid</dt><dd>{result.cells} cells @ {result.cellSizeM.toFixed(1)} m</dd>
        </dl>
      </div>
    );
  }
  return null;
}
