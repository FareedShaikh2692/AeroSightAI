import { db, store, verifyAuditChain } from "@/lib/store";
import { PageHeader, Card, Kpi, StatusBadge, Badge } from "@/components/ui";
import { fmtBytes, fmtDate, fmtDateTime } from "@/lib/format";
import { BreakGlassForm } from "./BreakGlassForm";

// Platform console: tenant METADATA only — no tenant content (ADMIN-009 break-glass is out of scope for the demo).
export default async function AdminHome() {
  const d = db();
  const orgs = d.organizations.map((o) => ({
    o, seats: d.memberships.filter((m) => m.organizationId === o.id && m.status === "active").length,
    projects: d.projects.filter((p) => p.organizationId === o.id).length,
    storage: d.media.filter((m) => m.organizationId === o.id).reduce((s, m) => s + m.sizeBytes, 0),
    chain: verifyAuditChain(o.id),
  }));
  const active = d.missions.filter((m) => m.status === "in_progress").length;
  return (
    <>
      <PageHeader title="Platform overview" subtitle={`Store booted ${new Date(store().bootedAt).toISOString().slice(0, 16).replace("T", " ")} UTC · in-memory demo data`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Organizations" value={orgs.length} /><Kpi label="Users" value={d.users.length} /><Kpi label="Active flights" value={active} /><Kpi label="Audit events" value={d.auditLogs.length} />
      </div>
      <Card title="Organizations" className="mt-6" pad={false}>
        <table className="table"><thead><tr><th>Organization</th><th>Plan</th><th>Region</th><th>Seats</th><th>Projects</th><th>Storage</th><th>Audit chain</th><th>Created</th><th>Status</th></tr></thead>
          <tbody>{orgs.map(({ o, seats, projects, storage, chain }) => (
            <tr key={o.id}><td>{o.name}<div className="font-mono text-[11px] text-ink-3">{o.slug}</div></td><td className="capitalize">{o.plan}</td><td className="font-mono text-xs">{o.region}</td>
              <td className="font-mono">{seats}</td><td className="font-mono">{projects}</td><td className="font-mono text-xs">{fmtBytes(storage)}</td>
              <td>{chain.ok ? <Badge tone="ok">verified</Badge> : <Badge tone="bad">broken</Badge>}</td><td className="text-xs">{fmtDate(o.createdAt)}</td><td><StatusBadge status={o.status} /></td></tr>
          ))}</tbody></table>
      </Card>
      <Card title="Break-glass access (ADMIN-009)" className="mt-6">
        <BreakGlassForm orgs={d.organizations.map((o) => ({ id: o.id, name: o.name }))} />
        {d.breakGlassSessions.length > 0 && (
          <table className="table mt-4 text-xs"><thead><tr><th>Started</th><th>Staff</th><th>Organization</th><th>Ticket</th><th>Ends</th><th>Status</th></tr></thead><tbody>
            {d.breakGlassSessions.slice().reverse().map((b) => <tr key={b.id}><td>{fmtDateTime(b.startsAt)}</td><td>{d.users.find((u) => u.id === b.staffUserId)?.email}</td>
              <td>{d.organizations.find((o) => o.id === b.organizationId)?.name}</td><td className="font-mono">{b.ticketRef}</td><td>{fmtDateTime(b.endedEarlyAt ?? b.endsAt)}</td>
              <td>{b.endedEarlyAt ? "ended" : Date.parse(b.endsAt) > Date.now() ? <span className="text-bad">active</span> : "expired"}</td></tr>)}
          </tbody></table>
        )}
      </Card>
      <Card title="System health" className="mt-6">
        <ul className="grid gap-2 text-sm md:grid-cols-3">
          {[["Core API", "ok"], ["Telemetry stream (SSE, simulator)", "ok"], ["Data store", "in-memory (demo)"], ["Object storage", "not connected"], ["AI service", "not connected"], ["Drone providers", "simulator only"]].map(([k, v]) => (
            <li key={k} className="flex justify-between rounded-lg border border-line px-3 py-2"><span>{k}</span><span className={v === "ok" ? "text-ok" : "text-ink-2"}>{v}</span></li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-3">Staff have no tenant content access. Break-glass access (ticket + approval + time limit) is specified in ADMIN-009.</p>
      </Card>
    </>
  );
}
