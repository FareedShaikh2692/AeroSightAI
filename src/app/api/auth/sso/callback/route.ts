// GET /api/auth/sso/callback — OIDC redirect target: validate state, exchange the code, verify the id_token,
// JIT-provision and start a session.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSsoConfig, completeAuthorization, provision } from "@/lib/sso";
import { signSession, verifyFlowState, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session";
import { appendAudit, store } from "@/lib/store";
import { HttpError } from "@/lib/policy";
import { newId } from "@/lib/ids";
import { clientIp } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const jar = await cookies();
  const flow = await verifyFlowState("aerosight-sso", jar.get("asai_sso")?.value);
  const back = (msg: string) => {
    const r = NextResponse.redirect(new URL(`/login?sso=1&error=${encodeURIComponent(msg)}`, u.origin), 303);
    r.cookies.delete({ name: "asai_sso", path: "/api/auth/sso" });
    return r;
  };
  if (u.searchParams.get("error")) return back(`The identity provider returned: ${u.searchParams.get("error_description") ?? u.searchParams.get("error")}`);
  if (!flow || flow.state !== u.searchParams.get("state")) return back("Your sign-in session expired. Please try again.");
  const c = getSsoConfig(flow.org);
  if (!c?.enabled) return back("Single sign-on is no longer enabled for this organization.");
  const ip = await clientIp();
  try {
    const id = await completeAuthorization(c, u.searchParams.get("code") ?? "", `${u.origin}/api/auth/sso/callback`, flow.verifier, flow.nonce);
    const { userId, created } = provision(c, id);
    const now = new Date().toISOString();
    if (created) appendAudit(store(), { id: newId(), organizationId: c.organizationId, occurredAt: now, actorType: "system", actorLabel: "sso", action: "user.jit_provisioned", entityType: "user", entityId: userId, changes: { role: [null, c.jitRole] } });
    appendAudit(store(), { id: newId(), organizationId: c.organizationId, occurredAt: now, actorType: "user", actorId: userId, actorLabel: id.email, action: "auth.login_succeeded", entityType: "user", entityId: userId, ip, changes: { method: [null, "sso_oidc"] } });
    const res = NextResponse.redirect(new URL(flow.next?.startsWith("/app/") ? flow.next : "/app/dashboard", u.origin), 303);
    res.cookies.set(SESSION_COOKIE, await signSession({ sub: userId, org: c.organizationId, sid: newId() }), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS,
    });
    res.cookies.delete({ name: "asai_sso", path: "/api/auth/sso" });
    return res;
  } catch (e) {
    if (e instanceof HttpError) return back(e.message);
    console.error("[sso] callback", e);
    return back("Single sign-on failed. Please try again.");
  }
}
