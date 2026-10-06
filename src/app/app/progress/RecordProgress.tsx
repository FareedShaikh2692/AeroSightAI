"use client";
import { useActionState, useState } from "react";
import { recordProgressAction, type ActionState } from "../actions";
import { FormError } from "@/components/ui";

export function RecordProgress({ projectId, milestones, willAutoApprove }: { projectId: string; milestones: { id: string; name: string; actual: number }[]; willAutoApprove: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordProgressAction, {});
  const [mid, setMid] = useState(milestones.find((m) => m.actual < 100)?.id ?? milestones[0]?.id);
  const current = milestones.find((m) => m.id === mid);
  const [pct, setPct] = useState(Math.min(100, Math.round((current?.actual ?? 0) + 5)));
  return (
    <form action={action} className="space-y-3">
      <FormError error={state.error} />{state.ok && <p className="text-sm text-ok">{state.ok}</p>}
      <input type="hidden" name="projectId" value={projectId} />
      <div><label className="label" htmlFor="milestoneId">Milestone</label>
        <select id="milestoneId" name="milestoneId" className="input" value={mid} onChange={(e) => { setMid(e.target.value); setPct(Math.min(100, Math.round((milestones.find((m) => m.id === e.target.value)?.actual ?? 0) + 5))); }}>
          {milestones.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.actual}%)</option>)}</select></div>
      <div><div className="flex justify-between"><label className="label" htmlFor="percent">Percent complete</label><span className="font-mono text-xs">{pct}%</span></div>
        <input id="percent" name="percent" type="range" min={0} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full accent-[#FFB020]" /></div>
      <div><label className="label" htmlFor="recordDate">Date</label><input id="recordDate" name="recordDate" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} /></div>
      <div><label className="label" htmlFor="notes">Notes / evidence</label><textarea id="notes" name="notes" rows={2} className="input" maxLength={1000} placeholder="e.g. verified from 06 Oct orthomosaic" /></div>
      <button className="btn btn-primary w-full justify-center" disabled={pending}>Save record</button>
      <p className="text-[11px] text-ink-3">{willAutoApprove ? "You can approve progress, so this record is approved immediately." : "This record will wait for approval by a project manager."}</p>
    </form>
  );
}
