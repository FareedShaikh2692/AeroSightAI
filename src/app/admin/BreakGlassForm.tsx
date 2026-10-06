"use client";
import { useActionState } from "react";
import { startBreakGlassAction, type AdminState } from "./actions";
import { FormError } from "@/components/ui";

export function BreakGlassForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const [s, a, p] = useActionState<AdminState, FormData>(startBreakGlassAction, {});
  return (
    <form action={a} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2"><FormError error={s.error} /></div>
      <div><label className="label" htmlFor="organizationId">Organization</label><select id="organizationId" name="organizationId" className="input">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="ticketRef">Ticket</label><input id="ticketRef" name="ticketRef" className="input font-mono" placeholder="SUP-1234" required /></div>
        <div><label className="label" htmlFor="minutes">Minutes (≤ 240)</label><input id="minutes" name="minutes" type="number" min={5} max={240} defaultValue={30} className="input" /></div>
      </div>
      <div className="md:col-span-2"><label className="label" htmlFor="justification">Justification (shown to the customer&apos;s Owner)</label><textarea id="justification" name="justification" rows={2} className="input" required minLength={20} /></div>
      <div className="md:col-span-2"><button className="btn btn-danger" disabled={p}>Start read-only access</button>
        <p className="mt-1 text-xs text-ink-3">Access is read-only, expires automatically, is recorded in the customer&apos;s audit log and notifies their Owner immediately.</p></div>
    </form>
  );
}
