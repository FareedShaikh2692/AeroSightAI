import { api, page } from "@/lib/api";
import * as repo from "@/lib/repo";
export const GET = api(async (ctx, req) => {
  const u = new URL(req.url);
  return page(repo.listMedia(ctx, { siteId: u.searchParams.get("siteId") ?? undefined, missionId: u.searchParams.get("missionId") ?? undefined, type: u.searchParams.get("type") ?? undefined })
    .map(({ seed: _s, ...m }) => ({ ...m, previewUrl: `/api/v1/media/${m.id}/render` })), req.url);
});
