import { api } from "@/lib/api";
import * as repo from "@/lib/repo";
import { notFound } from "@/lib/policy";
export const GET = api<{ id: string }>(async (ctx, _req, { id }) => {
  const m = repo.getMission(ctx, id);
  if (!m) throw notFound();
  return m;
});
