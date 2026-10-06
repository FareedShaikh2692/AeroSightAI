"use client";
import { useActionState, useState } from "react";
import { FormError } from "@/components/ui";
import { analyzeAction, decideAction, type AiState } from "./actions";

export function AnalyzeForm({ projects, engine }: { projects: { id: string; name: string }[]; engine: string }) {
  const [s, a, p] = useActionState<AiState, FormData>(analyzeAction, {});
  return (
    <form action={a} className="flex flex-wrap items-end gap-2">
      <div className="w-full"><FormError error={s.error} />{s.ok && <p className="text-sm text-ok">{s.ok}</p>}</div>
      <div><label className="label" htmlFor="projectId">Project</label><select id="projectId" name="projectId" className="input w-72">{projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <button className="btn btn-primary" disabled={p}>{p ? "Analyzing…" : "Analyze progress"}</button>
      <span className="text-xs text-ink-3">Engine: {engine}</span>
    </form>
  );
}

export function Decide({ id, proposed }: { id: string; proposed: number }) {
  const [s, a, p] = useActionState<AiState, FormData>(decideAction, {});
  const [mode, setMode] = useState<"none" | "edit" | "reject">("none");
  return (
    <div className="space-y-2">
      <FormError error={s.error} />
      <div className="flex flex-wrap gap-1">
        <form action={a}><input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value="accepted" /><button className="btn btn-primary h-8 text-xs" disabled={p}>Accept {proposed}%</button></form>
        <button type="button" className="btn btn-secondary h-8 text-xs" onClick={() => setMode("edit")}>Edit</button>
        <button type="button" className="btn btn-danger h-8 text-xs" onClick={() => setMode("reject")}>Reject</button>
      </div>
      {mode === "edit" && <form action={a} className="flex gap-2"><input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value="edited" />
        <input name="percent" type="number" min={0} max={100} defaultValue={proposed} className="input h-8 w-24" aria-label="Percent" /><button className="btn btn-primary h-8 text-xs">Save</button></form>}
      {mode === "reject" && <form action={a} className="flex gap-2"><input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value="rejected" />
        <input name="reason" required minLength={3} className="input h-8" placeholder="Reason" /><button className="btn btn-danger h-8 text-xs">Reject</button></form>}
    </div>
  );
}
