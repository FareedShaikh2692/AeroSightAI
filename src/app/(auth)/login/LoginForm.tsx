"use client";
import { useActionState } from "react";
import { loginAction, mfaVerifyAction, type FormState } from "../actions";
import { FormError } from "@/components/ui";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  const [mfaState, mfaAction, mfaPending] = useActionState<FormState, FormData>(mfaVerifyAction, {});
  if (state.mfa) {
    return (
      <form action={mfaAction} className="mt-8 space-y-4">
        <FormError error={mfaState.error} />
        <p className="text-sm text-ink-2">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
        <div>
          <label className="label" htmlFor="code">Authentication code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus className="input font-mono tracking-widest" maxLength={24} />
        </div>
        <button className="btn btn-primary w-full justify-center" disabled={mfaPending}>{mfaPending ? "Verifying…" : "Verify"}</button>
      </form>
    );
  }
  return (
    <form action={action} className="mt-8 space-y-4">
      <FormError error={state.error ?? notice} />
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
