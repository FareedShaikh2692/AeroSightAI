// Provider connectors (docs/04-Architecture/Drone-Architecture.md §5, GIS spec §5).
// Status: Integration Required — these call the real provider endpoints when configured; nothing is simulated here.
import "server-only";
import { decrypt, encrypt } from "./crypto";
import { safeFetch } from "./net";
import type { Integration } from "./types";

export interface ProviderTest { ok: boolean; message: string; details?: Record<string, unknown> }

/** NodeODM (OpenDroneMap) REST API: GET /info returns version and queue state. Token passed as ?token= when set. */
async function testNodeOdm(i: Integration): Promise<ProviderTest> {
  const token = i.secretEnc ? decrypt(i.secretEnc) : "";
  const url = new URL("/info", i.config.baseUrl);
  if (token) url.searchParams.set("token", token);
  const res = await safeFetch(url.toString(), { method: "GET" });
  if (!res.ok) return { ok: false, message: `NodeODM responded with HTTP ${res.status}.` };
  try {
    const info = JSON.parse(await res.text()) as { version?: string; taskQueueCount?: number; engine?: string };
    if (!info.version) return { ok: false, message: "The endpoint did not return NodeODM /info data." };
    return { ok: true, message: `NodeODM ${info.version} (${info.engine ?? "odm"}), ${info.taskQueueCount ?? 0} task(s) queued.`, details: info };
  } catch {
    return { ok: false, message: "The endpoint did not return JSON." };
  }
}

/**
 * DJI Cloud API: AeroSight acts as a third-party cloud that DJI Pilot 2 / Dock connect to (MQTT + HTTPS).
 * Verifying credentials requires the customer's DJI developer App ID/Key/License and a reachable device binding
 * endpoint; here we verify that the configured gateway is reachable over HTTPS.
 */
async function testDjiCloud(i: Integration): Promise<ProviderTest> {
  const res = await safeFetch(i.config.baseUrl, { method: "GET" });
  if (res.status >= 500) return { ok: false, message: `Gateway responded with HTTP ${res.status}.` };
  return { ok: false, message: "Gateway reachable. Device binding and MQTT telemetry require a DJI developer licence and paired devices (Integration Required)." };
}

export async function testProvider(i: Integration): Promise<ProviderTest> {
  try {
    if (i.provider === "procore" || i.provider === "acc") return await testOAuthConnector(i);
    return i.provider === "nodeodm" ? await testNodeOdm(i) : await testDjiCloud(i);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// ---------------------------------------------------------------- Construction platforms (OAuth 2.0)
// Procore (https://developers.procore.com) and Autodesk Construction Cloud via Autodesk Platform Services.
// The customer registers an app in their developer portal and enters its client ID/secret; an admin then
// authorizes AeroSight. Tokens are stored encrypted (SEC-041) and refreshed on use.

export const OAUTH_CONNECTORS = {
  procore: {
    name: "Procore", authorize: "https://login.procore.com/oauth/authorize", token: "https://login.procore.com/oauth/token", scope: "",
    test: "https://api.procore.com/rest/v1.0/companies", basicAuth: false,
  },
  acc: {
    name: "Autodesk Construction Cloud", authorize: "https://developer.api.autodesk.com/authentication/v2/authorize",
    token: "https://developer.api.autodesk.com/authentication/v2/token", scope: "data:read account:read", test: "https://developer.api.autodesk.com/project/v1/hubs", basicAuth: true,
  },
} as const;
export type OAuthProvider = keyof typeof OAUTH_CONNECTORS;

export function oauthAuthorizeUrl(p: OAuthProvider, clientId: string, redirectUri: string, state: string) {
  const c = OAUTH_CONNECTORS[p];
  const u = new URL(c.authorize);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  if (c.scope) u.searchParams.set("scope", c.scope);
  return u.toString();
}

async function tokenRequest(p: OAuthProvider, i: Integration, params: Record<string, string>) {
  const c = OAUTH_CONNECTORS[p];
  const secret = i.secretEnc ? decrypt(i.secretEnc) : "";
  const body = new URLSearchParams(c.basicAuth ? params : { ...params, client_id: i.config.clientId, client_secret: secret });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (c.basicAuth) headers.authorization = `Basic ${Buffer.from(`${i.config.clientId}:${secret}`).toString("base64")}`;
  const r = await safeFetch(c.token, { method: "POST", body, headers, maxBytes: 32_000 });
  const text = await r.text();
  if (!r.ok) throw new Error(`${c.name} token endpoint returned HTTP ${r.status}.`);
  const t = JSON.parse(text) as { access_token: string; refresh_token?: string; expires_in?: number };
  i.tokenEnc = encrypt(JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in ?? 3600) * 1000 }));
}

export async function oauthExchange(p: OAuthProvider, i: Integration, code: string, redirectUri: string) {
  await tokenRequest(p, i, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

async function accessToken(i: Integration): Promise<string> {
  if (!i.tokenEnc) throw new Error("Not authorized yet — click Authorize.");
  const t = JSON.parse(decrypt(i.tokenEnc)) as { access_token: string; refresh_token?: string; expires_at: number };
  if (t.expires_at - Date.now() > 60_000) return t.access_token;
  if (!t.refresh_token) throw new Error("The access token expired — authorize again.");
  await tokenRequest(i.provider as OAuthProvider, i, { grant_type: "refresh_token", refresh_token: t.refresh_token });
  return (JSON.parse(decrypt(i.tokenEnc)) as { access_token: string }).access_token;
}

async function testOAuthConnector(i: Integration): Promise<ProviderTest> {
  const c = OAUTH_CONNECTORS[i.provider as OAuthProvider];
  if (!i.tokenEnc) return { ok: false, message: `Credentials saved. Click “Authorize with ${c.name}” to finish connecting.` };
  const r = await safeFetch(c.test, { headers: { authorization: `Bearer ${await accessToken(i)}`, accept: "application/json" }, maxBytes: 200_000 });
  if (!r.ok) return { ok: false, message: `${c.name} API returned HTTP ${r.status}.` };
  const body = JSON.parse(await r.text()) as unknown;
  const n = Array.isArray(body) ? body.length : Array.isArray((body as { data?: unknown[] }).data) ? (body as { data: unknown[] }).data.length : 0;
  return { ok: true, message: `${c.name} connected — ${n} ${i.provider === "procore" ? "compan(ies)" : "hub(s)"} visible.` };
}
