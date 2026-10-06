// Shared wrapper for SCIM endpoints: bearer-token auth, SCIM error format, audit of every write.
import "server-only";
import { HttpError } from "./policy";
import { scimError, scimOrg } from "./scim";
import { appendAudit, store } from "./store";
import { newId } from "./ids";

export function scimRoute<P>(handler: (orgId: string, req: Request, base: string, params: P) => Promise<Response> | Response, writeAction?: string) {
  return async (req: Request, route: { params: Promise<P> }) => {
    const orgId = scimOrg(req);
    if (!orgId) return scimError(401, "Missing, unknown or revoked SCIM token.");
    const base = `${new URL(req.url).origin}/api/scim/v2`;
    try {
      const res = await handler(orgId, req, base, await route.params);
      if (writeAction && res.status < 300) {
        const id = (await route.params as { id?: string })?.id;
        appendAudit(store(), { id: newId(), organizationId: orgId, occurredAt: new Date().toISOString(), actorType: "system", actorLabel: "scim", action: writeAction, entityType: "membership", entityId: id });
      }
      return res;
    } catch (e) {
      if (e instanceof HttpError) return scimError(e.status, e.message, e.code);
      if (e instanceof SyntaxError) return scimError(400, "Malformed JSON body.", "invalidSyntax");
      console.error("[scim]", e);
      return scimError(500, "Internal error.");
    }
  };
}
