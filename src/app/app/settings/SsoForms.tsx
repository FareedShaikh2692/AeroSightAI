"use client";
import { useActionState } from "react";
import { FormError } from "@/components/ui";
import { saveSsoAction, addDomainAction, verifyDomainAction, createScimTokenAction, type SsoState } from "./sso-actions";

function Result({ s }: { s: SsoState }) {
  return (
    <>
      <FormError error={s.error} />
      {s.ok && <p className="text-sm text-ok">{s.ok}</p>}
      {s.txt && (
        <div className="rounded-lg border border-line bg-raised p-3 font-mono text-xs">
          <div><span className="text-ink-3">Host </span>{s.txt.host}</div><div><span className="text-ink-3">Type </span>TXT</div>
          <div className="break-all"><span className="text-ink-3">Value </span><span className="text-accent">{s.txt.value}</span></div>
        </div>
      )}
      {s.secret && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 p-3">
          <code className="block break-all font-mono text-xs text-accent">{s.secret}</code>
          <button type="button" className="btn btn-secondary mt-2 h-7 text-xs" onClick={() => navigator.clipboard?.writeText(s.secret!)}>Copy</button>
        </div>
      )}
    </>
  );
}

export function SsoConfigForm({ c, roles, callbackUrl, hasVerifiedDomain }: {
  c?: { issuer: string; clientId: string; hasSecret: boolean; jitRole: string; enabled: boolean; enforced: boolean };
  roles: { key: string; label: string }[]; callbackUrl: string; hasVerifiedDomain: boolean;
}) {
  const [s, action, pending] = useActionState<SsoState, FormData>(saveSsoAction, {});
  return (
    <form action={action} className="space-y-3">
      <Result s={s} />
      <div><label className="label" htmlFor="sso-issuer">Issuer URL</label><input id="sso-issuer" name="issuer" className="input" defaultValue={c?.issuer} required placeholder="https://your-org.okta.com" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="sso-client">Client ID</label><input id="sso-client" name="clientId" className="input" defaultValue={c?.clientId} required /></div>
        <div><label className="label" htmlFor="sso-secret">Client secret</label><input id="sso-secret" name="clientSecret" type="password" className="input" autoComplete="off" placeholder={c?.hasSecret ? "•••••• (unchanged)" : ""} /></div>
      </div>
      <div><label className="label" htmlFor="sso-role">Role for new users (just-in-time provisioning)</label>
        <select id="sso-role" name="jitRole" className="input" defaultValue={c?.jitRole ?? "viewer"}>{roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
      <label className="flex items-start gap-3"><input type="checkbox" name="enabled" defaultChecked={c?.enabled} className="mt-1" /><span className="text-sm">Enable SSO sign-in</span></label>
      <label className="flex items-start gap-3"><input type="checkbox" name="enforced" defaultChecked={c?.enforced} disabled={!hasVerifiedDomain} className="mt-1" />
        <span><span className="block text-sm">Require SSO for verified domains</span><span className="text-xs text-ink-3">Password sign-in is refused for those emails. Owners keep password access as a recovery path.{!hasVerifiedDomain && " Verify a domain first."}</span></span></label>
      <p className="text-[11px] text-ink-3">Redirect URI to register at your IdP: <code className="break-all">{callbackUrl}</code> · scopes <code>openid email profile</code> · PKCE (S256).</p>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Checking issuer…" : "Save"}</button>
    </form>
  );
}

export function AddDomainForm() {
  const [s, action, pending] = useActionState<SsoState, FormData>(addDomainAction, {});
  return (
    <form action={action} className="space-y-2">
      <Result s={s} />
      <div className="flex gap-2"><input name="domain" className="input" placeholder="company.com" required aria-label="Domain" /><button className="btn btn-secondary shrink-0" disabled={pending}>Add domain</button></div>
    </form>
  );
}

export function VerifyDomainButton({ domain }: { domain: string }) {
  const [s, action, pending] = useActionState<SsoState, FormData>(verifyDomainAction, {});
  return (
    <form action={action} className="inline">
      <input type="hidden" name="domain" value={domain} />
      <button className="btn btn-secondary h-7 text-xs" disabled={pending}>{pending ? "Checking DNS…" : "Verify"}</button>
      {s.error && <p className="mt-1 max-w-md text-xs text-bad">{s.error}</p>}
    </form>
  );
}

export function CreateScimToken() {
  const [s, action, pending] = useActionState<SsoState>(createScimTokenAction, {});
  return (
    <form action={action} className="space-y-2">
      <Result s={s} />
      <button className="btn btn-secondary" disabled={pending}>Create SCIM token</button>
    </form>
  );
}
