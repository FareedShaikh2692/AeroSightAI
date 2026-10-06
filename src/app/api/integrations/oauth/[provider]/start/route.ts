// GET /api/integrations/oauth/:provider/start — send an admin to Procore / Autodesk to authorize AeroSight.
import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { OAUTH_CONNECTORS, oauthAuthorizeUrl, type OAuthProvider } from "@/lib/providers";
import { signFlowState } from "@/lib/session";
import { randomToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const u = new URL(req.url);
  const ctx = await getContext();
  if (!ctx || ctx.isPlatformStaff || !can(ctx, "integration:manage")) return NextResponse.redirect(new URL("/login", u.origin), 303);
  if (!(provider in OAUTH_CONNECTORS)) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  const i = db().integrations.find((x) => x.organizationId === ctx.orgId && x.provider === provider);
  if (!i?.config.clientId) return NextResponse.redirect(new URL("/app/integrations?tab=construction", u.origin), 303);
  const state = randomToken(24);
  const res = NextResponse.redirect(oauthAuthorizeUrl(provider as OAuthProvider, i.config.clientId, `${u.origin}/api/integrations/oauth/${provider}/callback`, state), 303);
  res.cookies.set("asai_oauth", await signFlowState("aerosight-oauth", { state, provider, org: ctx.orgId, user: ctx.userId }, 600), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/oauth", maxAge: 600,
  });
  return res;
}
