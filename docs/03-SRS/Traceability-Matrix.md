# Requirements Traceability Matrix (RTM)

| | |
|---|---|
| **Document** | Requirements Traceability Matrix |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-RTM |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product & QA |
| **Reviewer** | _Pending — QA Lead, Product Owner_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product & QA | Initial matrix (module-level + critical requirement-level) |

---

## 1. Traceability Chain

```text
BRD Requirement (BR-NN)
      ↓
PRD Feature (FEAT-<MOD>)
      ↓
SRS Requirement (<MOD>-NNN, NFR-*, SEC-*, PRIV-*)
      ↓
Implementation: API endpoint · DB table · UI screen
      ↓
Test Case (TC-<MOD>-NNN)
      ↓
Acceptance Criterion (AC-<MOD>-NN) → Acceptance Result
```

## 2. How the matrix is maintained

1. **Source of truth for test ↔ requirement links** is the test code itself. Every automated test is tagged with the requirement IDs it verifies:
   ```ts
   it('rotates refresh token and detects reuse @req:AUTH-006 @tc:TC-AUTH-005', ...)
   ```
2. A CI script (`scripts/rtm/generate.ts`, planned) parses tags, joins them with the requirement catalog ([Functional Requirements](Functional-Requirements.md)) and test-run results (JUnit XML), and regenerates `§4` as `Traceability-Matrix.generated.md`.
3. The release gate ([Release Checklist](../12-DevOps/Release-Checklist.md)) requires **every Must requirement in the release phase** to have ≥ 1 linked test case with status `Pass`.
4. Until the codebase exists, every **Result** is `Not run` and every **Implementation** column describes the *designed* artifact.

## 3. Module-Level Matrix

| BR | Feature | SRS requirements | API (primary) | DB tables | UI screens | Test cases | Acceptance | Result |
|---|---|---|---|---|---|---|---|---|
| BR-02, BR-17 | FEAT-AUTH | AUTH-001–020 | `/auth/*`, `/me` | users, refresh_tokens, mfa_recovery_codes, email_verification_tokens, password_reset_tokens | Login, Signup, 2FA, Settings › Security | TC-AUTH-001–015 | AC-AUTH-01–08 | Not run |
| BR-01, BR-02 | FEAT-ORG | ORG-001–012 | `/organizations/*` | organizations, organization_members, retention_policies | Onboarding, Settings | TC-ORG-001–006 | AC-ORG-01–05 | Not run |
| BR-02 | (cross-cutting) | TENANT-001–008, NFR-SEC-001 | all | all tenant tables (RLS) | all | TC-TENANT-001–012 | AC-TENANT-01–03 | Not run |
| BR-03 | FEAT-RBAC | RBAC-001–012 | `/members`, `/invitations`, `/roles`, `/permissions`, `/me/permissions` | roles, permissions, role_permissions, user_roles, project_members, invitations | Team, Roles | TC-RBAC-001–012 | AC-RBAC-01–06 | Not run |
| BR-04 | FEAT-PROJECT | PROJECT-001–012 | `/projects/*` | projects, project_members | Projects, Project Detail | TC-PROJECT-001–006 | AC-PROJECT-01–04 | Not run |
| BR-04 | FEAT-SITE | SITE-001–012 | `/sites/*` | sites, site_members, site_no_fly_zones | Sites, Site Detail | TC-SITE-001–006 | AC-SITE-01–04 | Not run |
| BR-04, BR-09 | FEAT-ASSET | ASSET-001–010 | `/assets/*` | assets | Site › Assets, Asset drawer | TC-ASSET-001–004 | AC-ASSET-01–03 | Not run |
| BR-05 | FEAT-DRONE | DRONE-001–014 | `/drones/*`, `/pilots/*` | drones, drone_pilots, drone_maintenance_logs | Drone Fleet, Drone Detail | TC-DRONE-001–008 | AC-DRONE-01–04 | Not run |
| BR-05 | FEAT-MISSION | MISSION-001–020 | `/missions/*` | drone_missions, mission_waypoints, mission_events | Missions, Mission Planner, Mission Detail | TC-MISSION-001–012 | AC-MISSION-01–07 | Not run |
| BR-06 | FEAT-TELEM | TELEM-001–012, NFR-PERF-004 | `/realtime/ticket`, WS, `/missions/:id/telemetry` | telemetry | Live Operations | TC-TELEM-001–008, PT-03 | AC-TELEM-01–04 | Not run |
| BR-06, BR-07 | FEAT-VIDEO | VIDEO-001–010 | `/media/:id/playback`, `/live-streams/*` | media, live_stream_sessions | Media player, Live Ops | TC-VIDEO-001–005 | AC-VIDEO-01–03 | Not run |
| BR-07 | FEAT-MEDIA | MEDIA-001–016 | `/media/*` | media, media_metadata, media_tags, upload_sessions | Media | TC-MEDIA-001–010 | AC-MEDIA-01–06 | Not run |
| BR-07, BR-08 | FEAT-SURVEY | SURVEY-001–010 | `/surveys/*` | surveys, survey_areas, maps, map_layers | Survey | TC-SURVEY-001–005 | AC-SURVEY-01–03 | Not run |
| BR-08 | FEAT-MAP | MAP-001–014 | `/maps`, `/map-layers`, `/tiles/*`, `/annotations` | maps, map_layers, annotations | Maps | TC-MAP-001–006 | AC-MAP-01–04 | Not run |
| BR-08 | FEAT-TWIN | TWIN-001–012 | `/twin/*` | twin_models, viewpoints | 3D Digital Twin | TC-TWIN-001–004 | AC-TWIN-01–04 | Not run |
| BR-09 | FEAT-INSPECTION | INSPECTION-001–016 | `/inspections/*`, `/findings/*`, `/inspection-templates/*` | inspection_templates, inspections, inspection_findings, inspection_attachments | Inspections | TC-INSPECTION-001–010 | AC-INSPECTION-01–06 | Not run |
| BR-10 | FEAT-PROGRESS | PROGRESS-001–012 | `/projects/:id/progress`, `/milestones`, `/progress-records` | milestones, progress_records | Progress | TC-PROGRESS-001–006 | AC-PROGRESS-01–05 | Not run |
| BR-11 | FEAT-AI | AI-001–016 | `/ai/*` | ai_analyses, ai_suggestions, ai_conversations, ai_messages | AI review, Assistant | TC-AI-001–010 | AC-AI-01–05 | Not run |
| BR-12 | FEAT-REPORT | REPORT-001–012 | `/reports/*`, `/report-templates/*` | reports, report_templates, report_share_links, report_schedules | Reports | TC-REPORT-001–008 | AC-REPORT-01–05 | Not run |
| BR-13 | FEAT-NOTIF | NOTIF-001–010 | `/notifications/*` | notifications, notification_preferences, notification_rules, domain_events | Bell, Notifications | TC-NOTIF-001–005 | AC-NOTIF-01–04 | Not run |
| BR-14 | FEAT-AUDIT | AUDIT-001–010 | `/audit-logs` | audit_logs | Audit Logs | TC-AUDIT-001–005 | AC-AUDIT-01–03 | Not run |
| BR-18 | FEAT-ANALYTICS | ANALYTICS-001–008 | `/analytics/*` | mv_* views | Analytics | TC-ANALYTICS-001–003 | AC-ANALYTICS-01–02 | Not run |
| BR-16 | FEAT-INTEG | INTEG-001–010 | `/integrations/*`, `/webhooks/*`, `/api-keys/*` | integrations, webhooks, webhook_deliveries, api_keys | Integrations | TC-INTEG-001–004 | AC-INTEG-01–03 | Not run |
| BR-15 | FEAT-BILLING | BILLING-001–010 | `/billing/*` | plans, subscriptions, usage_records | Billing | TC-BILLING-001–005 | AC-BILLING-01–03 | Not run |
| BR-02, BR-17 | FEAT-ADMIN | ADMIN-001–010 | `/admin/v1/*` | (platform schema) | Admin console | TC-ADMIN-001–005 | AC-ADMIN-01–03 | Not run |
| BR-17 | NFR | NFR-PERF-*, NFR-AVAIL-* | — | — | — | PT-01 – PT-10 | — | Not run |
| BR-14 | Privacy | PRIV-001–012 | `/me/export`, `/organizations/current/export` | retention_policies, legal_holds | Settings › Data | TC-PRIV-001–005 | — | Not run |

## 4. Requirement-Level Matrix — Critical Phase 1 Requirements

| SRS ID | BR | Implementation (designed) | Test case(s) | AC | Result |
|---|---|---|---|---|---|
| AUTH-003 | BR-17 | `auth/password.service.ts` argon2id | TC-AUTH-003 | AC-AUTH-01 | Not run |
| AUTH-005 | BR-17 | `POST /auth/login`; JWT ES256 signer | TC-AUTH-004 | AC-AUTH-02 | Not run |
| AUTH-006 | BR-17 | `refresh_tokens.family_id` reuse detection | TC-AUTH-005, TC-AUTH-006 | AC-AUTH-03 | Not run |
| AUTH-007 | BR-17 | Redis counters `auth:fail:{email}` / `{ip}` | TC-AUTH-007 | AC-AUTH-04 | Not run |
| AUTH-009/010 | BR-17 | `/auth/mfa/*` TOTP | TC-AUTH-009, TC-AUTH-010 | AC-AUTH-05 | Not run |
| AUTH-014 | BR-02 | `SessionRevocationService` + WS kick via Redis pub/sub | TC-AUTH-013 | AC-RBAC-05 | Not run |
| TENANT-002 | BR-02 | RLS policies in migration `0002_rls.sql` | TC-TENANT-001, TC-TENANT-002 | AC-TENANT-01 | Not run |
| TENANT-003 | BR-02 | `TenantContextInterceptor` | TC-TENANT-003 | AC-TENANT-01 | Not run |
| TENANT-004 | BR-02 | Repository returns null → 404 | TC-TENANT-004 | AC-TENANT-02 | Not run |
| TENANT-005 | BR-02 | `StorageService.signUrl()` | TC-TENANT-006 | AC-TENANT-02 | Not run |
| TENANT-006 | BR-02 | `RealtimeAuthorizer.canSubscribe()` | TC-TENANT-007 | AC-TENANT-03 | Not run |
| TENANT-007 | BR-02 | `TenantJob` base class | TC-TENANT-008 | AC-TENANT-01 | Not run |
| RBAC-006 | BR-17 | `RoleService.assertNoEscalation()` | TC-RBAC-006 | AC-RBAC-03 | Not run |
| RBAC-008 | BR-03 | `PolicyEngine.can(user, perm, resource)` | TC-RBAC-001–004 | AC-RBAC-01 | Not run |
| RBAC-010 | BR-03 | Project membership filter in repositories | TC-RBAC-008, TC-RBAC-009 | AC-RBAC-04 | Not run |
| SITE-002 | BR-04 | `ST_IsValid` + zod geometry schema | TC-SITE-002 | AC-SITE-02 | Not run |
| MISSION-004 | BR-05 | `MissionValidator` (PostGIS `ST_Within`, buffer) | TC-MISSION-003, TC-MISSION-004 | AC-MISSION-02 | Not run |
| MISSION-010 | BR-05 | `MissionStateMachine` (XState-style table) | TC-MISSION-006 | AC-MISSION-04 | Not run |
| MISSION-011 | BR-05 | Checklist gate on `/start` | TC-MISSION-007 | AC-MISSION-05 | Not run |
| TELEM-002 | BR-06 | `TelemetryValidator` (zod + range rules) | TC-TELEM-002 | AC-TELEM-02 | Not run |
| TELEM-006 | BR-06 | `AlertEvaluator` stream consumer | TC-TELEM-004, TC-TELEM-005 | AC-TELEM-03 | Not run |
| MEDIA-001 | BR-07 | `/media/uploads` multipart presign | TC-MEDIA-001, TC-MEDIA-002 | AC-MEDIA-01 | Not run |
| MEDIA-003 | BR-17 | ClamAV scan worker, quarantine bucket | TC-MEDIA-004 | AC-MEDIA-03 | Not run |
| MEDIA-006 | BR-07 | `MediaLinker` (time window + `ST_Covers`) | TC-MEDIA-005 | AC-MEDIA-04 | Not run |
| PROGRESS-006 | BR-10 | `ProgressCalculator` | TC-PROGRESS-002, TC-PROGRESS-003 | AC-PROGRESS-02 | Not run |
| REPORT-005 | BR-03 | Report worker uses requester's `PolicyEngine` snapshot | TC-REPORT-004 | AC-REPORT-03 | Not run |
| AUDIT-003 | BR-14 | Audit insert in the same transaction (`AuditInterceptor`) | TC-AUDIT-001 | AC-AUDIT-01 | Not run |
| AUDIT-004 | BR-14 | DB grants + hash chain trigger | TC-AUDIT-002, TC-AUDIT-003 | AC-AUDIT-02 | Not run |
| AI-010 | BR-02 | Assistant tools call API services with the user's `AuthContext` | TC-AI-005, TC-AI-006 | AC-AI-03 | Not run (Phase 2) |
| NOTIF-002 | BR-02 | Recipient authorization in the notification worker | TC-NOTIF-002 | AC-NOTIF-02 | Not run |

## 5. Coverage Summary (to be auto-generated)

| Phase | Must reqs | With ≥ 1 test | Passing | Coverage |
|---|---|---|---|---|
| Phase 1 | _computed_ | 0 | 0 | 0% (pre-implementation) |
| Phase 2 | _computed_ | 0 | 0 | 0% |
