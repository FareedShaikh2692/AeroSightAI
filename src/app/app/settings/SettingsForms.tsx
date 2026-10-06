"use client";
import { useActionState, useState, useTransition } from "react";
import { FormError } from "@/components/ui";
import {
  beginMfaAction, confirmMfaAction, disableMfaAction, regenerateCodesAction, savePreferencesAction, saveOrgSettingsAction,
  saveRetentionAction, runRetentionAction, placeHoldAction, type SettingsState,
} from "./actions";

function Ok({ s }: { s: SettingsState }) {
  return s.ok ? <p className="text-sm text-ok">{s.ok}</p> : null;
}

function Codes({ codes }: { codes?: string[] }) {
  if (!codes?.length) return null;
  return (
    <div className="rounded-lg border border-warn/40 bg-warn/10 p-3">
      <div className="grid grid-cols-2 gap-1 font-mono text-sm">{codes.map((c) => <span key={c}>{c}</span>)}</div>
      <button type="button" className="btn btn-secondary mt-3 h-8 text-xs" onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>Copy codes</button>
    </div>
  );
}

export function MfaSetup({ enabled, enforced, remainingCodes }: { enabled: boolean; enforced: boolean; remainingCodes: number }) {
  const [setup, setSetup] = useState<SettingsState | null>(null);
  const [pending, start] = useTransition();
  const [confirmState, confirm, confirming] = useActionState<SettingsState, FormData>(confirmMfaAction, {});
  const [disableState, disable] = useActionState<SettingsState, FormData>(disableMfaAction, {});
  const [regenState, regen] = useActionState<SettingsState, FormData>(regenerateCodesAction, {});

  if (confirmState.codes) return <div className="space-y-3"><Ok s={confirmState} /><Codes codes={confirmState.codes} /></div>;
  if (enabled) {
    return (
      <div className="space-y-4">
        <p className="text-sm">Two-factor authentication is <span className="text-ok">on</span>. {remainingCodes} recovery code(s) left.</p>
        <form action={regen} className="flex flex-wrap items-end gap-2">
          <FormError error={regenState.error} />
          <div><label className="label" htmlFor="rc">Current code</label><input id="rc" name="code" className="input w-32 font-mono" inputMode="numeric" maxLength={6} required /></div>
          <button className="btn btn-secondary">Regenerate recovery codes</button>
        </form>
        <Ok s={regenState} /><Codes codes={regenState.codes} />
        {enforced ? <p className="text-xs text-ink-3">Your organization requires 2FA, so it can't be turned off.</p> : (
          <form action={disable} className="space-y-2 rounded-lg border border-line p-3">
            <div className="text-sm font-medium">Turn off 2FA</div>
            <FormError error={disableState.error} /><Ok s={disableState} />
            <div className="flex flex-wrap gap-2">
              <input name="password" type="password" placeholder="Password" className="input w-48" required autoComplete="current-password" />
              <input name="code" placeholder="Code" className="input w-28 font-mono" inputMode="numeric" maxLength={6} required />
              <button className="btn btn-danger">Turn off</button>
            </div>
          </form>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">Protect your account with a time-based code from an authenticator app (Google Authenticator, 1Password, Microsoft Authenticator, Authy).</p>
      {!setup?.secret ? (
        <>
          <FormError error={setup?.error} />
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => start(async () => setSetup(await beginMfaAction()))}>Set up two-factor authentication</button>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {setup.qr && <img src={setup.qr} alt="QR code for your authenticator app" className="rounded-lg bg-white p-2" width={220} height={220} />}
          <form action={confirm} className="space-y-3">
            <p className="text-sm text-ink-2">Scan the QR code, or enter this key manually:</p>
            <code className="block break-all rounded bg-raised px-2 py-1 font-mono text-xs text-accent">{setup.secret}</code>
            <FormError error={confirmState.error} />
            <div><label className="label" htmlFor="code">6-digit code from the app</label><input id="code" name="code" className="input w-40 font-mono tracking-widest" inputMode="numeric" maxLength={6} required autoFocus /></div>
            <button className="btn btn-primary" disabled={confirming}>Verify and enable</button>
          </form>
        </div>
      )}
    </div>
  );
}

const CAT_LABEL: Record<string, string> = { missions: "Missions", telemetry: "Live alerts", inspections: "Inspections & findings", progress: "Progress", reports: "Reports", ai: "AI analyses", fleet: "Fleet & licenses", security: "Security", billing: "Billing" };

export function PreferencesForm({ prefs }: { prefs: { category: string; inApp: boolean; email: boolean; digest: boolean; mandatory: boolean }[] }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(savePreferencesAction, {});
  return (
    <form action={action}>
      <table className="table">
        <thead><tr><th>Category</th><th className="text-center">In-app</th><th className="text-center">Email</th><th className="text-center">Daily digest</th></tr></thead>
        <tbody>{prefs.map((p) => (
          <tr key={p.category}>
            <td>{CAT_LABEL[p.category]}{p.mandatory && <span className="ml-2 text-xs text-ink-3">required</span>}</td>
            {(["inApp", "email", "digest"] as const).map((k) => (
              <td key={k} className="text-center"><input type="checkbox" name={`${p.category}.${k}`} defaultChecked={p[k]} disabled={p.mandatory}
                aria-label={`${CAT_LABEL[p.category]} ${k}`} /></td>
            ))}
          </tr>
        ))}</tbody>
      </table>
      <div className="flex items-center gap-3 p-4"><button className="btn btn-primary" disabled={pending}>Save preferences</button><Ok s={state} /></div>
      <p className="px-4 pb-4 text-xs text-ink-3">Email delivery requires an email provider (not connected in the demo); preferences are stored and applied to in-app delivery. Security and billing notices are always delivered.</p>
    </form>
  );
}

export function OrgSettingsForm({ s, brandColor, disabled }: { s: Record<string, boolean>; brandColor: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveOrgSettingsAction, {});
  const rows: [string, string, string][] = [
    ["mfaRequired", "Require two-factor authentication", "Members without 2FA must enroll before they can use the app."],
    ["missionApprovalRequired", "Require mission approval", "Missions must be approved by a project manager before they can be flown."],
    ["fourEyesProgress", "Four-eyes progress approval", "Progress records can't be approved by the person who recorded them."],
    ["externalSharing", "Allow external sharing", "Reports may be shared outside the organization."],
    ["droneCommandsEnabled", "Allow drone flight commands", "Pilots can send pause, resume and return-to-home to drones whose adapter is verified for mission control."],
    ["aiEnabled", "Enable AI features", "AI progress analysis, narratives and assistant (Beta)."],
  ];
  return (
    <form action={action} className="space-y-4">
      <FormError error={state.error} /><Ok s={state} />
      {rows.map(([k, label, hint]) => (
        <label key={k} className="flex items-start gap-3"><input type="checkbox" name={k} defaultChecked={s[k]} disabled={disabled} className="mt-1" />
          <span><span className="block text-sm">{label}</span><span className="text-xs text-ink-3">{hint}</span></span></label>
      ))}
      <div className="flex items-center gap-3"><label className="label m-0" htmlFor="brandColor">Brand color</label><input id="brandColor" name="brandColor" type="color" defaultValue={brandColor} disabled={disabled} className="h-8 w-14 rounded border border-line bg-transparent" /></div>
      {!disabled && <button className="btn btn-primary" disabled={pending}>Save</button>}
    </form>
  );
}

export function RetentionForm({ rows, disabled }: { rows: { cls: string; label: string; days: number; min: number; max: number }[]; disabled: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveRetentionAction, {});
  const [runState, run, running] = useActionState<SettingsState, FormData>(runRetentionAction, {});
  const preview = runState.preview ?? state.preview;
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <FormError error={state.error} /><Ok s={state} />
        <table className="table"><thead><tr><th>Data</th><th>Keep for (days)</th><th>Allowed</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.cls}><td>{r.label}</td><td><input name={r.cls} type="number" defaultValue={r.days} min={r.min} max={r.max} className="input h-8 w-28 font-mono" disabled={disabled} /></td><td className="text-xs text-ink-3">{r.min}–{r.max}</td></tr>)}
        </tbody></table>
        {!disabled && <button className="btn btn-primary" disabled={pending}>Save and preview</button>}
      </form>
      {preview && (
        <div className="rounded-lg border border-line p-3 text-sm">
          <div className="mb-1 font-medium">{runState.preview ? "Deleted" : "Would be deleted now"}</div>
          <ul className="grid grid-cols-2 gap-1 text-xs text-ink-2 md:grid-cols-3">{Object.entries(preview).map(([k, v]) => <li key={k}>{k.replace("_", " ")}: <span className="font-mono">{v}</span></li>)}</ul>
        </div>
      )}
      {!disabled && <form action={run}><FormError error={runState.error} /><button className="btn btn-danger" disabled={running}>Enforce retention now</button>
        <p className="mt-1 text-xs text-ink-3">Production runs this daily. Data under a legal hold is never deleted.</p></form>}
    </div>
  );
}

export function LegalHoldForm({ projects }: { projects: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(placeHoldAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="w-full"><FormError error={state.error} /><Ok s={state} /></div>
      <div><label className="label" htmlFor="projectId">Scope</label><select id="projectId" name="projectId" className="input w-56"><option value="">Whole organization</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="flex-1"><label className="label" htmlFor="reason">Reason</label><input id="reason" name="reason" className="input" placeholder="e.g. Contract dispute #2026-14" required minLength={5} /></div>
      <button className="btn btn-secondary" disabled={pending}>Place hold</button>
    </form>
  );
}
