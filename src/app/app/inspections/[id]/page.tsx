import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can, isOrgWide } from "@/lib/policy";
import { PageHeader, Card, StatusBadge, Badge } from "@/components/ui";
import { MapClient } from "@/components/MapClient";
import { inspectionChecklistAction, findingTransitionAction } from "../../actions";
import { InspectionActions, NewFinding } from "./InspectionForms";
import { fmtDate } from "@/lib/format";

const NEXT: Record<string, { to: string; label: string }[]> = {
  open: [{ to: "in_progress", label: "Start work" }, { to: "wont_fix", label: "Won't fix" }],
  in_progress: [{ to: "resolved", label: "Resolve" }], resolved: [{ to: "verified", label: "Verify" }, { to: "open", label: "Reopen" }], verified: [{ to: "closed", label: "Close" }],
};

export default async function InspectionDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  const i = repo.getInspection(ctx, id);
  if (!i) notFound();
  const site = repo.getSite(ctx, i.siteId)!;
  const findings = repo.listFindings(ctx, { inspectionId: i.id });
  const assets = repo.listAssets(ctx, i.siteId);
  const asset = assets.find((a) => a.id === i.assetId);
  const canEdit = i.status === "in_progress" && can(ctx, "inspection:update", i) && (i.assigneeId === ctx.userId || isOrgWide(ctx));
  const isApprover = can(ctx, "inspection:approve", i);
  const actions = [
    ...(i.status === "scheduled" ? ["start"] : []), ...(i.status === "in_progress" ? ["submit"] : []),
    ...(i.status === "submitted" ? ["approve", "reject"] : []), ...(i.status === "approved" ? ["close"] : []),
  ].map((a) => ({ action: a, allowed: ["approve", "reject", "close"].includes(a) ? isApprover && i.assigneeId !== ctx.userId : can(ctx, "inspection:update", i),
    why: ["approve", "reject", "close"].includes(a) ? (i.assigneeId === ctx.userId ? "You cannot approve your own inspection" : "Requires inspection:approve") : "Requires inspection:update" }));

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{i.code}</span>} title={i.title}
        subtitle={<>{site.name}{asset ? ` · ${asset.tag} ${asset.name}` : ""} · {i.type} · due {fmtDate(i.dueDate)} · assignee {repo.userName(i.assigneeId)} · reviewer {repo.userName(i.reviewerId)}</>}
        actions={<StatusBadge status={i.status} />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card title={`Checklist (${i.checklist.filter((c) => c.value).length}/${i.checklist.length})`}>
            <ul className="divide-y divide-line">
              {i.checklist.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <span>{c.label} {c.required && <span className="text-xs text-ink-3">· required</span>}</span>
                  <div className="flex gap-1">
                    {(["pass", "fail", "na"] as const).map((v) => (
                      <form key={v} action={inspectionChecklistAction}>
                        <input type="hidden" name="id" value={i.id} /><input type="hidden" name="item" value={c.id} /><input type="hidden" name="value" value={v} />
                        <button disabled={!canEdit} className={`h-7 rounded-md border px-2.5 text-xs uppercase ${c.value === v ? (v === "pass" ? "border-ok bg-ok/15 text-ok" : v === "fail" ? "border-bad bg-bad/15 text-bad" : "border-line-strong bg-raised") : "border-line text-ink-3"} disabled:cursor-not-allowed`}>{v}</button>
                      </form>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {!canEdit && <p className="mt-3 text-xs text-ink-3">{i.status === "in_progress" ? "Only the assignee can edit the checklist." : ["approved", "closed"].includes(i.status) ? "Approved inspections are locked." : "The checklist is editable while the inspection is in progress."}</p>}
          </Card>
          <Card title={`Findings (${findings.length})`}>
            {findings.length === 0 ? <p className="text-sm text-ink-2">No findings recorded.</p> : (
              <ul className="space-y-3">
                {findings.map((f) => (
                  <li key={f.id} className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{f.title}</div>
                      <div className="flex gap-1"><StatusBadge status={f.severity} /><StatusBadge status={f.status} />{f.aiGenerated && <Badge tone="data">AI-assisted</Badge>}</div>
                    </div>
                    <div className="mt-1 text-xs text-ink-2">{f.code} · {f.category} · due {fmtDate(f.dueDate)} · {assets.find((a) => a.id === f.assetId)?.name ?? "no asset"}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(NEXT[f.status] ?? []).map((n) => (
                        <form key={n.to} action={findingTransitionAction}>
                          <input type="hidden" name="id" value={f.id} /><input type="hidden" name="to" value={n.to} /><input type="hidden" name="inspectionId" value={i.id} />
                          <button className="btn btn-secondary h-7 px-2 text-xs" disabled={!can(ctx, n.to === "wont_fix" ? "inspection:approve" : "finding:resolve", f)}>{n.label}</button>
                        </form>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Workflow">
            <InspectionActions id={i.id} actions={actions} />
            {i.reviewComment && <p className="mt-3 text-sm text-ink-2">Reviewer: “{i.reviewComment}”</p>}
            {i.approvedBy && <p className="mt-2 text-xs text-ok">Approved by {repo.userName(i.approvedBy)}</p>}
          </Card>
          {can(ctx, "finding:create", i) && !["approved", "closed"].includes(i.status) && <Card title="Add finding"><NewFinding inspectionId={i.id} assets={assets.map((a) => ({ id: a.id, label: `${a.tag} · ${a.name}` }))} /></Card>}
          <Card pad={false}><MapClient height={300} fitTo={site.boundary} initialBasemap="satellite" data={{ sites: [{ id: site.id, name: site.name, boundary: site.boundary }], assets,
            findings: findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity, location: f.location })) }} /></Card>
        </div>
      </div>
    </>
  );
}
