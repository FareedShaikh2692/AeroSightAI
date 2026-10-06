import { api, page } from "@/lib/api";
import * as repo from "@/lib/repo";
export const GET = api(async (ctx, req) => {
  const u = new URL(req.url);
  const status = u.searchParams.get("status");
  const rows = repo.listMissions(ctx, { siteId: u.searchParams.get("siteId") ?? undefined, mine: u.searchParams.get("mine") === "true" })
    .filter((m) => !status || m.status === status).map(({ waypoints, ...m }) => ({ ...m, waypointCount: waypoints.length }));
  return page(rows, req.url);
});
