import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { PageHeader, Badge, Forbidden, Tabs, Card, StatusBadge } from "@/components/ui";
import { EVENT_CATALOG, WEBHOOK_EVENTS } from "@/lib/events";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { RuleForm, TestRule, WebhookForm, TestWebhook, ApiKeyForm, ProviderForm } from "./IntegrationForms";
import { deleteRuleAction, toggleWebhookAction, revokeApiKeyAction, disconnectProviderAction } from "./actions";
import { fmtDate, fmtDateTime, relTime } from "@/lib/format";

export default async function Integrations({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "integration:manage")) return <Forbidden perm="integration:manage" />;
  const { tab = "channels" } = await searchParams;
  const rules = db().notificationRules.filter((r) => r.organizationId === ctx.orgId);
  const hooks = db().webhooks.filter((w) => w.organizationId === ctx.orgId);
  const deliveries = db().webhookDeliveries.filter((d) => d.organizationId === ctx.orgId).slice(-20).reverse();
  const keys = db().apiKeys.filter((k) => k.organizationId === ctx.orgId);
  const integ = db().integrations.filter((i) => i.organizationId === ctx.orgId);
  const tabs = [
    { key: "channels", label: `Slack & Teams (${rules.length})`, href: "/app/integrations" },
    { key: "webhooks", label: `Webhooks (${hooks.length})`, href: "/app/integrations?tab=webhooks" },
    { key: "keys", label: `API keys (${keys.filter((k) => !k.revokedAt).length})`, href: "/app/integrations?tab=keys" },
    { key: "providers", label: "Drone & processing", href: "/app/integrations?tab=providers" },
  ];
  return (
    <>
      <PageHeader eyebrow="Organization" title="Integrations" subtitle="Credentials and webhook URLs are encrypted at rest and never shown again. Demo build: settings live in memory and reset on restart." />
      <Tabs items={tabs} active={tab} />

      {tab === "channels" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <Card title="Connected channels" pad={false}>
            {rules.length === 0 ? <p className="p-5 text-sm text-ink-2">No channels yet. Connect a Slack or Teams incoming webhook to route alerts to a channel.</p> : (
              <table className="table"><thead><tr><th>Channel</th><th>Categories</th><th>Min severity</th><th>Last delivery</th><th /></tr></thead><tbody>
                {rules.map((r) => <tr key={r.id}><td>{r.name}<div className="font-mono text-[11px] text-ink-3">{r.channel} · {r.webhookUrlHint}</div></td>
                  <td className="text-xs">{r.categories.join(", ")}</td><td><StatusBadge status={r.minSeverity === "critical" ? "critical" : r.minSeverity === "warning" ? "medium" : "low"} /></td>
                  <td className="text-xs text-ink-2">{r.lastSentAt ? `${r.lastStatus} · ${relTime(r.lastSentAt)}` : "—"}{!r.active && <Badge tone="bad">disabled</Badge>}</td>
                  <td className="space-y-1"><TestRule id={r.id} /><form action={deleteRuleAction}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost h-7 text-xs">Remove</button></form></td></tr>)}
              </tbody></table>
            )}
          </Card>
          <Card title="Connect a channel"><RuleForm /></Card>
        </div>
      )}

      {tab === "webhooks" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <Card title="Endpoints" pad={false}>
              {hooks.length === 0 ? <p className="p-5 text-sm text-ink-2">No webhooks yet.</p> : (
                <table className="table"><thead><tr><th>Endpoint</th><th>Events</th><th>Status</th><th /></tr></thead><tbody>
                  {hooks.map((w) => <tr key={w.id}><td className="max-w-xs truncate font-mono text-xs">{w.url}</td><td className="text-xs">{w.eventTypes.length}</td>
                    <td>{w.active ? <Badge tone="ok">active</Badge> : <Badge tone="bad">{w.disabledReason ?? "disabled"}</Badge>}{w.consecutiveFailures > 0 && <div className="text-[11px] text-warn">{w.consecutiveFailures} failure(s)</div>}</td>
                    <td className="space-y-1"><TestWebhook id={w.id} />
                      <form action={toggleWebhookAction} className="flex gap-1"><input type="hidden" name="id" value={w.id} />
                        <button name="op" value="toggle" className="btn btn-ghost h-7 text-xs">{w.active ? "Disable" : "Enable"}</button>
                        <button name="op" value="delete" className="btn btn-ghost h-7 text-xs">Delete</button></form></td></tr>)}
                </tbody></table>
              )}
            </Card>
            <Card title="Recent deliveries" pad={false}>
              {deliveries.length === 0 ? <p className="p-5 text-sm text-ink-2">No deliveries yet.</p> : (
                <table className="table text-xs"><thead><tr><th>Time</th><th>Event</th><th>Attempt</th><th>Result</th><th>Duration</th></tr></thead><tbody>
                  {deliveries.map((d) => <tr key={d.id}><td>{fmtDateTime(d.deliveredAt)}</td><td className="font-mono">{d.eventType}</td><td>{d.attempt}</td>
                    <td>{d.error ? <span className="text-bad">{d.error}</span> : <span className="text-ok">HTTP {d.statusCode}</span>}</td><td className="font-mono">{d.durationMs ?? "—"} ms</td></tr>)}
                </tbody></table>
              )}
            </Card>
          </div>
          <Card title="Add webhook"><WebhookForm events={WEBHOOK_EVENTS.map((k) => ({ key: k, label: EVENT_CATALOG[k].label }))} /></Card>
        </div>
      )}

      {tab === "keys" && (
        <div className="space-y-6">
          <Card title="API keys" pad={false}>
            {keys.length === 0 ? <p className="p-5 text-sm text-ink-2">No API keys.</p> : (
              <table className="table"><thead><tr><th>Name</th><th>Key</th><th>Permissions</th><th>Expires</th><th>Last used</th><th /></tr></thead><tbody>
                {keys.map((k) => <tr key={k.id}><td>{k.name}<div className="text-[11px] text-ink-3">by {repo.userName(k.createdBy)}</div></td><td className="font-mono text-xs">asai_live_{k.prefix}_…</td>
                  <td className="text-xs">{k.permissions.length}{k.projectIds ? " · 1 project" : ""}</td><td className="text-xs">{fmtDate(k.expiresAt)}</td>
                  <td className="text-xs text-ink-2">{k.lastUsedAt ? relTime(k.lastUsedAt) : "never"}</td>
                  <td>{k.revokedAt ? <Badge>revoked</Badge> : can(ctx, "apikey:manage") && <form action={revokeApiKeyAction}><input type="hidden" name="id" value={k.id} /><button className="btn btn-ghost h-7 text-xs">Revoke</button></form>}</td></tr>)}
              </tbody></table>
            )}
          </Card>
          {can(ctx, "apikey:manage") && <Card title="Create API key"><ApiKeyForm perms={[...ROLE_PERMISSIONS[ctx.role]].filter((p) => !["org:delete", "billing:manage", "role:manage", "user:manage", "apikey:manage"].includes(p))} projects={repo.listProjects(ctx).map((p) => ({ id: p.id, name: p.name }))} /></Card>}
        </div>
      )}

      {tab === "providers" && (
        <div className="grid gap-6 xl:grid-cols-2">
          {(["dji_cloud", "nodeodm"] as const).map((prov) => {
            const i = integ.find((x) => x.provider === prov);
            return (
              <Card key={prov} title={prov === "dji_cloud" ? "DJI Cloud API (live telemetry, live video, mission upload)" : "NodeODM / OpenDroneMap (photogrammetry)"}
                actions={i ? <Badge tone={i.status === "connected" ? "ok" : "accent"}>{i.status === "connected" ? "connected" : "integration required"}</Badge> : <Badge tone="accent">integration required</Badge>}>
                <p className="mb-4 text-sm text-ink-2">{prov === "dji_cloud"
                  ? "Requires a DJI developer account, App ID/Key and licence, plus DJI Pilot 2 or Dock devices bound to your organization. Until connected, live operations use the Simulator."
                  : "Point AeroSight at your NodeODM server to process raw images into orthomosaics, DSMs and 3D models. Requires media storage (Phase 2 production) to submit images."}</p>
                {i?.lastError && <p className="mb-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">Last check {i.lastCheckedAt ? relTime(i.lastCheckedAt) : ""}: {i.lastError}</p>}
                {i?.status === "connected" && <p className="mb-3 text-xs text-ok">Last check {i.lastCheckedAt ? relTime(i.lastCheckedAt) : ""}: OK</p>}
                <ProviderForm provider={prov} current={i ? { baseUrl: i.config.baseUrl, appId: i.config.appId } : undefined} />
                {i && <form action={disconnectProviderAction} className="mt-2"><input type="hidden" name="id" value={i.id} /><button className="btn btn-ghost h-8 text-xs">Disconnect</button></form>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
