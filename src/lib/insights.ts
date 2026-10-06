// Predictive insights assembly: delay forecast + risk score per project (system level for cron; ctx-scoped for UI).
import "server-only";
import { db } from "./store";
import * as repo from "./repo";
import { forecastDelay, riskScore, type DelayForecast, type RiskScore } from "./predict";
import { computeProgress } from "./progress";
import type { AuthContext, Project, UUID } from "./types";

export interface ProjectInsight { project: Project; forecast: DelayForecast; risk: RiskScore; scheduleVariancePct: number }

export function projectInsight(projectId: UUID, nowMs = Date.now()): ProjectInsight | null {
  const d = db();
  const project = d.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const ms = d.milestones.filter((m) => m.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);
  const rs = d.progressRecords.filter((r) => r.projectId === projectId);
  const forecast = forecastDelay(project, ms, rs, nowMs);
  const prog = computeProgress(ms, rs.filter((r) => r.approvalStatus === "approved"), new Date(nowMs).toISOString().slice(0, 10));
  const missions = d.missions.filter((m) => m.projectId === projectId);
  const lastCaptureAt = missions.filter((m) => m.status === "completed" && m.actualEnd).map((m) => m.actualEnd!).sort().pop();
  const risk = riskScore({ forecast, scheduleVariancePct: prog.scheduleVariancePct, findings: d.findings.filter((f) => f.projectId === projectId),
    inspections: d.inspections.filter((i) => i.projectId === projectId), missions, lastCaptureAt, nowMs });
  return { project, forecast, risk, scheduleVariancePct: prog.scheduleVariancePct };
}

/** Insights for the projects the user can access (analytics:read is checked by the caller). */
export function insightsFor(ctx: AuthContext) {
  return repo.listProjects(ctx).map((p) => projectInsight(p.id)!).filter(Boolean).sort((a, b) => b.risk.score - a.risk.score);
}

const lastBand = new Map<string, string>();
/** Cron: emit risk.high when a project's band rises to high/critical. */
export function riskTransitions(orgId: UUID) {
  const out: { projectId: string; score: number; band: string }[] = [];
  for (const p of db().projects.filter((x) => x.organizationId === orgId && x.status === "active")) {
    const i = projectInsight(p.id);
    if (!i) continue;
    const prev = lastBand.get(p.id);
    lastBand.set(p.id, i.risk.band);
    if ((i.risk.band === "high" || i.risk.band === "critical") && prev !== i.risk.band && prev !== "critical") out.push({ projectId: p.id, score: i.risk.score, band: i.risk.band });
  }
  return out;
}
