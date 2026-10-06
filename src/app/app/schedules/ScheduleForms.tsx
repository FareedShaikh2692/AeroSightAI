"use client";
import { useActionState, useState } from "react";
import { FormError } from "@/components/ui";
import { saveScheduleAction, runNowAction, type SchedState } from "./actions";

type Opt = { value: string; label: string };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ScheduleForm({ templates, drones, pilots }: { templates: Opt[]; drones: Opt[]; pilots: Opt[] }) {
  const [s, action, pending] = useActionState<SchedState, FormData>(saveScheduleAction, {});
  const [cadence, setCadence] = useState("weekly");
  if (!templates.length) return <p className="text-sm text-ink-2">Plan a mission first — schedules repeat an existing mission&apos;s flight plan.</p>;
  return (
    <form action={action} className="space-y-3">
      <FormError error={s.error} />{s.ok && <p className="text-sm text-ok">{s.ok}</p>}
      <div><label className="label" htmlFor="sc-tpl">Repeat flight plan of</label><select id="sc-tpl" name="templateMissionId" className="input">{templates.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
      <div><label className="label" htmlFor="sc-name">Name</label><input id="sc-name" name="name" className="input" placeholder="Weekly progress capture" maxLength={100} /></div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="label" htmlFor="sc-cad">Cadence</label><select id="sc-cad" name="cadence" className="input" value={cadence} onChange={(e) => setCadence(e.target.value)}>
          <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option></select></div>
        <div><label className="label" htmlFor="sc-day">{cadence === "monthly" ? "Day of month" : "Day"}</label>
          {cadence === "monthly" ? <input id="sc-day" name="weekday" type="number" min={1} max={28} defaultValue={1} className="input" />
            : <select id="sc-day" name="weekday" className="input" defaultValue={4} disabled={cadence === "daily"}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>}</div>
        <div><label className="label" htmlFor="sc-time">Local time</label><input id="sc-time" name="timeLocal" type="time" defaultValue="10:00" className="input" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label" htmlFor="sc-drone">Drone</label><select id="sc-drone" name="droneId" className="input"><option value="">Same as plan</option>{drones.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
        <div><label className="label" htmlFor="sc-pilot">Pilot</label><select id="sc-pilot" name="pilotId" className="input"><option value="">Same as plan</option>{pilots.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="weatherGate" defaultChecked className="mt-1" /><span>Weather go/no-go<span className="block text-xs text-ink-3">Flags generated flights when wind, gusts, rain or temperature are outside limits.</span></span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="autoAnalyze" defaultChecked className="mt-1" /><span>Analyze automatically<span className="block text-xs text-ink-3">When the flight is completed, run AI progress analysis and queue proposals for review.</span></span></label>
      <button className="btn btn-primary" disabled={pending}>Create schedule</button>
    </form>
  );
}

export function RunNow({ id }: { id: string }) {
  const [s, action, pending] = useActionState<SchedState, FormData>(runNowAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-secondary h-7 text-xs" disabled={pending}>{pending ? "Generating…" : "Generate next flight now"}</button>
      {(s.ok || s.error) && <p className={`mt-1 max-w-md text-[11px] ${s.error ? "text-bad" : "text-ok"}`}>{s.error ?? s.ok}</p>}
    </form>
  );
}
