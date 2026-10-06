"use client";
import { useActionState, useState, useCallback } from "react";
import { createProjectAction, type ActionState } from "../../actions";
import { FormError } from "@/components/ui";
import { MapClient } from "@/components/MapClient";
import type { LngLat } from "@/lib/types";

export function NewProjectForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createProjectAction, {});
  const [loc, setLoc] = useState<LngLat>([55.2708, 25.2048]);
  const today = new Date().toISOString().slice(0, 10);
  const onDraw = useCallback((pts: LngLat[]) => setLoc(pts[pts.length - 1]), []);
  return (
    <form action={action} className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-4 p-6">
        <FormError error={state.error} />
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label" htmlFor="code">Code</label><input id="code" name="code" className="input font-mono uppercase" required pattern="[A-Za-z0-9-]{2,20}" placeholder="PRJ-001" /></div>
          <div className="col-span-2"><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" required maxLength={160} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="type">Type</label>
            <select id="type" name="type" className="input">{["building", "road", "bridge", "rail", "utility", "industrial", "energy", "mining", "other"].map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label className="label" htmlFor="clientName">Client</label><input id="clientName" name="clientName" className="input" maxLength={160} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="startDate">Start date</label><input id="startDate" name="startDate" type="date" className="input" required defaultValue={today} /></div>
          <div><label className="label" htmlFor="endDate">End date</label><input id="endDate" name="endDate" type="date" className="input" required /></div>
        </div>
        <div><label className="label" htmlFor="description">Description</label><textarea id="description" name="description" rows={3} className="input" maxLength={5000} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="lng">Longitude</label><input id="lng" name="lng" className="input font-mono" value={loc[0]} onChange={(e) => setLoc([Number(e.target.value), loc[1]])} /></div>
          <div><label className="label" htmlFor="lat">Latitude</label><input id="lat" name="lat" className="input font-mono" value={loc[1]} onChange={(e) => setLoc([loc[0], Number(e.target.value)])} /></div>
        </div>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create project"}</button>
      </div>
      <div>
        <p className="mb-2 text-sm text-ink-2">Click the map to set the project location.</p>
        <MapClient height={460} center={loc} zoom={11} drawMode onDrawChange={onDraw} data={{ pins: [{ id: "loc", label: "Project location", location: loc }] }} />
      </div>
    </form>
  );
}
