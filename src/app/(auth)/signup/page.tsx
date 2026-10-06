"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { signupAction, type FormState } from "../actions";
import { FormError } from "@/components/ui";
import { Logo } from "@/components/Logo";

function strength(p: string) {
  let s = 0;
  if (p.length >= 12) s++;
  if (p.length >= 16) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
}

export default function SignupPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, {});
  const [pw, setPw] = useState("");
  const s = strength(pw);
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Logo />
        <h1 className="mt-10 text-2xl font-semibold">Start your free trial</h1>
        <p className="mt-1 text-sm text-ink-2">Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link></p>
        <form action={action} className="card mt-8 space-y-4 p-6">
          <FormError error={state.error} />
          <div><label className="label" htmlFor="fullName">Full name</label><input id="fullName" name="fullName" className="input" required maxLength={120} /></div>
          <div><label className="label" htmlFor="email">Work email</label><input id="email" name="email" type="email" className="input" required autoComplete="email" /></div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="input" required minLength={12} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <div className="mt-2 flex gap-1" aria-hidden="true">{[0, 1, 2, 3].map((i) => <div key={i} className={`h-1 flex-1 rounded ${i < s ? (s >= 3 ? "bg-ok" : "bg-warn") : "bg-white/10"}`} />)}</div>
            <p className="mt-1 text-xs text-ink-3">At least 12 characters, mixing upper/lowercase, digits or symbols.</p>
          </div>
          <div><label className="label" htmlFor="organizationName">Organization name</label><input id="organizationName" name="organizationName" className="input" required maxLength={120} /></div>
          <label className="flex gap-2 text-xs text-ink-2"><input type="checkbox" name="acceptTerms" required /> I accept the terms of service and privacy policy.</label>
          <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
          <p className="text-xs text-ink-3">Demo environment: new organizations start empty and are kept in memory only.</p>
        </form>
      </div>
    </div>
  );
}
