import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { verifyAuditChain } from "@/lib/store";
import { PageHeader, Forbidden, Badge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export default async function Audit({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "audit:read")) return <Forbidden perm="audit:read" />;
  const { q = "" } = await searchParams;
  const rows = repo.listAudit(ctx).filter((r) => !q || `${r.action} ${r.actorLabel} ${r.entityType}`.toLowerCase().includes(q.toLowerCase()));
  const chain = verifyAuditChain(ctx.orgId);
  return (
    <>
      <PageHeader eyebrow="Organization" title="Audit logs" subtitle="Append-only, hash-chained record of significant actions. Entries cannot be edited or deleted."
        actions={chain.ok ? <Badge tone="ok">Hash chain verified · {chain.checked} entries</Badge> : <Badge tone="bad">Chain broken at {chain.brokenAt}</Badge>} />
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} className="input max-w-sm" placeholder="Filter by action, actor or entity" aria-label="Filter" /><button className="btn btn-secondary">Filter</button>
        <a href="/api/v1/audit-logs?format=csv" className="btn btn-ghost ml-auto">Export CSV</a></form>
      <div className="card overflow-x-auto"><table className="table text-xs">
        <thead><tr><th>Time (UTC)</th><th>Actor</th><th>Action</th><th>Entity</th><th>Changes</th><th>IP</th><th>Hash</th></tr></thead>
        <tbody>{rows.slice(0, 300).map((r) => (
          <tr key={r.id}><td className="whitespace-nowrap">{fmtDateTime(r.occurredAt)}</td><td>{r.actorLabel}</td><td className="font-mono text-accent">{r.action}</td>
            <td>{r.entityType}<div className="font-mono text-[10px] text-ink-3">{r.entityId?.slice(0, 8)}</div></td>
            <td className="max-w-xs truncate font-mono text-[11px] text-ink-2">{r.changes ? Object.entries(r.changes).map(([k, [a, b]]) => `${k}: ${a ?? "∅"} → ${b ?? "∅"}`).join("; ") : "—"}</td>
            <td className="font-mono text-[11px]">{r.ip ?? "—"}</td><td className="font-mono text-[10px] text-ink-3">{r.hash.slice(0, 10)}</td></tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
