"use client";
import { useActionState } from "react";
import { loginAction, type FormState } from "../actions";
import { FormError } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="mt-8 space-y-4">
      <FormError error={state.error} />
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">Work email</label>
        <input key={state.email ?? ""} id="email" name="email" type="email" autoComplete="username" required className="input" defaultValue={state.email ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
