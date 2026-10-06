// REST helpers: RFC 9457 problem+json errors, request IDs, context resolution (docs/06-API §3–§4).
import "server-only";
import { NextResponse } from "next/server";
import { getContext } from "./auth";
import { HttpError } from "./policy";
import type { AuthContext } from "./types";
import { newId } from "./ids";
import { ZodError } from "zod";
import { db } from "./store";
import { sha256 } from "./crypto";

/** `Authorization: ApiKey asai_live_<prefix>_<secret>` (INTEG-007). Keys act with the creator's role, limited to the key's permissions/projects. */
function apiKeyContext(req: Request): AuthContext | null | "invalid" {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("ApiKey ")) return null;
  const raw = h.slice(7).trim();
  const k = db().apiKeys.find((x) => x.keyHash === sha256(raw));
  if (!k || k.revokedAt || Date.parse(k.expiresAt) < Date.now()) return "invalid";
  const m = db().memberships.find((x) => x.organizationId === k.organizationId && x.userId === k.createdBy && x.status === "active");
  if (!m) return "invalid";
  k.lastUsedAt = new Date().toISOString();
  return { userId: k.createdBy, orgId: k.organizationId, role: m.role, isPlatformStaff: false, sessionId: `apikey:${k.id}`, apiKey: { id: k.id, permissions: k.permissions, projectIds: k.projectIds } };
}

export function problem(status: number, code: string, detail: string, requestId: string, meta?: unknown) {
  return NextResponse.json(
    { type: `https://docs.aerosight.ai/errors/${code}`, title: code.replace(/_/g, " ").toLowerCase(), status, code, detail, requestId, ...(meta ? { meta } : {}) },
    { status, headers: { "content-type": "application/problem+json", "x-request-id": requestId } },
  );
}

type Handler<P> = (ctx: AuthContext, req: Request, params: P) => Promise<unknown> | unknown;

export function api<P = Record<string, string>>(handler: Handler<P>, opts: { status?: number } = {}) {
  return async (req: Request, route: { params: Promise<P> }) => {
    const requestId = req.headers.get("x-request-id") ?? newId();
    try {
      const keyCtx = apiKeyContext(req);
      if (keyCtx === "invalid") return problem(401, "UNAUTHENTICATED", "Invalid, revoked or expired API key.", requestId);
      const ctx = keyCtx ?? (await getContext());
      if (!ctx || (ctx.isPlatformStaff && !ctx.breakGlass)) return problem(401, "UNAUTHENTICATED", "Sign in to use the API.", requestId);
      const body = await handler(ctx, req, await route.params);
      if (body instanceof Response) return body;
      return NextResponse.json(body, { status: opts.status ?? 200, headers: { "x-request-id": requestId, "cache-control": "no-store" } });
    } catch (e) {
      if (e instanceof HttpError) return problem(e.status, e.code, e.message, requestId, e.meta);
      if (e instanceof ZodError) return problem(422, "VALIDATION_ERROR", e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), requestId, { errors: e.issues });
      if (e instanceof SyntaxError) return problem(400, "BAD_REQUEST", "Malformed JSON body.", requestId);
      console.error(`[api] ${requestId}`, e);
      return problem(500, "INTERNAL_ERROR", "Something went wrong.", requestId);
    }
  };
}

export function page<T>(rows: T[], url: string) {
  const u = new URL(url);
  const limit = Math.min(100, Math.max(1, Number(u.searchParams.get("limit") ?? 25)));
  const offset = Math.max(0, Number(u.searchParams.get("cursor") ? Buffer.from(u.searchParams.get("cursor")!, "base64url").toString() : 0) || 0);
  const data = rows.slice(offset, offset + limit);
  const hasMore = offset + limit < rows.length;
  return { data, page: { nextCursor: hasMore ? Buffer.from(String(offset + limit)).toString("base64url") : null, hasMore, limit } };
}
