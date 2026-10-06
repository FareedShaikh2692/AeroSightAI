"use client";
import { useCallback, useMemo, useState } from "react";
import { MapClient } from "@/components/MapClient";
import type { MapData } from "@/components/MapView";
import type { Asset, LngLat, Polygon } from "@/lib/types";
import { haversine, polygonArea } from "@/lib/geo";
import { fmtArea } from "@/lib/format";

type Layer = "boundary" | "nofly" | "assets" | "findings" | "media" | "path";
const LABELS: Record<Layer, string> = { boundary: "Site boundary", nofly: "No-fly zones", assets: "Assets", findings: "Inspection findings", media: "Media capture points", path: "Last flight path" };

export function MapsWorkspace({ site, assets, findings, media, path }: {
  site: { id: string; name: string; boundary: Polygon; noFlyZones: { id: string; name: string; geometry: Polygon }[] };
  assets: Asset[]; findings: NonNullable<MapData["findings"]>; media: NonNullable<MapData["media"]>; path: LngLat[];
}) {
  const [on, setOn] = useState<Record<Layer, boolean>>({ boundary: true, nofly: true, assets: true, findings: true, media: false, path: true });
  const [tool, setTool] = useState<"none" | "distance" | "area">("none");
  const [pts, setPts] = useState<LngLat[]>([]);
  const onDraw = useCallback((p: LngLat[]) => setPts([...p]), []);
  const distance = pts.reduce((s, p, i) => (i ? s + haversine(pts[i - 1], p) : 0), 0);
  const area = pts.length >= 3 ? polygonArea([...pts, pts[0]]) : 0;
  const data: MapData = useMemo(() => ({
    sites: on.boundary ? [{ id: site.id, name: site.name, boundary: site.boundary }] : [], noFly: on.nofly ? site.noFlyZones : [],
    assets: on.assets ? assets : [], findings: on.findings ? findings : [], media: on.media ? media : [], path: on.path ? path : [],
    area: tool === "area" && pts.length >= 3 ? [...pts, pts[0]] : tool !== "none" ? pts : undefined,
  }), [on, site, assets, findings, media, path, tool, pts]);

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Layers</div>
          {(Object.keys(LABELS) as Layer[]).map((k) => (
            <label key={k} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={on[k]} onChange={() => setOn({ ...on, [k]: !on[k] })} /> {LABELS[k]}</label>
          ))}
        </div>
        <div className="card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Measure</div>
          <div className="flex gap-1">
            {(["none", "distance", "area"] as const).map((t) => (
              <button key={t} type="button" onClick={() => { setTool(t); setPts([]); }} className={`btn h-8 flex-1 justify-center px-2 text-xs ${tool === t ? "btn-primary" : "btn-secondary"}`}>{t === "none" ? "Off" : t}</button>
            ))}
          </div>
          {tool !== "none" && (
            <div className="mt-3 text-sm">
              <p className="text-xs text-ink-3">Click points on the map.</p>
              <div className="mt-2 font-mono">{tool === "distance" ? `${distance >= 1000 ? (distance / 1000).toFixed(3) + " km" : distance.toFixed(1) + " m"}` : area ? fmtArea(area) : "—"}</div>
              <p className="mt-1 text-[11px] text-ink-3">Geodesic (WGS 84). Accuracy depends on imagery alignment.</p>
              <button type="button" className="btn btn-ghost mt-2 h-7 px-2 text-xs" onClick={() => setPts([])}>Reset</button>
            </div>
          )}
        </div>
      </div>
      <MapClient height={620} fitTo={site.boundary} initialBasemap="satellite" data={data} drawMode={tool !== "none"} onDrawChange={onDraw} />
    </div>
  );
}
