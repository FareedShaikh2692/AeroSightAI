// SCIM 2.0 /Users/:id — read, replace, patch (e.g. active=false) and delete (deactivates the membership).
import { scimRoute } from "@/lib/scim-route";
import { deleteUser, getUser, patchUser, replaceUser, scimJson } from "@/lib/scim";

export const dynamic = "force-dynamic";
type P = { id: string };
export const GET = scimRoute<P>((orgId, _req, base, { id }) => scimJson(getUser(orgId, id, base)));
export const PUT = scimRoute<P>(async (orgId, req, base, { id }) => scimJson(replaceUser(orgId, id, JSON.parse(await req.text()), base)), "scim.user_replaced");
export const PATCH = scimRoute<P>(async (orgId, req, base, { id }) => scimJson(patchUser(orgId, id, JSON.parse(await req.text()), base)), "scim.user_patched");
export const DELETE = scimRoute<P>((orgId, _req, _base, { id }) => { deleteUser(orgId, id); return new Response(null, { status: 204 }); }, "scim.user_deactivated");
