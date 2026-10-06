import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, StatusBadge, SimulatedBadge, Forbidden, Card, Badge } from "@/components/ui";
import { droneStatusAction } from "../actions";
import { RegisterDrone } from "./RegisterDrone";
import { fmtDate } from "@/lib/format";
import { Drone } from "lucide-react";
import { listEdgeDevices } from "@/lib/edge";
import { ADAPTERS, adapter } from "@/lib/adapters";
import { db } from "@/lib/store";
import { CreateEdgeDevice } from "./EdgeDevices";
import { revokeEdgeDeviceAction } from "./actions";

export default async function Fleet() {
  const ctx = await requireContext();
  if (!can(ctx, "drone:read")) return <Forbidden perm="drone:read" />;
  const drones = repo.listDrones(ctx);
  const pilots = repo.listPilots(ctx);
  const edge = listEdgeDevices(ctx);
  const canEdge = can(ctx, "drone:update");
  const soon = (d: string) => Date.parse(d) - Date.now() < 30 * 86_400_000;
  return (
    <>
      <PageHeader eyebrow="Operations" title="Drone Fleet" subtitle="Aircraft, registrations, maintenance and pilot qualifications." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {drones.map((d) => (
          <div key={d.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-data/10 text-data"><Drone size={22} /></div>
              <div className="flex gap-1">{d.providerKey === "simulator" && <SimulatedBadge />}<StatusBadge status={d.status} /></div>
            </div>
            <div className="mt-3 font-semibold">{d.name}</div>
            <div className="text-xs text-ink-2">{d.manufacturer} {d.model}</div>
            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
              <dt className="text-ink-3">Serial</dt><dd className="truncate font-mono">{d.serialNumber}</dd>
              <dt className="text-ink-3">Registration</dt><dd className="font-mono">{d.registrationNumber}</dd>
              <dt className="text-ink-3">Expires</dt><dd className={soon(d.registrationExpiresAt) ? "text-warn" : ""}>{fmtDate(d.registrationExpiresAt)}</dd>
              <dt className="text-ink-3">Flight hours</dt><dd className="font-mono">{(d.totalFlightSeconds / 3600).toFixed(1)} h · {d.totalFlights}</dd>
              <dt className="text-ink-3">Provider</dt><dd>{adapter(d.providerKey)?.name ?? d.providerKey}</dd>
              <dt className="text-ink-3">Commands</dt><dd>{d.missionControlVerified ? <span className="text-ok">pause · resume · RTH</span> : <span className="text-ink-3">record only</span>}</dd>
            </dl>
            {can(ctx, "drone:update") && d.status !== "in_mission" && d.status !== "retired" && (
              <form action={droneStatusAction} className="mt-4">
                <input type="hidden" name="id" value={d.id} /><input type="hidden" name="status" value={d.status === "maintenance" ? "available" : "maintenance"} />
                <button className="btn btn-secondary h-8 w-full justify-center text-xs">{d.status === "maintenance" ? "Return to service" : "Put in maintenance"}</button>
              </form>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Pilots" pad={false}>
          <table className="table"><thead><tr><th>Pilot</th><th>License</th><th>Authority</th><th>Expires</th></tr></thead><tbody>
            {pilots.map((p) => <tr key={p.id}><td>{p.fullName}</td><td className="font-mono text-xs">{p.licenseNumber}<div className="text-ink-3">{p.licenseType}</div></td><td>{p.issuingAuthority}</td>
              <td>{Date.parse(p.licenseExpiresAt) < Date.now() ? <Badge tone="bad">expired</Badge> : soon(p.licenseExpiresAt) ? <Badge tone="warn">{fmtDate(p.licenseExpiresAt)}</Badge> : fmtDate(p.licenseExpiresAt)}</td></tr>)}
          </tbody></table>
        </Card>
        {can(ctx, "drone:register") && <Card title="Register drone"><RegisterDrone providers={ADAPTERS.filter((a) => a.builtIn || db().orgAdapters.some((o) => o.organizationId === ctx.orgId && o.adapterKey === a.key)).map((a) => ({ key: a.key, name: a.name }))} /></Card>}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Edge devices (live telemetry bridge)" pad={false}>
          <p className="px-5 pt-4 text-xs text-ink-2">A bridge next to the pilot&apos;s controller posts real telemetry to <code>POST /api/v1/ingest/telemetry</code> with <code>Authorization: Device &lt;token&gt;</code>. Each token is bound to one drone. Reference bridge: <code>scripts/edge-bridge.mjs</code>.</p>
          <table className="table mt-2"><thead><tr><th>Device</th><th>Drone</th><th>Last seen</th><th>Accepted / rejected</th><th /></tr></thead><tbody>
            {edge.length === 0 && <tr><td colSpan={5} className="text-ink-3">No edge devices yet.</td></tr>}
            {edge.map((e) => <tr key={e.id}><td>{e.name}<div className="font-mono text-[11px] text-ink-3">asai_edge_{e.prefix}_…</div></td><td>{drones.find((d) => d.id === e.droneId)?.name ?? "—"}</td>
              <td className="text-xs">{e.revokedAt ? <Badge tone="bad">revoked</Badge> : e.lastSeenAt ? fmtDate(e.lastSeenAt) : <span className="text-ink-3">never</span>}</td>
              <td className="font-mono text-xs">{e.messagesAccepted} / {e.messagesRejected}</td>
              <td>{canEdge && !e.revokedAt && <form action={revokeEdgeDeviceAction}><input type="hidden" name="id" value={e.id} /><button className="btn btn-ghost h-7 text-xs">Revoke</button></form>}</td></tr>)}
          </tbody></table>
        </Card>
        {canEdge && <Card title="Connect an edge device"><CreateEdgeDevice drones={drones.filter((d) => d.providerKey !== "simulator" && d.status !== "retired").map((d) => ({ id: d.id, name: d.name }))} /></Card>}
      </div>
    </>
  );
}
