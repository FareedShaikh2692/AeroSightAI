"use client";
import { useActionState, useState } from "react";
import { inspectionTransitionAction, createFindingAction, type ActionState } from "../../actions";
import { FormError } from "@/components/ui";

const LABEL: Record<string, string> = { start: "Start inspection", submit: "Submit for review", approve: "Approve", reject: "Reject", close: "Close inspection" };

export function InspectionActions({ id, actions }: { id: string; actions: { action: string; allowed: boolean; why: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(inspectionTransitionAction, {});
  const [reject, setReject] = useState(false);
  if (!actions.length) return <p className="text-sm text-ink-2">No further workflow steps.</p>;
  return (
    <div className="space-y-3">
      <FormError error={state.error} />
      <div className="flex flex-wrap gap-2">
        {actions.filter((a) => a.action !== "reject").map((a) => (
          <form key={a.action} action={formAction}>
            <input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={a.action} />
            <button className="btn btn-primary" disabled={!a.allowed || pending} title={a.allowed ? undefined : a.why}>{LABEL[a.action]}</button>
          </form>
        ))}
        {actions.some((a) => a.action === "reject") && (
          <button type="button" className="btn btn-danger" disabled={!actions.find((a) => a.action === "reject")!.allowed} onClick={() => setReject(true)}>Reject</button>
        )}
      </div>
      {reject && (
        <form action={(f) => { formAction(f); setReject(false); }} className="space-y-2 rounded-lg border border-line bg-raised p-3">
          <input type="hidden" name="id" value={id} /><input type="hidden" name="action" value="reject" />
          <label className="label" htmlFor="comment">Comment for the inspector (required)</label>
          <textarea id="comment" name="comment" className="input" rows={2} required />
          <button className="btn btn-danger">Confirm rejection</button>
        </form>
      )}
    </div>
  );
}

export function NewFinding({ inspectionId, assets }: { inspectionId: string; assets: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createFindingAction, {});
  return (
    <form action={action} className="space-y-3">
      <FormError error={state.error} />{state.ok && <p className="text-sm text-ok">{state.ok}</p>}
      <input type="hidden" name="inspectionId" value={inspectionId} />
      <div><label className="label" htmlFor="ftitle">Title</label><input id="ftitle" name="title" className="input" required maxLength={160} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="severity">Severity</label><select id="severity" name="severity" className="input"><option>low</option><option>medium</option><option>high</option><option>critical</option></select></div>
        <div><label className="label" htmlFor="category">Category</label><select id="category" name="category" className="input">{["structural", "safety", "quality", "environmental", "progress", "other"].map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div><label className="label" htmlFor="assetId">Asset</label><select id="assetId" name="assetId" className="input"><option value="">—</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
      <div><label className="label" htmlFor="description">Description</label><textarea id="description" name="description" rows={2} className="input" maxLength={2000} /></div>
      <button className="btn btn-primary w-full justify-center" disabled={pending}>Add finding</button>
      <p className="text-[11px] text-ink-3">Critical and high findings notify the site manager, project manager and engineer.</p>
    </form>
  );
}
