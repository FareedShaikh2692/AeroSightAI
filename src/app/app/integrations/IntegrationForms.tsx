"use client";
import { useActionState } from "react";
import { FormError } from "@/components/ui";
import { createRuleAction, testRuleAction, createWebhookAction, testWebhookAction, createApiKeyAction, connectProviderAction, type IntState } from "./actions";

function Result({ s }: { s: IntState }) {
  return (
    <>
      <FormError error={s.error} />
      {s.ok && <p className="text-sm text-ok">{s.ok}</p>}
      {s.secret && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 p-3">
          <code className="block break-all font-mono text-xs text-accent">{s.secret}</code>
          <button type="button" className="btn btn-secondary mt-2 h-7 text-xs" onClick={() => navigator.clipboard?.writeText(s.secret!)}>Copy</button>
        </div>
      )}
    </>
  );
}

const CATS = ["missions", "telemetry", "inspections", "progress", "reports", "ai", "fleet"];

export function RuleForm() {
  const [s, a, p] = useActionState<IntState, FormData>(createRuleAction, {});
  return (
    <form action={a} className="space-y-3">
      <Result s={s} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="channel">Channel</label><select id="channel" name="channel" className="input"><option value="slack">Slack</option><option value="teams">Microsoft Teams</option></select></div>
        <div><label className="label" htmlFor="rname">Name</label><input id="rname" name="name" className="input" placeholder="#site-alerts" maxLength={60} /></div>
      </div>
      <div><label className="label" htmlFor="url">Incoming webhook URL</label><input id="url" name="url" type="url" className="input font-mono text-xs" placeholder="https://hooks.slack.com/services/…" required /></div>
      <fieldset><legend className="label">Categories</legend><div className="flex flex-wrap gap-3">{CATS.map((c) => <label key={c} className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="categories" value={c} defaultChecked={["inspections", "telemetry", "missions"].includes(c)} />{c}</label>)}</div></fieldset>
      <div><label className="label" htmlFor="minSeverity">Minimum severity</label><select id="minSeverity" name="minSeverity" className="input w-48" defaultValue="warning"><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select></div>
      <button className="btn btn-primary" disabled={p}>Connect channel</button>
    </form>
  );
}

export function TestRule({ id }: { id: string }) {
  const [s, a, p] = useActionState<IntState, FormData>(testRuleAction, {});
  return <form action={a} className="inline-flex flex-col gap-1"><input type="hidden" name="id" value={id} /><button className="btn btn-secondary h-8 text-xs" disabled={p}>Send test</button><Result s={s} /></form>;
}

export function WebhookForm({ events }: { events: { key: string; label: string }[] }) {
  const [s, a, p] = useActionState<IntState, FormData>(createWebhookAction, {});
  return (
    <form action={a} className="space-y-3">
      <Result s={s} />
      <div><label className="label" htmlFor="wurl">Endpoint URL (https)</label><input id="wurl" name="url" type="url" className="input font-mono text-xs" placeholder="https://example.com/aerosight-hook" required /></div>
      <fieldset><legend className="label">Events</legend><div className="grid grid-cols-2 gap-1">{events.map((e) => <label key={e.key} className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="events" value={e.key} defaultChecked={e.key.startsWith("mission.") || e.key === "finding.created"} />{e.label}</label>)}</div></fieldset>
      <button className="btn btn-primary" disabled={p}>Create webhook</button>
      <p className="text-[11px] text-ink-3">Requests are signed: header <code>X-AeroSight-Signature: v1=HMAC_SHA256(secret, timestamp + &quot;.&quot; + body)</code>. Private and internal addresses are rejected.</p>
    </form>
  );
}

export function TestWebhook({ id }: { id: string }) {
  const [s, a, p] = useActionState<IntState, FormData>(testWebhookAction, {});
  return <form action={a} className="inline-flex flex-col gap-1"><input type="hidden" name="id" value={id} /><button className="btn btn-secondary h-8 text-xs" disabled={p}>{p ? "Sending…" : "Send test"}</button><Result s={s} /></form>;
}

export function ApiKeyForm({ perms, projects }: { perms: string[]; projects: { id: string; name: string }[] }) {
  const [s, a, p] = useActionState<IntState, FormData>(createApiKeyAction, {});
  const readPerms = perms.filter((x) => x.endsWith(":read"));
  return (
    <form action={a} className="space-y-3">
      <Result s={s} />
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label" htmlFor="kname">Name</label><input id="kname" name="name" className="input" required maxLength={60} placeholder="BI export" /></div>
        <div><label className="label" htmlFor="projectId">Project scope</label><select id="projectId" name="projectId" className="input"><option value="">All accessible</option>{projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div><label className="label" htmlFor="expiresInDays">Expires in (days)</label><input id="expiresInDays" name="expiresInDays" type="number" min={1} max={365} defaultValue={90} className="input" /></div>
      </div>
      <fieldset><legend className="label">Permissions (subset of yours)</legend>
        <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded border border-line p-2 md:grid-cols-3">{perms.map((x) => <label key={x} className="flex items-center gap-1.5 font-mono text-[11px]"><input type="checkbox" name="permissions" value={x} defaultChecked={readPerms.includes(x)} />{x}</label>)}</div>
      </fieldset>
      <button className="btn btn-primary" disabled={p}>Create API key</button>
      <p className="text-[11px] text-ink-3">Use as <code>Authorization: ApiKey &lt;key&gt;</code> against <code>/api/v1/*</code>.</p>
    </form>
  );
}

export function ProviderForm({ provider, current }: { provider: "dji_cloud" | "nodeodm"; current?: { baseUrl?: string; appId?: string } }) {
  const [s, a, p] = useActionState<IntState, FormData>(connectProviderAction, {});
  return (
    <form action={a} className="space-y-3">
      <Result s={s} />
      <input type="hidden" name="provider" value={provider} />
      <div><label className="label" htmlFor={`${provider}-url`}>{provider === "nodeodm" ? "NodeODM URL" : "Cloud gateway URL"}</label>
        <input id={`${provider}-url`} name="baseUrl" type="url" defaultValue={current?.baseUrl} className="input font-mono text-xs" placeholder={provider === "nodeodm" ? "https://odm.example.com" : "https://dji-gateway.example.com"} required /></div>
      {provider === "dji_cloud" && <div><label className="label" htmlFor="appId">App ID</label><input id="appId" name="appId" defaultValue={current?.appId} className="input font-mono" /></div>}
      <div><label className="label" htmlFor={`${provider}-secret`}>{provider === "nodeodm" ? "Token (optional)" : "App Key"}</label><input id={`${provider}-secret`} name="secret" type="password" className="input" autoComplete="off" /></div>
      <button className="btn btn-primary" disabled={p}>{p ? "Testing…" : current ? "Update & test" : "Connect & test"}</button>
    </form>
  );
}
