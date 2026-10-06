import { api } from "@/lib/api";
import * as repo from "@/lib/repo";
import { notFound } from "@/lib/policy";
export const GET = api<{ id: string }>(async (ctx, _req, { id }) => {
  const p = repo.getProject(ctx, id);
  if (!p) throw notFound();
  return { ...p, sites: repo.listSites(ctx, p.id).map((s) => ({ id: s.id, code: s.code, name: s.name, areaM2: s.areaM2 })) };
});
