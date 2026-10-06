import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, StatusBadge, Empty, Forbidden, Kpi } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export default async function Inspections() {
  const ctx = await requireContext();
  if (!can(ctx, "inspection:read")) return <Forbidden perm="inspection:read" />;
  const inspections = repo.listInspections(ctx);
  const findings = repo.listFindings(ctx);
  const sites = new Map(repo.listSites(ctx).map((s) => [s.id, s]));
  const open = findings.filter((f) => ["open", "in_progress"].includes(f.status));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader eyebrow="Data" title="Inspections" subtitle="Checklists, findings and approvals."
        actions={<><Link href="/app/inspections/templates" className="btn btn-secondary">Templates</Link>{can(ctx, "inspection:assign") && <Link href="/app/inspections/new" className="btn btn-primary">Schedule inspection</Link>}</>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Open findings" value={open.length} />
        <Kpi label="Critical / high" value={open.filter((f) => f.severity === "critical" || f.severity === "high").length} tone="bad" />
        <Kpi label="Overdue" value={open.filter((f) => f.dueDate < today).length} tone="warn" />
        <Kpi label="Awaiting review" value={inspections.filter((i) => i.status === "submitted").length} />
      </div>
      {inspections.length === 0 ? <Empty title="No inspections" /> : (
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>Inspection</th><th>Site</th><th>Assignee · Reviewer</th><th>Due</th><th>Findings</th><th>Status</th></tr></thead>
          <tbody>{inspections.map((i) => {
            const fs = findings.filter((f) => f.inspectionId === i.id);
            return (
              <tr key={i.id}>
                <td><Link href={`/app/inspections/${i.id}`} className="hover:text-accent">{i.title}</Link><div className="font-mono text-[11px] text-ink-3">{i.code} · {i.type}</div></td>
                <td className="text-ink-2">{sites.get(i.siteId)?.name}</td>
                <td className="text-xs text-ink-2">{repo.userName(i.assigneeId)} · {repo.userName(i.reviewerId)}</td>
                <td className={`text-xs ${i.dueDate < today && !["approved", "closed"].includes(i.status) ? "text-bad" : ""}`}>{fmtDate(i.dueDate)}</td>
                <td className="flex gap-1">{(["critical", "high", "medium", "low"] as const).map((s) => { const n = fs.filter((f) => f.severity === s).length; return n ? <StatusBadge key={s} status={s} /> : null; })}{fs.length === 0 && <span className="text-xs text-ink-3">none</span>}</td>
                <td><StatusBadge status={i.status} /></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </>
  );
}
