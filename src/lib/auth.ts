// Server-side session → AuthContext resolution. Role and membership status are re-read on every request,
// so deactivation and role changes take effect immediately (AUTH-014, RBAC-012).
import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "./session";
import { db, store, appendAudit } from "./store";
import type { AuthContext, AuditLog } from "./types";
import { newId } from "./ids";

export async function getContext(): Promise<AuthContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims) return null;
  const user = db().users.find((u) => u.id === claims.sub);
  if (!user) return null;
  if (claims.staff) {
    if (!user.isPlatformStaff) return null;
    // ADMIN-009: an active break-glass session grants time-boxed, read-only access to one organization.
    const bg = db().breakGlassSessions.find((b) => b.staffUserId === user.id && !b.endedEarlyAt && Date.parse(b.endsAt) > Date.now());
    if (bg) return { userId: user.id, orgId: bg.organizationId, role: "org_admin", isPlatformStaff: true, sessionId: claims.sid, breakGlass: { sessionId: bg.id, endsAt: bg.endsAt } };
    return { userId: user.id, orgId: "", role: "viewer", isPlatformStaff: true, sessionId: claims.sid };
  }
  const org = db().organizations.find((o) => o.id === claims.org);
  const m = db().memberships.find((x) => x.userId === user.id && x.organizationId === claims.org && x.status === "active");
  if (!org || !m || org.status === "suspended" || org.status === "pending_deletion") return null;
  return { userId: user.id, orgId: org.id, role: m.role, isPlatformStaff: false, sessionId: claims.sid };
}

export async function requireContext(): Promise<AuthContext> {
  const ctx = await getContext();
  if (!ctx || (ctx.isPlatformStaff && !ctx.breakGlass)) redirect(ctx?.isPlatformStaff ? "/admin" : "/login");
  return ctx;
}

export async function requireStaff(): Promise<AuthContext> {
  const ctx = await getContext();
  if (!ctx?.isPlatformStaff) redirect("/login?staff=1");
  return ctx;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

/** Record an audit event for the current actor (same "transaction" as the in-memory mutation). */
export async function audit(ctx: AuthContext, action: string, entityType: string, entityId?: string,
  extra: { projectId?: string; changes?: AuditLog["changes"]; orgId?: string } = {}) {
  const user = db().users.find((u) => u.id === ctx.userId);
  appendAudit(store(), {
    id: newId(), organizationId: extra.orgId ?? ctx.orgId, occurredAt: new Date().toISOString(),
    actorType: ctx.isPlatformStaff ? "platform_staff" : "user", actorId: ctx.userId, actorLabel: user?.email ?? "unknown",
    action, entityType, entityId, projectId: extra.projectId, changes: extra.changes, ip: await clientIp(),
  });
}
