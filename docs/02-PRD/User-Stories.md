# User Stories

| | |
|---|---|
| **Document** | User Stories |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-36 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product Team |
| **Reviewer** | _Pending — Product Owner, QA Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product Team | Initial backlog of 70 stories |

---

## Conventions

- Format: *As a **role**, I want **capability** so that **benefit**.*
- Each story has an ID `US-<MOD>-NN`, a priority (MoSCoW), a phase, linked functional requirements (FR), and acceptance criteria.
- Story points are estimated in refinement and are not recorded here.
- Formal Given/When/Then criteria for major modules are in [Acceptance Criteria](../11-QA/Acceptance-Criteria.md).

---

## 1. Organization Owner

### US-ORG-01 — Create projects
As an organization owner, I want to create projects so that I can manage multiple construction projects.
**Priority:** Must · **Phase:** 1 · **FR:** PROJECT-001 – PROJECT-006
**Acceptance criteria**
- Owner can create a project with name, unique code, type, dates and location.
- Owner can edit any project field. Changes are audited.
- Owner can assign team members with a project role.
- Owner can create sites inside the project.
- Owner can view project analytics (progress, flights, findings).

### US-ORG-02 — Onboard my organization
As an organization owner, I want a guided setup so that my team can start using the platform on day one.
**Priority:** Must · **Phase:** 1 · **FR:** ORG-001 – ORG-004
**Acceptance criteria**
- After email verification, a wizard collects org profile, invites, first project and first drone. Each step is skippable.
- A "Getting started" checklist stays on the dashboard until all items are completed or it is dismissed.

### US-ORG-03 — Manage subscription
As an organization owner, I want to see my plan, usage and invoices so that I can control cost.
**Priority:** Must · **Phase:** 1 · **FR:** BILLING-001 – BILLING-006
**Acceptance criteria**
- Billing shows plan, seats used/available, storage, AI credits and video minutes against limits.
- Warning banners at 80% and 100% of any limit.
- Plan changes go through hosted checkout. No card data touches AeroSight.

### US-ORG-04 — Transfer ownership
As an organization owner, I want to transfer ownership to another admin so that the account survives staff changes.
**Priority:** Should · **Phase:** 1 · **FR:** ORG-009
**Acceptance criteria**
- Only an existing Admin can receive ownership.
- Requires re-authentication (password + 2FA if enabled).
- Both users receive an email. The previous owner becomes Admin. The action is audited.

### US-ORG-05 — Export or delete organization data
As an organization owner, I want to export all our data or delete the organization so that we meet contractual and privacy obligations.
**Priority:** Must · **Phase:** 1 · **FR:** ORG-010, ORG-011, PRIV-004
**Acceptance criteria**
- Export produces a signed download link (valid 7 days) with JSON/CSV metadata and original media.
- Deletion requires the typed slug + re-auth and enters a 30-day pending-deletion state that can be cancelled. Data is then purged, including backups within their rotation window.

## 2. Organization Administrator

### US-RBAC-01 — Invite team members
As an organization admin, I want to invite users with a role so that they get the right access immediately.
**Priority:** Must · **Phase:** 1 · **FR:** RBAC-001 – RBAC-003
**Acceptance criteria**
- Invite by email with an org role and optional project assignments.
- Invitation expires after 7 days. It can be resent or revoked.
- Seat limits are enforced at invite time.

### US-RBAC-02 — Create custom roles
As an organization admin, I want to define custom roles so that permissions match our internal structure.
**Priority:** Should (Enterprise) · **Phase:** 1 · **FR:** RBAC-005 – RBAC-007
**Acceptance criteria**
- Create a role by cloning a system role or from blank. Toggle any permission from the catalog.
- Cannot grant a permission the admin does not hold.
- A role in use cannot be deleted until its members are reassigned.

### US-RBAC-03 — Offboard a user
As an organization admin, I want to deactivate a user so that they lose access immediately.
**Priority:** Must · **Phase:** 1 · **FR:** RBAC-009, AUTH-014
**Acceptance criteria**
- Deactivation revokes all refresh tokens and WebSocket connections within 60 seconds.
- Records the user created remain, attributed to them.
- Mission assignments for the user are flagged for reassignment.

### US-AUTH-01 — Enforce 2FA
As an organization admin, I want to require 2FA for all members so that accounts are protected.
**Priority:** Must · **Phase:** 1 · **FR:** AUTH-011
**Acceptance criteria**
- When enforced, users without 2FA must set it up at next login before accessing data.
- The team table shows 2FA status per member.

### US-AUDIT-01 — Review audit log
As an organization admin, I want to search the audit log so that I can investigate who did what.
**Priority:** Must · **Phase:** 1 · **FR:** AUDIT-005 – AUDIT-007
**Acceptance criteria**
- Filter by actor, action, entity type, entity ID and date range.
- Export to CSV.
- Entries are read-only. There is no edit or delete.

### US-INTEG-01 — Connect a drone provider
As an organization admin, I want to connect our drone cloud account so that drones and telemetry sync automatically.
**Priority:** Should · **Phase:** 2 · **FR:** INTEG-001 – INTEG-004, DRONE-010
**Acceptance criteria**
- Credentials are stored in the secrets manager and never shown again.
- "Test connection" reports success or a specific error.
- Discovered drones can be imported with one click.

### US-PRIV-01 — Configure data retention
As an organization admin, I want to set retention periods per data class so that we keep data only as long as required.
**Priority:** Should · **Phase:** 2 · **FR:** PRIV-002, ORG-008
**Acceptance criteria**
- Configure retention per class (raw media, processed media, telemetry, audit logs, reports) within the plan's allowed bounds.
- A preview shows how many items will be affected before saving.
- A legal hold on a project suspends deletion for that project.

## 3. Project Manager

### US-PROG-01 — Compare imagery over time
As a project manager, I want to compare current and previous site imagery so that I can understand construction progress.
**Priority:** Must · **Phase:** 1 · **FR:** MAP-009, MEDIA-012, PROGRESS-006
**Acceptance criteria**
- Choose any two capture dates for a site.
- Swipe and side-by-side modes for orthomosaics. Side-by-side for photos taken near the same location (≤ 15 m, heading ±30°).
- Comparison can be added to a report.

### US-PROG-02 — Define milestones
As a project manager, I want to define weighted milestones so that progress percentage reflects our schedule.
**Priority:** Must · **Phase:** 1 · **FR:** PROGRESS-001 – PROGRESS-003
**Acceptance criteria**
- Create milestones with planned start/end and weight. Weights are normalized to 100%.
- Import from CSV (MS Project / Primavera P6 export columns).
- Gantt view shows planned vs. actual.

### US-PROG-03 — Record progress with evidence
As a project manager, I want to record percent complete per milestone with linked media so that progress is evidence-based.
**Priority:** Must · **Phase:** 1 · **FR:** PROGRESS-004, PROGRESS-005
**Acceptance criteria**
- A progress record needs a percentage (0–100) and a date. Evidence media is optional but recommended.
- Project % = Σ(weight × milestone %).
- Schedule variance is shown (planned % at date vs. actual).

### US-REPORT-01 — Generate monthly report
As a project manager, I want to generate a branded progress report so that I can send it to the client in minutes.
**Priority:** Must · **Phase:** 1 · **FR:** REPORT-001 – REPORT-006
**Acceptance criteria**
- Choose template, project, period and sections.
- Generation runs in the background. I am notified when it is ready (target < 2 min for ≤ 200 images).
- The PDF includes org branding, KPIs, milestone table, before/after imagery and open findings.

### US-REPORT-02 — Share a report with the client
As a project manager, I want to share a report with client viewers or via an expiring link so that external stakeholders stay informed.
**Priority:** Should · **Phase:** 1 · **FR:** REPORT-008, REPORT-009
**Acceptance criteria**
- Share to project Viewers (in-app) or create an external link with expiry (≤ 30 days) and an optional passcode.
- Links can be revoked. Every access is logged.

### US-MISSION-01 — Request a mission
As a project manager, I want to request a progress-capture mission for a site so that a pilot captures consistent imagery.
**Priority:** Must · **Phase:** 1 · **FR:** MISSION-001 – MISSION-006
**Acceptance criteria**
- Choose site, mission type and template. Draw the area. Set the schedule window.
- The mission can be saved as a recurring template (e.g. weekly) so captures are repeatable.

### US-AI-01 — AI progress analysis
As a project manager, I want AI to estimate progress from new aerial imagery so that I get a first assessment quickly.
**Priority:** Should · **Phase:** 2 · **FR:** AI-001 – AI-004
**Acceptance criteria**
- Select site + capture (and baseline). Output shows estimated %, detected changes, potential issues, recommendations, confidence.
- Output is labelled as AI-assisted and must be accepted, edited or rejected before it affects official progress.

### US-AI-02 — Ask the assistant
As a project manager, I want to ask natural-language questions about my projects so that I can find answers without building reports.
**Priority:** Could · **Phase:** 2 · **FR:** AI-009 – AI-012
**Acceptance criteria**
- The assistant answers only from data I am authorized to see and cites sources (entity links).
- If data is outside my access, it says it cannot find it. It must not reveal that the data exists.

## 4. Site Manager

### US-SITE-01 — Create a site with boundary
As a site manager, I want to draw or import a site boundary so that flights and data are spatially anchored.
**Priority:** Must · **Phase:** 1 · **FR:** SITE-001 – SITE-005
**Acceptance criteria**
- Draw a polygon or import KML/GeoJSON/zipped Shapefile.
- Invalid geometry is rejected with a reason. Area is displayed.

### US-SITE-02 — See what changed this week
As a site manager, I want a site timeline so that I can see all captures, findings and progress for a period.
**Priority:** Should · **Phase:** 1 · **FR:** SITE-009
**Acceptance criteria**
- Timeline groups events by day: missions, media batches, surveys, findings, progress records.
- Clicking an event focuses the map and opens its detail.

### US-ASSET-01 — Register assets
As a site manager, I want to register assets with location and hierarchy so that inspections can target them.
**Priority:** Must · **Phase:** 1 · **FR:** ASSET-001 – ASSET-005
**Acceptance criteria**
- Assets have a type, a tag unique in the site, a location and an optional parent.
- Bulk import CSV/GeoJSON with a row-level error report.

### US-NOTIF-01 — Get alerted on critical findings
As a site manager, I want an immediate notification when a critical finding is raised on my site so that I can act fast.
**Priority:** Should · **Phase:** 2 · **FR:** NOTIF-001 – NOTIF-004
**Acceptance criteria**
- In-app + email (+ Slack/Teams if configured) within 60 s of creation.
- Notification deep-links to the finding.

## 5. Drone Pilot

### US-DRONE-01 — View assigned missions
As a drone pilot, I want to view my assigned missions so that I know which flights I need to perform.
**Priority:** Must · **Phase:** 1 · **FR:** MISSION-008
**Acceptance criteria**
- "My Missions" shows upcoming, today and overdue missions sorted by scheduled time.
- Each shows site, type, drone, window, weather summary (if the weather integration is enabled) and approval status.
- Calendar export (iCal) available.

### US-DRONE-02 — Register a drone
As a drone pilot, I want to register a drone with its serial and registration number so that it can be assigned to missions.
**Priority:** Must · **Phase:** 1 · **FR:** DRONE-001 – DRONE-004
**Acceptance criteria**
- Serial number is unique within the organization.
- Registration expiry triggers warnings at 30/7/0 days.

### US-DRONE-03 — Complete pre-flight checklist
As a drone pilot, I want to complete a pre-flight checklist so that the flight is safe and documented.
**Priority:** Must · **Phase:** 1 · **FR:** MISSION-011
**Acceptance criteria**
- The org-configurable checklist must be fully confirmed before Start is enabled.
- Checklist responses, timestamp and pilot are stored with the mission.

### US-DRONE-04 — Start and complete a mission
As a drone pilot, I want to start and complete a mission in AeroSight so that the flight is tracked and media is linked.
**Priority:** Must · **Phase:** 1 · **FR:** MISSION-012 – MISSION-015
**Acceptance criteria**
- Start transitions the mission to `in_progress` and records actual start time.
- For simulator missions, simulated telemetry streams and the UI shows `Simulated`.
- Complete/Abort records end time. Abort requires a reason.

### US-MEDIA-01 — Upload flight media
As a drone pilot, I want to upload all media from a flight in one batch with auto-linking so that I don't tag files manually.
**Priority:** Must · **Phase:** 1 · **FR:** MEDIA-001 – MEDIA-006
**Acceptance criteria**
- Batch upload up to 2,000 files, resumable after network loss.
- Files whose EXIF timestamp falls within the mission window and whose GPS falls within the site boundary are auto-linked. Others are flagged for review.

### US-DRONE-05 — Keep my license current
As a drone pilot, I want to store my license details so that I remain assignable and compliant.
**Priority:** Must · **Phase:** 1 · **FR:** DRONE-011, DRONE-012
**Acceptance criteria**
- License number, type, authority and expiry stored, with document upload.
- Expired license blocks assignment.

## 6. Surveyor

### US-SURVEY-01 — Upload processed survey outputs
As a surveyor, I want to upload an orthomosaic and DSM so that the team can view and measure them on the map.
**Priority:** Must · **Phase:** 1 · **FR:** SURVEY-004 – SURVEY-006, MAP-005
**Acceptance criteria**
- Accept GeoTIFF / COG. Non-COG files are converted to COG server-side.
- Layer appears on the map at the correct location with a capture date.
- CRS is detected. Unsupported CRS gives a clear error.

### US-SURVEY-02 — Measure distances, areas and volumes
As a surveyor, I want measurement tools so that I can quantify site features.
**Priority:** Should · **Phase:** 1 (distance/area), 2 (volume) · **FR:** MAP-008, SURVEY-009
**Acceptance criteria**
- Distance and area use geodesic calculations.
- Volume (stockpile) uses a DSM with a base-plane option. Shows cut/fill.

### US-SURVEY-03 — Process raw images
As a surveyor, I want to send raw images to a connected processing engine so that I get outputs without leaving AeroSight.
**Priority:** Should · **Phase:** 2 · **FR:** SURVEY-007, SURVEY-008
**Acceptance criteria**
- Only available when a processing integration is connected (otherwise the "Integration Required" state is shown).
- Job status is polled or pushed. Outputs are registered automatically.

## 7. Inspector

### US-INSP-01 — Create findings against assets
As an inspector, I want to create findings against specific assets so that issues can be tracked and resolved.
**Priority:** Must · **Phase:** 2 · **FR:** INSPECTION-005 – INSPECTION-008
**Acceptance criteria**
- A finding requires a title, severity and category. It is linked to an inspection and optionally to an asset and location.
- Attach media with annotations (box, arrow, freehand).
- Findings appear as markers on the map and in the twin.

### US-INSP-02 — Run an inspection from a template
As an inspector, I want to start an inspection from a checklist template so that inspections are consistent.
**Priority:** Must · **Phase:** 2 · **FR:** INSPECTION-001 – INSPECTION-004
**Acceptance criteria**
- Templates define sections and items (pass/fail/NA, numeric, text, photo-required).
- Progress shows items completed / total.

### US-INSP-03 — Submit for review
As an inspector, I want to submit a completed inspection for engineer review so that conclusions are approved.
**Priority:** Must · **Phase:** 2 · **FR:** INSPECTION-010
**Acceptance criteria**
- Submit is blocked until all required items are answered.
- The reviewer is notified. The inspection becomes read-only to the inspector until it is returned.

### US-INSP-04 — Create a finding from a video frame
As an inspector, I want to grab a frame from drone video and create a finding so that evidence is precise.
**Priority:** Should · **Phase:** 2 · **FR:** VIDEO-007, INSPECTION-007
**Acceptance criteria**
- Snapshot stores the frame as a new image media item, linked to the source video and timestamp, with geolocation interpolated from the flight log when available.

## 8. Engineer

### US-ENG-01 — Approve or reject an inspection
As an engineer, I want to approve or reject submitted inspections with comments so that only reviewed results are relied on.
**Priority:** Must · **Phase:** 2 · **FR:** INSPECTION-011, INSPECTION-012
**Acceptance criteria**
- Approve locks the inspection. Reject returns it to the inspector with a mandatory comment.
- Approval records the engineer's name, timestamp and optional professional reference number.

### US-ENG-02 — Review AI findings
As an engineer, I want to accept, edit or reject AI-suggested findings so that AI never creates official findings unsupervised.
**Priority:** Must · **Phase:** 2 · **FR:** AI-006, AI-007
**Acceptance criteria**
- AI suggestions are in a review queue with confidence and source image region.
- Accepting creates a finding with `ai_generated=true` and the reviewer recorded.

## 9. Client / Viewer

### US-VIEW-01 — See shared project status
As a client viewer, I want a read-only dashboard of the projects shared with me so that I understand status without asking.
**Priority:** Must · **Phase:** 1 · **FR:** RBAC-010, PROJECT-010
**Acceptance criteria**
- Viewer sees only projects they are a member of.
- Sees KPIs, map, approved/shared media and published reports. Never sees drafts, internal comments or unshared media.

### US-VIEW-02 — Download published reports
As a client viewer, I want to download published reports so that I can share them internally.
**Priority:** Must · **Phase:** 1 · **FR:** REPORT-007
**Acceptance criteria**
- Download uses a signed URL valid for 5 minutes. The download is audited.

## 10. Platform Administrator & Support

### US-ADMIN-01 — Suspend an organization
As a platform administrator, I want to suspend an organization so that I can stop abuse or non-payment.
**Priority:** Must · **Phase:** 1 · **FR:** ADMIN-003
**Acceptance criteria**
- Suspended org users see a suspension page on login. API returns 403 `ORG_SUSPENDED`.
- Data is retained. Reactivation restores access. A reason is required and audited.

### US-ADMIN-02 — Monitor system health
As a platform administrator, I want a health dashboard so that I can detect issues early.
**Priority:** Must · **Phase:** 1 · **FR:** ADMIN-007
**Acceptance criteria**
- Shows API error rate and p95 latency, queue depths, WebSocket connections, storage growth, provider adapter health.

### US-ADMIN-03 — Break-glass access
As a support engineer, I want time-boxed, audited access to a tenant's data with customer consent so that I can resolve complex tickets.
**Priority:** Should · **Phase:** 2 · **FR:** ADMIN-009
**Acceptance criteria**
- Requires a ticket ID, justification and Org Owner approval (or contractual emergency clause), and lasts at most 4 hours.
- The Org Owner is notified at start and end. All actions are tagged `actor_type=platform_staff` in the tenant's audit log.

## 11. Integration Provider (system actor)

### US-INTEG-02 — Stream telemetry to AeroSight
As a drone integration provider, I want a documented adapter contract so that my platform's telemetry appears in AeroSight in real time.
**Priority:** Should · **Phase:** 2 · **FR:** TELEM-001 – TELEM-004
**Acceptance criteria**
- The adapter normalizes provider payloads to the canonical telemetry schema.
- Invalid payloads are rejected and counted in metrics. Valid data reaches subscribed clients in < 2 s p95.

## 12. Story Map (summary)

| Activity → | Set up | Plan | Fly | Capture | Analyze | Act | Report |
|---|---|---|---|---|---|---|---|
| **Phase 1** | US-ORG-02, US-RBAC-01, US-ORG-01, US-SITE-01, US-ASSET-01, US-DRONE-02 | US-MISSION-01, US-PROG-02 | US-DRONE-01, -03, -04 | US-MEDIA-01, US-SURVEY-01 | US-PROG-01, US-PROG-03 | US-SITE-02 | US-REPORT-01, -02, US-VIEW-01, -02 |
| **Phase 2** | US-INTEG-01, US-PRIV-01 | — | US-INTEG-02 | US-SURVEY-03 | US-AI-01, US-AI-02, US-SURVEY-02 | US-INSP-01–04, US-ENG-01, -02, US-NOTIF-01 | — |
