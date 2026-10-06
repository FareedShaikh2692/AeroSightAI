"use client";
import { useActionState } from "react";
import { inviteMemberAction, type ActionState } from "../actions";
import { FormError } from "@/components/ui";
import { ROLES, ROLE_LABELS } from "@/lib/permissions";

export function InviteMember({ canGrantAdmin }: { canGrantAdmin: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteMemberAction, {});
  return (
    <form action={action} className="space-y-3">
      <FormError error={state.error} />{state.ok && <p className="text-sm text-ok">{state.ok}</p>}
      <div><label className="label" htmlFor="fullName">Name</label><input id="fullName" name="fullName" className="input" maxLength={120} /></div>
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required /></div>
      <div><label className="label" htmlFor="role">Organization role</label><select id="role" name="role" className="input" defaultValue="viewer">
        {ROLES.filter((r) => canGrantAdmin || (r !== "org_owner" && r !== "org_admin")).filter((r) => r !== "org_owner").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
      <button className="btn btn-primary w-full justify-center" disabled={pending}>Add member</button>
      <p className="text-[11px] text-ink-3">Production sends an expiring email invitation. This demo creates the account directly.</p>
    </form>
  );
}
