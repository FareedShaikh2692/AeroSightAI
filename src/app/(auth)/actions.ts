"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, store, appendAudit } from "@/lib/store";
import { verifyPassword, dummyVerify, hashPassword, passwordIssues } from "@/lib/password";
import { signSession, SESSION_COOKIE, SESSION_TTL_SECONDS, MFA_COOKIE, signMfaPending, verifyMfaPending } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";
import { sha256 } from "@/lib/crypto";
import { getContext, clientIp } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { z } from "zod";

export type FormState = { error?: string | null; email?: string; mfa?: boolean };

// AUTH-007: lock an account for 15 minutes after 10 failures within 15 minutes; per-IP throttle too.
const failures = new Map<string, number[]>();
const WINDOW = 15 * 60_000;
function tooMany(key: string, limit: number) {
  const now = Date.now();
  const arr = (failures.get(key) ?? []).filter((t) => now - t < WINDOW);
  failures.set(key, arr);
  return arr.length >= limit;
}
function fail(key: string) {
  failures.set(key, [...(failures.get(key) ?? []), Date.now()]);
}

async function setSession(userId: string, orgId: string, staff = false) {
  const token = await signSession({ sub: userId, org: orgId, sid: newId(), staff });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS,
  });
}

const GENERIC = "Email or password is incorrect.";

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  const ip = await clientIp();
  if (tooMany(`acct:${email}`, 10) || tooMany(`ip:${ip}`, 50)) return { error: "Too many attempts. Try again in 15 minutes.", email };
  const user = db().users.find((u) => u.email === email);
  if (!user) { dummyVerify(password); fail(`acct:${email}`); fail(`ip:${ip}`); return { error: GENERIC, email }; }
  if (!verifyPassword(password, user.passwordHash)) { fail(`acct:${email}`); fail(`ip:${ip}`); return { error: GENERIC, email }; }
  failures.delete(`acct:${email}`);
  user.lastLoginAt = new Date().toISOString();
  if (user.isPlatformStaff) {
    await setSession(user.id, "", true);
    redirect("/admin");
  }
  const membership = db().memberships.find((m) => m.userId === user.id && m.status === "active" && db().organizations.find((o) => o.id === m.organizationId)?.status === "active");
  if (!membership) return { error: "Your account has no active organization.", email };
  if (user.mfaSecret) {
    // AUTH-010: password verified — require the second factor before issuing a session.
    (await cookies()).set(MFA_COOKIE, await signMfaPending(user.id, membership.organizationId, next), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 300,
    });
    return { mfa: true, email };
  }
  await completeLogin(user.id, membership.organizationId, ip, next, "password");
  return {};
}

async function completeLogin(userId: string, orgId: string, ip: string, next: string, method: string): Promise<never> {
  const user = db().users.find((u) => u.id === userId)!;
  await setSession(user.id, orgId);
  appendAudit(store(), { id: newId(), organizationId: orgId, occurredAt: new Date().toISOString(), actorType: "user", actorId: user.id, actorLabel: user.email,
    action: "auth.login_succeeded", entityType: "user", entityId: user.id, ip, changes: { method: [null, method] } });
  redirect(next.startsWith("/app/") ? next : "/app/dashboard");
}

/** Second step: TOTP code or a single-use recovery code (AUTH-009/010). */
export async function mfaVerifyAction(_: FormState, form: FormData): Promise<FormState> {
  const jar = await cookies();
  const pending = await verifyMfaPending(jar.get(MFA_COOKIE)?.value);
  if (!pending) return { error: "Your sign-in expired. Enter your password again." };
  const ip = await clientIp();
  if (tooMany(`mfa:${pending.sub}`, 5)) return { error: "Too many attempts. Try again in 15 minutes.", mfa: true };
  const user = db().users.find((u) => u.id === pending.sub);
  if (!user?.mfaSecret) return { error: "Two-factor authentication is not set up for this account." };
  const code = String(form.get("code") ?? "").replace(/\s|-/g, "");
  let method = "totp";
  if (/^\d{6}$/.test(code)) {
    const step = verifyTotp(user.mfaSecret, code, user.mfaLastStep ?? -1);
    if (step === null) { fail(`mfa:${pending.sub}`); return { error: "That code is invalid or was already used.", mfa: true }; }
    user.mfaLastStep = step;
  } else {
    const h = sha256(code.toLowerCase());
    const idx = user.recoveryCodeHashes?.indexOf(h) ?? -1;
    if (idx < 0) { fail(`mfa:${pending.sub}`); return { error: "That code is invalid or was already used.", mfa: true }; }
    user.recoveryCodeHashes!.splice(idx, 1); // single use
    method = "recovery_code";
  }
  jar.delete(MFA_COOKIE);
  failures.delete(`mfa:${pending.sub}`);
  await completeLogin(user.id, pending.org, ip, pending.next, method);
  return {};
}

const SignupSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid work email."),
  password: z.string(),
  organizationName: z.string().trim().min(2, "Organization name must be at least 2 characters.").max(120),
  acceptTerms: z.literal("on", { errorMap: () => ({ message: "Accept the terms to continue." }) }),
});

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { fullName, email, password, organizationName } = parsed.data;
  const weak = passwordIssues(password, email);
  if (weak) return { error: weak };
  if (db().users.some((u) => u.email === email)) return { error: "We couldn't create an account with these details. If you already have an account, sign in instead." };
  const baseSlug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "org";
  let slug = baseSlug, n = 1;
  while (db().organizations.some((o) => o.slug === slug)) slug = `${baseSlug}-${++n}`;
  const now = new Date().toISOString();
  const user = { id: newId(), email, fullName, passwordHash: hashPassword(password), mfaEnabled: false, lastLoginAt: now };
  const org = { id: newId(), name: organizationName, slug, status: "active" as const, country: "AE", timezone: "UTC", region: "demo", brandColor: "#FFB020",
    plan: "professional" as const, settings: { mfaRequired: false, externalSharing: true, missionApprovalRequired: false, aiEnabled: true, fourEyesProgress: false },
    aiCreditsUsed: 0, aiCreditsLimit: 5000, createdAt: now };
  db().users.push(user);
  db().organizations.push(org);
  db().memberships.push({ id: newId(), organizationId: org.id, userId: user.id, role: "org_owner", status: "active", joinedAt: now });
  appendAudit(store(), { id: newId(), organizationId: org.id, occurredAt: now, actorType: "user", actorId: user.id, actorLabel: email, action: "org.created", entityType: "organization", entityId: org.id, ip: await clientIp() });
  await setSession(user.id, org.id);
  redirect("/app/dashboard?welcome=1");
}

export async function logoutAction() {
  const ctx = await getContext();
  if (ctx && !ctx.isPlatformStaff) {
    const u = db().users.find((x) => x.id === ctx.userId);
    appendAudit(store(), { id: newId(), organizationId: ctx.orgId, occurredAt: new Date().toISOString(), actorType: "user", actorId: ctx.userId, actorLabel: u?.email ?? "", action: "auth.logout", entityType: "user", entityId: ctx.userId });
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Demo convenience: sign in as a seeded persona without typing the password. Only accepts seeded demo accounts. */
export async function demoLoginAction(form: FormData) {
  const email = String(form.get("email") ?? "");
  if (!email.endsWith(".demo")) redirect("/login");
  const user = db().users.find((u) => u.email === email);
  if (!user) redirect("/login");
  if (user.mfaSecret) redirect("/login?mfa=1"); // never bypass a second factor the user has enabled
  if (user.isPlatformStaff) { await setSession(user.id, "", true); redirect("/admin"); }
  const m = db().memberships.find((x) => x.userId === user.id && x.status === "active");
  if (!m) redirect("/login");
  await setSession(user.id, m.organizationId);
  redirect("/app/dashboard");
}
