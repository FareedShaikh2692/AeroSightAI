# API Specification

| | |
|---|---|
| **Document** | API Specification (REST + Realtime) |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-09 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Engineering |
| **Reviewer** | _Pending — Tech Lead, Frontend Lead, Security Engineer_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Engineering | Initial contract |

---

## 1. Overview

| Item | Value |
|---|---|
| Base URL | `https://api.aerosight.ai/api/v1` (regional: `https://api.{region}.aerosight.ai/api/v1`) |
| Versioning | URI major version (`/v1`). Additive changes are non-breaking. Breaking changes → `/v2` with ≥ 6 months overlap. `Deprecation` and `Sunset` headers on deprecated endpoints. |
| Format | JSON (UTF-8), `camelCase` fields, RFC 3339 timestamps (UTC), GeoJSON (RFC 7946) for geometry |
| Machine-readable spec | OpenAPI 3.1 generated from code at `/api/v1/openapi.json` (authenticated in prod). This document is the design contract. CI diff-checks the generated spec against it. |
| Path note | The short examples elsewhere (e.g. `POST /api/auth/login`) map to `POST /api/v1/auth/login`. |

## 2. Authentication

| Scheme | Used by | Header |
|---|---|---|
| **Bearer access token** (JWT ES256, 15 min) | Web app, mobile web | `Authorization: Bearer <jwt>` |
| **Refresh token** (opaque, httpOnly cookie `asai_rt`, path `/api/v1/auth`) | Web app | Cookie |
| **API key** | Server-to-server integrations | `Authorization: ApiKey asai_live_<prefix>_<secret>` |
| **Webhook / ingest signature** | Provider push, payment provider | `X-AeroSight-Signature` / provider-specific |
| **Share token** | Public report links | Path token + optional passcode |

Access token claims:

```json
{
  "iss": "https://api.aerosight.ai", "aud": "aerosight-api",
  "sub": "0192a0f2-…(userId)", "org": "0192a0f3-…(organizationId)",
  "sid": "0192a0f4-…(sessionId)", "amr": ["pwd","otp"],
  "iat": 1791270000, "exp": 1791270900, "ver": 7
}
```

`ver` = the user's permission version. The gateway rejects tokens whose `ver` is lower than the current value in Redis after a forced revocation.

## 3. Conventions

### 3.1 Resource style
Flat collections with filter parameters (`GET /sites?projectId=…`). Nested routes only for strong ownership (`/missions/:id/waypoints`). State transitions are `POST /resource/:id/<verb>`.

### 3.2 Pagination (cursor)
```
GET /media?projectId=…&limit=50&cursor=eyJjIjoiMjAyNi0xMC0wNlQwNzoxMjozMVoiLCJpIjoiMDE5MiJ9
```
```json
{ "data": [ … ], "page": { "nextCursor": "…", "hasMore": true, "limit": 50 } }
```
`limit` default 25, max 100 (max 500 for map feature endpoints). Total counts only when `includeTotal=true` (may be approximate for > 10,000).

### 3.3 Filtering and sorting
`?status=active,on_hold&createdFrom=2026-01-01&q=tower&sort=-createdAt`. Spatial filters: `bbox=minLon,minLat,maxLon,maxLat`, `within=<siteId>`, `near=lon,lat,radiusM`.

### 3.4 Partial responses / expansion
`?fields=id,name,status` and `?expand=site,drone` (whitelisted per endpoint).

### 3.5 Concurrency
Detail responses include `ETag: W/"<version>"`. `PATCH` accepts `If-Match`. A mismatch returns `412 PRECONDITION_FAILED`. `If-Match` is required for `PATCH` on missions, inspections, milestones and reports.

### 3.6 Idempotency
`POST` endpoints that create resources or trigger side effects accept `Idempotency-Key: <uuid>` (required for `/media/uploads`, `/reports/generate`, `/ai/analyze`, `/missions/:id/start|stop|abort`, billing). The response is replayed for 24 h. Reusing a key with a different body → `422 IDEMPOTENCY_KEY_REUSED`.

### 3.7 Standard headers
Request: `X-Request-Id` (optional, echoed), `Accept-Language`. Response: `X-Request-Id`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (IETF draft), `Retry-After` on 429/503.

### 3.8 Rate-limit tiers

| Tier | Applies to | Limit | Key |
|---|---|---|---|
| **R1 — Auth-sensitive** | login, register, forgot/reset, MFA verify, invitation accept | 10/min and 50/h | IP **and** email/account |
| **R2 — Standard read** | GET endpoints | 600/min | user |
| **R3 — Standard write** | POST/PATCH/PUT/DELETE | 120/min | user |
| **R4 — Heavy** | upload init, report generate, AI analyze, exports, bulk ops | 20/min per user; org concurrency caps (e.g. 5 concurrent AI jobs) | user + org |
| **R5 — Public** | share links, public status | 30/min | IP |
| **R6 — Ingest** | provider ingest endpoints | 50 msg/s per connection (burst 200) | connection |
| **API keys** | all | 1,200/min per key (Enterprise configurable) | key |

Org-level cap: 3,000 req/min aggregate (protects other tenants).

## 4. Error Model

RFC 9457 Problem Details (`application/problem+json`):

```json
{
  "type": "https://docs.aerosight.ai/errors/MISSION_GEOFENCE_VIOLATION",
  "title": "Mission plan violates the site geofence",
  "status": 422,
  "code": "MISSION_GEOFENCE_VIOLATION",
  "detail": "3 waypoints are outside the site boundary plus 50 m buffer.",
  "requestId": "01J9Z4…",
  "errors": [ { "path": "waypoints[12]", "code": "OUTSIDE_GEOFENCE" } ],
  "meta": { "offendingWaypoints": [12, 13, 14] }
}
```

### 4.1 Common error codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON or parameters |
| 401 | `UNAUTHENTICATED` | Missing, invalid or expired token |
| 401 | `MFA_REQUIRED` | 2FA step required |
| 403 | `FORBIDDEN` | Authenticated but lacks permission (only when the resource's existence may be revealed) |
| 403 | `ORG_SUSPENDED` / `ORG_READ_ONLY` | Tenant state blocks the action |
| 403 | `MFA_ENROLLMENT_REQUIRED` | Org enforces 2FA |
| 403 | `REAUTH_REQUIRED` | Sensitive action needs recent re-authentication |
| 404 | `NOT_FOUND` | Not found **or** in another tenant **or** not visible to the user |
| 409 | `CONFLICT` | Unique constraint (e.g. duplicate code) |
| 409 | `INVALID_STATE_TRANSITION` | State machine violation |
| 412 | `PRECONDITION_FAILED` | ETag mismatch |
| 413 | `PAYLOAD_TOO_LARGE` | Body/file over limit |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | |
| 422 | `VALIDATION_ERROR` | Field-level errors in `errors[]` |
| 422 | `PLAN_LIMIT_EXCEEDED` | Seats/projects/storage/AI credits |
| 429 | `RATE_LIMITED` | See `Retry-After` |
| 500 | `INTERNAL_ERROR` | Unexpected. Only the request ID is exposed. |
| 502/503 | `UPSTREAM_UNAVAILABLE` / `SERVICE_UNAVAILABLE` | Provider/AI/etc. down |

Module-specific codes are listed per endpoint group.

## 5. Common Schemas

```ts
type UUID = string;               // UUIDv7
type Timestamp = string;          // RFC 3339 UTC
type GeoPoint = { type: 'Point'; coordinates: [lon: number, lat: number, alt?: number] };
type GeoPolygon = { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };

interface AuditFields { createdAt: Timestamp; updatedAt: Timestamp; createdBy?: UserRef; version: number }
interface UserRef { id: UUID; fullName: string; avatarUrl?: string }
interface Page<T> { data: T[]; page: { nextCursor: string | null; hasMore: boolean; limit: number; total?: number } }
```

---

## 6. Endpoints

Legend: **Auth** — `Public`, `Bearer`, `Bearer+MFA` (session must have a satisfied 2FA where enforced), `Reauth` (re-auth within 5 min). **RL** — rate-limit tier.

### 6.1 Authentication

#### `POST /auth/register`
| Auth | Permission | RL |
|---|---|---|
| Public | — | R1 |

Request:
```json
{ "fullName": "Priya Shah", "email": "priya@buildco.com", "password": "•••••••••••••",
  "organizationName": "BuildCo", "country": "AE", "acceptTerms": true }
```
Validation: fullName 1–120; email valid and ≤ 254; password per AUTH-004; organizationName 2–120; `acceptTerms === true`.
Response `201`:
```json
{ "userId": "0192…", "organizationId": "0192…", "verificationRequired": true }
```
Errors: `VALIDATION_ERROR`, `PASSWORD_TOO_WEAK`, `PASSWORD_BREACHED`. (An existing email returns the **same 201** and sends a "you already have an account" email — no enumeration.)

#### `POST /auth/verify-email`
Public, R1. `{ "email": "…", "code": "482913" }` or `{ "token": "…" }` → `200 { "verified": true }`. Errors: `CODE_INVALID`, `CODE_EXPIRED`.

#### `POST /auth/login`
| Auth | Permission | RL |
|---|---|---|
| Public | — | R1 |

Request: `{ "email": "priya@buildco.com", "password": "…" }`
Response `200` (no MFA):
```json
{ "accessToken": "eyJ…", "expiresIn": 900,
  "user": { "id": "…", "fullName": "Priya Shah", "email": "…", "mfaEnabled": false },
  "organizations": [ { "id": "…", "name": "BuildCo", "slug": "buildco", "role": "org_owner" } ],
  "activeOrganizationId": "…" }
```
Sets cookie `asai_rt` (HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age per policy).
Response `200` (MFA required): `{ "mfaRequired": true, "mfaToken": "…", "methods": ["totp","recovery_code"] }`
Errors: `INVALID_CREDENTIALS` (401), `ACCOUNT_LOCKED` (423 with `Retry-After`), `EMAIL_NOT_VERIFIED` (403), `ORG_SUSPENDED` (403).

#### `POST /auth/mfa/verify`
Public (with `mfaToken`), R1. `{ "mfaToken": "…", "code": "123456" }` or `{ "mfaToken": "…", "recoveryCode": "abcd-efgh" }` → same as login success. Errors: `MFA_CODE_INVALID`, `MFA_TOKEN_EXPIRED`.

#### `POST /auth/refresh`
Cookie, R2. No body. → `200 { "accessToken", "expiresIn" }` and a rotated cookie. Errors: `REFRESH_INVALID` (401). On reuse: `REFRESH_REUSED` (401, whole family revoked).

#### `POST /auth/logout`
Bearer + cookie, R3. `{ "allSessions": false }` → `204`. Revokes the refresh token (or all).

#### Other auth endpoints

| Method & Path | Auth | RL | Request → Response | Errors |
|---|---|---|---|---|
| `POST /auth/password/forgot` | Public | R1 | `{email}` → `202` always | — |
| `POST /auth/password/reset` | Public | R1 | `{token, newPassword}` → `204` | `TOKEN_INVALID`, `PASSWORD_TOO_WEAK` |
| `POST /auth/password/change` | Bearer + Reauth | R3 | `{currentPassword, newPassword}` → `204` | `INVALID_CREDENTIALS` |
| `POST /auth/mfa/setup` | Bearer | R3 | → `{secret, otpauthUrl, qrPng}` | `MFA_ALREADY_ENABLED` |
| `POST /auth/mfa/enable` | Bearer | R3 | `{code}` → `{recoveryCodes: string[10]}` | `MFA_CODE_INVALID` |
| `POST /auth/mfa/disable` | Bearer + Reauth | R3 | `{code}` → `204` | `MFA_ENFORCED_BY_ORG` |
| `POST /auth/mfa/recovery-codes` | Bearer + Reauth | R3 | → `{recoveryCodes}` (regenerate) | — |
| `POST /auth/reauth` | Bearer | R1 | `{password, code?}` → `{reauthUntil}` | `INVALID_CREDENTIALS` |
| `POST /auth/switch-organization` | Bearer | R3 | `{organizationId}` → `{accessToken, expiresIn}` | `NOT_FOUND` (not a member) |
| `GET /auth/sessions` | Bearer | R2 | → `{data:[{id, device, ipCity, lastUsedAt, current}]}` | — |
| `DELETE /auth/sessions/:id` | Bearer | R3 | → `204` | `NOT_FOUND` |
| `GET /auth/sso/:orgSlug/start` | Public | R1 | → 302 to IdP (Phase 3) | `SSO_NOT_CONFIGURED` |
| `POST /auth/sso/callback` | Public | R1 | OIDC/SAML assertion → session (Phase 3) | `SSO_ASSERTION_INVALID` |

### 6.2 Current user

| Method & Path | Permission | RL | Description |
|---|---|---|---|
| `GET /me` | — | R2 | Profile, active org, role, MFA status, preferences |
| `PATCH /me` | — | R3 | `fullName, phone, locale, timezone, units, avatar` |
| `GET /me/permissions` | — | R2 | `{ org: string[], projects: { [projectId]: string[] }, orgWide: boolean }` |
| `GET/PUT /me/notification-preferences` | — | R2/R3 | See [Notifications](../02-PRD/Features/Notifications.md) |
| `POST /me/export` | Reauth | R4 | DSAR personal data export → `202 {jobId}` |

### 6.3 Organizations

| Method & Path | Permission | RL | Request / Response | Errors |
|---|---|---|---|---|
| `GET /organizations` | — | R2 | Orgs the user belongs to | — |
| `POST /organizations` | verified user | R3 | `{name, slug?, country, timezone, industry}` → `201 Organization` | `CONFLICT` (slug), `PLAN_LIMIT_EXCEEDED` |
| `GET /organizations/current` | `org:read` | R2 | → `Organization` (with settings) | — |
| `PATCH /organizations/current` | `org:update` | R3 | partial `{name, industry, timezone, units, defaultCrs, brandColor, settings}` | `VALIDATION_ERROR` |
| `POST /organizations/current/logo` | `org:update` | R3 | multipart ≤ 2 MB → `{logoUrl}` | `UNSUPPORTED_MEDIA_TYPE` |
| `GET /organizations/current/usage` | `org:read` | R2 | seats, storage, credits vs limits | — |
| `POST /organizations/current/export` | `org:delete` (Owner) + Reauth | R4 | → `202 {jobId}` | — |
| `POST /organizations/current/transfer-ownership` | Owner + Reauth | R3 | `{newOwnerUserId}` → `204` | `TARGET_NOT_ADMIN` |
| `DELETE /organizations/current` | Owner + Reauth | R3 | `{confirmSlug}` → `202 {deletionScheduledAt}` | `ACTIVE_SUBSCRIPTION`, `CONFIRMATION_MISMATCH` |
| `POST /organizations/current/cancel-deletion` | Owner | R3 | → `204` | — |
| `GET/PUT /organizations/current/retention-policies` | `retention:manage` | R2/R3 | `[{dataClass, retentionDays, action, projectId?}]` | `RETENTION_OUT_OF_BOUNDS` |
| `GET/POST /legal-holds`, `POST /legal-holds/:id/release` | `retention:manage` | R2/R3 | | — |

`Organization` schema:
```json
{ "id": "…", "name": "BuildCo", "slug": "buildco", "status": "active", "country": "AE",
  "timezone": "Asia/Dubai", "region": "me-central-1", "units": "metric", "defaultCrs": "EPSG:4326",
  "brandColor": "#0EA5E9", "logoUrl": "https://cdn…signed",
  "settings": { "mfaRequired": true, "sessionMaxDays": 14, "allowedInviteDomains": ["buildco.com"],
                "externalSharing": true, "ai": { "enabled": true, "feedbackOptIn": false } },
  "plan": { "key": "professional", "status": "active" }, "createdAt": "…", "version": 3 }
```

### 6.4 Members & invitations

| Method & Path | Permission | RL | Request / Response | Errors |
|---|---|---|---|---|
| `GET /members` | `user:manage` or `org:read` (limited fields) | R2 | `?q&roleId&status&projectId` → `Page<Member>` | — |
| `PATCH /members/:userId` | `user:manage` | R3 | `{roleId?, status?: 'active'|'deactivated'}` | `LAST_OWNER`, `PRIVILEGE_ESCALATION` |
| `DELETE /members/:userId` | `user:manage` | R3 | → `204` | `LAST_OWNER` |
| `POST /invitations` | `user:invite` | R3 | `{invites:[{email, roleId, projects?:[{projectId, roleId}]}]}` (≤ 50) → `201 {created, skipped}` | `SEAT_LIMIT_REACHED`, `DOMAIN_NOT_ALLOWED`, `PRIVILEGE_ESCALATION` |
| `GET /invitations` | `user:invite` | R2 | pending invitations | — |
| `POST /invitations/:id/resend` | `user:invite` | R3 | → `204` | — |
| `DELETE /invitations/:id` | `user:invite` | R3 | → `204` | — |
| `GET /invitations/lookup/:token` | Public | R1 | → `{orgName, inviterName, email, expiresAt}` | `INVITATION_INVALID` |
| `POST /invitations/:token/accept` | Public or Bearer | R1 | new user: `{fullName, password}`; existing: Bearer → `{organizationId}` | `INVITATION_EXPIRED`, `EMAIL_MISMATCH` |

### 6.5 Roles & permissions

| Method & Path | Permission | RL | Notes |
|---|---|---|---|
| `GET /permissions` | `role:manage` or `org:read` | R2 | Catalog grouped by module |
| `GET /roles` | `org:read` | R2 | System + custom roles, member counts |
| `POST /roles` | `role:manage` | R3 | `{key, name, description, scope, permissions: string[]}` → `201`. Errors `PRIVILEGE_ESCALATION`, `PLAN_LIMIT_EXCEEDED` |
| `PATCH /roles/:id` | `role:manage` | R3 | System roles → `403 SYSTEM_ROLE_IMMUTABLE` |
| `DELETE /roles/:id` | `role:manage` | R3 | `409 ROLE_IN_USE` |

### 6.6 Projects

#### `GET /projects`
Bearer, `project:read` (membership-scoped), R2. Query: `status, type, managerId, q, startFrom, startTo, sort (name|-createdAt|startDate), limit, cursor`.
Response `200 Page<ProjectSummary>`:
```json
{ "data": [ { "id": "…", "code": "PRJ-DXB-01", "name": "Marina Tower B", "type": "building",
  "status": "active", "clientName": "Emaar", "startDate": "2026-01-15", "endDate": "2027-09-30",
  "location": { "type": "Point", "coordinates": [55.1403, 25.0805] },
  "progress": { "actualPct": 41.2, "plannedPct": 44.0, "scheduleVariancePct": -2.8, "status": "at_risk" },
  "sitesCount": 2, "openFindings": { "critical": 0, "high": 3 }, "coverImageUrl": "…" } ],
  "page": { "nextCursor": null, "hasMore": false, "limit": 25 } }
```

#### `POST /projects`
Bearer, `project:create`, R3, `Idempotency-Key` optional.
```json
{ "code": "PRJ-DXB-01", "name": "Marina Tower B", "type": "building", "clientName": "Emaar",
  "startDate": "2026-01-15", "endDate": "2027-09-30", "description": "52-storey residential tower",
  "location": { "type": "Point", "coordinates": [55.1403, 25.0805] }, "timezone": "Asia/Dubai",
  "members": [ { "userId": "…", "roleId": "…" } ] }
```
Validation: PROJECT-001/002. Response `201 Project` + `Location` header. Errors: `CONFLICT` (code), `VALIDATION_ERROR`, `PLAN_LIMIT_EXCEEDED`.

#### Other project endpoints

| Method & Path | Permission | RL | Notes / Errors |
|---|---|---|---|
| `GET /projects/:id` | `project:read` | R2 | `?expand=sites,members` |
| `PATCH /projects/:id` | `project:update` | R3 | `If-Match` supported. `PROJECT_ARCHIVED` (409) |
| `POST /projects/:id/archive` / `/restore` | `project:archive` | R3 | `PLAN_LIMIT_EXCEEDED` on restore |
| `DELETE /projects/:id` | `project:archive` | R3 | `PROJECT_HAS_DATA` (409) |
| `GET /projects/:id/summary` | `project:read` | R2 | KPI block (PROJECT-008) |
| `GET /projects/:id/activity` | `project:read` | R2 | Activity feed, cursor |
| `GET /projects/:id/members` | `project:read` | R2 | |
| `POST /projects/:id/members` | `project:member_manage` | R3 | `{userId, roleId}`. `NOT_ORG_MEMBER`, `PRIVILEGE_ESCALATION` |
| `PATCH/DELETE /projects/:id/members/:userId` | `project:member_manage` | R3 | |

### 6.7 Sites

#### `POST /sites`
Bearer, `site:create` on the project, R3.
```json
{ "projectId": "…", "code": "S1", "name": "Plot 14 — Tower B", "address": "Dubai Marina, Dubai",
  "timezone": "Asia/Dubai",
  "boundary": { "type": "Polygon", "coordinates": [[[55.1395,25.0801],[55.1411,25.0801],[55.1411,25.0811],[55.1395,25.0811],[55.1395,25.0801]]] },
  "elevationM": 4.5, "geofenceBufferM": 50, "maxAltitudeM": 120, "airspaceNotes": "Near DXB control zone" }
```
Validation: SITE-001/002 (valid polygon, ≥ 4 positions with closed ring, area > 100 m², WGS 84 ranges, ≤ 10,000 vertices).
Response `201`:
```json
{ "id": "…", "projectId": "…", "code": "S1", "name": "Plot 14 — Tower B",
  "boundary": { … }, "centroid": { "type": "Point", "coordinates": [55.1403, 25.0806] },
  "areaM2": 17923.44, "status": "active", "createdAt": "…", "version": 1 }
```
Errors: `GEOMETRY_INVALID` (422, `meta.reason` e.g. "Self-intersection at [55.14, 25.08]"), `CONFLICT`, `PROJECT_ARCHIVED`, `NOT_FOUND` (project).

| Method & Path | Permission | RL | Notes |
|---|---|---|---|
| `GET /sites` | `site:read` | R2 | `?projectId&bbox&q&status` |
| `GET /sites/:id` | `site:read` | R2 | |
| `PATCH /sites/:id` | `site:update` | R3 | geometry re-validated |
| `DELETE /sites/:id` | `site:delete` | R3 | `MISSION_IN_PROGRESS` (409) |
| `POST /sites/import-boundary` | `site:create` | R4 | multipart (GeoJSON/KML/KMZ/SHP zip ≤ 10 MB) → `{boundary, warnings}` (preview, not saved) |
| `GET /sites/:id/features` | `site:read` | R2 | GeoJSON FeatureCollection (boundary, no-fly zones, assets, survey areas, open findings, last flight paths). `?layers=` |
| `GET /sites/:id/timeline` | `site:read` | R2 | `?from&to` grouped by day |
| `GET/POST /sites/:id/no-fly-zones`, `PATCH/DELETE /no-fly-zones/:id` | `site:update` | R2/R3 | |
| `GET /sites/:id/export?format=geojson|kml` | `site:read` | R2 | |

### 6.8 Assets

| Method & Path | Permission | RL | Request / Notes | Errors |
|---|---|---|---|---|
| `GET /assets` | `asset:read` | R2 | `?siteId&type&parentId&bbox&hasOpenFindings&q` | — |
| `POST /assets` | `asset:create` | R3 | `{siteId, type, name, tag, parentAssetId?, location: PointZ, geometry?, attributes?, conditionRating?}` | `CONFLICT` (tag), `ASSET_PARENT_INVALID`, `ASSET_CYCLE` |
| `GET /assets/:id` | `asset:read` | R2 | `?expand=children,openFindings` | |
| `PATCH /assets/:id` | `asset:update` | R3 | | |
| `DELETE /assets/:id` | `asset:delete` | R3 | | `ASSET_HAS_CHILDREN` |
| `POST /assets/import` | `asset:create` | R4 | multipart CSV/GeoJSON, `?dryRun=true` → `{valid, errors:[{row, field, code}]}` | |
| `GET /assets/:id/history` | `asset:read` | R2 | audit-derived | |

### 6.9 Drones & pilots

#### `POST /drones`
Bearer, `drone:register`, R3.
```json
{ "providerKey": "manual", "name": "Mavic-03", "manufacturer": "DJI", "model": "Mavic 3 Enterprise",
  "serialNumber": "1581F5FHD23…", "registrationNumber": "UAE-UAS-00123", "registrationExpiresAt": "2027-03-31",
  "remoteId": "1581F5FHD23…", "payloads": [ { "type": "camera", "model": "M3E Wide", "sensorWidthMm": 17.3, "focalMm": 12.29, "resolution": [5280, 3956] } ],
  "maxFlightTimeMin": 42, "maxSpeedMps": 15, "homeSiteId": "…" }
```
Response `201 Drone` (includes `capabilities: string[]`, `isSimulated`). Errors: `CONFLICT` (serial), `INTEGRATION_REQUIRED` (providerKey needs a connected integration).

| Method & Path | Permission | RL | Notes / Errors |
|---|---|---|---|
| `GET /drones` | `drone:read` | R2 | `?status&providerKey&siteId&q`. Includes live `battery`/`lastSeenAt` if available |
| `GET /drones/:id` | `drone:read` | R2 | |
| `PATCH /drones/:id` | `drone:update` | R3 | `{status: 'maintenance'|'available'}` etc. `DRONE_IN_MISSION` |
| `POST /drones/:id/retire` | `drone:retire` | R3 | `DRONE_IN_MISSION` |
| `GET/POST /drones/:id/maintenance` | `drone:read` / `drone:update` | R2/R3 | |
| `GET /drones/:id/flight-log` | `drone:read` | R2 | |
| `POST /integrations/:id/sync-drones` | `integration:manage` | R4 | → `{discovered:[…], alreadyLinked:[…]}`; then `POST /drones/import {integrationId, providerDroneIds}` |
| `GET /pilots` | `drone:read` | R2 | `?licenseExpiringWithinDays=30` |
| `POST /pilots` / `PATCH /pilots/:id` | `pilot:manage` (or self for own profile, except status) | R3 | `{userId, licenseNumber, licenseType, issuingAuthority, licenseExpiresAt, insuranceExpiresAt, certifications}` |

### 6.10 Missions

#### `POST /missions`
Bearer, `mission:create` on the project, R3.
```json
{ "projectId": "…", "siteId": "…", "name": "Weekly progress capture — Tower B", "type": "progress",
  "template": "grid",
  "area": { "type": "Polygon", "coordinates": [[[55.1396,25.0802],[55.1410,25.0802],[55.1410,25.0810],[55.1396,25.0810],[55.1396,25.0802]]] },
  "parameters": { "altitudeM": 80, "altitudeRef": "AGL", "speedMps": 8, "frontOverlap": 0.8, "sideOverlap": 0.7, "gimbalPitch": -90, "captureMode": "photo_interval", "sensor": { "payloadIndex": 0 } },
  "scheduledStart": "2026-10-08T05:00:00Z", "scheduledEnd": "2026-10-08T06:00:00Z",
  "droneId": "…", "pilotId": "…", "recurrenceRule": "FREQ=WEEKLY;BYDAY=TH" }
```
Response `201 Mission` with `status: "planned"` (or `draft` if incomplete), generated `waypoints` summary and `estimates`:
```json
{ "id": "…", "code": "MSN-000123", "status": "planned", "isSimulated": false,
  "estimates": { "durationS": 1260, "distanceM": 8420, "photoCount": 412, "gsdCm": 2.19, "batteries": 1 },
  "validation": { "valid": true, "issues": [] }, "capabilities": ["missionUpload"], "version": 1 }
```
Errors: `MISSION_GEOFENCE_VIOLATION`, `MISSION_ALTITUDE_EXCEEDED`, `DRONE_UNAVAILABLE`, `DRONE_DOUBLE_BOOKED`, `PILOT_LICENSE_EXPIRED`, `PILOT_DOUBLE_BOOKED`, `DRONE_REGISTRATION_EXPIRED`.

#### `POST /missions/:id/start`
Bearer, `mission:start` (assigned pilot or org-wide role), R3, `Idempotency-Key` required.
Request: `{ "confirmPilotInCommand": true }`
Preconditions: status `ready` (or `approved` if approval required and auto-ready), checklist complete, drone `available`, pilot license valid.
Response `200`:
```json
{ "id": "…", "status": "in_progress", "actualStart": "2026-10-08T05:03:12Z",
  "execution": { "mode": "logical", "providerCommandSent": false, "telemetryChannel": "org:…:mission:…:telemetry" } }
```
`execution.mode` is `logical` unless the drone's adapter has `missionControl` enabled. Then it is `provider` and `providerCommandSent` reflects the provider ack.
Errors: `INVALID_STATE_TRANSITION`, `CHECKLIST_INCOMPLETE`, `PILOT_LICENSE_EXPIRED`, `DRONE_UNAVAILABLE`, `PROVIDER_COMMAND_FAILED` (502, the mission stays `ready`).

#### `POST /missions/:id/stop`
Completes the mission. `mission:start`, R3, Idempotency-Key. `{ "notes": "…" }` → `200 {status: "completed", actualEnd, summary}`.

#### Other mission endpoints

| Method & Path | Permission | RL | Notes / Errors |
|---|---|---|---|
| `GET /missions` | `mission:read` | R2 | `?projectId&siteId&status&droneId&pilotId&from&to&mine=true` |
| `GET /missions/:id` | `mission:read` | R2 | `?expand=waypoints,drone,pilot,events` |
| `PATCH /missions/:id` | `mission:update` | R3 | Only in `draft/planned/rejected`. `If-Match` required. |
| `POST /missions/:id/generate-waypoints` | `mission:update` | R3 | Recompute from area/params → waypoints + estimates (no save unless `save=true`) |
| `GET/PUT /missions/:id/waypoints` | `mission:read` / `mission:update` | R2/R3 | PUT replaces the set (≤ 2,000 waypoints) and re-validates |
| `POST /missions/:id/submit` | `mission:update` | R3 | → `pending_approval` |
| `POST /missions/:id/approve` / `/reject` | `mission:approve` | R3 | reject requires `{reason}` |
| `PUT /missions/:id/checklist` | `mission:start` | R3 | `{items:[{id, checked}]}` |
| `POST /missions/:id/pause` / `/resume` | `mission:start` | R3 | |
| `POST /missions/:id/abort` | `mission:abort` | R3 | `{reasonCode: weather|technical|airspace|safety|other, reason}` |
| `POST /missions/:id/cancel` | `mission:update` | R3 | pre-flight states only |
| `GET /missions/:id/events` | `mission:read` | R2 | |
| `GET /missions/:id/export?format=kmz|kml|geojson|wpml` | `mission:read` | R2 | MISSION-020 |
| `GET /missions/calendar.ics?token=` | token | R5 | Pilot iCal feed (MISSION-008) |

### 6.11 Telemetry & realtime

| Method & Path | Permission | RL | Notes |
|---|---|---|---|
| `POST /realtime/ticket` | Bearer | R3 | → `{ticket, url, expiresAt}` (30 s, single-use) |
| `GET /missions/:id/telemetry` | `telemetry:read` | R2 | `?from&to&resolution=raw|1s|5s|1m&cursor` → `{data:[CanonicalTelemetry], page}` (≤ 10,000 points) |
| `GET /missions/:id/telemetry/track` | `telemetry:read` | R2 | GeoJSON LineString of the flown path (simplified) |
| `GET /live/active-missions` | `telemetry:read` | R2 | Snapshot for Live Operations (accessible projects only) |
| `POST /ingest/:provider/:connectionId` | HMAC signature | R6 | Provider push ingest (internal ingress host) |

WebSocket protocol: [Real-Time Architecture §4](../04-Architecture/Real-Time-Architecture.md#4-websocket-protocol).

### 6.12 Media & video

#### `POST /media/uploads` (initiate)
Bearer, `media:upload`, R4, Idempotency-Key required.
```json
{ "projectId": "…", "siteId": "…", "missionId": "…",
  "files": [ { "clientFileId": "f1", "filename": "DJI_0001.JPG", "sizeBytes": 12873421, "mimeType": "image/jpeg", "sha256": "…optional…" } ] }
```
Validation: ≤ 2,000 files per session. Each ≤ 20 GB. The declared type is in the allow-list. Storage quota pre-check (sum of sizes).
Response `201`:
```json
{ "uploadSessionId": "…", "expiresAt": "…",
  "files": [ { "clientFileId": "f1", "mediaId": "…", "uploadId": "…", "partSizeBytes": 16777216, "partCount": 1,
               "duplicateOf": null } ] }
```
Errors: `STORAGE_QUOTA_EXCEEDED` (422), `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`.

| Method & Path | Permission | RL | Notes |
|---|---|---|---|
| `POST /media/uploads/:sessionId/files/:mediaId/parts` | `media:upload` | R3 | `{partNumbers:[1..n]}` → presigned PUT URLs (TTL 1 h) |
| `POST /media/uploads/:sessionId/files/:mediaId/complete` | `media:upload` | R3 | `{parts:[{partNumber, etag}]}` → `202 {status: 'scanning'}` |
| `POST /media/uploads/:sessionId/files/:mediaId/abort` | `media:upload` | R3 | |
| `GET /media/uploads/:sessionId` | `media:upload` | R2 | Session progress (resume support) |
| `GET /media` | `media:read` | R2 | `?projectId&siteId&missionId&assetId&type&tag&from&to&bbox&status&sharedWithViewers&sort=-capturedAt&view=map` (map view returns GeoJSON points) |
| `GET /media/:id` | `media:read` | R2 | Includes signed `thumbnailUrl`, `previewUrl`, `metadata` |
| `PATCH /media/:id` | `media:upload` (owner) or `media:share` | R3 | `{siteId, missionId, assetId, sharedWithViewers, caption}` |
| `DELETE /media/:id` | `media:delete` | R3 | soft delete (trash 30 d) |
| `POST /media/:id/restore` | `media:delete` | R3 | |
| `GET /media/:id/download` | `media:download` | R2 | → `{url, expiresAt}` (5 min), audited |
| `POST /media/bulk` | varies | R4 | `{action: tag|untag|share|unshare|delete|move|download, mediaIds ≤ 500, …}` → `202 {jobId}` for download zip |
| `POST /media/:id/tags` / `DELETE /media/:id/tags/:tag` | `media:upload` | R3 | |
| `GET /media/:id/playback` | `media:read` | R2 | → `{manifestUrl, posterUrl, spriteVttUrl, expiresAt}` and sets CloudFront signed cookies |
| `POST /media/:id/frames` | `media:upload` | R3 | `{timeMs}` → `201 Media` (VIDEO-007) |
| `POST /media/compare` | `media:read` | R2 | `{a: mediaId|mapId, b: …}` → aligned pair metadata |
| `POST /live-streams/:droneId/session` | `livevideo:view` | R3 | → `{whepUrl, hlsUrl, viewerToken, expiresAt}`. Errors `STREAM_OFFLINE`, `VIEWER_LIMIT_REACHED`, `CAPABILITY_UNAVAILABLE` |

### 6.13 Surveys, maps & twin

| Method & Path | Permission | RL | Notes / Errors |
|---|---|---|---|
| `GET /surveys` / `POST /surveys` | `survey:read` / `survey:create` | R2/R3 | `{siteId, name, type, captureDate, targetGsdCm, crs, missionIds?}` |
| `GET/PATCH /surveys/:id` | `survey:read` / `survey:create` | R2/R3 | |
| `POST /surveys/:id/areas` | `survey:create` | R3 | Polygon must be within the site boundary (`AREA_OUTSIDE_SITE`) |
| `POST /surveys/:id/outputs` | `survey:upload` | R4 | `{mediaId, outputType: orthomosaic|dsm|dtm|pointcloud|mesh|contours}` → `202` conversion job. Errors `GEOREFERENCE_MISSING`, `CRS_UNSUPPORTED` |
| `POST /surveys/:id/process` | `survey:process` | R4 | `{integrationId, preset}` → `202`. `INTEGRATION_REQUIRED` if none connected |
| `POST /surveys/:id/publish` | `survey:publish` | R3 | `SURVEY_QA_REQUIRED` |
| `POST /surveys/:id/volumes` | `survey:read` | R4 | `{polygon, basePlane: lowest|average_edge|custom|survey, baseElevationM?, compareSurveyId?}` → `{cutM3, fillM3, netM3, areaM2}` |
| `GET /maps` | `map:read` | R2 | `?siteId&type&from&to` |
| `GET /maps/:id` | `map:read` | R2 | Includes `tileUrlTemplate` (signed, 1 h) and bounds |
| `GET /map-layers` / `POST /map-layers` / `PATCH /map-layers/:id` / `DELETE /map-layers/:id` | `map:read` / `map:layer_manage` | R2/R3 | |
| `GET /tiles/:layerId/:z/:x/:y.:fmt` | signed URL / cookie | CDN | `fmt` = png, webp, pbf. Proxied to TiTiler with an authorization check on cache miss |
| `GET /maps/:id/elevation?lon&lat` / `POST /maps/:id/profile` | `map:read` | R2 | Point elevation / profile along a line (DSM) |
| `GET/POST /annotations`, `PATCH/DELETE /annotations/:id` | `map:read` / `map:annotate` | R2/R3 | |
| `GET /twin/models?siteId` | `twin:read` | R2 | |
| `POST /twin/models` | `twin:model_upload` | R4 | `{siteId, mediaId, kind, format, capturedAt, transform?}` → `202` conversion |
| `GET /twin/models/:id/tileset` | `twin:read` | R2 | → `{tilesetUrl}` + signed cookies |
| `GET/POST /viewpoints`, `DELETE /viewpoints/:id` | `twin:read` | R2/R3 | |

### 6.14 Progress & milestones

| Method & Path | Permission | RL | Request / Response | Errors |
|---|---|---|---|---|
| `GET /projects/:id/milestones` | `progress:read` | R2 | → `[{id, name, weight, normalizedWeightPct, plannedStart, plannedEnd, actualPct, plannedPct, status, lastRecord}]` | — |
| `POST /projects/:id/milestones` | `milestone:manage` | R3 | `{name, siteId?, plannedStart, plannedEnd, weight, curve?, assetIds?, parentMilestoneId?}` | `VALIDATION_ERROR` |
| `PATCH /milestones/:id` / `DELETE /milestones/:id` | `milestone:manage` | R3 | `If-Match` | `MILESTONE_HAS_APPROVED_RECORDS` (delete) |
| `POST /projects/:id/milestones/import` | `milestone:manage` | R4 | multipart CSV, `?dryRun` | row errors |
| `GET /projects/:id/progress` | `progress:read` | R2 | `?asOf=2026-10-06` → see below | — |
| `GET /projects/:id/progress/series` | `progress:read` | R2 | `?from&to&interval=day|week|month` → `[{date, plannedPct, actualPct}]` | — |
| `POST /progress-records` | `progress:update` | R3 | `{projectId, milestoneId?, siteId?, recordDate, percentComplete, evidenceMediaIds?, notes?}` → `201` (`approvalStatus` per permissions) | `PERCENT_OUT_OF_RANGE`, `FUTURE_DATE_NOT_ALLOWED` |
| `POST /progress-records/:id/approve` / `/reject` | `progress:approve` | R3 | reject `{reason}` | `FOUR_EYES_REQUIRED`, `INVALID_STATE_TRANSITION` |
| `GET /progress-records` | `progress:read` | R2 | `?projectId&milestoneId&approvalStatus` | — |

`GET /projects/:id/progress` response:
```json
{ "asOf": "2026-10-06", "actualPct": 41.2, "plannedPct": 44.0, "scheduleVariancePct": -2.8,
  "status": "at_risk", "forecastCompletion": "2027-11-04", "milestonesDelayed": 2,
  "pendingApprovals": 1, "calculatedAt": "2026-10-06T07:30:00Z" }
```

### 6.15 Inspections & findings

| Method & Path | Permission | RL | Notes |
|---|---|---|---|
| `GET/POST /inspection-templates`, `PATCH /inspection-templates/:id`, `POST /inspection-templates/:id/publish` | `inspection:read` / `inspection:template_manage` | R2/R3 | |
| `GET /inspections` | `inspection:read` | R2 | `?projectId&siteId&assetId&status&assigneeId&dueBefore&mine` |
| `POST /inspections` | `inspection:create` | R3 | `{projectId, siteId, assetId?, missionId?, templateId?, title, type, assigneeId?, reviewerId?, dueDate?, recurrenceRule?}` |
| `GET/PATCH /inspections/:id` | `inspection:read` / `inspection:update` | R2/R3 | `If-Match` |
| `POST /inspections/:id/{schedule\|start\|submit\|approve\|reject\|close\|cancel}` | per state table | R3 | approve `{approvalReference?, comment?}`; reject `{comment}` required. Errors `INSPECTION_INCOMPLETE`, `SELF_APPROVAL_FORBIDDEN`, `INVALID_STATE_TRANSITION` |
| `PUT /inspections/:id/checklist/items/:itemId` | `inspection:update` (assignee) | R3 | `{value, note?, mediaIds?}` |
| `GET /inspections/:id/findings` / `POST /inspections/:id/findings` | `inspection:read` / `finding:create` | R2/R3 | `{title, description, category, severity, assetId?, location?, assigneeId?, dueDate?, attachments?:[{mediaId, annotations}]}` |
| `GET /findings` | `inspection:read` | R2 | Cross-inspection list `?projectId&severity&status&overdue&bbox` |
| `PATCH /findings/:id` | `finding:update` | R3 | |
| `POST /findings/:id/{start\|resolve\|verify\|reopen\|close\|wont-fix}` | `finding:update` / `finding:resolve` / `inspection:approve` | R3 | resolve `{resolutionNotes, mediaIds?}` (`FINDING_EVIDENCE_REQUIRED`) |
| `POST /findings/:id/attachments` | `finding:update` | R3 | |
| `GET/POST /comments?entityType&entityId` | read perm on the entity | R2/R3 | `{body}` with `@[userId]` mentions |

### 6.16 Reports

#### `POST /reports/generate`
Bearer, `report:generate`, R4, Idempotency-Key required.
```json
{ "type": "progress", "templateId": "…", "scope": { "type": "project", "id": "…" },
  "periodStart": "2026-09-01", "periodEnd": "2026-09-30", "format": "pdf",
  "sections": ["cover","executive_summary","kpis","s_curve","milestones","before_after","map","findings_summary","upcoming","appendix_media"],
  "options": { "aiNarrative": false, "beforeAfterPairs": [ { "a": "map:…", "b": "map:…" } ], "maxImages": 120 } }
```
Response `202`:
```json
{ "reportId": "…", "status": "queued", "version": 1, "jobChannel": "org:…:jobs:…" }
```
Errors: `REPORT_SCOPE_FORBIDDEN` (returned as `NOT_FOUND` if the scope is not visible), `REPORT_TOO_LARGE`, `PLAN_LIMIT_EXCEEDED` (AI narrative credits).

| Method & Path | Permission | RL | Notes |
|---|---|---|---|
| `GET /reports` | `report:read` | R2 | Viewers see `published` only |
| `GET /reports/:id` | `report:read` | R2 | Status, versions, metadata |
| `GET /reports/:id/download` | `report:read` | R2 | → `{url, expiresAt}` (5 min), audited |
| `POST /reports/:id/publish` | `report:share` | R3 | → `published`, notifies Viewers |
| `POST /reports/:id/regenerate` | `report:generate` | R4 | new version |
| `POST /reports/:id/archive` | `report:generate` | R3 | |
| `POST /reports/:id/share-links` | `report:share` | R3 | `{expiresAt ≤ 30 d, passcode?}` → `{url, expiresAt}` (token shown once). `SHARE_DISABLED` |
| `GET /reports/:id/share-links` / `DELETE /report-share-links/:id` | `report:share` | R2/R3 | |
| `GET /public/reports/:token` | Public (+ passcode via `POST /public/reports/:token/unlock`) | R5 | Viewer page data + 5-min PDF URL. Access logged. |
| `GET /reports/:id/verify?sha256=` | `report:read` or Public with share token | R5 | `{authentic: bool, version, generatedAt}` |
| `GET/POST /report-templates`, `PATCH /report-templates/:id` | `report:read` / `report:template_manage` | R2/R3 | |
| `GET/POST /report-schedules`, `PATCH/DELETE /report-schedules/:id` | `report:generate` | R2/R3 | Phase 2 |

### 6.17 AI

#### `POST /ai/analyze`
Bearer, `ai:analyze` + read permission on all inputs, R4, Idempotency-Key required.
```json
{ "type": "progress", "projectId": "…", "siteId": "…",
  "inputs": { "mapId": "…", "baselineMapId": "…", "mediaIds": [], "milestoneIds": ["…","…"] },
  "options": { "language": "en" } }
```
Response `202 { "analysisId": "…", "status": "queued", "estimatedCredits": 12 }`.
Errors: `AI_DISABLED` (403), `AI_CREDITS_EXHAUSTED` (422), `AI_INPUT_INVALID` (422, e.g. maps not co-registered), `NOT_FOUND` (input not visible).

| Method & Path | Permission | RL | Notes |
|---|---|---|---|
| `GET /ai/analyses` / `GET /ai/analyses/:id` | `ai:analyze` or read on the project | R2 | Output per schema ([AI spec §4](../09-AI/AI-Requirements.md#4-ai-capabilities)) |
| `POST /ai/analyses/:id/cancel` | requester | R3 | |
| `GET /ai/suggestions?analysisId&decision=pending` | `ai:review` | R2 | Review queue |
| `POST /ai/suggestions/:id/decision` | `ai:review` | R3 | `{decision: accepted|edited|rejected, edits?, reason?}` → resulting entity |
| `POST /ai/assistant/conversations` | `ai:assistant` | R3 | → `{conversationId}` |
| `POST /ai/assistant/conversations/:id/messages` | `ai:assistant` | R4 | `{content}` → **SSE stream** (`text/event-stream`) of `delta`, `tool_call`, `citation`, `done` events |
| `GET /ai/assistant/conversations[/:id]` | owner only | R2 | |
| `DELETE /ai/assistant/conversations/:id` | owner | R3 | |

### 6.18 Notifications

`GET /notifications?unread&category&cursor`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET /notifications/unread-count`, `GET/POST /notification-rules` (`notification:manage_rules`), `PATCH/DELETE /notification-rules/:id`, `POST /me/push-subscriptions`, `DELETE /me/push-subscriptions/:id`. All R2/R3.

### 6.19 Audit & analytics

| Method & Path | Permission | RL | Notes |
|---|---|---|---|
| `GET /audit-logs` | `audit:read` | R2 | `?actorId&action&entityType&entityId&projectId&from&to&ip&cursor` |
| `POST /audit-logs/export` | `audit:read` + Reauth | R4 | `{filters, format: csv|jsonl}` → `202 {jobId}` |
| `GET /audit-logs/verify?from&to` | `audit:read` | R4 | Hash-chain verification result |
| `GET /analytics/overview` | `analytics:read` | R2 | `?from&to&projectIds` |
| `GET /analytics/operations` / `/progress` / `/inspections` / `/usage` | `analytics:read` | R2 | `?format=csv` supported |

### 6.20 Billing

| Method & Path | Permission | RL | Notes |
|---|---|---|---|
| `GET /billing/plans` | Bearer | R2 | |
| `GET /billing/subscription` | `billing:manage` | R2 | |
| `POST /billing/checkout-session` | `billing:manage` | R4 | `{planKey, seats}` → `{url}` (hosted checkout). `DOWNGRADE_BLOCKED` with `meta.remediation` |
| `POST /billing/portal-session` | `billing:manage` | R4 | → `{url}` |
| `GET /billing/invoices` | `billing:manage` | R2 | |
| `GET /billing/usage?from&to` | `billing:manage` or `org:read` | R2 | |
| `POST /webhooks/billing/:provider` | Provider signature | — | Idempotent on provider event ID |

### 6.21 Integrations, webhooks & API keys

| Method & Path | Permission | RL | Notes |
|---|---|---|---|
| `GET /integrations/catalog` | `org:read` | R2 | Availability per plan + status label |
| `GET /integrations` / `POST /integrations` | `integration:manage` | R2/R3 | `{provider, name, config, credentials}` — credentials are write-only (never returned) |
| `GET /integrations/:provider/oauth/start` / `/callback` | `integration:manage` | R3 | OAuth 2.0 + PKCE + state |
| `PATCH/DELETE /integrations/:id` | `integration:manage` | R3 | |
| `POST /integrations/:id/test` | `integration:manage` | R4 | → `{ok, latencyMs, error?}` |
| `GET/POST /webhooks`, `PATCH/DELETE /webhooks/:id` | `integration:manage` | R2/R3 | `{url (https), eventTypes, projectIds?}`. Secret returned once on create. URL validated against SSRF rules. |
| `GET /webhooks/:id/deliveries` / `POST /webhooks/:id/deliveries/:deliveryId/redeliver` | `integration:manage` | R2/R3 | |
| `GET/POST /api-keys`, `DELETE /api-keys/:id` | `apikey:manage` + Reauth (create) | R2/R3 | `{name, permissions ⊆ creator's, projectIds?, expiresAt ≤ 1 y}` → key shown once |

### 6.22 Platform admin (`/admin/v1`, staff realm)

`GET /admin/v1/organizations`, `GET /admin/v1/organizations/:id`, `POST /admin/v1/organizations/:id/{suspend|reactivate|schedule-deletion|cancel-deletion}` (`{reason}`), `GET /admin/v1/users?email=`, `POST /admin/v1/users/:id/{lock|unlock|reset-mfa}` (`{ticketRef}`), `GET/PATCH /admin/v1/subscriptions/:orgId`, `GET /admin/v1/usage`, `GET /admin/v1/health`, `GET/PUT /admin/v1/feature-flags/:key`, `POST /admin/v1/break-glass` (`{organizationId, ticketRef, justification, durationMinutes ≤ 240}`), `GET /admin/v1/audit-logs`. All require staff session + WebAuthn + IP allow-list. All are audited to `platform.audit_logs`.

---

## 7. Outbound Webhooks (customer endpoints)

```http
POST https://customer.example.com/aerosight-hook
Content-Type: application/json
X-AeroSight-Event: finding.created
X-AeroSight-Delivery: 0192b3…
X-AeroSight-Timestamp: 1791270000
X-AeroSight-Signature: v1=5f2b…  (hex HMAC-SHA256 of "{timestamp}.{rawBody}" with the webhook secret)

{ "id": "evt_0192b3…", "type": "finding.created", "createdAt": "2026-10-06T07:12:31Z",
  "organizationId": "…", "data": { "findingId": "…", "projectId": "…", "severity": "high", "title": "…", "url": "https://app.aerosight.ai/…" } }
```

- Receivers must reject timestamps older than 5 minutes (replay protection).
- Payloads contain IDs and minimal fields. Receivers fetch details via the API (which enforces permissions).
- Retries: 1 m, 5 m, 30 m, 2 h, 6 h, 12 h, 24 h on non-2xx/timeout (10 s). Auto-disable after 20 consecutive failures (INTEG-010).
- Event types: `mission.*`, `media.ready`, `survey.published`, `inspection.*`, `finding.*`, `progress.approved`, `report.ready`, `report.published`.

## 8. SDK & Tooling

- TypeScript client generated from OpenAPI (`packages/contracts/client`).
- Postman/Bruno collection generated per release.
- Sandbox environment (`api.sandbox.aerosight.ai`) with simulator drones for integrators (Phase 2).
