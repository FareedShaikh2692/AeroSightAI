// PolicyEngine — central authorization (docs/07-Security/RBAC.md §1, §5; Technical-Design §4.4).
import type { AuthContext, UUID } from "./types";
import { ORG_SCOPED, ORG_WIDE_ROLES, RESTRICTED, ROLE_PERMISSIONS, type Permission } from "./permissions";
import { db } from "./store";

export interface Scoped { organizationId: UUID; projectId?: UUID }

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public meta?: Record<string, unknown>) {
    super(message);
  }
}

export const notFound = () => new HttpError(404, "NOT_FOUND", "Not found or you don't have access.");
export const forbidden = (perm?: string) => new HttpError(403, "FORBIDDEN", perm ? `Requires permission ${perm}.` : "Forbidden.");

export function isOrgWide(ctx: AuthContext) {
  return ORG_WIDE_ROLES.has(ctx.role);
}

/** Project role for the user in a project, if they are a member. */
export function projectRole(ctx: AuthContext, projectId: UUID) {
  return db().projectMembers.find((m) => m.organizationId === ctx.orgId && m.projectId === projectId && m.userId === ctx.userId)?.role;
}

export function accessibleProjectIds(ctx: AuthContext): Set<UUID> {
  const projects = db().projects.filter((p) => p.organizationId === ctx.orgId);
  const restrict = (s: Set<UUID>) => (ctx.apiKey?.projectIds ? new Set([...s].filter((x) => ctx.apiKey!.projectIds!.includes(x))) : s);
  if (isOrgWide(ctx) || ctx.breakGlass) return restrict(new Set(projects.map((p) => p.id)));
  return restrict(new Set(db().projectMembers.filter((m) => m.organizationId === ctx.orgId && m.userId === ctx.userId).map((m) => m.projectId)));
}

/** Can the user perform `perm` (optionally on resource `res`)? Tenant guard first, then RBAC, then project scope. */
const READ_ONLY = (p: Permission) => /:(read|view)$/.test(p) || p === "telemetry:read";

export function can(ctx: AuthContext, perm: Permission, res?: Scoped): boolean {
  if (ctx.isPlatformStaff && !ctx.breakGlass) return false; // staff have no tenant permissions
  if (ctx.breakGlass && (!READ_ONLY(perm) || Date.parse(ctx.breakGlass.endsAt) < Date.now())) return false; // ADMIN-009: read-only, time-boxed
  if (res && res.organizationId !== ctx.orgId) return false;
  if (ctx.apiKey) {
    if (!ctx.apiKey.permissions.includes(perm)) return false;
    if (ctx.apiKey.projectIds && res?.projectId && !ctx.apiKey.projectIds.includes(res.projectId)) return false;
  }
  const orgPerms = ROLE_PERMISSIONS[ctx.role];
  if (isOrgWide(ctx) || ORG_SCOPED.has(perm) || !res?.projectId) return orgPerms.has(perm);
  const pRole = projectRole(ctx, res.projectId);
  if (!pRole) return false;
  return orgPerms.has(perm) || ROLE_PERMISSIONS[pRole].has(perm);
}

/** "S"/"A" restrictions from the matrix for the user's effective role in the project. */
export function restriction(ctx: AuthContext, perm: Permission, projectId?: UUID): "S" | "A" | undefined {
  if (isOrgWide(ctx)) return undefined;
  const pRole = projectId ? projectRole(ctx, projectId) : undefined;
  const effective = pRole && ROLE_PERMISSIONS[pRole].has(perm) && !RESTRICTED[pRole]?.[perm] ? pRole : ctx.role;
  return RESTRICTED[effective]?.[perm];
}

export function assertCan(ctx: AuthContext, perm: Permission, res?: Scoped) {
  if (res && res.organizationId !== ctx.orgId) throw notFound();
  if (!can(ctx, perm, res)) throw forbidden(perm);
}

/** Org-level permission set for the UI (cosmetic only — the server re-checks every action). */
export function permissionsForUi(ctx: AuthContext) {
  const projects: Record<string, Permission[]> = {};
  for (const pid of accessibleProjectIds(ctx)) {
    projects[pid] = [...ROLE_PERMISSIONS[ctx.role]].filter((p) => can(ctx, p, { organizationId: ctx.orgId, projectId: pid }));
  }
  return { org: [...ROLE_PERMISSIONS[ctx.role]], projects, orgWide: isOrgWide(ctx) };
}
