// GET /api/auth/sso/start?email=…&next=… — begin OIDC sign-in for the organization that owns the email domain.
import { NextResponse } from "next/server";
import { ssoForEmail, authorizationUrl, pkce } from "@/lib/sso";
import { signFlowState } from "@/lib/session";
import { randomToken } from "@/lib/crypto";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";


export async function GET(req: Request) {
  const u = new URL(req.url);
  const email = (u.searchParams.get("email") ?? "").trim().toLowerCase();
  const next = u.searchParams.get("next") ?? "";
  const back = (msg: string) => NextResponse.redirect(new URL(`/login?sso=1&error=${encodeURIComponent(msg)}`, u.origin), 303);
  const c = ssoForEmail(email);
  if (!c) return back("Single sign-on isn't set up for that email domain. Sign in with your password instead.");
  const state = randomToken(24), nonce = randomToken(24);
  const { verifier, challenge } = pkce();
  const redirectUri = `${u.origin}/api/auth/sso/callback`;
  let target: string;
  try {
    target = await authorizationUrl(c, redirectUri, state, nonce, challenge, email);
  } catch (e) {
    return back(e instanceof HttpError ? e.message : "The identity provider could not be reached.");
  }
  const res = NextResponse.redirect(target, 303);
  res.cookies.set("asai_sso", await signFlowState("aerosight-sso", { state, nonce, verifier, org: c.organizationId, next }, 600), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/sso", maxAge: 600,
  });
  return res;
}
