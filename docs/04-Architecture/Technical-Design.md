# Technical Design Document (TDD)

| | |
|---|---|
| **Document** | Technical Design Document |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-07 |
| **Version** | 0.2 |
| **Status** | Draft |
| **Author** | AeroSight AI Engineering |
| **Reviewer** | _Pending — Tech Lead, Frontend Lead, Backend Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Engineering | Initial draft with ADR-001…ADR-012 |
| 0.2 | 2026-10-06 | Engineering | ADR-013: Phase 1 demo build |

---

## 1. Scope

This document explains **how** the system in [System Architecture](System-Architecture.md) is built: repository layout, module structure, key abstractions, coding conventions and architecture decisions. It is binding for all engineers.

## 2. Architecture Decision Records

| ADR | Title | Status | Decision | Consequences |
|---|---|---|---|---|
| ADR-001 | Modular monolith for core domain | Accepted | One NestJS app with modules per bounded context. Modules expose a public `*.service.ts` facade and emit domain events. Cross-module DB joins are only allowed via read models/views. | Fast development and ACID. Must enforce boundaries with dependency-cruiser. Extraction later is possible per module. |
| ADR-002 | PostgreSQL RLS as second tenant-isolation layer | Accepted | Force RLS on all tenant tables. `SET LOCAL` per transaction. | Slight query overhead (< 5%). Requires transaction-mode pooling discipline. |
| ADR-003 | Telemetry storage | Proposed | TimescaleDB hypertable on self-managed PG (or Timescale Cloud) in the same cluster family. Fallback: native PG range partitioning by day + BRIN index if a managed service without Timescale is mandated. | Compression (≈ 10×), continuous aggregates for 1 s/1 m resolutions. |
| ADR-004 | Provider-agnostic drone adapter layer | Accepted | `DroneProviderAdapter` interface + capability flags. Simulator adapter first. | No vendor lock-in. Some advanced vendor features are lowest-common-denominator or need capability-gated UI. |
| ADR-005 | Logical mission execution by default | Accepted | `start/stop` are state transitions. Flight-control commands only via adapters declaring `missionControl` with pilot confirmation. | Safety and regulatory compliance. Less "magic" in MVP. |
| ADR-006 | BullMQ for jobs, Redis Streams for telemetry | Accepted | BullMQ for at-least-once jobs with retries. Streams for high-rate ordered telemetry. | One infrastructure dependency (Redis). Revisit Kafka at > 50k msg/s. |
| ADR-007 | Direct-to-S3 multipart uploads | Accepted | Presigned part URLs. API never proxies bytes. | Scalable. Requires CORS config and resumable client logic. |
| ADR-008 | MapLibre GL JS for 2D, CesiumJS for 3D | Accepted | Two engines, each lazy-loaded. Shared layer model in `packages/geo`. | Bundle size managed by code splitting. Consistent symbology via shared style tokens. |
| ADR-009 | JWT access + opaque rotating refresh | Accepted | 15-minute ES256 JWT. Refresh in httpOnly cookie, rotated, family revocation. | Short revocation lag (≤ 15 min) is mitigated by a Redis deny-list for deactivated users (checked at gateway). |
| ADR-010 | LLM provider abstraction | Accepted | `LlmClient` interface. Default implementation Anthropic Claude (`claude-sonnet-5-5` general, `claude-haiku-4-5-20251001` high-volume classification, `claude-opus-5-5` complex analysis). Model IDs in config. | Swap or multi-provider without code changes. Prompt versions tracked. |
| ADR-011 | Transactional outbox for events | Accepted | `domain_events` written in the business TX. Relay publishes to Redis Stream. | Exactly-once *publication intent*. Consumers must be idempotent. |
| ADR-012 | UUIDv7 primary keys | Accepted | Time-ordered UUIDs generated in app. | Index locality. No ID enumeration. |
| ADR-013 | Phase 1 demo build as a single Next.js app | Accepted (temporary) | To show the product early on Vercel, `src/` implements the core domain (PolicyEngine, tenant-scoped repository, mission validation, ProgressCalculator, simulator, audit hash chain) in one Next.js app with an in-memory seeded store, Server-Sent Events instead of WebSockets, and scrypt instead of argon2id. Module boundaries mirror §4 so each piece can move into the planned monorepo. | Data resets on restart. Not suitable for customer data. Replace the store with PostgreSQL (RLS) and add the worker/realtime services before pilot GA. |

## 3. Repository Layout (monorepo)

```text
aerosight/
├── apps/
│   ├── web/                    Next.js tenant app
│   ├── admin/                  Next.js platform admin app
│   ├── api/                    NestJS core API (modular monolith)
│   ├── realtime/               WebSocket gateway
│   ├── drone-integration/      Adapters, telemetry ingest, simulator
│   └── workers/                BullMQ processors (media, video, geo, report, notify, scan, cron)
├── services/
│   ├── ai/                     Python FastAPI AI service
│   └── tiles/                  TiTiler configuration
├── packages/
│   ├── contracts/              zod schemas + generated OpenAPI types shared FE/BE
│   ├── permissions/            permission catalog + role seeds (single source of truth)
│   ├── drone-sdk/              DroneProviderAdapter interface, canonical telemetry types
│   ├── geo/                    geometry utils, layer model, styles
│   ├── ui/                     design-system components (Radix + Tailwind)
│   ├── config/                 eslint, tsconfig, tailwind preset
│   └── testing/                fixtures (two-org fixture), factories
├── db/
│   ├── migrations/             SQL migrations (ordered, reversible where possible)
│   └── seeds/                  permissions, system roles, plans, demo data
├── infra/
│   ├── terraform/              cloud infrastructure
│   ├── helm/                   charts per app
│   └── docker/                 Dockerfiles, docker-compose.dev.yml
├── scripts/                    rtm generator, docs gate, tooling
└── docs/                       this documentation
```

Tooling: pnpm workspaces + Turborepo, uv for Python, Changesets for package versions.

## 4. Backend Module Design (Core API)

### 4.1 Module list and ownership

| Module | Owns tables | Public service | Emits events |
|---|---|---|---|
| `auth` | users, refresh_tokens, *_tokens, mfa_recovery_codes | `AuthService` | `user.registered`, `session.revoked` |
| `organizations` | organizations, organization_members, retention_policies, legal_holds | `OrgService` | `org.created`, `org.suspended` |
| `iam` | roles, permissions, role_permissions, user_roles, invitations, project_members, site_members | `PolicyEngine`, `MembershipService` | `member.joined`, `permissions.changed` |
| `projects` | projects | `ProjectService` | `project.*` |
| `sites` | sites, site_no_fly_zones, assets | `SiteService`, `AssetService` | `site.*`, `asset.*` |
| `fleet` | drones, drone_pilots, drone_maintenance_logs | `FleetService` | `drone.*` |
| `missions` | drone_missions, mission_waypoints, mission_events | `MissionService` | `mission.*` |
| `telemetry` (read side) | telemetry | `TelemetryQueryService` | — |
| `media` | media, media_metadata, media_tags, upload_sessions, live_stream_sessions | `MediaService` | `media.*` |
| `geo` | surveys, survey_areas, maps, map_layers, annotations, twin_models, viewpoints | `SurveyService`, `MapService`, `TwinService` | `survey.*` |
| `inspections` | inspection_templates, inspections, inspection_findings, inspection_attachments | `InspectionService` | `inspection.*`, `finding.*` |
| `progress` | milestones, progress_records | `ProgressService`, `ProgressCalculator` | `progress.*` |
| `ai` (orchestration) | ai_analyses, ai_suggestions, ai_conversations, ai_messages | `AiOrchestrator` | `ai.*` |
| `reports` | reports, report_templates, report_share_links, report_schedules | `ReportService` | `report.*` |
| `notifications` | notifications, notification_preferences, notification_rules, push_subscriptions | `NotificationService` | — |
| `audit` | audit_logs, domain_events | `AuditService`, `Outbox` | — |
| `collaboration` | comments | `CommentService` | `comment.mention` |
| `integrations` | integrations, webhooks, webhook_deliveries, api_keys | `IntegrationService` | `integration.*` |
| `billing` | plans, subscriptions, usage_records | `BillingService`, `QuotaService` | `billing.*` |

### 4.2 Layering inside a module

```text
controller (HTTP, DTO validation with zod, no business logic)
   ↓
application service (use cases; authorization via PolicyEngine; transactions)
   ↓
domain (entities, value objects, state machines, pure functions — e.g. ProgressCalculator)
   ↓
repository (Kysely/Drizzle queries; RLS context already set; returns domain objects)
```

### 4.3 Request pipeline (NestJS)

1. `RequestIdMiddleware`: honors or creates `X-Request-Id`.
2. `AuthGuard`: verifies JWT (JWKS), loads `AuthContext {userId, orgId, sessionId, mfa: bool, actorType}`, checks the deny-list.
3. `TenantContextInterceptor`: opens a transaction-scoped DB handle with `SET LOCAL` variables (AsyncLocalStorage).
4. `PermissionGuard`: route-level coarse check (`@RequirePermission('mission:create')`).
5. Controller → service → fine-grained `policy.assert(ctx, 'mission:start', mission)`.
6. `AuditInterceptor`: writes the audit row in the same TX for mutating routes (`@Audited('mission.started')`).
7. `ProblemDetailsFilter`: maps errors to RFC 9457 responses.

### 4.4 PolicyEngine (pseudo-code)

```ts
can(ctx: AuthContext, perm: Permission, res?: ScopedResource): boolean {
  if (ctx.actorType === 'platform_staff' && !ctx.breakGlass) return false;
  if (res && res.organizationId !== ctx.orgId) return false;               // tenant guard
  const orgPerms = this.cache.orgPermissions(ctx.userId, ctx.orgId);       // Redis, TTL 5 min
  if (isOrgWideRole(ctx)) return orgPerms.has(perm);                       // owner/admin
  if (!res?.projectId) return orgPerms.has(perm);                          // org-level perm
  const projPerms = this.cache.projectPermissions(ctx.userId, res.projectId);
  if (!projPerms) return false;                                            // not a member
  const effective = union(orgPerms.filter(isOrgScoped), projPerms);
  if (!effective.has(perm)) return false;
  return this.resourceRules(perm, ctx, res);                               // e.g. assignee-only start,
}                                                                          // viewer-only-shared, no self-approval
```

Resource rules (examples):
- `mission:start`: `ctx.userId === mission.pilotUserId` OR org-wide role.
- `inspection:approve`: `ctx.userId !== inspection.assigneeId`.
- `media:read` for Viewer: `media.sharedWithViewers === true`.
- `report:read` for Viewer: `report.status === 'published'`.

### 4.5 State machines

Mission, inspection, finding, report and survey lifecycles are implemented as explicit transition tables (`domain/*.state.ts`), e.g.:

```ts
export const missionTransitions = {
  draft:            { plan: 'planned', cancel: 'cancelled' },
  planned:          { submit: 'pending_approval', markReady: 'ready', cancel: 'cancelled' },
  pending_approval: { approve: 'approved', reject: 'rejected' },
  approved:         { markReady: 'ready', cancel: 'cancelled' },
  rejected:         { revise: 'draft' },
  ready:            { start: 'in_progress', cancel: 'cancelled' },
  in_progress:      { pause: 'paused', stop: 'completed', abort: 'aborted', fail: 'failed' },
  paused:           { resume: 'in_progress', abort: 'aborted' },
} as const;
```

Each transition has guards (e.g. `start` requires a complete checklist, valid pilot license, and drone `available`) and effects (events, drone status update). Invalid transitions throw `InvalidStateTransition` → HTTP 409.

### 4.6 Error model

Domain errors extend `AppError {code, httpStatus, detail, meta}`. Codes are UPPER_SNAKE and documented in [API §4](../06-API/API-Specification.md#4-error-model). Unexpected errors → 500 with request ID only (no stack to client).

### 4.7 Background jobs

```ts
abstract class TenantJob<P extends { organizationId: string }> {
  abstract name: string;
  async handle(job: Job<P>) {
    assertUuid(job.data.organizationId);                 // TENANT-007
    return db.withTenant(job.data.organizationId, () => this.run(job.data));
  }
}
```

- Queues: `media.scan`, `media.process`, `video.transcode`, `geo.cog`, `geo.3dtiles`, `report.generate`, `notify.fanout`, `notify.email`, `notify.push`, `notify.chat`, `webhook.deliver`, `ai.dispatch`, `export.org`, `retention.enforce`, `usage.aggregate`, `cron.*`.
- Defaults: 5 attempts, exponential backoff (base 10 s, jitter), removeOnComplete after 24 h, DLQ (`*.dead`) with alert.
- Idempotency: jobs keyed by `jobId = <type>:<entityId>:<version>`.
- Per-org fairness: BullMQ group rate limits (`group.id = organizationId`, max concurrency per org per queue).

### 4.8 Caching

| Data | Store | TTL | Invalidation |
|---|---|---|---|
| Permission sets | Redis `t:{org}:perm:{user}` | 5 min | `permissions.changed` event |
| Project membership IDs | Redis `t:{org}:projs:{user}` | 5 min | membership events |
| JWKS | in-memory | 10 min | key rotation |
| Plan limits | in-memory | 5 min | subscription events |
| Tiles | CDN | 1 day (immutable per layer version) | new layer version = new URL |
| HTTP GET responses | none by default; ETag/If-None-Match on detail endpoints | — | — |

### 4.9 Feature flags

OpenFeature SDK with a DB-backed provider (`feature_flags` platform table). Evaluated with context `{orgId, plan, userId, env}`. Flags guard Prototype/Beta features (e.g. `ai.progress_analysis`, `twin.viewer`).

## 5. Frontend Design

### 5.1 Stack
Next.js App Router (mostly client-rendered app behind auth; marketing pages statically generated), React 19, TypeScript strict, TanStack Query (server state), Zustand (UI/map state), react-hook-form + zod (forms, schemas shared from `packages/contracts`), Radix UI primitives + Tailwind (design tokens), MapLibre GL JS, CesiumJS (dynamic import), deck.gl (dense layers, e.g. telemetry trails), Recharts/visx (charts), pdf.js (report viewer), hls.js, WebRTC (WHEP client).

### 5.2 Route structure
```text
/(marketing)/            landing, features, industries, pricing, about, contact
/(auth)/login, /signup, /verify, /forgot, /reset, /mfa
/app/[orgSlug]/
   dashboard, projects, projects/[id]/(overview|sites|team|milestones|missions|media|inspections|progress|reports|activity|settings)
   sites/[id], sites/[id]/twin, live, fleet, fleet/[id], missions, missions/new, missions/[id],
   surveys, surveys/[id], maps, media, inspections, inspections/[id], progress, reports, reports/[id],
   analytics, team, roles, notifications, integrations, billing, settings/(general|branding|security|data|notifications|profile)
/share/reports/[token]   public report link
```

### 5.3 Data and permissions in UI
- `useCan('mission:start', mission)` hook backed by `/me/permissions`. Used only for UX (hide/disable). The server is authoritative.
- Query keys include `orgId` so switching organization drops all cached data (`queryClient.clear()` on switch).
- Optimistic updates only for low-risk actions (mark read, tags).

### 5.4 Realtime client
A single `RealtimeClient` singleton manages the WS connection, tickets, heartbeats, reconnection with backoff, subscriptions (ref-counted), and `resume` with the last sequence per channel. It exposes `useChannel(channel, handler)`.

### 5.5 Performance practices
Route-level code splitting. Map and 3D engines are dynamically imported. Virtualized tables (TanStack Virtual). Image `srcset` from preview/thumbnail derivatives. Web Workers for heavy client geometry (turf.js) and EXIF pre-reading during upload.

## 6. Coding Conventions

| Area | Convention |
|---|---|
| Naming | DB `snake_case`. API JSON `camelCase`. TypeScript `camelCase`/`PascalCase`. Permission keys `resource:action`. Events `entity.past_tense`. |
| Validation | zod at every trust boundary (HTTP, jobs, WS messages, adapter inputs). Parse, don't validate. |
| Time | `Temporal`/`date-fns-tz`. Store UTC. Never use server-local time. |
| Money | Integer minor units + currency. |
| Geometry | GeoJSON in API (RFC 7946, lon/lat order). PostGIS `geography` in DB. |
| Logging | `pino` JSON. Never log tokens, passwords, presigned URLs, or EXIF GPS of private media. |
| Tests | Co-located `*.spec.ts`. Integration tests with Testcontainers (Postgres+PostGIS, Redis, MinIO). |
| Commits | Conventional Commits. PR template with the "Docs updated" checkbox. |

## 7. Configuration

All configuration is via environment variables validated at boot by a zod schema (`packages/config/env.ts`). Apps fail fast on invalid config. See [Environment Configuration](../12-DevOps/Environment-Configuration.md).

## 8. Open Technical Questions

| # | Question | Owner | Due |
|---|---|---|---|
| Q-01 | Managed Postgres choice given the TimescaleDB requirement (ADR-003) | Tech Lead | Before sprint 2 |
| Q-02 | First real drone provider for Phase 2 (DJI Cloud API vs. MAVLink bridge) | Product + Tech Lead | End of Phase 1 |
| Q-03 | Defect-detection model: fine-tune an open model vs. a vendor API | AI Lead | Phase 2 start |
| Q-04 | IFC → 3D Tiles conversion tooling (open-source vs. Cesium ion) | GIS Lead | Phase 3 start |
