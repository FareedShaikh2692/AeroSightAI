// Permission catalog and system-role matrix. Single source of truth — mirrors docs/07-Security/RBAC.md §3–§4.
import type { RoleKey } from "./types";

export const PERMISSIONS = [
  "org:read", "org:update", "org:delete", "retention:manage",
  "user:invite", "user:manage", "role:manage", "pilot:manage",
  "billing:manage", "audit:read", "integration:manage", "apikey:manage", "notification:manage_rules",
  "analytics:read", "project:create",
  "project:read", "project:update", "project:archive", "project:member_manage",
  "site:create", "site:read", "site:update", "site:delete",
  "asset:create", "asset:read", "asset:update", "asset:delete",
  "drone:register", "drone:read", "drone:update", "drone:retire",
  "mission:create", "mission:read", "mission:update", "mission:approve", "mission:start", "mission:abort",
  "telemetry:read", "livevideo:view",
  "media:upload", "media:read", "media:download", "media:delete", "media:share",
  "survey:create", "survey:read", "survey:upload", "survey:process", "survey:publish",
  "map:read", "map:annotate", "map:layer_manage",
  "twin:read", "twin:model_upload",
  "inspection:create", "inspection:read", "inspection:update", "inspection:assign", "inspection:approve", "inspection:template_manage",
  "finding:create", "finding:update", "finding:resolve",
  "progress:read", "progress:update", "progress:approve", "milestone:manage",
  "report:generate", "report:read", "report:share", "report:template_manage",
  "ai:analyze", "ai:review", "ai:assistant",
  "comment:create",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Organization-scoped permissions (everything else is project-scoped). */
export const ORG_SCOPED = new Set<Permission>([
  "org:read", "org:update", "org:delete", "retention:manage", "user:invite", "user:manage", "role:manage",
  "pilot:manage", "billing:manage", "audit:read", "integration:manage", "apikey:manage",
  "notification:manage_rules", "analytics:read", "project:create",
  "drone:register", "drone:read", "drone:update", "drone:retire",
]);

export const ROLE_LABELS: Record<RoleKey, string> = {
  org_owner: "Owner", org_admin: "Admin", project_manager: "Project Manager", site_manager: "Site Manager",
  drone_pilot: "Drone Pilot", surveyor: "Surveyor", inspector: "Inspector", engineer: "Engineer", viewer: "Viewer",
};

export const ROLES: RoleKey[] = [
  "org_owner", "org_admin", "project_manager", "site_manager", "drone_pilot", "surveyor", "inspector", "engineer", "viewer",
];

/** Permissions where the role only gets "S" (shared/published content) or "A" (assigned items) — see RBAC §4. */
export const RESTRICTED: Partial<Record<RoleKey, Partial<Record<Permission, "S" | "A">>>> = {
  viewer: { "analytics:read": "S", "media:read": "S", "media:download": "S", "map:read": "S", "twin:read": "S", "report:read": "S" },
  drone_pilot: { "mission:start": "A", "mission:abort": "A", "finding:resolve": "A" },
  surveyor: { "finding:resolve": "A" },
};

const ALL = new Set<Permission>(PERMISSIONS);
const without = (...p: Permission[]) => new Set([...ALL].filter((x) => !p.includes(x)));
const set = (...p: Permission[]) => new Set<Permission>(p);

const READS_ALL: Permission[] = ["org:read", "project:read", "site:read", "asset:read", "progress:read", "map:read", "twin:read", "report:read"];
const OPS_READ: Permission[] = ["drone:read", "mission:read", "telemetry:read", "livevideo:view", "media:read", "media:download", "survey:read", "map:annotate", "ai:assistant", "comment:create"];

export const ROLE_PERMISSIONS: Record<RoleKey, Set<Permission>> = {
  org_owner: ALL,
  org_admin: without("org:delete"),
  project_manager: set(...READS_ALL, ...OPS_READ,
    "analytics:read", "project:create", "project:update", "project:archive", "project:member_manage",
    "site:create", "site:update", "site:delete", "asset:create", "asset:update", "asset:delete",
    "mission:create", "mission:update", "mission:approve", "mission:abort",
    "media:upload", "media:delete", "media:share",
    "survey:create", "survey:upload", "survey:process", "survey:publish", "map:layer_manage", "twin:model_upload",
    "inspection:read", "inspection:create", "inspection:update", "inspection:assign", "inspection:template_manage",
    "finding:create", "finding:update", "finding:resolve",
    "progress:update", "progress:approve", "milestone:manage",
    "report:generate", "report:share", "report:template_manage", "ai:analyze", "ai:review"),
  site_manager: set(...READS_ALL, ...OPS_READ,
    "analytics:read", "site:create", "site:update", "asset:create", "asset:update", "asset:delete",
    "mission:create", "mission:update", "mission:abort", "media:upload", "media:delete", "media:share",
    "survey:create", "survey:upload", "map:layer_manage",
    "inspection:read", "inspection:create", "inspection:update", "inspection:assign",
    "finding:create", "finding:update", "finding:resolve", "progress:update", "report:generate", "ai:analyze"),
  drone_pilot: set(...READS_ALL, ...OPS_READ,
    "drone:register", "drone:update", "mission:create", "mission:update", "mission:start", "mission:abort",
    "media:upload", "survey:upload", "inspection:read", "finding:resolve"),
  surveyor: set(...READS_ALL, ...OPS_READ,
    "asset:create", "asset:update", "mission:create", "media:upload",
    "survey:create", "survey:upload", "survey:process", "survey:publish", "map:layer_manage", "twin:model_upload",
    "finding:resolve", "progress:update", "report:generate", "ai:analyze"),
  inspector: set(...READS_ALL, ...OPS_READ,
    "asset:create", "asset:update", "mission:create", "media:upload", "survey:upload",
    "inspection:read", "inspection:create", "inspection:update", "finding:create", "finding:update", "finding:resolve",
    "report:generate", "ai:analyze", "ai:review"),
  engineer: set(...READS_ALL, ...OPS_READ,
    "analytics:read", "inspection:read", "inspection:approve", "finding:create", "finding:update", "finding:resolve",
    "report:generate", "ai:analyze", "ai:review"),
  viewer: set(...READS_ALL, "analytics:read", "media:read", "media:download"),
};

export const ORG_WIDE_ROLES = new Set<RoleKey>(["org_owner", "org_admin"]);

export function roleHas(role: RoleKey, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(perm);
}
