// SCIM 2.0 user provisioning (RFC 7643/7644; docs/07-Security/Authentication.md §6.4). The IdP creates,
// updates and deactivates members. Tokens are per-organization, stored as SHA-256 hashes, and can only manage
// memberships of their own organization. Deprovisioning deactivates the membership (sessions are refused at the
// next request); it never deletes the user or their audit history.
import "server-only";
import { NextResponse } from "next/server";
import { db } from "./store";
import { assertCan, HttpError } from "./policy";
import { newId } from "./ids";
import { randomToken, sha256 } from "./crypto";
import { hashPassword } from "./password";
import { getSsoConfig } from "./sso";
import type { AuthContext, Membership, ScimToken, User, UUID } from "./types";

export const SCIM_USER = "urn:ietf:params:scim:schemas:core:2.0:User";
const LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const ERROR = "urn:ietf:params:scim:api:messages:2.0:Error";
const PATCH = "urn:ietf:params:scim:api:messages:2.0:PatchOp";

export function createScimToken(ctx: AuthContext): { token: string; row: ScimToken } {
  assertCan(ctx, "user:manage");
  const prefix = randomToken(6).replace(/[^a-zA-Z0-9]/g, "x").slice(0, 8);
  const token = `asai_scim_${prefix}_${randomToken(32)}`;
  const row: ScimToken = { id: newId(), organizationId: ctx.orgId, prefix, tokenHash: sha256(token), createdBy: ctx.userId, createdAt: new Date().toISOString() };
  db().scimTokens.push(row);
  return { token, row };
}

export function revokeScimToken(ctx: AuthContext, id: UUID) {
  assertCan(ctx, "user:manage");
  const t = db().scimTokens.find((x) => x.id === id && x.organizationId === ctx.orgId && !x.revokedAt);
  if (t) t.revokedAt = new Date().toISOString();
  return t;
}

export function scimOrg(req: Request): UUID | null {
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Bearer asai_scim_")) return null;
  const t = db().scimTokens.find((x) => x.tokenHash === sha256(h.slice(7).trim()) && !x.revokedAt);
  if (!t) return null;
  t.lastUsedAt = new Date().toISOString();
  return t.organizationId;
}

export const scimError = (status: number, detail: string, scimType?: string) =>
  NextResponse.json({ schemas: [ERROR], status: String(status), detail, ...(scimType ? { scimType } : {}) }, { status, headers: { "content-type": "application/scim+json" } });
export const scimJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "content-type": "application/scim+json", "cache-control": "no-store" } });

function resource(u: User, m: Membership, base: string) {
  const [given, ...rest] = u.fullName.split(" ");
  return {
    schemas: [SCIM_USER], id: m.id, externalId: m.scimExternalId, userName: u.email, active: m.status === "active",
    name: { formatted: u.fullName, givenName: given, familyName: rest.join(" ") }, displayName: u.fullName,
    emails: [{ value: u.email, primary: true, type: "work" }],
    "urn:aerosight:params:scim:schemas:extension:2.0:User": { role: m.role },
    meta: { resourceType: "User", created: m.joinedAt, location: `${base}/Users/${m.id}` },
  };
}

function rows(orgId: UUID) {
  return db().memberships.filter((m) => m.organizationId === orgId).map((m) => ({ m, u: db().users.find((x) => x.id === m.userId)! })).filter((r) => r.u && !r.u.isPlatformStaff);
}

export function listUsers(orgId: UUID, url: URL, base: string) {
  let all = rows(orgId);
  const filter = url.searchParams.get("filter");
  if (filter) {
    const f = filter.match(/^\s*(userName|externalId|emails\.value)\s+eq\s+"([^"]*)"\s*$/i);
    if (!f) throw new HttpError(400, "invalidFilter", "Only `userName eq`, `externalId eq` and `emails.value eq` filters are supported.");
    const v = f[2].toLowerCase();
    all = all.filter(({ m, u }) => (f[1].toLowerCase() === "externalid" ? (m.scimExternalId ?? "").toLowerCase() === v : u.email === v));
  }
  const start = Math.max(1, Number(url.searchParams.get("startIndex") ?? 1) || 1);
  const count = Math.min(200, Math.max(0, Number(url.searchParams.get("count") ?? 100) || 0));
  const page = all.slice(start - 1, start - 1 + count);
  return { schemas: [LIST], totalResults: all.length, startIndex: start, itemsPerPage: page.length, Resources: page.map(({ u, m }) => resource(u, m, base)) };
}

export function getUser(orgId: UUID, id: string, base: string) {
  const r = rows(orgId).find((x) => x.m.id === id);
  if (!r) throw new HttpError(404, "notFound", "User not found.");
  return resource(r.u, r.m, base);
}

interface ScimUserInput { userName?: string; externalId?: string; active?: boolean; name?: { givenName?: string; familyName?: string; formatted?: string }; displayName?: string; emails?: { value: string; primary?: boolean }[] }

function emailOf(b: ScimUserInput) {
  const e = (b.emails?.find((x) => x.primary)?.value ?? b.emails?.[0]?.value ?? b.userName ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new HttpError(400, "invalidValue", "userName must be an email address.");
  return e;
}
function nameOf(b: ScimUserInput, fallback: string) {
  return (b.name?.formatted ?? ([b.name?.givenName, b.name?.familyName].filter(Boolean).join(" ") || b.displayName || fallback)).slice(0, 120);
}

export function createUser(orgId: UUID, b: ScimUserInput, base: string) {
  const email = emailOf(b);
  const sso = getSsoConfig(orgId);
  const domain = email.split("@")[1];
  if (!sso?.domains.some((d) => d.verifiedAt && d.domain === domain)) throw new HttpError(400, "invalidValue", `Only users in this organization's verified domains can be provisioned (got ${domain}).`);
  let u = db().users.find((x) => x.email === email);
  if (u?.isPlatformStaff) throw new HttpError(409, "uniqueness", "User already exists.");
  const existing = u && db().memberships.find((m) => m.organizationId === orgId && m.userId === u!.id);
  if (existing) throw new HttpError(409, "uniqueness", "User already exists in this organization.");
  if (!u) {
    u = { id: newId(), email, fullName: nameOf(b, email.split("@")[0]), passwordHash: hashPassword(randomToken(32)), mfaEnabled: false };
    db().users.push(u);
  }
  const m: Membership = { id: newId(), organizationId: orgId, userId: u.id, role: sso.jitRole, status: b.active === false ? "deactivated" : "active", joinedAt: new Date().toISOString(), scimExternalId: b.externalId };
  db().memberships.push(m);
  return resource(u, m, base);
}

function guardOwner(m: Membership, deactivating: boolean) {
  if (!deactivating || m.role !== "org_owner") return;
  const owners = db().memberships.filter((x) => x.organizationId === m.organizationId && x.role === "org_owner" && x.status === "active");
  if (owners.length <= 1) throw new HttpError(400, "mutability", "The last active owner can't be deactivated through SCIM.");
}

export function replaceUser(orgId: UUID, id: string, b: ScimUserInput, base: string) {
  const r = rows(orgId).find((x) => x.m.id === id);
  if (!r) throw new HttpError(404, "notFound", "User not found.");
  if (b.active !== undefined) { guardOwner(r.m, b.active === false); r.m.status = b.active ? "active" : "deactivated"; }
  if (b.externalId !== undefined) r.m.scimExternalId = b.externalId;
  if (b.name || b.displayName) r.u.fullName = nameOf(b, r.u.fullName);
  return resource(r.u, r.m, base);
}

export function patchUser(orgId: UUID, id: string, body: { schemas?: string[]; Operations?: { op: string; path?: string; value?: unknown }[] }, base: string) {
  if (!body.schemas?.includes(PATCH) || !Array.isArray(body.Operations)) throw new HttpError(400, "invalidSyntax", "Expected a PatchOp request.");
  const patch: ScimUserInput = {};
  for (const op of body.Operations) {
    if (!["replace", "add"].includes(op.op.toLowerCase())) throw new HttpError(400, "invalidSyntax", `Unsupported op ${op.op}.`);
    const entries: [string, unknown][] = op.path ? [[op.path, op.value]] : Object.entries((op.value ?? {}) as Record<string, unknown>);
    for (const [path, value] of entries) {
      if (path === "active") patch.active = value === true || value === "True" || value === "true";
      else if (path === "externalId") patch.externalId = String(value);
      else if (path === "displayName") patch.displayName = String(value);
      else if (path === "name.givenName" || path === "name.familyName") patch.name = { ...patch.name, [path.split(".")[1]]: String(value) };
      else if (path === "name") patch.name = value as ScimUserInput["name"];
    }
  }
  return replaceUser(orgId, id, patch, base);
}

export function deleteUser(orgId: UUID, id: string) {
  const r = rows(orgId).find((x) => x.m.id === id);
  if (!r) throw new HttpError(404, "notFound", "User not found.");
  guardOwner(r.m, true);
  r.m.status = "deactivated";
}
