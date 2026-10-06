# Audit Logging Specification

| | |
|---|---|
| **Document** | Audit Logging Specification |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-24 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Security |
| **Reviewer** | _Pending — Security Engineer, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Security | Initial draft |

---

## 1. Purpose

Audit logs answer **who did what, to which object, when, from where, and what changed**. They support customer investigations, contractual disputes, regulatory evidence and security monitoring. Requirements: AUDIT-001 – AUDIT-010, SEC-053.

Audit logs are **not** application debug logs (see [Monitoring](../12-DevOps/Monitoring.md)). They are tenant-visible, durable and tamper-evident.

## 2. What Is Audited

| Category | Actions (examples — `entity.verb`) |
|---|---|
| Authentication | `auth.login_succeeded`, `auth.login_failed` (per account, aggregated), `auth.logout`, `auth.mfa_enabled`, `auth.mfa_disabled`, `auth.password_changed`, `auth.password_reset`, `auth.refresh_reuse_detected`, `auth.session_revoked`, `auth.org_switched`, `auth.sso_login` |
| Organization | `org.updated`, `org.settings_changed`, `org.logo_changed`, `org.export_requested`, `org.deletion_scheduled`, `org.deletion_cancelled`, `org.ownership_transferred`, `retention.policy_changed`, `legal_hold.placed`, `legal_hold.released` |
| Team & access | `member.invited`, `member.joined`, `member.role_changed`, `member.deactivated`, `member.removed`, `role.created`, `role.updated`, `role.deleted`, `project_member.added/removed/role_changed`, `api_key.created/revoked`, `access.denied` (sampled, see §6) |
| Projects/sites/assets | `project.created/updated/archived/restored/deleted`, `site.*`, `asset.*`, `no_fly_zone.*` |
| Fleet | `drone.registered/updated/status_changed/retired`, `drone.maintenance_logged`, `pilot.created/updated`, `assignment.override` (expired license/registration override with reason) |
| Missions | `mission.created/updated/submitted/approved/rejected/started/paused/resumed/completed/aborted/cancelled`, `mission.checklist_completed`, `mission.command_sent` (provider commands), `mission.exported` |
| Media | `media.uploaded`, `media.updated`, `media.shared/unshared`, `media.downloaded`, `media.bulk_downloaded`, `media.deleted/restored/purged`, `media.quarantined` |
| Live | `live_stream.viewed` (start/end per viewer), `telemetry.replayed` (sampled) |
| Surveys/maps/twin | `survey.*`, `survey.published`, `map_layer.*`, `twin_model.*` |
| Inspections | `inspection.created/assigned/started/submitted/approved/rejected/closed`, `finding.created/updated/resolved/verified/reopened/closed/wont_fix` |
| Progress | `milestone.*`, `progress.recorded/approved/rejected` |
| AI | `ai.analysis_requested`, `ai.suggestion_decided`, `ai.assistant_conversation_created` (content not logged in audit) |
| Reports | `report.generated/published/downloaded/archived`, `report.share_link_created/revoked/accessed` |
| Integrations | `integration.connected/updated/disconnected/test_failed`, `webhook.created/updated/disabled` |
| Billing | `subscription.changed`, `billing.portal_opened` |
| Platform staff | `staff.break_glass_started/ended`, `staff.org_suspended/reactivated`, `staff.user_locked`, `staff.mfa_reset`, `staff.subscription_overridden` (also in the tenant log with `actor_type=platform_staff`) |

**Not audited:** pure reads of non-sensitive data (list/detail views), except downloads, exports, live viewing and break-glass reads, which are always audited.

## 3. Capture Mechanism

```text
Mutating request ─► Controller ─► Service (business TX)
                                     │
                                     ├─ domain changes
                                     ├─ AuditService.record({...})  ◄── same transaction (AUDIT-003)
                                     └─ Outbox event
COMMIT ─ all or nothing
```

- `@Audited('mission.started', { entity: 'mission', diff: true })` decorator + explicit `AuditService.record()` for complex flows.
- **Diff:** `changes = { field: [old, new] }` for changed fields only. Redaction list: `password*`, `*Secret*`, `*token*`, `mfa*`, `credentials*`, `passcode*`. Large fields (geometry > 10 KB, JSON > 10 KB) are replaced with `{hash, sizeBytes}`.
- Background/system actions: `actor_type = system`, `actor_label = job name`.
- Auth events that happen outside a tenant context (failed login for unknown email) go to the platform security log, not tenant audit.

## 4. Event Schema

| Field | Type | Description |
|---|---|---|
| `id` | uuid (v7) | Event ID |
| `organization_id` | uuid | Tenant |
| `occurred_at` | timestamptz | Server time (UTC, μs) |
| `actor_type` | text | `user, api_key, system, platform_staff, share_link` |
| `actor_id` | uuid | User/API key/staff ID |
| `actor_label` | text | Name/email at the time (denormalized for readability after user deletion) |
| `impersonator_id` | uuid | Staff ID during break-glass |
| `action` | text | `entity.verb` |
| `entity_type` / `entity_id` | text / uuid | Target |
| `project_id` | uuid | For project-scoped filtering |
| `request_id` | text | Correlates with traces |
| `ip` | inet | Client IP (from a trusted proxy header chain) |
| `user_agent` | text | Truncated to 512 chars |
| `changes` | jsonb | Redacted diff |
| `metadata` | jsonb | Context (reason codes, ticket refs, counts) |
| `prev_hash` | bytea | Hash of the previous event in this org's chain |
| `hash` | bytea | `SHA-256(prev_hash ‖ canonical_json(event without hash))` |

Example:
```json
{ "id": "0192b4…", "organizationId": "0192a0…", "occurredAt": "2026-10-08T05:03:12.481Z",
  "actorType": "user", "actorId": "0192a1…", "actorLabel": "Diego Ruiz <diego@buildco.com>",
  "action": "mission.started", "entityType": "mission", "entityId": "0192a1d0…", "projectId": "0192a0f9…",
  "requestId": "01J9Z4…", "ip": "94.200.12.7", "userAgent": "Mozilla/5.0 …",
  "changes": { "status": ["ready", "in_progress"], "actualStart": [null, "2026-10-08T05:03:12Z"] },
  "metadata": { "executionMode": "logical", "isSimulated": false } }
```

## 5. Integrity & Immutability

1. `app_user` has only `INSERT, SELECT` on `audit_logs`. No `UPDATE/DELETE`. Partitions are dropped only by `app_migrator` through the retention job, which itself writes `audit.partition_purged` to the platform log.
2. **Hash chain per organization** computed in a `BEFORE INSERT` trigger with `pg_advisory_xact_lock(hashtext(org_id))` to serialize the chain per org. (Throughput: thousands per second per org is sufficient. Revisit if contention is observed.)
3. **Daily verification job** (AUDIT-010) recomputes chains for the previous day and alerts on mismatch.
4. **Daily export** of the previous day's audit partition to S3 with **Object Lock (compliance mode)** for the retention period → an independent tamper-evident copy.
5. Enterprise: SIEM streaming (AUDIT-008) via webhook or S3 export to the customer bucket.

## 6. Volume Controls

- `access.denied` events are sampled: the first 10 per (actor, action) per hour are recorded in full, then a counter summary event is written hourly.
- `auth.login_failed` events are aggregated per account per 15 min.
- `telemetry.replayed` is sampled 1 per user per mission per day.

## 7. Access & UI

- **Settings → Audit Logs** (`audit:read`): table (time, actor, action, entity link, project, IP) with filters (actor, action group, entity type/ID, project, date range, IP). Row drawer shows the diff and metadata.
- Entity pages show a **History** tab built from audit events filtered by entity (respecting the viewer's read permission on the entity, not requiring `audit:read`).
- Export (AUDIT-006): CSV/JSONL, async, signed link, and the export itself is audited.
- Platform staff view tenant audit logs only via break-glass. Platform audit (`platform.audit_logs`) is visible to platform admins only.

## 8. Retention

Default 1 year (Starter/Professional), configurable up to 7 years (Enterprise). Minimum 1 year. Partitions are monthly. Retention drops whole partitions after the export to Object Lock storage is verified.

## 9. Tests

TC-AUDIT-001 (same-transaction rollback), TC-AUDIT-002 (no update/delete grants), TC-AUDIT-003 (hash-chain tamper detection), TC-AUDIT-004 (redaction), TC-AUDIT-005 (export + permission).
