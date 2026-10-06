// Enterprise SSO — OpenID Connect (docs/07-Security/Authentication.md §6). Authorization-code flow with PKCE,
// id_token verified against the IdP's JWKS (RS256/ES256), issuer/audience/nonce checks, verified email domains
// (DNS TXT), just-in-time provisioning and optional enforcement. SAML is specified but not built (Integration Required).
import "server-only";
import { createHash } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { z } from "zod";
import { db } from "./store";
import { assertCan, HttpError } from "./policy";
import { decrypt, encrypt, randomToken } from "./crypto";
import { assertSafeUrl, safeFetch } from "./net";
import { hashPassword } from "./password";
import { newId } from "./ids";
import type { AuthContext, RoleKey, SsoConfig, UUID } from "./types";

export const JIT_ROLES: RoleKey[] = ["viewer", "engineer", "inspector", "surveyor", "drone_pilot", "site_manager", "project_manager"];
const TXT_HOST = (domain: string) => `_aerosight-verification.${domain}`;

export interface Discovery { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string }

export function getSsoConfig(orgId: UUID): SsoConfig | undefined {
  return db().ssoConfigs.find((c) => c.organizationId === orgId);
}

function emailDomain(email: string) {
  return email.toLowerCase().split("@")[1] ?? "";
}

/** The SSO configuration that owns this email's domain (verified domains only). */
export function ssoForEmail(email: string): SsoConfig | undefined {
  const d = emailDomain(email);
  if (!d) return undefined;
  return db().ssoConfigs.find((c) => c.enabled && c.protocol === "oidc" && c.domains.some((x) => x.verifiedAt && x.domain === d));
}

/** AUTH-SSO-04: password sign-in is refused for enforced SSO domains, except organization owners (recovery path). */
export function passwordLoginBlocked(email: string, userId: UUID): boolean {
  const c = ssoForEmail(email);
  if (!c?.enforced) return false;
  const m = db().memberships.find((x) => x.organizationId === c.organizationId && x.userId === userId);
  return m?.role !== "org_owner";
}

export async function discover(issuer: string): Promise<Discovery> {
  const base = issuer.replace(/\/$/, "");
  await assertSafeUrl(base);
  const r = await safeFetch(`${base}/.well-known/openid-configuration`, { maxBytes: 64_000, headers: { accept: "application/json" } });
  if (!r.ok) throw new HttpError(422, "SSO_DISCOVERY_FAILED", `The issuer's discovery document returned HTTP ${r.status}.`);
  let doc: Discovery;
  try { doc = JSON.parse(await r.text()); } catch { throw new HttpError(422, "SSO_DISCOVERY_FAILED", "The discovery document is not valid JSON."); }
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri || !doc.issuer) throw new HttpError(422, "SSO_DISCOVERY_FAILED", "The discovery document is missing required endpoints.");
  if (doc.issuer.replace(/\/$/, "") !== base) throw new HttpError(422, "SSO_DISCOVERY_FAILED", `Issuer mismatch: the document says ${doc.issuer}.`);
  return doc;
}

const ConfigSchema = z.object({
  issuer: z.string().url("Enter the issuer URL, e.g. https://login.microsoftonline.com/<tenant>/v2.0"),
  clientId: z.string().trim().min(3, "Enter the client ID.").max(200),
  clientSecret: z.string().max(500).optional(),
  jitRole: z.enum(JIT_ROLES as [RoleKey, ...RoleKey[]]),
  enabled: z.boolean(),
  enforced: z.boolean(),
});

export async function saveSsoConfig(ctx: AuthContext, input: z.input<typeof ConfigSchema>) {
  assertCan(ctx, "org:update");
  assertCan(ctx, "user:manage");
  const v = ConfigSchema.parse(input);
  const issuer = v.issuer.replace(/\/$/, "");
  if (v.enabled) await discover(issuer); // fail fast on a wrong issuer
  let c = getSsoConfig(ctx.orgId);
  if (v.enforced && !(c?.domains.some((d) => d.verifiedAt))) throw new HttpError(422, "VALIDATION_ERROR", "Verify at least one email domain before enforcing SSO.");
  if (v.enabled && !v.clientSecret && !c?.clientSecretEnc) throw new HttpError(422, "VALIDATION_ERROR", "Enter the client secret.");
  if (!c) {
    c = { organizationId: ctx.orgId, protocol: "oidc", issuer, clientId: v.clientId, domains: [], enforced: false, jitRole: v.jitRole, enabled: false, updatedAt: "" };
    db().ssoConfigs.push(c);
  }
  c.issuer = issuer; c.clientId = v.clientId; c.jitRole = v.jitRole; c.enabled = v.enabled; c.enforced = v.enabled && v.enforced;
  if (v.clientSecret) c.clientSecretEnc = encrypt(v.clientSecret);
  c.updatedAt = new Date().toISOString();
  return c;
}

const DomainSchema = z.string().trim().toLowerCase().regex(/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Enter a domain like example.com.");
const PUBLIC_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "aerosight.demo"];

export function addDomain(ctx: AuthContext, raw: string) {
  assertCan(ctx, "org:update");
  const domain = DomainSchema.parse(raw);
  if (PUBLIC_DOMAINS.includes(domain)) throw new HttpError(422, "VALIDATION_ERROR", "Public email domains can't be claimed.");
  const c = getSsoConfig(ctx.orgId);
  if (!c) throw new HttpError(422, "VALIDATION_ERROR", "Save the identity-provider settings first.");
  if (db().ssoConfigs.some((x) => x.organizationId !== ctx.orgId && x.domains.some((d) => d.domain === domain && d.verifiedAt))) throw new HttpError(409, "DOMAIN_CLAIMED", "This domain is already verified by another organization.");
  if (c.domains.some((d) => d.domain === domain)) throw new HttpError(409, "CONFLICT", "Domain already added.");
  const entry = { domain, token: `aerosight-verification=${randomToken(18)}` };
  c.domains.push(entry);
  return { ...entry, host: TXT_HOST(domain) };
}

export async function verifyDomain(ctx: AuthContext, domain: string) {
  assertCan(ctx, "org:update");
  const c = getSsoConfig(ctx.orgId);
  const d = c?.domains.find((x) => x.domain === domain);
  if (!c || !d) throw new HttpError(404, "NOT_FOUND", "Domain not found.");
  if (db().ssoConfigs.some((x) => x.organizationId !== ctx.orgId && x.domains.some((y) => y.domain === domain && y.verifiedAt))) throw new HttpError(409, "DOMAIN_CLAIMED", "This domain is already verified by another organization.");
  let records: string[][] = [];
  try {
    records = await Promise.race([resolveTxt(TXT_HOST(domain)), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000))]);
  } catch { /* NXDOMAIN, timeout → not verified */ }
  const found = records.map((r) => r.join("")).some((r) => r.trim() === d.token);
  if (!found) throw new HttpError(422, "DOMAIN_NOT_VERIFIED", `TXT record not found. Add ${TXT_HOST(domain)} TXT "${d.token}" and try again (DNS can take a few minutes).`);
  d.verifiedAt = new Date().toISOString();
  return d;
}

export function removeDomain(ctx: AuthContext, domain: string) {
  assertCan(ctx, "org:update");
  const c = getSsoConfig(ctx.orgId);
  if (!c) return;
  c.domains = c.domains.filter((d) => d.domain !== domain);
  if (!c.domains.some((d) => d.verifiedAt)) c.enforced = false;
}

export function pkce() {
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function authorizationUrl(c: SsoConfig, redirectUri: string, state: string, nonce: string, challenge: string, loginHint?: string) {
  const d = await discover(c.issuer);
  const u = new URL(d.authorization_endpoint);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", c.clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("nonce", nonce);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  if (loginHint) u.searchParams.set("login_hint", loginHint);
  return u.toString();
}

const jwksCache = new Map<string, { at: number; jwks: JSONWebKeySet }>();
async function jwks(uri: string): Promise<JSONWebKeySet> {
  const hit = jwksCache.get(uri);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.jwks;
  const r = await safeFetch(uri, { maxBytes: 256_000, headers: { accept: "application/json" } });
  if (!r.ok) throw new HttpError(502, "SSO_JWKS_FAILED", "Could not load the identity provider's signing keys.");
  const set = JSON.parse(await r.text()) as JSONWebKeySet;
  jwksCache.set(uri, { at: Date.now(), jwks: set });
  return set;
}

export interface SsoIdentity { email: string; name: string; sub: string }

/** Exchange the code and verify the id_token. Throws HttpError on any failure. */
export async function completeAuthorization(c: SsoConfig, code: string, redirectUri: string, verifier: string, nonce: string): Promise<SsoIdentity> {
  const d = await discover(c.issuer);
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: c.clientId, code_verifier: verifier,
    ...(c.clientSecretEnc ? { client_secret: decrypt(c.clientSecretEnc) } : {}) });
  const r = await safeFetch(d.token_endpoint, { method: "POST", body, maxBytes: 64_000, headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" } });
  const text = await r.text();
  if (!r.ok) throw new HttpError(401, "SSO_TOKEN_EXCHANGE_FAILED", "The identity provider rejected the sign-in.");
  const tok = JSON.parse(text) as { id_token?: string };
  if (!tok.id_token) throw new HttpError(401, "SSO_TOKEN_EXCHANGE_FAILED", "The identity provider did not return an id_token.");
  const { payload } = await jwtVerify(tok.id_token, createLocalJWKSet(await jwks(d.jwks_uri)), {
    issuer: d.issuer, audience: c.clientId, algorithms: ["RS256", "ES256", "PS256"], clockTolerance: 60,
  }).catch(() => { throw new HttpError(401, "SSO_INVALID_TOKEN", "The identity token could not be verified."); });
  if (payload.nonce !== nonce) throw new HttpError(401, "SSO_INVALID_TOKEN", "Nonce mismatch.");
  const email = String(payload.email ?? payload.preferred_username ?? "").toLowerCase();
  if (!email.includes("@")) throw new HttpError(401, "SSO_NO_EMAIL", "The identity provider did not share an email address.");
  if (payload.email_verified === false) throw new HttpError(401, "SSO_EMAIL_UNVERIFIED", "Your email address is not verified at the identity provider.");
  return { email, name: String(payload.name ?? email.split("@")[0]), sub: String(payload.sub) };
}

/** Find or just-in-time provision the user for this org. Only verified domains may be provisioned. */
export function provision(c: SsoConfig, id: SsoIdentity): { userId: UUID; created: boolean } {
  if (!c.domains.some((d) => d.verifiedAt && d.domain === emailDomain(id.email))) throw new HttpError(403, "SSO_DOMAIN_NOT_ALLOWED", "Your email domain is not verified for this organization.");
  let user = db().users.find((u) => u.email === id.email);
  let created = false;
  if (!user) {
    user = { id: newId(), email: id.email, fullName: id.name, passwordHash: hashPassword(randomToken(32)), mfaEnabled: false };
    db().users.push(user);
    created = true;
  }
  if (user.isPlatformStaff) throw new HttpError(403, "FORBIDDEN", "Platform staff cannot sign in through customer SSO.");
  const m = db().memberships.find((x) => x.organizationId === c.organizationId && x.userId === user!.id);
  if (m?.status === "deactivated") throw new HttpError(403, "ACCOUNT_DEACTIVATED", "Your access to this organization has been removed.");
  if (!m) db().memberships.push({ id: newId(), organizationId: c.organizationId, userId: user.id, role: c.jitRole, status: "active", joinedAt: new Date().toISOString() });
  user.lastLoginAt = new Date().toISOString();
  return { userId: user.id, created };
}
