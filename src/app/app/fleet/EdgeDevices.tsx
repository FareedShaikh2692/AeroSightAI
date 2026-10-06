"use client";
import { useActionState } from "react";
import { FormError } from "@/components/ui";
import { createEdgeDeviceAction, type EdgeState } from "./actions";

export function CreateEdgeDevice({ drones }: { drones: { id: string; name: string }[] }) {
  const [s, action, pending] = useActionState<EdgeState, FormData>(createEdgeDeviceAction, {});
  if (!drones.length) return <p className="text-sm text-ink-2">Register a real (non-simulated) drone first.</p>;
  return (
    <form action={action} className="space-y-3">
      <FormError error={s.error} />
      {s.ok && <p className="text-sm text-ok">{s.ok}</p>}
      {s.secret && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 p-3">
          <code className="block break-all font-mono text-xs text-accent">{s.secret}</code>
          <button type="button" className="btn btn-secondary mt-2 h-7 text-xs" onClick={() => navigator.clipboard?.writeText(s.secret!)}>Copy</button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="edge-drone">Drone</label>
          <select id="edge-drone" name="droneId" className="input">{drones.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label className="label" htmlFor="edge-name">Device name</label><input id="edge-name" name="name" className="input" placeholder="Field laptop bridge" /></div>
      </div>
      <button className="btn btn-primary" disabled={pending}>Create device token</button>
    </form>
  );
}
