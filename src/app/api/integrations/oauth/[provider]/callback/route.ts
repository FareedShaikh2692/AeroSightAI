// GET /api/integrations/oauth/:provider/callback — exchange the authorization code and test the connection.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getContext, audit } from "@/lib/auth";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { oauthExchange, testProvider, type OAuthProvider } from "@/lib/providers";
import { verifyFlowState } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const u = new URL(req.url);
  const done = (msg: string) => {
    const r = NextResponse.redirect(new URL(`/app/integrations?tab=construction&msg=${encodeURIComponent(msg)}`, u.origin), 303);
    r.cookies.delete({ name: "asai_oauth", path: "/api/integrations/oauth" });
    return r;
  };
  const ctx = await getContext();
  const flow = await verifyFlowState("aerosight-oauth", (await cookies()).get("asai_oauth")?.value);
  if (!ctx || !can(ctx, "integration:manage")) return NextResponse.redirect(new URL("/login", u.origin), 303);
  if (!flow || flow.state !== u.searchParams.get("state") || flow.provider !== provider || flow.org !== ctx.orgId || flow.user !== ctx.userId) return done("Authorization expired or did not match. Try again.");
  if (u.searchParams.get("error")) return done(`Authorization was declined: ${u.searchParams.get("error_description") ?? u.searchParams.get("error")}`);
  const i = db().integrations.find((x) => x.organizationId === ctx.orgId && x.provider === provider);
  if (!i) return done("Save the connector credentials first.");
  try {
    await oauthExchange(provider as OAuthProvider, i, u.searchParams.get("code") ?? "", `${u.origin}/api/integrations/oauth/${provider}/callback`);
    const r = await testProvider(i);
    i.status = r.ok ? "connected" : "error"; i.lastError = r.ok ? undefined : r.message; i.lastCheckedAt = new Date().toISOString();
    await audit(ctx, "integration.authorized", "integration", i.id, { changes: { provider: [null, provider], status: [null, i.status] } });
    return done(r.message);
  } catch (e) {
    i.status = "error"; i.lastError = (e as Error).message; i.lastCheckedAt = new Date().toISOString();
    return done((e as Error).message);
  }
}
