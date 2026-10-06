"use client";
import { useActionState } from "react";
import { generateReportAction, type ActionState } from "../actions";
import { FormError } from "@/components/ui";

const SECTIONS: [string, string][] = [["cover", "Cover"], ["executive_summary", "Executive summary"], ["kpis", "KPIs"], ["s_curve", "S-curve"], ["milestones", "Milestone table"],
  ["before_after", "Before / after imagery"], ["map", "Site map"], ["findings_summary", "Open findings"], ["missions", "Flights in period"]];

export function GenerateReport({ projects, initial }: { projects: { id: string; name: string }[]; initial?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(generateReportAction, {});
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-3">
      <FormError error={state.error} />
      <div><label className="label" htmlFor="projectId">Project</label><select id="projectId" name="projectId" className="input" defaultValue={initial ?? projects[0]?.id}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="periodStart">From</label><input id="periodStart" name="periodStart" type="date" className="input" defaultValue={start} /></div>
        <div><label className="label" htmlFor="periodEnd">To</label><input id="periodEnd" name="periodEnd" type="date" className="input" defaultValue={end} /></div>
      </div>
      <fieldset><legend className="label">Sections</legend>
        <div className="grid grid-cols-2 gap-1">{SECTIONS.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-xs"><input type="checkbox" name="sections" value={k} defaultChecked={k !== "missions"} />{l}</label>)}</div>
      </fieldset>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="aiNarrative" /> AI-assisted executive summary (Beta)</label>
      <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Generating…" : "Generate"}</button>
    </form>
  );
}
