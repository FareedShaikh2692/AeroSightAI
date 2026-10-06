"use client";
import { useActionState } from "react";
import { contactAction } from "./actions";
import { FormError } from "@/components/ui";

export function ContactForm() {
  const [state, action, pending] = useActionState(contactAction, {} as { error?: string; ok?: boolean });
  if (state.ok) return <div className="card mt-8 p-6 text-sm">Thanks — your message was received. (Demo environment: messages are not forwarded to a CRM.)</div>;
  return (
    <form action={action} className="card mt-8 space-y-4 p-6">
      <FormError error={state.error} />
      <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" required maxLength={120} /></div>
      <div><label className="label" htmlFor="email">Work email</label><input id="email" name="email" type="email" className="input" required /></div>
      <div><label className="label" htmlFor="company">Company</label><input id="company" name="company" className="input" required maxLength={120} /></div>
      <div><label className="label" htmlFor="message">Message</label><textarea id="message" name="message" rows={4} className="input" maxLength={2000} /></div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex gap-2 text-xs text-ink-2"><input type="checkbox" name="consent" required /> I agree to be contacted about AeroSight AI.</label>
      <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
    </form>
  );
}
