# Database Design Document

| | |
|---|---|
| **Document** | Database Design Document |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-08 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Engineering (DBA) |
| **Reviewer** | _Pending — Tech Lead, DBA, Security Engineer_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Engineering | Initial physical design for 70 tenant/global tables + platform schema |

---

## 1. Platform

| Item | Choice |
|---|---|
| Engine | PostgreSQL 16 |
| Extensions | `postgis` 3.4, `timescaledb` 2.x (see ADR-003), `pgcrypto`, `citext`, `pg_trgm`, `btree_gist`, `vector` (pgvector, Phase 2), `pg_stat_statements` |
| Schemas | `public` (application), `platform` (admin realm: staff users, feature flags, platform audit), `analytics` (materialized views) |
| Migrations | Plain SQL in `db/migrations/NNNN_description.sql`. Applied with a migration runner (e.g. `graphile-migrate` or `dbmate`). Expand/contract pattern for zero-downtime deploys. |
| Roles | `app_migrator` (DDL owner), `app_user` (runtime, RLS enforced, no BYPASSRLS), `app_readonly` (replica/analytics, RLS enforced), `app_platform` (admin API, audited) |

## 2. Conventions

### 2.1 Standard columns ("STD")

Unless stated otherwise, every tenant table includes:

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | app-generated UUIDv7 | Primary key |
| `organization_id` | `uuid` | NO | — | FK → `organizations(id)` `ON DELETE CASCADE`. RLS key. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Maintained by trigger `set_updated_at()` |
| `created_by` | `uuid` | YES | — | FK → `users(id)` `ON DELETE SET NULL` |
| `updated_by` | `uuid` | YES | — | FK → `users(id)` |
| `version` | `integer` | NO | `1` | Optimistic locking (`If-Match` / ETag). Incremented by trigger. |

Tables marked **SD** (soft delete) also have `deleted_at timestamptz NULL` and `deleted_by uuid NULL`.

### 2.2 Soft deletion strategy

1. **Soft-deleted (SD):** user-facing business entities: projects, sites, assets, drones, missions, media, surveys, maps, map layers, twin models, inspections, findings, milestones, reports, templates, roles, integrations, webhooks, annotations, comments.
2. Unique constraints on SD tables are **partial**: `… WHERE deleted_at IS NULL`.
3. Repositories exclude `deleted_at IS NOT NULL` by default. Trash views (`include_deleted`) exist only for media/reports.
4. **Purge:** the `retention.enforce` job hard-deletes SD rows after 30 days (media trash) or per the retention policy, deletes the related storage objects, and writes an audit event.
5. **Append-only (no soft delete, no UPDATE by `app_user`):** `audit_logs`, `telemetry`, `mission_events`, `domain_events` (except `published_at`), `usage_records`, `webhook_deliveries`.
6. **Immutable after state:** `progress_records` once approved; `inspections` once approved (enforced by trigger + service).

### 2.3 Other conventions

- Enumerations use PostgreSQL `text` + `CHECK` constraints (easier to evolve than native enums) and are mirrored in `packages/contracts`.
- Geometry: `geography(<Type>, 4326)` for storage and distance/area. Cast to `geometry` for topology functions. GIST indexes on every spatial column.
- JSONB columns have a documented JSON Schema in `packages/contracts/jsonb/*.schema.json`. Validated in the application.
- Money: `bigint` minor units + `char(3)` currency.
- Timestamps in UTC. Local timezone stored as IANA text where needed.
- Every FK column is indexed.
- Composite tenant FKs: child `(organization_id, parent_id)` references parent `(organization_id, id)`. Every tenant table therefore has `UNIQUE (organization_id, id)`.

### 2.4 RLS template

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <t>
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
```

`roles` and `report_templates` additionally allow reading system rows: `USING (organization_id IS NULL OR organization_id = current_setting(...)::uuid)` with `WITH CHECK (organization_id = current_setting(...)::uuid)` (system rows can't be written by tenants). For these two tables `organization_id` is nullable.

---

## 3. Table Catalog

| # | Table | Domain | Tenant | SD | Phase |
|---|---|---|---|---|---|
| 1 | organizations | Tenancy | (is tenant) | status-based | 1 |
| 2 | users | Identity | global | status-based | 1 |
| 3 | organization_members | Tenancy | ✓ | — | 1 |
| 4 | roles | IAM | ✓ (null = system) | ✓ | 1 |
| 5 | permissions | IAM | global | — | 1 |
| 6 | role_permissions | IAM | ✓ (null = system) | — | 1 |
| 7 | user_roles | IAM | ✓ | — | 1 |
| 8 | invitations | IAM | ✓ | — | 1 |
| 9 | refresh_tokens | Auth | global (user) | — | 1 |
| 10 | email_verification_tokens | Auth | global | — | 1 |
| 11 | password_reset_tokens | Auth | global | — | 1 |
| 12 | mfa_recovery_codes | Auth | global | — | 1 |
| 13 | webauthn_credentials | Auth | global | — | 2 |
| 14 | projects | Projects | ✓ | ✓ | 1 |
| 15 | project_members | Projects | ✓ | — | 1 |
| 16 | sites | Sites | ✓ | ✓ | 1 |
| 17 | site_members | Sites | ✓ | — | 2 |
| 18 | site_no_fly_zones | Sites | ✓ | ✓ | 1 |
| 19 | assets | Sites | ✓ | ✓ | 1 |
| 20 | drones | Fleet | ✓ | ✓ | 1 |
| 21 | drone_pilots | Fleet | ✓ | ✓ | 1 |
| 22 | drone_maintenance_logs | Fleet | ✓ | ✓ | 1 |
| 23 | drone_missions | Missions | ✓ | ✓ | 1 |
| 24 | mission_waypoints | Missions | ✓ | — (replaced as set) | 1 |
| 25 | mission_events | Missions | ✓ | append-only | 1 |
| 26 | telemetry | Telemetry | ✓ | append-only | 1 |
| 27 | media | Media | ✓ | ✓ | 1 |
| 28 | media_metadata | Media | ✓ | — | 1 |
| 29 | media_tags | Media | ✓ | — | 1 |
| 30 | upload_sessions | Media | ✓ | — | 1 |
| 31 | live_stream_sessions | Media | ✓ | — | 2 |
| 32 | surveys | Geo | ✓ | ✓ | 1 |
| 33 | survey_areas | Geo | ✓ | ✓ | 1 |
| 34 | maps | Geo | ✓ | ✓ | 1 |
| 35 | map_layers | Geo | ✓ | ✓ | 1 |
| 36 | annotations | Geo | ✓ | ✓ | 1 |
| 37 | twin_models | Geo/3D | ✓ | ✓ | 2–3 |
| 38 | viewpoints | Geo/3D | ✓ | ✓ | 3 |
| 39 | inspection_templates | Inspections | ✓ | ✓ | 2 |
| 40 | inspections | Inspections | ✓ | ✓ | 2 |
| 41 | inspection_findings | Inspections | ✓ | ✓ | 2 |
| 42 | inspection_attachments | Inspections | ✓ | — | 2 |
| 43 | comments | Collaboration | ✓ | ✓ | 1 |
| 44 | milestones | Progress | ✓ | ✓ | 1 |
| 45 | progress_records | Progress | ✓ | immutable | 1 |
| 46 | ai_analyses | AI | ✓ | — | 2 |
| 47 | ai_suggestions | AI | ✓ | — | 2 |
| 48 | ai_conversations | AI | ✓ | ✓ | 2 |
| 49 | ai_messages | AI | ✓ | — | 2 |
| 50 | ai_embeddings | AI | ✓ | — | 2 |
| 51 | report_templates | Reports | ✓ (null = system) | ✓ | 1 |
| 52 | reports | Reports | ✓ | ✓ | 1 |
| 53 | report_share_links | Reports | ✓ | — (revoked_at) | 1 |
| 54 | report_schedules | Reports | ✓ | ✓ | 2 |
| 55 | notifications | Notifications | ✓ | — | 1 |
| 56 | notification_preferences | Notifications | ✓ | — | 2 |
| 57 | notification_rules | Notifications | ✓ | ✓ | 2 |
| 58 | push_subscriptions | Notifications | ✓ | — | 2 |
| 59 | domain_events | Events | ✓ | append-only | 1 |
| 60 | audit_logs | Audit | ✓ | append-only | 1 |
| 61 | integrations | Integrations | ✓ | ✓ | 2 |
| 62 | webhooks | Integrations | ✓ | ✓ | 2 |
| 63 | webhook_deliveries | Integrations | ✓ | append-only | 2 |
| 64 | api_keys | Integrations | ✓ | — (revoked_at) | 2 |
| 65 | plans | Billing | global | — | 1 |
| 66 | subscriptions | Billing | ✓ | — | 1 |
| 67 | usage_records | Billing | ✓ | append-only | 1 |
| 68 | retention_policies | Privacy | ✓ | — | 2 |
| 69 | legal_holds | Privacy | ✓ | — (released_at) | 2 |
| 70 | idempotency_keys | Platform | ✓ | — (TTL purge) | 1 |

Platform schema (admin realm): `platform.staff_users`, `platform.staff_sessions`, `platform.break_glass_sessions`, `platform.feature_flags`, `platform.audit_logs` (§5).

---

## 4. Table Specifications

Format per table: columns beyond STD, then constraints and indexes. Types: `uuid`, `text`, `citext`, `int`, `bigint`, `numeric(p,s)`, `bool`, `date`, `timestamptz`, `jsonb`, `geog(Type)` = `geography(Type,4326)`.

### 4.1 organizations
Not tenant-scoped (it is the tenant). Has `id, created_at, updated_at, version`.

| Column | Type | Null | Default / Constraint | Notes |
|---|---|---|---|---|
| name | text | NO | 2–120 chars | |
| slug | citext | NO | `^[a-z0-9-]{3,40}$` | **UNIQUE** |
| status | text | NO | `'active'` CHECK in (`pending_verification, active, read_only, suspended, pending_deletion, deleted`) | |
| industry | text | YES | | |
| country_code | char(2) | NO | ISO 3166-1 | |
| timezone | text | NO | `'UTC'` | IANA |
| region | text | NO | deployment region | Data residency |
| logo_storage_key | text | YES | | |
| brand_color | char(7) | YES | `^#[0-9A-Fa-f]{6}$` | |
| units | text | NO | `'metric'` CHECK (`metric, imperial`) | |
| default_crs | text | NO | `'EPSG:4326'` | |
| settings | jsonb | NO | `'{}'` | security policy, 2FA enforcement, session lifetime, allowed domains, external sharing, AI controls |
| kms_key_alias | text | NO | | Per-org data key |
| suspended_reason | text | YES | | |
| deletion_scheduled_at | timestamptz | YES | | |

Indexes: `UNIQUE(slug)`, `(status)`.

### 4.2 users
Global identity. Has `id, created_at, updated_at, version`.

| Column | Type | Null | Default / Constraint | Notes |
|---|---|---|---|---|
| email | citext | NO | RFC 5322 | **UNIQUE** |
| password_hash | text | YES | | null for SSO-only users |
| full_name | text | NO | 1–120 | |
| phone | text | YES | E.164 | |
| avatar_storage_key | text | YES | | |
| locale | text | NO | `'en'` | |
| timezone | text | NO | `'UTC'` | |
| units | text | YES | | overrides org |
| status | text | NO | `'pending_verification'` CHECK (`pending_verification, active, disabled, locked`) | |
| email_verified_at | timestamptz | YES | | |
| mfa_enabled | bool | NO | false | |
| mfa_secret_enc | bytea | YES | | AES-256-GCM encrypted with app KMS key |
| failed_login_count | int | NO | 0 | |
| locked_until | timestamptz | YES | | |
| last_login_at | timestamptz | YES | | |
| password_changed_at | timestamptz | YES | | |

Indexes: `UNIQUE(email)`, `(status)`.

### 4.3 organization_members — STD
| Column | Type | Null | Constraint |
|---|---|---|---|
| user_id | uuid | NO | FK users |
| status | text | NO | CHECK (`active, deactivated`) default `active` |
| joined_at | timestamptz | NO | `now()` |
| deactivated_at | timestamptz | YES | |
| last_active_at | timestamptz | YES | |

Unique: `(organization_id, user_id)`. Index: `(user_id)`.

### 4.4 roles — STD, SD (`organization_id` nullable for system roles)
| Column | Type | Null | Constraint |
|---|---|---|---|
| key | text | NO | `^[a-z_]{2,40}$` (e.g. `project_manager`, `custom_qa_lead`) |
| name | text | NO | |
| description | text | YES | |
| is_system | bool | NO | false |
| scope | text | NO | CHECK (`organization, project`). Org roles may also be used as project roles if `assignable_to_project`. |
| assignable_to_project | bool | NO | true |

Unique: `(organization_id, key) WHERE deleted_at IS NULL` (system: `(key) WHERE organization_id IS NULL`).

### 4.5 permissions (global)
| Column | Type | Null | Constraint |
|---|---|---|---|
| id | uuid | NO | PK |
| key | text | NO | **UNIQUE**, `resource:action` |
| resource | text | NO | |
| action | text | NO | |
| description | text | NO | |
| scope | text | NO | CHECK (`organization, project`) |
| is_sensitive | bool | NO | false (requires re-auth / restricted to Owner-Admin by default) |

Seeded from `packages/permissions`. See [RBAC §3](../07-Security/RBAC.md#3-permission-catalog).

### 4.6 role_permissions
`organization_id uuid NULL`, `role_id uuid NOT NULL FK roles ON DELETE CASCADE`, `permission_id uuid NOT NULL FK permissions`, `created_at`. PK `(role_id, permission_id)`.

### 4.7 user_roles — STD
`user_id uuid NOT NULL`, `role_id uuid NOT NULL`, `granted_by uuid NULL`. Unique `(organization_id, user_id, role_id)`. Business rule: exactly one org role per member (enforced by a partial unique index on `(organization_id, user_id)` for roles with `scope='organization'` via the service, since partial unique cannot join — the service validates and a trigger asserts).

### 4.8 invitations — STD
| Column | Type | Null | Constraint |
|---|---|---|---|
| email | citext | NO | |
| role_id | uuid | NO | FK roles |
| project_assignments | jsonb | NO | `'[]'` — `[{projectId, roleId}]` |
| token_hash | bytea | NO | SHA-256 of a 32-byte random token. **UNIQUE** |
| expires_at | timestamptz | NO | now() + 7 d |
| accepted_at | timestamptz | YES | |
| accepted_user_id | uuid | YES | |
| revoked_at | timestamptz | YES | |
| invited_by | uuid | NO | |

Index: `(organization_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL`.

### 4.9 refresh_tokens
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | NO | PK |
| user_id | uuid | NO | FK users |
| organization_id | uuid | YES | active org at issuance |
| family_id | uuid | NO | rotation family |
| token_hash | bytea | NO | **UNIQUE** (SHA-256) |
| parent_id | uuid | YES | previous token in the family |
| issued_at / expires_at | timestamptz | NO | |
| last_used_at | timestamptz | YES | |
| rotated_at | timestamptz | YES | set when exchanged |
| revoked_at / revoked_reason | timestamptz / text | YES | `logout, reuse_detected, password_reset, admin, deactivated` |
| ip / user_agent / device_label | inet / text / text | YES | |

Indexes: `(user_id) WHERE revoked_at IS NULL`, `(family_id)`, `(expires_at)` for cleanup.

### 4.10 – 4.12 email_verification_tokens, password_reset_tokens, mfa_recovery_codes
Common: `id, user_id FK, token_hash/code_hash bytea UNIQUE, expires_at (codes: none), used_at, created_at`. Recovery codes: 10 per user, argon2id-hashed. Index `(user_id)`.

### 4.13 webauthn_credentials (Phase 2)
`id, user_id, credential_id bytea UNIQUE, public_key bytea, sign_count bigint, transports text[], aaguid uuid, name text, created_at, last_used_at`.

### 4.14 projects — STD, SD
| Column | Type | Null | Constraint / Notes |
|---|---|---|---|
| code | text | NO | `^[A-Z0-9-]{2,20}$` |
| name | text | NO | 2–160 |
| description | text | YES | ≤ 5,000 |
| type | text | NO | CHECK (`building, road, bridge, rail, utility, industrial, energy, mining, other`) |
| client_name | text | YES | |
| status | text | NO | `'planning'` CHECK (`planning, active, on_hold, completed, archived`) |
| start_date / end_date | date | YES | CHECK `end_date >= start_date` |
| location | geog(Point) | YES | |
| timezone | text | NO | org default |
| cover_media_id | uuid | YES | FK media |
| settings | jsonb | NO | `'{}'` (missionApprovalRequired, fourEyesProgress, autoAiAnalysis, defaultReportTemplateId) |
| archived_at | timestamptz | YES | |

Unique: `(organization_id, code) WHERE deleted_at IS NULL`. Indexes: `(organization_id, status)`, GIST `(location)`, trigram `(organization_id, name gin_trgm_ops)`.

### 4.15 project_members — STD
`project_id uuid NOT NULL` (composite FK), `user_id uuid NOT NULL`, `role_id uuid NOT NULL`. Unique `(organization_id, project_id, user_id)`. Index `(organization_id, user_id)`.

### 4.16 sites — STD, SD
| Column | Type | Null | Constraint / Notes |
|---|---|---|---|
| project_id | uuid | NO | composite FK → projects |
| code | text | NO | `^[A-Z0-9-]{1,20}$` |
| name | text | NO | |
| address | text | YES | |
| timezone | text | NO | |
| boundary | geog(MultiPolygon) | NO | valid (`ST_IsValid(boundary::geometry)` CHECK) |
| centroid | geog(Point) | NO | computed trigger `ST_Centroid` |
| area_m2 | numeric(14,2) | NO | computed `ST_Area(boundary)` |
| elevation_m | numeric(8,2) | YES | |
| geofence_buffer_m | int | NO | 50, CHECK 0–1000 |
| max_altitude_m | int | YES | override, CHECK ≤ 500 |
| airspace_notes | text | YES | |
| contacts | jsonb | NO | `'[]'` |
| status | text | NO | `'active'` CHECK (`active, inactive`) |

Unique: `(organization_id, project_id, code) WHERE deleted_at IS NULL`; `(organization_id, project_id, id)` (for composite FKs). Indexes: GIST `(boundary)`, GIST `(centroid)`, `(organization_id, project_id)`.

### 4.17 site_members — STD
`site_id`, `user_id`. Unique `(organization_id, site_id, user_id)`. If any rows exist for a site, only listed project members can access it (SITE-011).

### 4.18 site_no_fly_zones — STD, SD
`site_id`, `name`, `geometry geog(Polygon) NOT NULL`, `reason text`, `active_from/active_to timestamptz NULL` (temporary restrictions). GIST `(geometry)`.

### 4.19 assets — STD, SD
| Column | Type | Null | Constraint / Notes |
|---|---|---|---|
| project_id, site_id | uuid | NO | composite FK → sites |
| parent_asset_id | uuid | YES | same-site trigger + cycle check |
| type | text | NO | CHECK (`building, structure, floor, element, bridge, road_segment, tower, crane, equipment, utility, stockpile, other`) |
| name | text | NO | |
| tag | text | NO | |
| location | geog(PointZ) | NO | |
| geometry | geog(Geometry) | YES | footprint/line |
| attributes | jsonb | NO | `'{}'` |
| condition_rating | smallint | YES | CHECK 1–5 |
| status | text | NO | `'active'` CHECK (`planned, under_construction, active, decommissioned`) |
| bim_guid | text | YES | IFC GlobalId (ASSET-010) |

Unique `(organization_id, site_id, tag) WHERE deleted_at IS NULL`. Indexes: GIST `(location)`, `(organization_id, site_id, type)`, `(parent_asset_id)`.

### 4.20 drones — STD, SD
| Column | Type | Null | Constraint / Notes |
|---|---|---|---|
| provider_key | text | NO | `manual, simulator, dji_cloud, mavlink_bridge, skydio, …` |
| integration_id | uuid | YES | FK integrations |
| provider_drone_id | text | YES | |
| name | text | NO | |
| manufacturer / model | text | NO | |
| serial_number | text | NO | |
| registration_number | text | YES | |
| registration_expires_at | date | YES | |
| remote_id | text | YES | |
| category | text | YES | e.g. `C1, C2, Part107` |
| payloads | jsonb | NO | `'[]'` (`[{type, model, sensorWidthMm, focalMm, resolution}]`) |
| max_flight_time_min | int | YES | |
| max_speed_mps | numeric(5,2) | YES | |
| status | text | NO | `'available'` CHECK (`available, in_mission, maintenance, offline, retired`) |
| firmware_version | text | YES | |
| home_site_id | uuid | YES | FK sites |
| total_flight_seconds | bigint | NO | 0 |
| total_flights | int | NO | 0 |
| last_seen_at | timestamptz | YES | |
| is_simulated | bool | NO | generated: `provider_key = 'simulator'` |
| retired_at | timestamptz | YES | |

Unique: `(organization_id, serial_number) WHERE deleted_at IS NULL`; `(organization_id, integration_id, provider_drone_id) WHERE provider_drone_id IS NOT NULL`. Index `(organization_id, status)`.

### 4.21 drone_pilots — STD, SD
`user_id NOT NULL`, `license_number text`, `license_type text`, `issuing_authority text`, `license_expires_at date`, `insurance_expires_at date`, `certifications jsonb '[]'` (`[{name, number, expiresAt, mediaId}]`), `status text CHECK (active, suspended, inactive)`. Unique `(organization_id, user_id) WHERE deleted_at IS NULL`. Index `(organization_id, license_expires_at)`.

### 4.22 drone_maintenance_logs — STD, SD
`drone_id`, `performed_at date`, `type text CHECK (inspection, repair, firmware, battery, calibration, other)`, `description text`, `technician text`, `next_due_at date`, `attachments uuid[]` (media IDs). Index `(drone_id, performed_at DESC)`.

### 4.23 drone_missions — STD, SD
| Column | Type | Null | Constraint / Notes |
|---|---|---|---|
| project_id, site_id | uuid | NO | composite FK → sites |
| code | text | NO | `MSN-000123` per org sequence |
| name | text | NO | |
| type | text | NO | CHECK (`survey, inspection, progress, video, custom`) |
| template | text | NO | CHECK (`grid, double_grid, orbit, corridor, waypoint, freeform`) |
| objective | text | YES | |
| status | text | NO | `'draft'` CHECK (`draft, planned, pending_approval, approved, rejected, ready, in_progress, paused, completed, aborted, failed, cancelled`) |
| drone_id | uuid | YES | FK drones |
| pilot_id | uuid | YES | FK drone_pilots |
| survey_id | uuid | YES | FK surveys |
| scheduled_start / scheduled_end | timestamptz | YES | CHECK end > start |
| actual_start / actual_end | timestamptz | YES | |
| area | geog(Polygon) | YES | |
| path | geog(LineStringZ) | YES | planned path |
| flown_path | geog(LineStringZ) | YES | computed after completion |
| parameters | jsonb | NO | `{altitudeM, altitudeRef, speedMps, frontOverlap, sideOverlap, gimbalPitch, captureMode, sensor}` |
| estimates | jsonb | YES | `{durationS, distanceM, photoCount, gsdCm, batteries}` |
| checklist | jsonb | YES | `{templateVersion, items:[{id,label,checked,checkedAt}], completedBy, completedAt}` |
| summary | jsonb | YES | `{durationS, distanceM, maxAltM, minBattery, alerts}` |
| approved_by / approved_at | uuid / timestamptz | YES | |
| rejection_reason | text | YES | |
| abort_reason_code / abort_reason | text | YES | |
| provider_mission_id | text | YES | |
| recurrence_rule | text | YES | RFC 5545 RRULE (templates) |
| recurrence_parent_id | uuid | YES | |
| is_simulated | bool | NO | false |

Unique `(organization_id, code)`. Indexes: `(organization_id, status, scheduled_start)`, `(drone_id, scheduled_start)`, `(pilot_id, scheduled_start)`, GIST `(area)`. Exclusion constraint (btree_gist) to prevent drone double-booking: `EXCLUDE USING gist (drone_id WITH =, tstzrange(scheduled_start, scheduled_end) WITH &&) WHERE (status IN ('approved','ready','in_progress','paused') AND deleted_at IS NULL)`.

### 4.24 mission_waypoints — STD (no SD; replaced as a set per plan version)
`mission_id`, `seq int NOT NULL`, `location geog(PointZ) NOT NULL`, `altitude_m numeric(7,2)`, `speed_mps numeric(5,2)`, `heading_deg numeric(5,2)`, `gimbal_pitch_deg numeric(5,2)`, `actions jsonb '[]'`, `hover_seconds int`. Unique `(mission_id, seq)`.

### 4.25 mission_events — append-only
`id, organization_id, mission_id, occurred_at timestamptz, type text` (`state_changed, checklist_completed, alert, command_sent, command_ack, provider_error, note`), `actor_user_id uuid NULL`, `data jsonb`. Index `(mission_id, occurred_at)`.

### 4.26 telemetry — Timescale hypertable, append-only
| Column | Type | Notes |
|---|---|---|
| time | timestamptz NOT NULL | partition column |
| organization_id | uuid NOT NULL | RLS |
| drone_id | uuid NOT NULL | |
| mission_id | uuid NULL | |
| seq | bigint NOT NULL | |
| lat / lon | double precision | |
| alt_m / rel_alt_m | real | |
| speed_mps / vspeed_mps / heading_deg | real | |
| battery_pct / battery_v | real | |
| gps_fix | text | |
| satellites | smallint | |
| signal_pct | real | |
| flight_time_s | int | |
| flight_mode | text | |
| gimbal | jsonb NULL | |
| simulated | bool | |
| suspect | bool default false | |
| received_at | timestamptz | |

PK `(drone_id, time, seq)`. Index `(mission_id, time)`. Chunk interval 1 day, compression after 7 days (`segmentby drone_id`, `orderby time`). Continuous aggregates `telemetry_1s`, `telemetry_1m`. Retention per §6.

### 4.27 media — STD, SD
| Column | Type | Null | Constraint / Notes |
|---|---|---|---|
| project_id | uuid | NO | |
| site_id | uuid | YES | |
| mission_id / survey_id / asset_id | uuid | YES | |
| upload_session_id | uuid | YES | |
| type | text | NO | CHECK (`image, video, panorama, document, model_3d, pointcloud, raster, vector`) |
| status | text | NO | CHECK (`pending_upload, uploaded, scanning, processing, ready, quarantined, failed`) |
| source | text | NO | CHECK (`upload, provider_sync, frame_capture, live_recording, report`) |
| original_filename | text | NO | |
| mime_type | text | NO | detected by magic bytes |
| size_bytes | bigint | NO | |
| checksum_sha256 | bytea | YES | |
| storage_key | text | NO | `org/{org}/media/{id}/original.{ext}` |
| thumbnail_key / preview_key / hls_manifest_key / dzi_key | text | YES | |
| captured_at | timestamptz | YES | |
| location | geog(PointZ) | YES | |
| shared_with_viewers | bool | NO | false |
| link_status | text | NO | `'linked'` CHECK (`linked, needs_review`) |
| processing_error | text | YES | |
| provider_media_id | text | YES | |
| source_media_id / source_time_ms | uuid / int | YES | frame capture provenance |

Indexes: `(organization_id, project_id, captured_at DESC)`, `(organization_id, site_id, captured_at DESC)`, `(mission_id)`, `(asset_id)`, GIST `(location)`, `(organization_id, checksum_sha256)`, `(status) WHERE status <> 'ready'`.

### 4.28 media_metadata — STD
`media_id UNIQUE`, `width int`, `height int`, `duration_s numeric(10,3)`, `fps numeric(6,3)`, `codec text`, `camera_make text`, `camera_model text`, `focal_length_mm numeric(6,2)`, `sensor jsonb`, `gps_altitude_m numeric(8,2)`, `relative_altitude_m numeric(8,2)`, `gimbal_pitch/yaw/roll numeric(6,2)`, `flight_yaw numeric(6,2)`, `exif jsonb` (sanitized), `track geog(LineStringZ)` (video), `renditions jsonb`.

### 4.29 media_tags — STD
`media_id`, `tag text` (lowercase, ≤ 50), `source text CHECK (user, ai)`, `confidence numeric(4,3) NULL`, `ai_analysis_id uuid NULL`. Unique `(media_id, tag, source)`. Index `(organization_id, tag)`.

### 4.30 upload_sessions — STD
`project_id, site_id, mission_id`, `status text CHECK (active, completed, aborted, expired)`, `file_count int`, `total_bytes bigint`, `completed_count int`, `failed_count int`, `expires_at timestamptz` (7 d), `files jsonb` (per-file multipart upload IDs, part ETags, state). Index `(organization_id, created_by, status)`.

### 4.31 live_stream_sessions — STD
`mission_id`, `drone_id`, `status CHECK (starting, live, ended, failed)`, `stream_key_hash bytea`, `ingest_protocol text`, `started_at`, `ended_at`, `peak_viewers int`, `recording_media_id uuid NULL`.

### 4.32 surveys — STD, SD
`project_id, site_id`, `name`, `type CHECK (orthomosaic, topographic, volumetric, progress, inspection, as_built)`, `status CHECK (planned, capturing, uploaded, processing, processed, published, failed)`, `capture_date date`, `target_gsd_cm numeric(6,2)`, `crs text`, `processing_integration_id uuid NULL`, `processing_job_id text NULL`, `processing_error text`, `qa jsonb` (`{gcpCount, rmseX, rmseY, rmseZ, checkRmse, notes}`), `published_at`, `published_by`. Indexes `(organization_id, site_id, capture_date DESC)`.

### 4.33 survey_areas — STD, SD
`survey_id`, `name`, `geometry geog(Polygon) NOT NULL`, `area_m2 numeric(14,2)` (computed). GIST `(geometry)`.

### 4.34 maps — STD, SD
`project_id, site_id, survey_id NULL`, `name`, `type CHECK (orthomosaic, dsm, dtm, hillshade, contour, ndvi, annotation, base)`, `captured_at date`, `bounds geog(Polygon)`, `native_crs text`, `resolution_cm numeric(8,3)`, `status CHECK (processing, ready, failed)`, `cog_storage_key text`, `stats jsonb` (min/max elevation, histogram). Index `(organization_id, site_id, type, captured_at DESC)`.

### 4.35 map_layers — STD, SD
`map_id NULL`, `site_id`, `name`, `type CHECK (raster_cog, vector_geojson, vector_tiles, 3dtiles, pointcloud, wms)`, `source_key text`, `style jsonb`, `z_order int`, `visible_default bool`, `opacity numeric(3,2)`, `min_zoom/max_zoom smallint`, `layer_version int` (cache-busting).

### 4.36 annotations — STD, SD
`site_id`, `geometry geog(Geometry) NOT NULL`, `label text`, `style jsonb`, `visibility CHECK (private, project)`, `linked_entity_type/linked_entity_id`. GIST `(geometry)`.

### 4.37 twin_models — STD, SD
`project_id, site_id, survey_id NULL`, `name`, `kind CHECK (photogrammetry_mesh, bim, pointcloud, terrain)`, `format CHECK (3dtiles, glb, gltf, obj, ifc, las, laz, copc)`, `status CHECK (uploaded, converting, ready, failed)`, `captured_at date`, `source_storage_key`, `tileset_key` (root `tileset.json`), `bounds geog(Polygon)`, `transform jsonb` (georeference matrix / offsets), `lod_levels smallint`, `size_bytes bigint`, `stats jsonb` (triangles, points).

### 4.38 viewpoints — STD, SD
`site_id`, `name`, `camera jsonb` (`{lon,lat,height,heading,pitch,roll}`), `layers jsonb`, `visibility CHECK (private, project)`.

### 4.39 inspection_templates — STD, SD
`name`, `description`, `asset_types text[]`, `version int`, `status CHECK (draft, published, retired)`, `schema jsonb` (sections → items with `{id, label, type, required, options, unit, min, max, photoRequired}`), `template_group_id uuid` (all versions share it). Unique `(organization_id, template_group_id, version)`.

### 4.40 inspections — STD, SD
`project_id, site_id`, `asset_id NULL`, `mission_id NULL`, `template_id NULL`, `code` (`INS-000045`), `title`, `type CHECK (routine, safety, quality, structural, handover, incident, other)`, `status CHECK (draft, scheduled, in_progress, submitted, in_review, approved, rejected, closed, cancelled)`, `assignee_id`, `reviewer_id`, `due_date date`, `started_at`, `submitted_at`, `approved_at`, `approved_by`, `approval_reference text`, `closed_at`, `summary text`, `checklist jsonb` (snapshot + answers), `recurrence_rule text`, `parent_inspection_id uuid` (follow-ups). Indexes `(organization_id, status, due_date)`, `(assignee_id, status)`, `(asset_id)`. CHECK `reviewer_id IS DISTINCT FROM assignee_id`.

### 4.41 inspection_findings — STD, SD
`inspection_id`, `project_id`, `site_id`, `asset_id NULL`, `code` (`FND-000310`), `title`, `description`, `category CHECK (structural, safety, quality, environmental, progress, other)`, `severity CHECK (low, medium, high, critical)`, `status CHECK (open, in_progress, resolved, verified, closed, wont_fix)`, `location geog(PointZ) NULL`, `assignee_id`, `due_date date`, `resolved_at`, `resolved_by`, `resolution_notes`, `verified_at`, `verified_by`, `wont_fix_reason`, `ai_generated bool default false`, `ai_suggestion_id uuid NULL`, `ai_confidence numeric(4,3)`. Indexes `(organization_id, project_id, status, severity)`, `(assignee_id, status)`, `(due_date) WHERE status IN ('open','in_progress')`, GIST `(location)`.

### 4.42 inspection_attachments — STD
`inspection_id`, `finding_id NULL`, `media_id NOT NULL`, `annotations jsonb` (normalized shapes), `caption text`, `phase CHECK (evidence, before, after)`.

### 4.43 comments — STD, SD
`entity_type CHECK (mission, media, inspection, finding, report, progress_record, survey)`, `entity_id uuid`, `project_id uuid` (for authorization), `body text` (≤ 10,000, sanitized Markdown), `mentions uuid[]`, `parent_comment_id NULL`, `edited_at`. Index `(entity_type, entity_id, created_at)`.

### 4.44 milestones — STD, SD
`project_id`, `site_id NULL`, `parent_milestone_id NULL`, `name`, `description`, `planned_start date NOT NULL`, `planned_end date NOT NULL` (CHECK ≥ start), `actual_start date`, `actual_end date`, `weight numeric(8,3) NOT NULL CHECK (weight > 0)`, `curve CHECK (linear, s_curve)` default `linear`, `asset_ids uuid[]`, `sort_order int`, `metric_formula jsonb NULL` (PROGRESS-010). Status is **derived** by `ProgressCalculator`, not stored (a cached `computed_status` is refreshed in `mv_project_kpis`).

### 4.45 progress_records — STD (immutable once approved)
`project_id`, `site_id NULL`, `milestone_id NULL` (NULL = site/project-level record), `record_date date NOT NULL`, `percent_complete numeric(5,2) NOT NULL CHECK 0–100`, `source CHECK (manual, ai, survey)`, `ai_analysis_id NULL`, `evidence_media_ids uuid[]`, `notes`, `approval_status CHECK (pending_approval, approved, rejected)`, `approved_by`, `approved_at`, `rejection_reason`, `supersedes_id uuid NULL`. Index `(milestone_id, record_date DESC) WHERE approval_status='approved'`. Trigger blocks UPDATE when `approval_status='approved'`.

### 4.46 ai_analyses — STD
| Column | Type | Notes |
|---|---|---|
| project_id, site_id | uuid | |
| type | text | CHECK (`progress, change_detection, defect_detection, auto_tagging, report_narrative, inspection_summary`) |
| status | text | CHECK (`queued, running, completed, failed, cancelled`) |
| requested_by | uuid | |
| input_refs | jsonb | `{mediaIds, mapIds, baselineMapId, milestoneIds, surveyId}` |
| model_provider / model_id / model_version | text | |
| prompt_version | text | |
| parameters | jsonb | |
| output | jsonb | validated against the schema per type |
| confidence | numeric(4,3) | overall |
| review_status | text | CHECK (`pending, accepted, partially_accepted, rejected`) |
| reviewed_by / reviewed_at | uuid / timestamptz | |
| error_code / error_message | text | |
| input_tokens / output_tokens / gpu_seconds | int / int / numeric | |
| credits_used | numeric(10,2) | |
| started_at / completed_at | timestamptz | |

Index `(organization_id, project_id, type, created_at DESC)`, `(status) WHERE status IN ('queued','running')`.

### 4.47 ai_suggestions — STD
`ai_analysis_id`, `kind CHECK (finding, tag, progress, change)`, `payload jsonb` (e.g. bbox, class, severity proposal), `media_id NULL`, `confidence numeric(4,3)`, `decision CHECK (pending, accepted, edited, rejected)`, `decision_reason text`, `decided_by`, `decided_at`, `result_entity_type/result_entity_id`.

### 4.48 ai_conversations — STD, SD
`user_id`, `title`, `project_id NULL` (scope hint), `last_message_at`. RLS + an additional policy `user_id = current_setting('app.current_user_id')::uuid` (private to the user).

### 4.49 ai_messages — STD
`conversation_id`, `role CHECK (user, assistant, tool)`, `content jsonb`, `citations jsonb` (`[{entityType, entityId, label}]`), `tool_calls jsonb`, `input_tokens`, `output_tokens`, `model_id`.

### 4.50 ai_embeddings — STD
`entity_type`, `entity_id`, `project_id`, `chunk_index int`, `content_hash bytea`, `embedding vector(1024)`, `model_id text`. Index HNSW `(embedding vector_cosine_ops)`. Retrieval always filters `organization_id` (RLS) **and** `project_id = ANY(accessible)`.

### 4.51 report_templates — STD, SD (`organization_id` NULL = system)
`name`, `type`, `version int`, `sections jsonb`, `branding jsonb` (`{logoKey, primaryColor, headerText, footerText, coverImageKey}`), `is_default bool`, `engine_template_key text`.

### 4.52 reports — STD, SD
`project_id NULL` (null for org-level executive), `site_id`, `scope_type CHECK (project, site, inspection, survey, mission, organization)`, `scope_id uuid`, `template_id`, `template_version int`, `title`, `type CHECK (progress, inspection, survey, mission, executive, custom)`, `status CHECK (queued, generating, ready, published, failed, archived)`, `version int`, `period_start/period_end date`, `parameters jsonb`, `format CHECK (pdf, docx, xlsx, html)`, `storage_key`, `size_bytes`, `sha256 bytea`, `page_count int`, `ai_assisted bool`, `data_snapshot_at timestamptz`, `generated_by`, `generated_at`, `published_at`, `published_by`, `error_code`, `schedule_id NULL`, `report_group_id uuid` (versions share). Indexes `(organization_id, project_id, created_at DESC)`, `(report_group_id, version)`.

### 4.53 report_share_links — STD
`report_id`, `token_hash bytea UNIQUE`, `passcode_hash text NULL` (argon2id), `expires_at NOT NULL` (CHECK ≤ created_at + 30 d), `revoked_at`, `access_count int`, `last_accessed_at`.

### 4.54 report_schedules — STD, SD
`project_id`, `template_id`, `rrule text`, `timezone`, `parameters jsonb`, `recipients uuid[]`, `auto_publish bool`, `next_run_at timestamptz`, `last_run_at`, `active bool`.

### 4.55 notifications — STD (no SD; purged after 180 days)
`user_id`, `event_key`, `severity CHECK (info, warning, critical)`, `title`, `body`, `entity_type`, `entity_id`, `project_id NULL`, `data jsonb`, `dedupe_key text`, `occurrences int default 1`, `read_at`, `channels jsonb` (`{email:{status,sentAt}, push:{…}}`). Indexes `(user_id, read_at NULLS FIRST, created_at DESC)`, `(dedupe_key, created_at)`. Additional RLS: `user_id = app.current_user_id` for SELECT.

### 4.56 notification_preferences — STD
`user_id`, `category text`, `channels jsonb` (`{inApp:true,email:true,push:false}`), `digest bool`. Unique `(organization_id, user_id, category)`.

### 4.57 notification_rules — STD, SD
`name`, `event_keys text[]`, `project_ids uuid[] NULL`, `min_severity`, `channel CHECK (slack, teams, email_list)`, `integration_id`, `target text` (channel ID / list), `quiet_hours jsonb`, `active bool`.

### 4.58 push_subscriptions — STD
`user_id`, `endpoint text UNIQUE`, `p256dh text`, `auth text`, `user_agent`, `last_success_at`, `failure_count`.

### 4.59 domain_events — outbox, append-only
`id, organization_id, event_type, aggregate_type, aggregate_id, payload jsonb, actor_user_id, occurred_at, published_at NULL, attempts int`. Index `(published_at) WHERE published_at IS NULL`. Purge published rows after 7 days.

### 4.60 audit_logs — append-only, partitioned monthly
See [Audit Logging §4](../07-Security/Audit-Logging.md#4-event-schema). Columns: `id, organization_id, occurred_at, actor_type, actor_id, actor_label, impersonator_id, action, entity_type, entity_id, project_id, request_id, ip inet, user_agent, changes jsonb, metadata jsonb, prev_hash bytea, hash bytea`. PK `(organization_id, occurred_at, id)`. Indexes `(organization_id, occurred_at DESC)`, `(organization_id, entity_type, entity_id)`, `(organization_id, actor_id, occurred_at DESC)`, `(organization_id, action)`. Grants: `app_user` INSERT, SELECT only.

### 4.61 integrations — STD, SD
`provider text` (`dji_cloud, mavlink_bridge, skydio, nodeodm, pix4d, dronedeploy, procore, autodesk_acc, slack, teams, oidc, saml, scim, weather`), `category CHECK (drone, processing, construction, collaboration, identity, data)`, `name`, `status CHECK (pending, connected, error, disabled)`, `config jsonb` (non-secret), `credentials_secret_ref text` (secrets manager ARN/path), `oauth_expires_at`, `last_sync_at`, `last_success_at`, `last_error`, `consecutive_failures int`. Unique `(organization_id, provider, name) WHERE deleted_at IS NULL`.

### 4.62 webhooks — STD, SD
`url text` (https only), `secret_ref text`, `event_types text[]`, `project_ids uuid[] NULL`, `active bool`, `consecutive_failures int`, `disabled_reason text`.

### 4.63 webhook_deliveries — append-only, 30-day retention
`webhook_id`, `event_id`, `attempt int`, `status_code int`, `duration_ms int`, `response_snippet text` (≤ 1 KB), `error text`, `delivered_at`, `next_retry_at`.

### 4.64 api_keys — STD
`name`, `prefix text` (first 8 chars, shown in UI), `key_hash bytea UNIQUE` (SHA-256 of a 32-byte secret), `permissions text[]`, `project_ids uuid[] NULL`, `expires_at`, `last_used_at`, `last_used_ip`, `revoked_at`, `acts_as_user_id uuid NULL` (audit attribution).

### 4.65 plans (global)
`id, key UNIQUE, name, price_monthly_minor bigint, currency, limits jsonb` (`{seats, activeProjects, storageGb, aiCreditsMonthly, videoMinutesMonthly, customRoles, sso, retentionMaxDays}`), `features text[]`, `provider_price_ids jsonb`, `active bool`.

### 4.66 subscriptions — STD
`plan_id`, `status CHECK (trialing, active, past_due, read_only, cancelled)`, `provider text`, `provider_customer_id`, `provider_subscription_id UNIQUE`, `seats int`, `current_period_start/end`, `trial_ends_at`, `cancel_at`, `grace_ends_at`, `custom_limits jsonb NULL`. Unique `(organization_id)`.

### 4.67 usage_records — append-only
`metric CHECK (storage_gb_hours, ai_credits, flight_minutes, video_processing_minutes, live_video_minutes, seats)`, `quantity numeric(16,4)`, `period_start/period_end timestamptz`, `source_ref text`, `reported_to_provider_at`. Index `(organization_id, metric, period_start)`. Unique `(organization_id, metric, period_start, source_ref)` (idempotent aggregation).

### 4.68 retention_policies — STD
`data_class CHECK (raw_media, processed_media, video, telemetry, audit_logs, reports, notifications, ai_conversations, deleted_items)`, `retention_days int` (within plan bounds; audit ≥ 365), `action CHECK (delete, archive)`, `applies_to_project_id NULL`. Unique `(organization_id, data_class, applies_to_project_id)`.

### 4.69 legal_holds — STD
`project_id NULL` (null = whole org), `reason`, `placed_by`, `placed_at`, `released_at`, `released_by`. Retention enforcement skips rows under an active hold.

### 4.70 idempotency_keys — STD (TTL 24 h)
`key text`, `user_id`, `method`, `path`, `request_hash bytea`, `response_status int`, `response_body jsonb`, `expires_at`. Unique `(organization_id, user_id, key)`.

---

## 5. Platform Schema (admin realm)

| Table | Purpose | Key columns |
|---|---|---|
| `platform.staff_users` | Staff identities | email, role (`platform_admin, support, sre`), webauthn required |
| `platform.staff_sessions` | Staff sessions | short-lived (8 h), IP-bound |
| `platform.break_glass_sessions` | Tenant access grants | staff_user_id, organization_id, ticket_ref, justification, approved_by, starts_at, ends_at (≤ 4 h), scope (`read_only`) |
| `platform.feature_flags` | Flags | key, description, rules jsonb (org IDs, plans, percentage) |
| `platform.audit_logs` | Staff actions | same schema as tenant audit, retained 7 years, Object-Lock export |

## 6. Data Lifecycle & Retention Defaults

| Data | Default retention | Configurable (plan bounds) |
|---|---|---|
| Original media | Life of project + 1 year after archive | 90 days – unlimited |
| Derivatives (thumbnails, HLS) | Same as original | — (follows original) |
| Telemetry full rate | 30 days | 7 – 365 days |
| Telemetry 1 s aggregate | 365 days | 30 days – 7 years |
| Audit logs | 1 year (Starter/Pro), 7 years (Enterprise) | min 1 year |
| Notifications | 180 days | — |
| Soft-deleted items | 30 days | 7 – 90 days |
| AI conversations | 90 days | 0 – 365 days |
| Reports | Life of project | — |
| Webhook deliveries | 30 days | — |
| Domain events (published) | 7 days | — |

## 7. Performance & Maintenance

- `pg_stat_statements` reviewed weekly. Slow-query threshold 200 ms logged.
- Autovacuum tuned for high-churn tables (`notifications`, `domain_events`, `idempotency_keys`).
- Partition maintenance (`pg_partman` for `audit_logs`; Timescale policies for `telemetry`).
- Read replica for analytics materialized views and report data collection.
- Connection pooling: RDS Proxy / PgBouncer in **transaction** mode. Pool size per pod 10. Max 400 server connections.

## 8. Materialized Views (analytics schema)

| View | Purpose | Refresh |
|---|---|---|
| `analytics.mv_project_kpis` | % complete, SV, counts per project | Every 15 min + on `progress.approved` (debounced) |
| `analytics.mv_flight_stats` | Flights, hours, aborts per drone/pilot/day | Hourly |
| `analytics.mv_finding_stats` | Findings by severity/status/age per project | Every 15 min |
| `analytics.mv_storage_usage` | Bytes per org/project/type | Hourly |

All views include `organization_id` and are exposed through RLS-protected security-barrier views.
