import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, StatusBadge, Progress, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export default async function Projects({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const ctx = await requireContext();
  const { q = "", status = "" } = await searchParams;
  const all = repo.listProjects(ctx);
  const projects = all.filter((p) => (!status || p.status === status) && (!q || `${p.name} ${p.code} ${p.clientName}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <PageHeader eyebrow="Work" title="Projects" subtitle={`${all.length} project(s) you can access`}
        actions={can(ctx, "project:create") ? <Link href="/app/projects/new" className="btn btn-primary">New project</Link> : undefined} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, code, client" className="input max-w-xs" aria-label="Search projects" />
        <select name="status" defaultValue={status} className="input w-40" aria-label="Status">
          <option value="">All statuses</option>{["planning", "active", "on_hold", "completed", "archived"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <button className="btn btn-secondary">Filter</button>
      </form>
      {projects.length === 0 ? <Empty title="No projects match" body="Try other filters, or ask a project manager to add you to a project." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const prog = repo.projectProgress(ctx, p.id);
            const sites = repo.listSites(ctx, p.id).length;
            return (
              <Link key={p.id} href={`/app/projects/${p.id}`} className="card block p-5 transition hover:border-line-strong">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="font-mono text-[11px] text-ink-3">{p.code}</div><div className="mt-0.5 font-semibold">{p.name}</div></div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-1 text-xs text-ink-2">{p.clientName} · {p.type} · {sites} site(s)</div>
                <div className="mt-4 flex items-center justify-between text-xs"><span className="text-ink-3">Actual vs planned</span><StatusBadge status={prog.status} /></div>
                <div className="mt-2"><Progress value={prog.actualPct} tone={prog.status === "delayed" ? "bad" : prog.status === "at_risk" ? "warn" : "ok"} /></div>
                <div className="mt-2 flex justify-between font-mono text-xs text-ink-2"><span>{prog.actualPct}%</span><span>plan {prog.plannedPct}%</span></div>
                <div className="mt-3 text-xs text-ink-3">{fmtDate(p.startDate)} → {fmtDate(p.endDate)}</div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
