"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, audit } from "@/lib/auth";
import { db } from "@/lib/store";
import { assertCan, HttpError } from "@/lib/policy";
import { encrypt, randomToken, sha256 } from "@/lib/crypto";
import { assertSafeUrl, safeFetch, UnsafeUrlError } from "@/lib/net";
import { deliverWebhook, WEBHOOK_EVENTS } from "@/lib/events";
import { newId } from "@/lib/ids";
import { PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/permissions";
import { testProvider } from "@/lib/providers";
import type { NotificationCategory } from "@/lib/types";

export type IntState = { error?: string | null; ok?: string | null; secret?: string };
const fail = (e: unknown): IntState => {
  if (e instanceof HttpError || e instanceof UnsafeUrlError) return { error: e.message };
  if (e instanceof z.ZodError) return { error: e.issues[0].message };
  throw e;
};
const done = (ok: string, extra: Partial<IntState> = {}) => { revalidatePath("/app/integrations"); return { ok, ...extra }; };

// ---------- Slack / Teams (NOTIF-006, INTEG-008) ----------
export async function createRuleAction(_: IntState, f: FormData): Promise<IntState> {
  const ctx = await requireContext();
  try {
    assertCan(ctx, "notification:manage_rules");
    const channel = z.enum(["slack", "teams"]).parse(f.get("channel"));
    const url = String(f.get("url") ?? "").trim();
    const u = await assertSafeUrl(url);
    const okHost = channel === "slack" ? u.hostname === "hooks.slack.com" : /(\.webhook\.office\.com|\.logic\.azure\.com|\.powerplatform\.com)$/.test(u.hostname);
    if (!okHost) throw new HttpError(422, "VALIDATION_ERROR", channel === "slack" ? "Use a Slack incoming-webhook URL (https://hooks.slack.com/…)." : "Use a Microsoft Teams incoming-webhook / Workflows URL.");
    const categories = f.getAll("categories").map(String) as NotificationCategory[];
    if (!categories.length) throw new HttpError(422, "VALIDATION_ERROR", "Choose at least one category.");
    const rule = { id: newId(), organizationId: ctx.orgId, name: String(f.get("name") || `${channel} alerts`), channel, webhookUrlEnc: encrypt(url),
      webhookUrlHint: `${u.hostname}/…${url.slice(-4)}`, categories, minSeverity: z.enum(["info", "warning", "critical"]).parse(f.get("minSeverity") ?? "warning"),
      projectIds: [], active: true, consecutiveFailures: 0, createdAt: new Date().toISOString() };
    db().notificationRules.push(rule);
    await audit(ctx, "notification_rule.created", "notification_rule", rule.id, { changes: { channel: [null, channel] } });
  } catch (e) { return fail(e); }
  return done("Channel connected. Matching alerts will be posted there.");
}

export async function testRuleAction(_: IntState, f: FormData): Promise<IntState> {
  const ctx = await requireContext();
  try {
    assertCan(ctx, "notification:manage_rules");
    const r = db().notificationRules.find((x) => x.id === f.get("id") && x.organizationId === ctx.orgId);
    if (!r) throw new HttpError(404, "NOT_FOUND", "Not found.");
    const { decrypt } = await import("@/lib/crypto");
    const body = r.channel === "slack" ? { text: "✅ AeroSight AI test message — this channel is connected." } : { text: "✅ AeroSight AI test message — this channel is connected." };
    const res = await safeFetch(decrypt(r.webhookUrlEnc), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    r.lastStatus = res.ok ? `ok (${res.status})` : `HTTP ${res.status}`; r.lastSentAt = new Date().toISOString();
    if (!res.ok) throw new HttpError(502, "UPSTREAM_ERROR", `The channel responded with HTTP ${res.status}.`);
  } catch (e) { return fail(e); }
  return done("Test message sent.");
}

export async function deleteRuleAction(f: FormData) {
  const ctx = await requireContext();
  assertCan(ctx, "notification:manage_rules");
  const i = db().notificationRules.findIndex((x) => x.id === f.get("id") && x.organizationId === ctx.orgId);
  if (i >= 0) { const [r] = db().notificationRules.splice(i, 1); await audit(ctx, "notification_rule.deleted", "notification_rule", r.id); }
  revalidatePath("/app/integrations");
}

// ---------- Webhooks (INTEG-006) ----------
export async function createWebhookAction(_: IntState, f: FormData): Promise<IntState> {
  const ctx = await requireContext();
  let secret: string;
  try {
    assertCan(ctx, "integration:manage");
    const url = String(f.get("url") ?? "").trim();
    await assertSafeUrl(url);
    const eventTypes = f.getAll("events").map(String).filter((e) => WEBHOOK_EVENTS.includes(e));
    if (!eventTypes.length) throw new HttpError(422, "VALIDATION_ERROR", "Choose at least one event.");
    if (db().webhooks.filter((w) => w.organizationId === ctx.orgId).length >= 10) throw new HttpError(422, "PLAN_LIMIT_EXCEEDED", "Up to 10 webhooks per organization.");
    secret = `whsec_${randomToken(24)}`;
    const w = { id: newId(), organizationId: ctx.orgId, url, secretEnc: encrypt(secret), eventTypes, active: true, consecutiveFailures: 0, createdAt: new Date().toISOString(), createdBy: ctx.userId };
    db().webhooks.push(w);
    await audit(ctx, "webhook.created", "webhook", w.id, { changes: { url: [null, new URL(url).host], events: [null, eventTypes.length] } });
  } catch (e) { return fail(e); }
  return done("Webhook created. Copy the signing secret now — it won't be shown again.", { secret });
}

export async function testWebhookAction(_: IntState, f: FormData): Promise<IntState> {
  const ctx = await requireContext();
  try {
    assertCan(ctx, "integration:manage");
    const w = db().webhooks.find((x) => x.id === f.get("id") && x.organizationId === ctx.orgId);
    if (!w) throw new HttpError(404, "NOT_FOUND", "Not found.");
    await deliverWebhook(w.id, { id: newId(), type: "webhook.test", createdAt: new Date().toISOString(), organizationId: ctx.orgId, data: { message: "Test event from AeroSight AI" } });
    const last = db().webhookDeliveries.filter((d) => d.webhookId === w.id).at(-1);
    if (last?.error) throw new HttpError(502, "UPSTREAM_ERROR", `Delivery failed: ${last.error}`);
  } catch (e) { return fail(e); }
  return done("Test event delivered.");
}

export async function toggleWebhookAction(f: FormData) {
  const ctx = await requireContext();
  assertCan(ctx, "integration:manage");
  const w = db().webhooks.find((x) => x.id === f.get("id") && x.organizationId === ctx.orgId);
  if (!w) return;
  if (f.get("op") === "delete") { db().webhooks.splice(db().webhooks.indexOf(w), 1); await audit(ctx, "webhook.deleted", "webhook", w.id); }
  else { w.active = !w.active; w.consecutiveFailures = 0; w.disabledReason = undefined; await audit(ctx, w.active ? "webhook.enabled" : "webhook.disabled", "webhook", w.id); }
  revalidatePath("/app/integrations");
}

// ---------- API keys (INTEG-007) ----------
const NEVER_ON_KEYS = ["org:delete", "billing:manage", "role:manage", "user:manage", "apikey:manage"];
export async function createApiKeyAction(_: IntState, f: FormData): Promise<IntState> {
  const ctx = await requireContext();
  let raw: string;
  try {
    assertCan(ctx, "apikey:manage");
    const name = z.string().trim().min(2, "Name the key.").max(60).parse(f.get("name"));
    const perms = f.getAll("permissions").map(String).filter((p) => (PERMISSIONS as readonly string[]).includes(p));
    if (!perms.length) throw new HttpError(422, "VALIDATION_ERROR", "Choose at least one permission.");
    const own = ROLE_PERMISSIONS[ctx.role];
    const escalation = perms.filter((p) => !own.has(p as never) || NEVER_ON_KEYS.includes(p));
    if (escalation.length) throw new HttpError(403, "PRIVILEGE_ESCALATION", `Not allowed on API keys: ${escalation.join(", ")}.`); // RR-10
    const days = z.coerce.number().int().min(1).max(365).parse(f.get("expiresInDays") ?? 90);
    const prefix = randomToken(6).replace(/[^a-zA-Z0-9]/g, "x").slice(0, 8);
    raw = `asai_live_${prefix}_${randomToken(32)}`;
    const projectId = String(f.get("projectId") ?? "");
    const k = { id: newId(), organizationId: ctx.orgId, name, prefix, keyHash: sha256(raw), permissions: perms, projectIds: projectId ? [projectId] : null,
      expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(), createdBy: ctx.userId, createdAt: new Date().toISOString() };
    db().apiKeys.push(k);
    await audit(ctx, "api_key.created", "api_key", k.id, { changes: { name: [null, name], permissions: [null, perms.length] } });
  } catch (e) { return fail(e); }
  return done("API key created. Copy it now — it won't be shown again.", { secret: raw });
}

export async function revokeApiKeyAction(f: FormData) {
  const ctx = await requireContext();
  assertCan(ctx, "apikey:manage");
  const k = db().apiKeys.find((x) => x.id === f.get("id") && x.organizationId === ctx.orgId && !x.revokedAt);
  if (!k) return;
  k.revokedAt = new Date().toISOString();
  await audit(ctx, "api_key.revoked", "api_key", k.id);
  revalidatePath("/app/integrations");
}

// ---------- Provider connections (INTEG-002/003/004/005) ----------
export async function connectProviderAction(_: IntState, f: FormData): Promise<IntState> {
  const ctx = await requireContext();
  try {
    assertCan(ctx, "integration:manage");
    const provider = z.enum(["dji_cloud", "nodeodm"]).parse(f.get("provider"));
    const baseUrl = String(f.get("baseUrl") ?? "").trim();
    await assertSafeUrl(baseUrl);
    const secret = String(f.get("secret") ?? "");
    const config: Record<string, string> = { baseUrl };
    if (provider === "dji_cloud") { config.appId = String(f.get("appId") ?? "").trim(); if (!config.appId || !secret) throw new HttpError(422, "VALIDATION_ERROR", "App ID and App Key are required."); }
    const existing = db().integrations.find((i) => i.organizationId === ctx.orgId && i.provider === provider);
    const integ = existing ?? { id: newId(), organizationId: ctx.orgId, provider, name: provider === "dji_cloud" ? "DJI Cloud API" : "NodeODM", status: "pending" as const, config, createdAt: new Date().toISOString() };
    integ.config = config;
    if (secret) integ.secretEnc = encrypt(secret);
    if (!existing) db().integrations.push(integ);
    const r = await testProvider(integ);
    integ.status = r.ok ? "connected" : "error"; integ.lastError = r.ok ? undefined : r.message; integ.lastCheckedAt = new Date().toISOString();
    await audit(ctx, existing ? "integration.updated" : "integration.connected", "integration", integ.id, { changes: { provider: [null, provider], status: [null, integ.status] } });
    if (!r.ok) return done(`Saved, but the connection test failed: ${r.message}`);
  } catch (e) { return fail(e); }
  return done("Connected.");
}

export async function disconnectProviderAction(f: FormData) {
  const ctx = await requireContext();
  assertCan(ctx, "integration:manage");
  const i = db().integrations.findIndex((x) => x.id === f.get("id") && x.organizationId === ctx.orgId);
  if (i >= 0) { const [x] = db().integrations.splice(i, 1); await audit(ctx, "integration.disconnected", "integration", x.id); }
  revalidatePath("/app/integrations");
}

// ---------- Construction platforms: Procore, Autodesk Construction Cloud (INTEG-010/011) ----------
export async function saveConnectorAction(_: IntState, f: FormData): Promise<IntState> {
  const ctx = await requireContext();
  try {
    assertCan(ctx, "integration:manage");
    const provider = z.enum(["procore", "acc"]).parse(f.get("provider"));
    const clientId = z.string().trim().min(6, "Enter the client ID from your developer app.").max(200).parse(f.get("clientId"));
    const secret = String(f.get("secret") ?? "");
    const existing = db().integrations.find((i) => i.organizationId === ctx.orgId && i.provider === provider);
    if (!existing && !secret) throw new HttpError(422, "VALIDATION_ERROR", "Enter the client secret.");
    const integ = existing ?? { id: newId(), organizationId: ctx.orgId, provider, name: provider === "procore" ? "Procore" : "Autodesk Construction Cloud", status: "pending" as const, config: {}, createdAt: new Date().toISOString() };
    if (existing && existing.config.clientId !== clientId) integ.tokenEnc = undefined; // new app → re-authorize
    integ.config = { clientId };
    if (secret) integ.secretEnc = encrypt(secret);
    integ.status = integ.tokenEnc ? integ.status : "pending";
    if (!existing) db().integrations.push(integ);
    await audit(ctx, existing ? "integration.updated" : "integration.connected", "integration", integ.id, { changes: { provider: [null, provider] } });
  } catch (e) { return fail(e); }
  return done("Credentials saved. Now click Authorize to grant access.");
}
