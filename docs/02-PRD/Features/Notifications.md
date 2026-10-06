# Notification Specification

| | |
|---|---|
| **Document** | Notification Specification |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-23 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product Team |
| **Reviewer** | _Pending — Product Owner, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product Team | Initial draft |

---

## 1. Purpose

Deliver the right event to the right authorized person on the right channel, without noise.

**BR:** BR-13 · **Feature:** FEAT-NOTIF · **Requirements:** NOTIF-001 – NOTIF-010 · **Phase:** 1 (in-app + transactional email), 2 (preferences, digests, Slack/Teams, web push).

## 2. Channels

| Channel | Phase | Technology | Notes |
|---|---|---|---|
| In-app (bell + toast) | 1 | WebSocket `user.notifications` + REST list | Source of truth. Every notification is stored. |
| Email | 1 | Transactional email provider (e.g. Amazon SES / Postmark) via the `notify.email` queue | MJML templates. Link-only for sensitive content (no media embedded). |
| Web push | 2 | Web Push (VAPID) | Opt-in per browser. |
| Slack / Microsoft Teams | 2 | Incoming webhook / app via an org integration | Channel-level, not per-user. Content minimized (title + deep link). |
| SMS | Future | — | Critical alerts only. |

## 3. Event Catalog

| Event key | Trigger | Default recipients | Default channels | Severity |
|---|---|---|---|---|
| `invitation.received` | Invite sent | Invitee | Email | info |
| `member.joined` | Invite accepted | Admins | In-app | info |
| `mission.assigned` | Pilot assigned | Pilot | In-app, Email | info |
| `mission.approval_requested` | Mission submitted | Approvers on project | In-app, Email | info |
| `mission.approved` / `mission.rejected` | Decision | Creator, Pilot | In-app, Email | info |
| `mission.starting_soon` | 60 min before scheduled start | Pilot, Site Manager | In-app | info |
| `mission.started` / `mission.completed` / `mission.aborted` | State change | PM, Site Manager | In-app | info / warning (aborted) |
| `telemetry.battery_low` | Battery ≤ 30% (warning) / ≤ 20% (critical) | Pilot, live viewers | In-app toast | warning / critical |
| `telemetry.geofence_breach` | Position outside boundary + buffer | Pilot, Site Manager, live viewers | In-app toast, Email | critical |
| `telemetry.signal_lost` | No telemetry > 10 s | Pilot, live viewers | In-app toast | warning |
| `media.batch_processed` | Upload batch ready | Uploader | In-app | info |
| `media.quarantined` | Malware detected | Uploader, Admins | In-app, Email | critical |
| `survey.processing_completed` / `_failed` | Processing job | Survey creator | In-app, Email | info / warning |
| `inspection.assigned` | Assigned | Assignee | In-app, Email | info |
| `inspection.submitted` | Submitted | Reviewer | In-app, Email | info |
| `inspection.approved` / `_rejected` | Decision | Inspector, PM | In-app, Email | info |
| `finding.created` (critical/high) | New finding | Site Manager, PM, Engineer on project | In-app, Email, Chat | critical / warning |
| `finding.assigned` | Assigned | Assignee | In-app, Email | info |
| `finding.overdue` | Past due date (daily 08:00 site time) | Assignee, Site Manager | In-app, Email digest | warning |
| `progress.approval_requested` | Pending record | Approvers | In-app | info |
| `progress.status_changed` | Milestone → At risk / Delayed | PM, Owner | In-app, Email | warning |
| `ai.analysis_completed` / `_failed` | AI job | Requester | In-app | info |
| `report.ready` / `report.failed` | Generation | Requester | In-app, Email | info |
| `report.published` | Published | Project Viewers | In-app, Email | info |
| `comment.mention` | @mention | Mentioned user (if they can view the entity) | In-app, Email | info |
| `drone.registration_expiring` / `pilot.license_expiring` | 30/7/0 days | Pilot, Admins | In-app, Email | warning |
| `billing.usage_threshold` | 80% / 100% of a limit | Owner, billing admins | In-app, Email | warning |
| `billing.payment_failed` | Provider webhook | Owner | Email | critical |
| `security.new_login` | Login from a new device/location | User | Email | info |
| `security.refresh_token_reuse` | Reuse detected | User, Admins | Email | critical |
| `security.break_glass_started` / `_ended` | Platform staff access | Owner | Email | critical |
| `integration.failing` | Integration/webhook auto-disabled | Admins | In-app, Email | warning |

## 4. Functional Requirements

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| NOTIF-001 | Domain services emit events to the outbox (`domain_events` table, transactional outbox). The notification worker fans out to recipients. | Must | 1 |
| NOTIF-002 | **Recipients are re-authorized at send time.** A recipient must hold read permission on the entity. Otherwise the notification is dropped. | Must | 1 |
| NOTIF-003 | In-app notifications are stored, listed (paginated) and marked read/unread individually or in bulk. Unread count is pushed via WebSocket. | Must | 1 |
| NOTIF-004 | Critical notifications are delivered in-app within 5 s (p95) and by email within 60 s (p95) of the event. | Must | 1 |
| NOTIF-005 | Users set preferences per event category × channel. Security and billing-critical events cannot be disabled. | Should | 2 |
| NOTIF-006 | Admins configure org rules: route categories to Slack/Teams channels per project, set quiet hours per site, and set SLA-escalation recipients. | Should | 2 |
| NOTIF-007 | Digest: low-priority events are batched into a daily email at 08:00 user-local time. | Should | 2 |
| NOTIF-008 | Deduplication: identical `(event_key, entity_id, recipient)` within 10 minutes (e.g. repeated battery warnings) collapse into one notification with a counter. | Must | 1 |
| NOTIF-009 | Email contains no sensitive content beyond title and deep link. Unsubscribe link per category (except mandatory). List-Unsubscribe header. | Must | 1 |
| NOTIF-010 | Delivery status (`queued, sent, delivered, bounced, failed`) is tracked per channel. Hard bounces disable email for that user and alert the Admin. | Should | 2 |

## 5. Architecture

```text
Domain transaction ──writes──► domain_events (outbox, same TX)
Outbox relay (poll 500 ms / LISTEN-NOTIFY) ──► Redis Stream "events"
Notification worker:
   resolve recipients (rules + preferences) → authorize each (PolicyEngine)
   → dedupe (Redis SET NX with TTL) → persist notifications row
   → publish WS (user channel) → enqueue email/push/chat jobs (retry 5× exp. backoff)
```

## 6. Data

`notifications`, `notification_preferences`, `notification_rules`, `domain_events`. See [Database Design](../../05-Database/Database-Design.md).

## 7. UI

- Bell icon with unread badge (99+ cap). Dropdown with the latest 20, grouped Today / Earlier. "Mark all read".
- **Notifications page:** filters by category, severity, read state.
- **Toasts:** critical = persistent until dismissed (red), warning = 8 s (amber), info = 5 s.
- **Settings → Notifications:** matrix of categories × channels with toggles. Mandatory rows are locked with an explanation.

## 8. API

`GET /notifications?unread=true&cursor=`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET/PUT /me/notification-preferences`, `GET/POST /notification-rules`, `PATCH/DELETE /notification-rules/:id`, `POST /me/push-subscriptions`.

## 9. Acceptance Criteria

See [AC-NOTIF-01 – AC-NOTIF-04](../../11-QA/Acceptance-Criteria.md#notifications).
