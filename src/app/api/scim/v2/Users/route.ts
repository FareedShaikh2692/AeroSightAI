// SCIM 2.0 /Users — list (filter userName eq) and create. Auth: Bearer asai_scim_… (Settings → Single sign-on).
import { scimRoute } from "@/lib/scim-route";
import { createUser, listUsers, scimJson } from "@/lib/scim";

export const dynamic = "force-dynamic";
export const GET = scimRoute((orgId, req, base) => scimJson(listUsers(orgId, new URL(req.url), base)));
export const POST = scimRoute(async (orgId, req, base) => scimJson(createUser(orgId, JSON.parse(await req.text()), base), 201), "scim.user_created");
