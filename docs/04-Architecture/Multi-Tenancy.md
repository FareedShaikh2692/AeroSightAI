# Multi-Tenant Architecture

| | |
|---|---|
| **Document** | Multi-Tenant Architecture & Tenant Isolation Strategy |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-06a |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Architecture |
| **Reviewer** | _Pending — Security Engineer, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Architecture | Initial draft |

---

## 1. Principle

> **Organization isolation is mandatory. No code path may read or write another organization's data.** Isolation is enforced in depth: a bug in one layer must be caught by another.

Each **Organization** owns its: users (memberships), roles, projects, sites, assets, drones, pilots, missions, telemetry, media, surveys, maps, models, inspections, findings, progress, reports, AI analyses, notifications, audit logs, integrations, API keys and usage.

## 2. Tenancy Model

| Option | Description | Decision |
|---|---|---|
| Shared DB, shared schema, `organization_id` column + RLS | All tenants in the same tables | **Default (all plans)** |
| Schema-per-tenant | Separate PG schema per org | Rejected: migration cost at hundreds of tenants |
| Database-per-tenant / dedicated cell | Separate DB (and optionally separate cluster) | **Enterprise option** ("Dedicated cell"), same code, own DB + buckets + KMS key |

`users` is a global identity table (a person can belong to several orgs, e.g. consultants). **Access is always through `organization_members`**. A user row by itself grants no access to tenant data.

## 3. Isolation Layers

### 3.1 Database level

1. **Every tenant table has `organization_id uuid NOT NULL`** with a FK to `organizations(id)` and an index (usually as the leading column of composite indexes).
2. **Row-Level Security** is enabled and **forced** on every tenant table:
   ```sql
   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
   ALTER TABLE projects FORCE ROW LEVEL SECURITY;

   CREATE POLICY tenant_isolation ON projects
     USING (organization_id = current_setting('app.current_org_id', true)::uuid)
     WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
   ```
3. The application connects as role `app_user` (**no** `BYPASSRLS`, not the table owner). Migrations run as `app_migrator`. Platform/admin queries that legitimately span tenants use a separate role `app_platform`, available only to the Admin API, and every one of its queries is audited.
4. The tenant context is set **per transaction** with `SET LOCAL` (safe with connection pooling in transaction mode, e.g. PgBouncer/RDS Proxy):
   ```sql
   BEGIN;
   SELECT set_config('app.current_org_id', $1, true);
   SELECT set_config('app.current_user_id', $2, true);
   -- queries
   COMMIT;
   ```
   If the variable is unset, `current_setting(..., true)` returns NULL and the policy matches **no rows** (fail closed).
5. **Composite foreign keys** include `organization_id` for child tables (e.g. `sites (organization_id, project_id) → projects (organization_id, id)`) so a row can never reference a parent in another org, even through a bug.
6. Unique constraints are scoped by org (e.g. `UNIQUE (organization_id, code)`).

### 3.2 API level

1. The org context comes **only** from the verified access token claim `org` (TENANT-003). Path/body IDs are never trusted to choose the tenant.
2. Switching org issues a new token (`POST /auth/switch-organization`) after verifying membership.
3. Cross-org lookups return **404** (TENANT-004).
4. Request validation rejects any `organizationId` field in client payloads (it is server-assigned).
5. Rate limits are keyed by org + user, so one tenant's burst does not degrade others.

### 3.3 Authorization level

1. `PolicyEngine.can(ctx, permission, resource)` checks: (a) `resource.organizationId === ctx.orgId`, (b) the permission is in the effective set, (c) resource scope (project membership, assignee, `shared_with_viewers`, etc.).
2. Repository methods for project-scoped resources always join or filter on the accessible project IDs (`ctx.projectIds`, computed once per request and cached).
3. Platform staff have **no** tenant permissions by default. Break-glass grants a time-boxed, audited, read-only context (ADMIN-009).

### 3.4 Storage level

1. Key layout: `org/{orgId}/{domain}/{entityId}/{variant}` e.g. `org/7f…/media/01J…/original.jpg`.
2. Buckets are private (Block Public Access on). Access only through **short-lived signed URLs** generated after an authorization check (TENANT-005). Downloads: TTL 5 min. Streaming (HLS/3D Tiles/tiles): CloudFront signed cookies scoped to a path prefix `org/{orgId}/…/{entityId}/*`, TTL ≤ 1 h.
3. **Per-org data keys** (envelope encryption): each org has a KMS data key alias. Objects use SSE-KMS with an encryption context `{orgId}`. Deleting an org schedules key deletion (crypto-shredding for backups, ORG-011).
4. The IAM policy for the worker role restricts to the bucket. Workers validate that the job's `organizationId` matches the key prefix before any read/write.

### 3.5 WebSocket / realtime level

1. Connection uses a single-use **ticket** (30 s TTL) obtained via an authenticated REST call. The ticket encodes `userId`, `orgId` and session ID.
2. Each `subscribe` message is authorized: the channel name encodes the org (`org:{orgId}:mission:{id}:telemetry`). The gateway checks `orgId === connection.orgId` **and** calls the policy check (`telemetry:read` on the mission's project) (TENANT-006).
3. Redis pub/sub channels are org-prefixed. The fan-out consumer publishes only to the channel derived from the telemetry record's validated org.
4. On membership/role change, `session.revoked` / `permissions.changed` events cause the gateway to re-evaluate or drop subscriptions (AUTH-014).

### 3.6 Background jobs, caches, search, AI

| Area | Rule |
|---|---|
| Jobs | Payload must include `organizationId`. `TenantJob` base sets the RLS context. Jobs without it fail validation (TENANT-007). Per-org concurrency caps. |
| Cache | Keys `t:{orgId}:…`. No global caches of tenant data (TENANT-008). |
| Search | Postgres full-text (RLS-protected) in Phase 1. If an external search engine is introduced, there is a mandatory `organization_id` filter injected by a single query builder plus isolation tests. |
| AI / embeddings | `pgvector` tables with RLS. Retrieval always runs inside the user's tenant context. Prompts never mix tenants. LLM provider requests are stateless with zero data retention where the provider supports it. |
| Logs | `orgId` included for diagnostics. Log access is restricted to platform SRE. No tenant content (payload bodies) is logged. |

## 4. Tenant Lifecycle

```text
pending_verification → active ⇄ suspended → pending_deletion (30 d) → deleted (purged)
                                └─ read_only (billing past_due grace expired)
```

| State | Login | Read | Write | Background jobs |
|---|---|---|---|---|
| active | ✓ | ✓ | ✓ | ✓ |
| read_only | ✓ | ✓ | ✗ (except billing) | Only maintenance |
| suspended | Suspension page | ✗ | ✗ | Paused |
| pending_deletion | Owner only (to cancel/export) | Export only | ✗ | Paused |
| deleted | ✗ | ✗ | ✗ | Purge job |

## 5. Verification

The tenant-isolation test suite ([Test Cases TC-TENANT-*](../11-QA/Test-Cases.md#tenant-isolation)) runs on every PR:

- **Two-org fixture:** Org A and Org B with identical structures. For every API endpoint (enumerated from the OpenAPI spec), call it as an Org A user with Org B IDs → expect 404/403 and no data in the body.
- **RLS unit tests:** connect as `app_user` with no context → zero rows from every tenant table. With Org A context → zero Org B rows. Inserting with the Org B ID under the Org A context → error.
- **Schema linter:** CI fails if a table in the `public` schema lacks `organization_id` + an RLS policy, unless it is allow-listed (`organizations`, `users`, `permissions`, `plans`, global system role rows).
- **Storage:** signed URL for an Org B key requested by Org A → 404. Workers refuse mismatched prefixes.
- **Realtime:** subscribe to an Org B channel → error `4403`.
- **Pen-test focus area:** IDOR across tenants.
