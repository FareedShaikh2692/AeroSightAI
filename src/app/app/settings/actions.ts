"use server";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { z } from "zod";
import { requireContext, audit } from "@/lib/auth";
import { db } from "@/lib/store";
import { assertCan, HttpError } from "@/lib/policy";
import { newTotpSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { sha256, randomToken } from "@/lib/crypto";
import { verifyPassword } from "@/lib/password";
import { emit, MANDATORY } from "@/lib/events";
import { RETENTION_BOUNDS, enforceRetention } from "@/lib/privacy";
import { newId } from "@/lib/ids";
import type { DataClass, NotificationCategory } from "@/lib/types";

export type SettingsState = { error?: string | null; ok?: string | null; qr?: string; secret?: string; codes?: string[]; preview?: Record<string, number> };
const fail = (e: unknown): SettingsState => { if (e instanceof HttpError) return { error: e.message }; if (e instanceof z.ZodError) return { error: e.issues[0].message }; throw e; };

function recoveryCodes() {
  const codes = Array.from({ length: 10 }, () => randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, "x").slice(0, 10));
  return { codes, hashes: codes.map((c) => sha256(c)) };
}

// ---------- Two-factor (AUTH-009/011) ----------
export async function beginMfaAction(): Promise<SettingsState> {
  const ctx = await requireContext();
  const u = db().users.find((x) => x.id === ctx.userId)!;
  if (u.mfaSecret) return { error: "Two-factor authentication is already enabled." };
  u.mfaPendingSecret = newTotpSecret();
  const url = otpauthUrl(u.mfaPendingSecret, u.email);
  return { secret: u.mfaPendingSecret, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) };
}

export async function confirmMfaAction(_: SettingsState, f: FormData): Promise<SettingsState> {
  const ctx = await requireContext();
  const u = db().users.find((x) => x.id === ctx.userId)!;
  if (!u.mfaPendingSecret) return { error: "Start the setup first." };
  const step = verifyTotp(u.mfaPendingSecret, String(f.get("code") ?? "").trim());
  if (step === null) return { error: "That code didn't match. Check your device clock and try the next code.", secret: u.mfaPendingSecret };
  const rc = recoveryCodes();
  u.mfaSecret = u.mfaPendingSecret; u.mfaPendingSecret = undefined; u.mfaLastStep = step; u.mfaEnabled = true; u.recoveryCodeHashes = rc.hashes;
  await audit(ctx, "auth.mfa_enabled", "user", u.id);
  emit({ key: "security.mfa_changed", orgId: ctx.orgId, entityType: "user", entityId: u.id, severity: "warning", title: "Two-factor authentication enabled", body: "2FA was enabled on your account. If this wasn't you, contact your administrator.", recipients: [u.id] });
  revalidatePath("/app/settings");
  return { ok: "Two-factor authentication is on. Save these recovery codes — they are shown only once.", codes: rc.codes };
}

export async function disableMfaAction(_: SettingsState, f: FormData): Promise<SettingsState> {
  const ctx = await requireContext();
  const u = db().users.find((x) => x.id === ctx.userId)!;
  const org = db().organizations.find((o) => o.id === ctx.orgId)!;
  if (org.settings.mfaRequired) return { error: "Your organization requires two-factor authentication." };
  if (!u.mfaSecret) return { error: "Two-factor authentication is not enabled." };
  if (!verifyPassword(String(f.get("password") ?? ""), u.passwordHash)) return { error: "Password is incorrect." }; // AUTH-020 re-auth
  if (verifyTotp(u.mfaSecret, String(f.get("code") ?? "").trim(), u.mfaLastStep ?? -1) === null) return { error: "Authentication code is invalid." };
  u.mfaSecret = undefined; u.mfaEnabled = false; u.recoveryCodeHashes = undefined; u.mfaLastStep = undefined;
  await audit(ctx, "auth.mfa_disabled", "user", u.id);
  emit({ key: "security.mfa_changed", orgId: ctx.orgId, entityType: "user", entityId: u.id, severity: "critical", title: "Two-factor authentication disabled", body: "2FA was turned off on your account.", recipients: [u.id] });
  revalidatePath("/app/settings");
  return { ok: "Two-factor authentication disabled." };
}

export async function regenerateCodesAction(_: SettingsState, f: FormData): Promise<SettingsState> {
  const ctx = await requireContext();
  const u = db().users.find((x) => x.id === ctx.userId)!;
  if (!u.mfaSecret) return { error: "Enable 2FA first." };
  const step = verifyTotp(u.mfaSecret, String(f.get("code") ?? "").trim(), u.mfaLastStep ?? -1);
  if (step === null) return { error: "Authentication code is invalid." };
  u.mfaLastStep = step;
  const rc = recoveryCodes();
  u.recoveryCodeHashes = rc.hashes;
  await audit(ctx, "auth.recovery_codes_regenerated", "user", u.id);
  return { ok: "New recovery codes generated. Previous codes no longer work.", codes: rc.codes };
}

// ---------- Notification preferences (NOTIF-005) ----------
const CATS: NotificationCategory[] = ["missions", "telemetry", "inspections", "progress", "reports", "ai", "fleet", "security", "billing"];
export async function savePreferencesAction(_: SettingsState, f: FormData): Promise<SettingsState> {
  const ctx = await requireContext();
  for (const c of CATS) {
    const mandatory = MANDATORY.includes(c);
    const row = { organizationId: ctx.orgId, userId: ctx.userId, category: c,
      inApp: mandatory || f.get(`${c}.inApp`) === "on", email: mandatory || f.get(`${c}.email`) === "on", digest: !mandatory && f.get(`${c}.digest`) === "on" };
    const i = db().notificationPreferences.findIndex((p) => p.organizationId === ctx.orgId && p.userId === ctx.userId && p.category === c);
    if (i >= 0) db().notificationPreferences[i] = row; else db().notificationPreferences.push(row);
  }
  await audit(ctx, "notification_preferences.updated", "user", ctx.userId);
  revalidatePath("/app/settings");
  return { ok: "Preferences saved." };
}

// ---------- Organization policy ----------
export async function saveOrgSettingsAction(_: SettingsState, f: FormData): Promise<SettingsState> {
  const ctx = await requireContext();
  try {
    assertCan(ctx, "org:update");
    const org = db().organizations.find((o) => o.id === ctx.orgId)!;
    const before = { ...org.settings, brandColor: org.brandColor };
    const color = String(f.get("brandColor") ?? org.brandColor);
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new HttpError(422, "VALIDATION_ERROR", "Brand color must be a hex value like #FFB020.");
    org.brandColor = color;
    org.settings = {
      mfaRequired: f.get("mfaRequired") === "on", externalSharing: f.get("externalSharing") === "on",
      missionApprovalRequired: f.get("missionApprovalRequired") === "on", aiEnabled: f.get("aiEnabled") === "on", fourEyesProgress: f.get("fourEyesProgress") === "on",
    };
    const changes = Object.fromEntries(Object.entries({ ...org.settings, brandColor: org.brandColor }).filter(([k, v]) => (before as Record<string, unknown>)[k] !== v)
      .map(([k, v]) => [k, [(before as Record<string, unknown>)[k], v]])) as Record<string, [unknown, unknown]>;
    await audit(ctx, "org.settings_changed", "organization", org.id, { changes });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  return { ok: "Organization settings saved." };
}

// ---------- Retention & legal holds (PRIV-002) ----------
export async function saveRetentionAction(_: SettingsState, f: FormData): Promise<SettingsState> {
  const ctx = await requireContext();
  try {
    assertCan(ctx, "retention:manage");
    const changes: Record<string, [unknown, unknown]> = {};
    for (const [cls, b] of Object.entries(RETENTION_BOUNDS) as [DataClass, { min: number; max: number; label: string }][]) {
      const v = Number(f.get(cls));
      if (!Number.isInteger(v) || v < b.min || v > b.max) throw new HttpError(422, "RETENTION_OUT_OF_BOUNDS", `${b.label}: choose between ${b.min} and ${b.max} days.`);
      const p = db().retentionPolicies.find((x) => x.organizationId === ctx.orgId && x.dataClass === cls);
      if (p && p.retentionDays !== v) { changes[cls] = [p.retentionDays, v]; p.retentionDays = v; p.updatedAt = new Date().toISOString(); p.updatedBy = ctx.userId; }
      else if (!p) db().retentionPolicies.push({ organizationId: ctx.orgId, dataClass: cls, retentionDays: v, updatedAt: new Date().toISOString(), updatedBy: ctx.userId });
    }
    if (Object.keys(changes).length) await audit(ctx, "retention.policy_changed", "organization", ctx.orgId, { changes });
  } catch (e) { return fail(e); }
  revalidatePath("/app/settings");
  return { ok: "Retention policy saved.", preview: enforceRetention(ctx.orgId, false) };
}

export async function runRetentionAction(_: SettingsState): Promise<SettingsState> {
  const ctx = await requireContext();
  try {
    assertCan(ctx, "retention:manage");
    const counts = enforceRetention(ctx.orgId, true);
    await audit(ctx, "retention.enforced", "organization", ctx.orgId, { changes: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, [null, v]])) });
    revalidatePath("/app", "layout");
    return { ok: "Retention enforced.", preview: counts };
  } catch (e) { return fail(e); }
}

export async function placeHoldAction(_: SettingsState, f: FormData): Promise<SettingsState> {
  const ctx = await requireContext();
  try {
    assertCan(ctx, "retention:manage");
    const reason = String(f.get("reason") ?? "").trim();
    if (reason.length < 5) throw new HttpError(422, "VALIDATION_ERROR", "Give a reason (at least 5 characters).");
    const projectId = String(f.get("projectId") ?? "") || undefined;
    if (projectId && !db().projects.some((p) => p.id === projectId && p.organizationId === ctx.orgId)) throw new HttpError(404, "NOT_FOUND", "Project not found.");
    const h = { id: newId(), organizationId: ctx.orgId, projectId, reason, placedBy: ctx.userId, placedAt: new Date().toISOString() };
    db().legalHolds.push(h);
    await audit(ctx, "legal_hold.placed", "legal_hold", h.id, { projectId, changes: { reason: [null, reason] } });
  } catch (e) { return fail(e); }
  revalidatePath("/app/settings");
  return { ok: "Legal hold placed. Retention will not delete covered data." };
}

export async function releaseHoldAction(f: FormData) {
  const ctx = await requireContext();
  assertCan(ctx, "retention:manage");
  const h = db().legalHolds.find((x) => x.id === String(f.get("id")) && x.organizationId === ctx.orgId && !x.releasedAt);
  if (!h) return;
  h.releasedAt = new Date().toISOString(); h.releasedBy = ctx.userId;
  await audit(ctx, "legal_hold.released", "legal_hold", h.id, { projectId: h.projectId });
  revalidatePath("/app/settings");
}
