// Daily maintenance (Vercel Cron): overdue-finding reminders (INSPECTION-014), retention enforcement (PRIV-002),
// digest roll-up (NOTIF-007), capture schedules and risk alerts (Phase 4). Authenticated with CRON_SECRET (Vercel sends `Authorization: Bearer <CRON_SECRET>`).
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db, store, appendAudit } from "@/lib/store";
import { emit } from "@/lib/events";
import { enforceRetention } from "@/lib/privacy";
import { newId } from "@/lib/ids";
import { runDueSchedules } from "@/lib/schedules";
import { riskTransitions } from "@/lib/insights";
import { membersWithRoles } from "@/lib/events";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run unauthenticated
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  const today = new Date().toISOString().slice(0, 10);
  const report: Record<string, unknown> = {};
  for (const org of db().organizations.filter((o) => o.status === "active")) {
    const overdue = db().findings.filter((f) => f.organizationId === org.id && ["open", "in_progress"].includes(f.status) && f.dueDate < today);
    for (const f of overdue) {
      const sm = db().projectMembers.filter((m) => m.projectId === f.projectId && m.role === "site_manager").map((m) => m.userId);
      emit({ key: "finding.overdue", orgId: org.id, projectId: f.projectId, entityType: "finding", entityId: f.id, severity: "warning", href: `/app/inspections/${f.inspectionId}`,
        title: "Finding overdue", body: `${f.code} ${f.title} was due ${f.dueDate}`, recipients: [...new Set([f.assigneeId, ...sm].filter(Boolean) as string[])] });
    }
    const purged = enforceRetention(org.id, true);
    if (Object.values(purged).some((n) => n > 0)) {
      appendAudit(store(), { id: newId(), organizationId: org.id, occurredAt: new Date().toISOString(), actorType: "system", actorLabel: "cron.daily", action: "retention.enforced",
        entityType: "organization", entityId: org.id, changes: Object.fromEntries(Object.entries(purged).map(([k, v]) => [k, [null, v]])) });
    }
    // Digest: mark low-priority notifications as delivered in today's digest (email delivery requires a provider).
    const digested = db().notifications.filter((n) => n.organizationId === org.id && n.digest && !n.readAt);
    // Predictive risk: alert when a project's risk band rises to high/critical.
    const risks = riskTransitions(org.id);
    for (const r of risks) {
      const p = db().projects.find((x) => x.id === r.projectId)!;
      emit({ key: "risk.high", orgId: org.id, projectId: p.id, entityType: "project", entityId: p.id, severity: r.band === "critical" ? "critical" : "warning", href: "/app/insights",
        title: `Project risk ${r.band}`, body: `${p.name}: risk score ${r.score}/100`, recipients: membersWithRoles(org.id, p.id, ["project_manager"], true), data: { "risk.score": r.score, "risk.band": r.band } });
    }
    report[org.slug] = { overdueFindings: overdue.length, purged, digestItems: digested.length, riskAlerts: risks.length };
  }
  const schedules = await runDueSchedules();
  return NextResponse.json({ ranAt: new Date().toISOString(), organizations: report, schedules });
}
