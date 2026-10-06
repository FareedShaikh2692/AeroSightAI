"use client";
import { useActionState, useState } from "react";
import { createInspectionAction, type ActionState } from "../../actions";
import { FormError } from "@/components/ui";

type Opt = { id: string; label: string };
export function NewInspectionForm({ sites, templates, assignees, reviewers }: { sites: { id: string; name: string; assets: Opt[] }[]; templates: Opt[]; assignees: Opt[]; reviewers: Opt[] }) {
  const [s, a, p] = useActionState<ActionState, FormData>(createInspectionAction, {});
  const [siteId, setSiteId] = useState(sites[0].id);
  const due = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  return (
    <form action={a} className="card grid max-w-3xl gap-4 p-6 md:grid-cols-2">
      <div className="md:col-span-2"><FormError error={s.error} /></div>
      <div><label className="label" htmlFor="siteId">Site</label><select id="siteId" name="siteId" className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>{sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div><label className="label" htmlFor="assetId">Asset (optional)</label><select id="assetId" name="assetId" className="input"><option value="">—</option>{sites.find((x) => x.id === siteId)!.assets.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
      <div><label className="label" htmlFor="templateId">Template</label><select id="templateId" name="templateId" className="input">{templates.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
      <div><label className="label" htmlFor="type">Type</label><select id="type" name="type" className="input">{["routine", "safety", "quality", "structural", "handover", "incident"].map((t) => <option key={t}>{t}</option>)}</select></div>
      <div className="md:col-span-2"><label className="label" htmlFor="title">Title (optional)</label><input id="title" name="title" className="input" maxLength={160} placeholder="Defaults to the template name" /></div>
      <div><label className="label" htmlFor="assigneeId">Inspector</label><select id="assigneeId" name="assigneeId" className="input">{assignees.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
      <div><label className="label" htmlFor="reviewerId">Reviewer (approves)</label><select id="reviewerId" name="reviewerId" className="input">{reviewers.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
      <div><label className="label" htmlFor="dueDate">Due date</label><input id="dueDate" name="dueDate" type="date" className="input" defaultValue={due} required /></div>
      <div className="flex items-end"><button className="btn btn-primary w-full justify-center" disabled={p}>Schedule inspection</button></div>
    </form>
  );
}
