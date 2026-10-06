"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, audit } from "@/lib/auth";
import { HttpError } from "@/lib/policy";
import { UnsafeUrlError } from "@/lib/net";
import { addDomain, removeDomain, saveSsoConfig, verifyDomain } from "@/lib/sso";
import { createScimToken, revokeScimToken } from "@/lib/scim";
import type { RoleKey } from "@/lib/types";

export type SsoState = { error?: string | null; ok?: string | null; secret?: string; txt?: { host: string; value: string } };
const fail = (e: unknown): SsoState => {
  if (e instanceof HttpError || e instanceof UnsafeUrlError) return { error: e.message };
  if (e instanceof z.ZodError) return { error: e.issues[0].message };
  throw e;
};
const done = (s: SsoState) => { revalidatePath("/app/settings"); return s; };

export async function saveSsoAction(_: SsoState, f: FormData): Promise<SsoState> {
  const ctx = await requireContext();
  try {
    const c = await saveSsoConfig(ctx, {
      issuer: String(f.get("issuer") ?? "").trim(), clientId: String(f.get("clientId") ?? ""), clientSecret: String(f.get("clientSecret") ?? "") || undefined,
      jitRole: String(f.get("jitRole") ?? "viewer") as RoleKey, enabled: f.get("enabled") === "on", enforced: f.get("enforced") === "on",
    });
    await audit(ctx, "sso.config_saved", "sso_config", ctx.orgId, { changes: { issuer: [null, c.issuer], enabled: [null, c.enabled], enforced: [null, c.enforced] } });
  } catch (e) { return fail(e); }
  return done({ ok: "Single sign-on settings saved." });
}

export async function addDomainAction(_: SsoState, f: FormData): Promise<SsoState> {
  const ctx = await requireContext();
  try {
    const d = addDomain(ctx, String(f.get("domain") ?? ""));
    await audit(ctx, "sso.domain_added", "sso_config", ctx.orgId, { changes: { domain: [null, d.domain] } });
    return done({ ok: `Add this DNS TXT record, then click Verify.`, txt: { host: d.host, value: d.token } });
  } catch (e) { return fail(e); }
}

export async function verifyDomainAction(_: SsoState, f: FormData): Promise<SsoState> {
  const ctx = await requireContext();
  try {
    const d = await verifyDomain(ctx, String(f.get("domain") ?? ""));
    await audit(ctx, "sso.domain_verified", "sso_config", ctx.orgId, { changes: { domain: [null, d.domain] } });
  } catch (e) { return fail(e); }
  return done({ ok: "Domain verified." });
}

export async function removeDomainAction(f: FormData) {
  const ctx = await requireContext();
  removeDomain(ctx, String(f.get("domain") ?? ""));
  await audit(ctx, "sso.domain_removed", "sso_config", ctx.orgId, { changes: { domain: [String(f.get("domain")), null] } });
  revalidatePath("/app/settings");
}

export async function createScimTokenAction(_: SsoState): Promise<SsoState> {
  const ctx = await requireContext();
  try {
    const { token, row } = createScimToken(ctx);
    await audit(ctx, "scim_token.created", "scim_token", row.id);
    return done({ ok: "SCIM token created. Copy it now — it won't be shown again.", secret: token });
  } catch (e) { return fail(e); }
}

export async function revokeScimTokenAction(f: FormData) {
  const ctx = await requireContext();
  const t = revokeScimToken(ctx, String(f.get("id") ?? ""));
  if (t) await audit(ctx, "scim_token.revoked", "scim_token", t.id);
  revalidatePath("/app/settings");
}
