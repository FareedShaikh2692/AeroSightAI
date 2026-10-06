import { api } from "@/lib/api";
import * as repo from "@/lib/repo";
import { assertCan, notFound } from "@/lib/policy";
export const GET = api<{ id: string }>(async (ctx, req, { id }) => {
  const p = repo.getProject(ctx, id);
  if (!p) throw notFound();
  assertCan(ctx, "progress:read", p);
  const asOf = new URL(req.url).searchParams.get("asOf") ?? new Date().toISOString().slice(0, 10);
  const { milestonesList: _m, records: _r, milestones, ...summary } = repo.projectProgress(ctx, p.id, asOf);
  return { ...summary, milestones: milestones.map((m) => ({ id: m.milestone.id, name: m.milestone.name, normalizedWeightPct: m.normalizedWeightPct, plannedPct: m.plannedPct, actualPct: m.actualPct, status: m.status })) };
});
