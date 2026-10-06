import { z } from "zod";
import { api, page } from "@/lib/api";
import * as repo from "@/lib/repo";
import { audit } from "@/lib/auth";

export const GET = api(async (ctx, req) => page(repo.listSites(ctx, new URL(req.url).searchParams.get("projectId") ?? undefined), req.url));

const Body = z.object({
  projectId: z.string().uuid().or(z.string().min(8)), code: z.string(), name: z.string().min(1).max(160), address: z.string().default(""),
  boundary: z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1) }),
}).strict();

export const POST = api(async (ctx, req) => {
  const b = Body.parse(await req.json());
  const s = repo.createSite(ctx, { projectId: b.projectId, code: b.code, name: b.name, address: b.address, boundary: b.boundary.coordinates[0] });
  await audit(ctx, "site.created", "site", s.id, { projectId: s.projectId });
  return s;
}, { status: 201 });
