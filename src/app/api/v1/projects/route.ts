import { z } from "zod";
import { api, page } from "@/lib/api";
import * as repo from "@/lib/repo";
import { audit } from "@/lib/auth";

export const GET = api(async (ctx, req) => {
  const status = new URL(req.url).searchParams.get("status");
  const rows = repo.listProjects(ctx).filter((p) => !status || p.status === status).map(({ projectId: _p, ...p }) => ({ ...p, progress: (({ actualPct, plannedPct, scheduleVariancePct, status }) => ({ actualPct, plannedPct, scheduleVariancePct, status }))(repo.projectProgress(ctx, p.id)) }));
  return page(rows, req.url);
});

const Body = z.object({
  code: z.string(), name: z.string().min(2).max(160), type: z.string().default("building"), clientName: z.string().default(""),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), description: z.string().max(5000).default(""),
  location: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }),
}).strict();

export const POST = api(async (ctx, req) => {
  const b = Body.parse(await req.json());
  const p = repo.createProject(ctx, { ...b, location: b.location.coordinates });
  await audit(ctx, "project.created", "project", p.id, { projectId: p.id, changes: { name: [null, p.name] } });
  return p;
}, { status: 201 });
