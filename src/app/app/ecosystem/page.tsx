import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { PageHeader, Card, Badge, Forbidden } from "@/components/ui";
import { ADAPTERS, CAP_LABELS, type Cap, type AdapterStatus } from "@/lib/adapters";
import { toggleAdapterAction } from "./actions";

const TONE: Record<AdapterStatus, "ok" | "info" | "accent"> = { verified: "ok", prototype: "info", integration_required: "accent" };
const LABEL: Record<AdapterStatus, string> = { verified: "verified", prototype: "prototype", integration_required: "integration required" };
const CAPS = Object.keys(CAP_LABELS) as Cap[];

export default async function Ecosystem() {
  const ctx = await requireContext();
  if (!can(ctx, "drone:read")) return <Forbidden perm="drone:read" />;
  const manage = can(ctx, "integration:manage");
  const enabled = new Set(db().orgAdapters.filter((a) => a.organizationId === ctx.orgId).map((a) => a.adapterKey));
  const drones = db().drones.filter((d) => d.organizationId === ctx.orgId && d.status !== "retired");
  const integ = db().integrations.filter((i) => i.organizationId === ctx.orgId);
  const apps = [
    { name: "Procore", kind: "Construction management", href: "/app/integrations?tab=construction", on: integ.some((i) => i.provider === "procore" && i.status === "connected") },
    { name: "Autodesk Construction Cloud", kind: "Construction management", href: "/app/integrations?tab=construction", on: integ.some((i) => i.provider === "acc" && i.status === "connected") },
    { name: "NodeODM / OpenDroneMap", kind: "Photogrammetry", href: "/app/integrations?tab=providers", on: integ.some((i) => i.provider === "nodeodm" && i.status === "connected") },
    { name: "Slack / Microsoft Teams", kind: "Messaging", href: "/app/integrations", on: db().notificationRules.some((r) => r.organizationId === ctx.orgId && r.active) },
    { name: "Okta / Entra ID / Google (OIDC)", kind: "Identity & SCIM", href: "/app/settings?tab=sso", on: db().ssoConfigs.some((c) => c.organizationId === ctx.orgId && c.enabled) },
    { name: "Splunk / Sentinel / Elastic", kind: "SIEM (audit JSONL)", href: "/app/integrations?tab=construction", on: false },
    { name: "Open-Meteo", kind: "Flight weather", href: "/app/schedules", on: true },
  ];
  return (
    <>
      <PageHeader eyebrow="Operations" title="Drone Ecosystem" subtitle="Every aircraft connects through an adapter that declares exactly what it can do. Enable an adapter to register its drones." />
      <Card title="Adapters & capabilities" pad={false}>
        <div className="overflow-x-auto"><table className="table text-sm"><thead><tr><th>Adapter</th><th>Status</th>{CAPS.map((c) => <th key={c} className="text-center">{CAP_LABELS[c]}</th>)}<th>Drones</th><th /></tr></thead><tbody>
          {ADAPTERS.map((a) => {
            const on = a.builtIn || enabled.has(a.key);
            const n = drones.filter((d) => d.providerKey === a.key).length;
            return (
              <tr key={a.key}>
                <td><div className="font-medium">{a.name}</div><div className="text-[11px] text-ink-3">{a.vendor} · {a.protocol}</div><div className="mt-1 max-w-sm text-[11px] text-ink-2">{a.requirements}</div>
                  <div className="text-[11px] text-ink-3">Models: {a.models.join(", ")}</div></td>
                <td><Badge tone={TONE[a.status]}>{LABEL[a.status]}</Badge></td>
                {CAPS.map((c) => <td key={c} className="text-center">{a.capabilities[c] ? <Badge tone={TONE[a.capabilities[c]!]}>{a.capabilities[c] === "verified" ? "✓" : a.capabilities[c] === "prototype" ? "β" : "IR"}</Badge> : <span className="text-ink-3">—</span>}</td>)}
                <td className="font-mono">{n}</td>
                <td>{a.builtIn ? <span className="text-xs text-ink-3">built in</span> : manage ? (
                  <form action={toggleAdapterAction}><input type="hidden" name="key" value={a.key} />
                    <button className={`btn h-7 text-xs ${on ? "btn-ghost" : "btn-secondary"}`} disabled={on && n > 0} title={on && n > 0 ? "Retire this adapter's drones first" : undefined}>{on ? "Disable" : "Enable"}</button></form>
                ) : on ? <Badge tone="ok">enabled</Badge> : null}</td>
              </tr>
            );
          })}
        </tbody></table></div>
        <p className="px-5 pb-4 pt-2 text-[11px] text-ink-3">✓ verified · β prototype · IR integration required. Flight commands are only sent through adapters verified for mission control. Enabling an Integration-Required adapter lets you register and track its drones (manual flights, media upload, edge-bridge telemetry where supported); live features activate once the provider connection is certified.</p>
      </Card>
      <Card title="Partner apps" className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{apps.map((x) => (
          <Link key={x.name} href={x.href} className="rounded-lg border border-line p-3 hover:border-accent">
            <div className="flex items-center justify-between"><span className="font-medium">{x.name}</span>{x.on ? <Badge tone="ok">connected</Badge> : <Badge>available</Badge>}</div>
            <div className="text-xs text-ink-3">{x.kind}</div>
          </Link>
        ))}</div>
        <p className="mt-3 text-[11px] text-ink-3">Build your own: REST API with scoped API keys, signed webhooks and workflow automations (Integrations → API keys / Webhooks, Organization → Automations).</p>
      </Card>
    </>
  );
}
