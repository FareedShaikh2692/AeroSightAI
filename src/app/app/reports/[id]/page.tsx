import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { StatusBadge } from "@/components/ui";
import { SCurve } from "@/components/SCurve";
import { series } from "@/lib/progress";
import { publishReportAction } from "../../actions";
import { PrintButton } from "./PrintButton";
import { fmtDate, fmtDateTime, fmtDuration } from "@/lib/format";

export default async function ReportView({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  const r = repo.getReport(ctx, id);
  if (!r) notFound();
  const p = repo.getProject(ctx, r.projectId)!;
  const org = repo.currentOrg(ctx);
  const prog = repo.projectProgress(ctx, p.id, r.periodEnd);
  // REPORT-005: content assembled with the requester's own permissions.
  const sites = repo.listSites(ctx, p.id);
  const findings = can(ctx, "inspection:read", p) ? repo.listFindings(ctx).filter((f) => f.projectId === p.id && !["closed", "verified"].includes(f.status)) : [];
  const flights = can(ctx, "mission:read", p) ? repo.listMissions(ctx).filter((m) => m.projectId === p.id && m.actualStart && m.actualStart.slice(0, 10) >= r.periodStart && m.actualStart.slice(0, 10) <= r.periodEnd) : [];
  const media = repo.listMedia(ctx).filter((m) => m.projectId === p.id && m.type === "image");
  const before = media.filter((m) => m.capturedAt.slice(0, 10) <= r.periodStart).at(0) ?? media.at(-1);
  const after = media.at(0);
  const has = (s: string) => r.sections.includes(s);
  const hash = createHash("sha256").update(JSON.stringify({ id: r.id, v: r.version, at: r.generatedAt, kpi: [prog.actualPct, prog.plannedPct] })).digest("hex").slice(0, 16);
  const summary = `${p.name} is ${prog.actualPct}% complete against ${prog.plannedPct}% planned as of ${fmtDate(r.periodEnd)} (variance ${prog.scheduleVariancePct > 0 ? "+" : ""}${prog.scheduleVariancePct} pts, ${prog.status.replace("_", " ")}). ${prog.milestonesDelayed} milestone(s) are delayed. ${findings.length} finding(s) remain open${findings.some((f) => f.severity === "critical") ? ", including critical items requiring immediate action" : ""}. ${flights.length} drone flight(s) were recorded in the period.`;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><StatusBadge status={r.status} /><span className="text-xs text-ink-3">v{r.version} · generated {fmtDateTime(r.generatedAt)} by {repo.userName(r.generatedBy)}</span></div>
        <div className="flex gap-2">
          <PrintButton />
          {r.status !== "published" && can(ctx, "report:share", r) && <form action={publishReportAction}><input type="hidden" name="id" value={r.id} /><button className="btn btn-primary">Publish to viewers</button></form>}
        </div>
      </div>
      <article className="space-y-8 rounded-2xl bg-white p-10 text-[#0E1620] shadow-xl print:rounded-none print:p-0 print:shadow-none">
        {has("cover") && (
          <header className="print-page border-b-4 pb-8" style={{ borderColor: org.brandColor }}>
            <div className="text-sm font-semibold uppercase tracking-widest" style={{ color: org.brandColor === "#FFB020" ? "#C77700" : "#0891B2" }}>{org.name}</div>
            <h1 className="mt-6 text-4xl font-semibold leading-tight">{p.name}</h1>
            <p className="mt-2 text-xl text-[#4A5868]">Monthly Progress Report</p>
            <dl className="mt-8 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-[#738192]">Project code</dt><dd>{p.code}</dd><dt className="text-[#738192]">Client</dt><dd>{p.clientName}</dd>
              <dt className="text-[#738192]">Reporting period</dt><dd>{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}</dd><dt className="text-[#738192]">Sites</dt><dd>{sites.map((s) => s.name).join(", ")}</dd>
            </dl>
          </header>
        )}
        {has("executive_summary") && (
          <section><h2 className="mb-2 text-lg font-semibold">Executive summary</h2>
            <p className="leading-relaxed text-[#4A5868]">{r.narrative?.text ?? summary}</p>
            {r.narrative?.engine === "claude" && <p className="mt-2 text-[11px] text-[#0891B2]">AI-assisted ({r.narrative.model}) — not an engineering certification. Figures verified against report data.</p>}
          </section>
        )}
        {has("kpis") && (
          <section className="grid grid-cols-4 gap-3">
            {[["Actual", `${prog.actualPct}%`], ["Planned", `${prog.plannedPct}%`], ["Variance", `${prog.scheduleVariancePct}%`], ["Forecast", prog.forecastCompletion ? fmtDate(prog.forecastCompletion) : "—"]].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-[#E3E7EC] p-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-[#738192]">{k}</div><div className="mt-1 font-mono text-xl">{v}</div></div>
            ))}
          </section>
        )}
        {has("s_curve") && <section className="rounded-lg bg-[#0A0F14] p-4 text-[#E8EEF4]"><h2 className="mb-2 text-sm font-semibold">Planned vs actual (S-curve)</h2><SCurve data={series(prog.milestonesList, prog.records, p.startDate, p.endDate, 14)} height={200} /></section>}
        {has("milestones") && (
          <section><h2 className="mb-2 text-lg font-semibold">Milestones</h2>
            <table className="w-full text-sm"><thead><tr className="border-b border-[#E3E7EC] text-left text-xs uppercase text-[#738192]"><th className="py-2">Milestone</th><th>Weight</th><th>Planned</th><th>Actual</th><th>Status</th></tr></thead>
              <tbody>{prog.milestones.map((m) => <tr key={m.milestone.id} className="border-b border-[#E3E7EC]"><td className="py-2">{m.milestone.name}</td><td className="font-mono">{m.normalizedWeightPct}%</td><td className="font-mono">{m.plannedPct}%</td><td className="font-mono">{m.actualPct}%</td><td className="capitalize">{m.status.replace("_", " ")}</td></tr>)}</tbody></table>
          </section>
        )}
        {has("before_after") && before && after && (
          <section><h2 className="mb-2 text-lg font-semibold">Before / after</h2>
            <div className="grid grid-cols-2 gap-3">
              {[before, after].map((m, i) => <figure key={m.id}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/v1/media/${m.id}/render`} alt={m.filename} className="w-full rounded" /><figcaption className="mt-1 text-xs text-[#738192]">{i ? "After" : "Before"} · {fmtDate(m.capturedAt)} · {m.filename}</figcaption></figure>)}
            </div>
          </section>
        )}
        {has("findings_summary") && (
          <section><h2 className="mb-2 text-lg font-semibold">Open findings ({findings.length})</h2>
            {findings.length === 0 ? <p className="text-sm text-[#4A5868]">No open findings.</p> : <ul className="space-y-1 text-sm">{findings.map((f) => <li key={f.id}><span className="font-mono text-xs">{f.code}</span> · <b className="capitalize">{f.severity}</b> · {f.title} · due {fmtDate(f.dueDate)}</li>)}</ul>}
          </section>
        )}
        {has("missions") && (
          <section><h2 className="mb-2 text-lg font-semibold">Flights in period ({flights.length})</h2>
            <ul className="space-y-1 text-sm">{flights.map((m) => <li key={m.id}>{m.code} · {m.name} · {fmtDate(m.actualStart)} · {m.summary ? fmtDuration(m.summary.durationS) : m.status}{m.isSimulated ? " · simulated" : ""}</li>)}</ul>
          </section>
        )}
        <footer className="border-t border-[#E3E7EC] pt-4 text-[11px] text-[#738192]">
          Report {r.id} · version {r.version} · generated {fmtDateTime(r.generatedAt)} · integrity {hash} · Generated by AeroSight AI (demo environment). Figures use approved progress records only.
        </footer>
      </article>
    </div>
  );
}
