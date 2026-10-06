import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { aiStatus } from "@/lib/ai/features";
import { PageHeader, Card, Badge, Forbidden, StatusBadge, Kpi } from "@/components/ui";
import { AnalyzeForm, Decide } from "./AiForms";
import { fmtDateTime } from "@/lib/format";

export default async function AiPage() {
  const ctx = await requireContext();
  if (!can(ctx, "ai:analyze") && !can(ctx, "ai:review")) return <Forbidden perm="ai:analyze" />;
  const org = repo.currentOrg(ctx);
  const projects = repo.listProjects(ctx);
  const pids = new Set(projects.map((p) => p.id));
  const analyses = db().aiAnalyses.filter((a) => a.organizationId === ctx.orgId && pids.has(a.projectId)).slice().reverse();
  const pending = db().aiSuggestions.filter((s) => s.organizationId === ctx.orgId && pids.has(s.projectId) && s.decision === "pending");
  const decided = db().aiSuggestions.filter((s) => s.organizationId === ctx.orgId && pids.has(s.projectId) && s.decision !== "pending");
  const st = aiStatus();
  const canReview = (pid: string) => can(ctx, "ai:review", { organizationId: ctx.orgId, projectId: pid }) && can(ctx, "progress:approve", { organizationId: ctx.orgId, projectId: pid });
  return (
    <>
      <PageHeader eyebrow="Data" title={<span className="flex items-center gap-3">AI Insights <Badge tone="info">Beta</Badge></span>}
        subtitle="AI proposes; people decide. Nothing changes official progress until an authorized reviewer accepts it." />
      <div className="mb-6 rounded-lg border border-data/30 bg-data/5 px-4 py-3 text-sm text-ink-2">
        <Badge tone="data">AI-assisted — not an engineering certification</Badge>{" "}
        {st.engine === "claude" ? <>Running on Claude (<code className="font-mono text-xs">{st.model}</code>) over structured project data.</> :
          <>Running in <b>heuristic mode</b> (velocity extrapolation) because no <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> is configured. Image-based change and defect detection need a vision model and media storage (Integration Required).</>}
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Pending review" value={pending.length} tone={pending.length ? "warn" : undefined} />
        <Kpi label="Acceptance rate" value={decided.length ? `${Math.round((decided.filter((d) => d.decision !== "rejected").length / decided.length) * 100)}%` : "—"} hint={`${decided.length} decided`} />
        <Kpi label="Analyses run" value={analyses.length} />
        <Kpi label="AI credits" value={`${org.aiCreditsUsed} / ${org.aiCreditsLimit}`} />
      </div>
      {can(ctx, "ai:analyze") && <Card title="Run progress analysis" className="mb-6"><AnalyzeForm projects={projects.filter((p) => can(ctx, "ai:analyze", p)).map((p) => ({ id: p.id, name: p.name }))} engine={st.engine === "claude" ? `Claude (${st.model})` : "heuristic"} /></Card>}
      <Card title={`Review queue (${pending.length})`} className="mb-6" pad={false}>
        {pending.length === 0 ? <p className="p-5 text-sm text-ink-2">No proposals waiting for review.</p> : (
          <table className="table"><thead><tr><th>Project · milestone</th><th>Current → proposed</th><th>Confidence</th><th>Rationale</th><th /></tr></thead><tbody>
            {pending.map((s) => <tr key={s.id}><td>{projects.find((p) => p.id === s.projectId)?.name}<div className="text-xs text-ink-2">{s.payload.milestoneName}</div></td>
              <td className="font-mono">{s.payload.currentPercent}% → <span className="text-accent">{s.payload.proposedPercent}%</span></td>
              <td><Badge tone={s.confidence >= 0.8 ? "ok" : s.confidence >= 0.5 ? "warn" : "neutral"}>{s.confidence >= 0.8 ? "High" : s.confidence >= 0.5 ? "Medium" : "Low"} ({s.confidence.toFixed(2)})</Badge></td>
              <td className="max-w-md text-xs text-ink-2">{s.payload.rationale}</td>
              <td>{canReview(s.projectId) ? <Decide id={s.id} proposed={s.payload.proposedPercent} /> : <span className="text-xs text-ink-3">Needs progress:approve</span>}</td></tr>)}
          </tbody></table>
        )}
      </Card>
      <Card title="Analyses" pad={false}>
        {analyses.length === 0 ? <p className="p-5 text-sm text-ink-2">No analyses yet.</p> : (
          <table className="table"><thead><tr><th>When</th><th>Project</th><th>Engine</th><th>Result</th><th>Credits</th><th>Review</th></tr></thead><tbody>
            {analyses.map((a) => { const o = (a.output ?? {}) as { proposals?: number; potentialIssues?: string[]; recommendations?: string[] };
              return <tr key={a.id}><td className="text-xs">{fmtDateTime(a.createdAt)}<div className="text-ink-3">{repo.userName(a.requestedBy)}</div></td><td>{projects.find((p) => p.id === a.projectId)?.name}</td>
                <td className="font-mono text-xs">{a.modelId ?? a.engine}</td>
                <td className="max-w-md text-xs">{a.status === "failed" ? <span className="text-bad">{a.error}</span> : <>{o.proposals} proposal(s){o.potentialIssues?.length ? <div className="text-warn">Issues: {o.potentialIssues.join("; ")}</div> : null}{o.recommendations?.length ? <div className="text-ink-2">{o.recommendations.join(" ")}</div> : null}</>}</td>
                <td className="font-mono text-xs">{a.creditsUsed}</td><td><StatusBadge status={a.reviewStatus === "pending" ? "pending" : a.reviewStatus === "rejected" ? "rejected" : "approved"} /></td></tr>; })}
          </tbody></table>
        )}
      </Card>
    </>
  );
}
