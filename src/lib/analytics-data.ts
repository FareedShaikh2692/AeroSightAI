// Scoped data assembly for analytics pages and exports — every row comes through repo.ts (ANALYTICS-006).
import "server-only";
import * as repo from "./repo";
import { can } from "./policy";
import { benchmark, findingSla, fleetUtilization } from "./analytics";
import type { AuthContext } from "./types";

export function analyticsData(ctx: AuthContext, days: number) {
  const projects = repo.listProjects(ctx);
  const missions = can(ctx, "mission:read") ? repo.listMissions(ctx) : [];
  const findings = can(ctx, "inspection:read") ? repo.listFindings(ctx) : [];
  const drones = can(ctx, "drone:read") ? repo.listDrones(ctx) : [];
  const withProgress = projects.map((p) => ({ ...p, progress: repo.projectProgress(ctx, p.id) }));
  return {
    projects, missions, findings, drones,
    bench: benchmark(withProgress, missions, findings),
    sla: findingSla(findings),
    fleet: fleetUtilization(drones, missions, days),
  };
}
