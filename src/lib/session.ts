// Session token (signed JWT in an httpOnly cookie). Edge-safe: used by middleware and server code.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "asai_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface SessionClaims { sub: string; org: string; sid: string; staff?: boolean }

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production" && !s) {
      console.warn("[auth] AUTH_SECRET is not set — using an insecure fallback. Set AUTH_SECRET in the environment.");
    }
    return new TextEncoder().encode(s && s.length >= 32 ? s : "aerosight-demo-insecure-fallback-secret-change-me");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(c: SessionClaims): Promise<string> {
  return new SignJWT({ org: c.org, sid: c.sid, staff: c.staff ?? false })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.sub)
    .setIssuer("aerosight")
    .setAudience("aerosight-app")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "aerosight", audience: "aerosight-app", algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.org !== "string") return null;
    return { sub: payload.sub, org: payload.org, sid: String(payload.sid), staff: Boolean(payload.staff) };
  } catch {
    return null;
  }
}
