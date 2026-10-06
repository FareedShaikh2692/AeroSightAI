import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, StatusBadge, Empty, Card, Forbidden } from "@/components/ui";
import { GenerateReport } from "./GenerateReport";
import { fmtDate, fmtDateTime } from "@/lib/format";

export default async function Reports({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "report:read")) return <Forbidden perm="report:read" />;
  const { project } = await searchParams;
  const reports = repo.listReports(ctx);
  const projects = repo.listProjects(ctx);
  const genProjects = projects.filter((p) => can(ctx, "report:generate", p));
  return (
    <>
      <PageHeader eyebrow="Data" title="Reports" subtitle="Branded progress reports. Viewers only see published reports." />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {reports.length === 0 ? <Empty title="No reports yet" /> : (
          <div className="card overflow-x-auto"><table className="table">
            <thead><tr><th>Report</th><th>Period</th><th>Version</th><th>Generated</th><th>Status</th></tr></thead>
            <tbody>{reports.map((r) => (
              <tr key={r.id}><td><Link href={`/app/reports/${r.id}`} className="hover:text-accent">{r.title}</Link></td>
                <td className="text-xs text-ink-2">{fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}</td><td className="font-mono">v{r.version}</td>
                <td className="text-xs text-ink-2">{fmtDateTime(r.generatedAt)} · {repo.userName(r.generatedBy)}</td><td><StatusBadge status={r.status} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
        {genProjects.length > 0 && <Card title="Generate report"><GenerateReport projects={genProjects.map((p) => ({ id: p.id, name: p.name }))} initial={project} /></Card>}
      </div>
    </>
  );
}
