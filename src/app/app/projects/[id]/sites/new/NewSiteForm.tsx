"use client";
import { useActionState, useCallback, useState } from "react";
import { createSiteAction, type ActionState } from "../../../../actions";
import { FormError } from "@/components/ui";
import { MapClient } from "@/components/MapClient";
import type { LngLat } from "@/lib/types";
import { polygonArea, validateRing } from "@/lib/geo";
import { fmtArea } from "@/lib/format";

export function NewSiteForm({ projectId, center }: { projectId: string; center: LngLat }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createSiteAction, {});
  const [pts, setPts] = useState<LngLat[]>([]);
  const onDraw = useCallback((p: LngLat[]) => setPts([...p]), []);
  const ring = pts.length >= 3 ? [...pts, pts[0]] : null;
  const issue = ring ? validateRing(ring) : null;
  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="card h-fit space-y-4 p-6">
        <FormError error={state.error} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="boundary" value={JSON.stringify(pts)} />
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label" htmlFor="code">Code</label><input id="code" name="code" className="input font-mono uppercase" required maxLength={20} placeholder="S1" /></div>
          <div className="col-span-2"><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" required maxLength={160} /></div>
        </div>
        <div><label className="label" htmlFor="address">Address</label><input id="address" name="address" className="input" maxLength={300} /></div>
        <div className="rounded-lg border border-line p-3 text-sm">
          <div className="flex justify-between"><span className="text-ink-2">Vertices</span><span className="font-mono">{pts.length}</span></div>
          <div className="flex justify-between"><span className="text-ink-2">Area</span><span className="font-mono">{ring ? fmtArea(polygonArea(ring)) : "—"}</span></div>
          {issue && <p className="mt-2 text-xs text-bad">{issue.message}</p>}
          {!ring && <p className="mt-2 text-xs text-ink-3">Click at least 3 points on the map to outline the site.</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setPts([])}>Clear</button>
          <button type="button" className="btn btn-secondary" onClick={() => setPts(pts.slice(0, -1))} disabled={!pts.length}>Undo point</button>
        </div>
        <button className="btn btn-primary w-full justify-center" disabled={pending || !ring || !!issue}>{pending ? "Saving…" : "Create site"}</button>
      </div>
      <MapClient height={560} center={center} zoom={16} initialBasemap="satellite" drawMode onDrawChange={onDraw} data={{ area: ring ?? pts }} />
    </form>
  );
}
