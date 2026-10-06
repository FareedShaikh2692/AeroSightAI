import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Card, Kpi, Forbidden, Progress } from "@/components/ui";
import { fmtBytes } from "@/lib/format";
import { db } from "@/lib/store";

export default async function Analytics() {
  const ctx = await requireContext();
  if (!can(ctx, "analytics:read")) return <Forbidden perm="analytics:read" />;
  // ANALYTICS-006: every aggregate below is computed only over projects the user can access.
  const projects = repo.listProjects(ctx);
  const missions = can(ctx, "mission:read") ? repo.listMissions(ctx) : [];
  const findings = can(ctx, "inspection:read") ? repo.listFindings(ctx) : [];
  const media = repo.listMedia(ctx);
  const done = missions.filter((m) => m.status === "completed");
  const hours = done.reduce((s, m) => s + (m.summary?.durationS ?? 0), 0) / 3600;
  const aborted = missions.filter((m) => m.status === "aborted").length;
  const sev = (["critical", "high", "medium", "low"] as const).map((s) => [s, findings.filter((f) => f.severity === s && !["closed", "verified"].includes(f.status)).length] as const);
  const maxSev = Math.max(1, ...sev.map(([, n]) => n));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - i * 7 * 86_400_000, start = end - 7 * 86_400_000;
    return { label: new Date(start).toISOString().slice(5, 10), n: missions.filter((m) => m.actualStart && Date.parse(m.actualStart) >= start && Date.parse(m.actualStart) < end).length };
  }).reverse();
  const maxW = Math.max(1, ...weeks.map((w) => w.n));
  const storage = db().media.filter((m) => m.organizationId === ctx.orgId).reduce((s, m) => s + m.sizeBytes, 0);
  return (
    <>
      <PageHeader eyebrow="Overview" title="Analytics" subtitle={`Computed across ${projects.length} accessible project(s). Data as of ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Flights completed" value={done.length} /><Kpi label="Flight hours" value={hours.toFixed(1)} /><Kpi label="Abort rate" value={missions.length ? `${((aborted / missions.length) * 100).toFixed(0)}%` : "—"} />
        <Kpi label="Media items" value={media.length} /><Kpi label="Storage used (org)" value={fmtBytes(storage)} hint="plan limit 2 TB" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Flights per week">
          <div className="flex h-40 items-end gap-2">{weeks.map((w) => (
            <div key={w.label} className="flex flex-1 flex-col items-center gap-1"><span className="font-mono text-[10px] text-ink-3">{w.n}</span>
              <div className="w-full rounded-t bg-data/70" style={{ height: `${(w.n / maxW) * 100}%`, minHeight: 2 }} /><span className="font-mono text-[10px] text-ink-3">{w.label}</span></div>
          ))}</div>
        </Card>
        <Card title="Open findings by severity">
          <div className="space-y-3">{sev.map(([s, n]) => (
            <div key={s} className="flex items-center gap-3 text-sm"><span className="w-16 capitalize text-ink-2">{s}</span>
              <div className="h-3 flex-1 rounded bg-white/5"><div className={`h-3 rounded ${s === "critical" ? "bg-bad" : s === "high" ? "bg-high" : s === "medium" ? "bg-warn" : "bg-info"}`} style={{ width: `${(n / maxSev) * 100}%` }} /></div>
              <span className="w-6 text-right font-mono">{n}</span></div>
          ))}</div>
        </Card>
        <Card title="Project progress vs plan" className="xl:col-span-2">
          <div className="space-y-4">{projects.map((p) => { const pr = repo.projectProgress(ctx, p.id); return (
            <div key={p.id}><div className="mb-1 flex justify-between text-sm"><span>{p.name}</span><span className="font-mono text-xs text-ink-2">{pr.actualPct}% / plan {pr.plannedPct}%</span></div>
              <div className="relative"><Progress value={pr.actualPct} tone={pr.status === "delayed" ? "bad" : pr.status === "at_risk" ? "warn" : "ok"} />
                <div className="absolute top-[-3px] h-3 w-0.5 bg-data" style={{ left: `${pr.plannedPct}%` }} title="Planned" /></div></div>
          ); })}</div>
        </Card>
      </div>
    </>
  );
}
