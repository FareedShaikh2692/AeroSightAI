# Acceptance Criteria

| | |
|---|---|
| **Document** | Acceptance Criteria |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-37 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product & QA |
| **Reviewer** | _Pending — Product Owner, QA Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product & QA | Initial measurable criteria for all modules |

---

## Conventions

- Format: **Given** (context) / **When** (action) / **Then** (measurable outcomes).
- "Audit log" means an entry per the [Audit Logging spec](../07-Security/Audit-Logging.md) with actor, action, entity and diff.
- Unless stated otherwise, every criterion implicitly includes: tenant isolation (no cross-org effect) and server-side permission enforcement.
- **Acceptance Result** is recorded in the [RTM](../03-SRS/Traceability-Matrix.md) (all *Not run* at v0.1).

---

## Authentication

**AC-AUTH-01 — Secure password storage.** Given a new signup, when the account is created, then the password is stored only as an argon2id hash with the specified parameters, and no plaintext appears in DB, logs or traces.

**AC-AUTH-02 — Login.** Given a verified active user, when they submit correct credentials, then within 1 s (p95) they receive a 15-minute access token and an httpOnly refresh cookie, and are routed to their last active organization's dashboard.

**AC-AUTH-03 — Refresh rotation & reuse.** Given a session, when a refresh token is used, then it is rotated. When an already-rotated token is presented after the 10 s grace window, then the whole session family is revoked, the user is emailed, and an audit entry is written.

**AC-AUTH-04 — Brute force.** Given 10 failed attempts in 15 min for an account, when another attempt is made, then the system responds 423 with Retry-After, and all prior failures returned an identical generic message.

**AC-AUTH-05 — 2FA.** Given a user with TOTP enabled, when they log in, then they must enter a valid unused code (or a recovery code) before any tokens are issued. Recovery codes work exactly once.

**AC-AUTH-06 — Org-enforced 2FA.** Given an org with 2FA enforced, when a member without 2FA logs in, then they can only access 2FA enrollment until enrolled.

**AC-AUTH-07 — Password reset.** Given a forgotten password, when the user requests a reset, then the response is identical for existing and unknown emails. The emailed link works once within 30 min. Completing the reset revokes all sessions.

**AC-AUTH-08 — Session management.** Given multiple active sessions, when the user revokes one in Settings → Security, then that device's next refresh fails and its WebSocket closes within 60 s.

## Organization

**AC-ORG-01 — Onboarding.** Given a newly verified owner, when they complete or skip the wizard, then the org exists with their profile, invites have been sent, and the dashboard shows the getting-started checklist reflecting completed steps.

**AC-ORG-02 — Branding.** Given an Admin, when they upload a logo and set a brand color, then both appear in the app header and in newly generated reports, and SVG logos are sanitized.

**AC-ORG-03 — Ownership transfer.** Given an Owner with recent re-auth, when they transfer ownership to an Admin, then the roles swap atomically, both receive emails, and an audit entry exists.

**AC-ORG-04 — Export.** Given an Owner, when they request an org export, then within 24 h (for ≤ 500 GB) they receive a link valid for 7 days to an archive containing all entity metadata (JSON/CSV) and original files, and nothing from other organizations.

**AC-ORG-05 — Deletion.** Given an Owner, when they confirm deletion with the typed slug and re-auth, then the org enters pending_deletion for 30 days (cancellable). Afterwards all DB rows and storage objects are purged and the org data key is scheduled for deletion.

## Tenant Isolation

**AC-TENANT-01 — Database isolation.** Given two organizations, when any application query runs, then RLS restricts results to the token's organization, and queries without tenant context return no rows.

**AC-TENANT-02 — API & storage isolation.** Given a user of Company A, when they call any endpoint or request any media URL with Company B identifiers, then they receive 404 and no Company B data, with no state change in Company B. Verified by the generated suite over 100% of endpoints.

**AC-TENANT-03 — Realtime isolation.** Given a Company A user, when they try to subscribe to any Company B channel, then the subscription is refused and no message is delivered.

## RBAC

**AC-RBAC-01 — Matrix compliance.** Given the system roles, when each role attempts each permissioned action, then outcomes match [RBAC §4](../07-Security/RBAC.md#4-permission-matrix-system-roles) exactly (100% of generated cases).

**AC-RBAC-02 — Invitations.** Given an Admin with available seats, when they invite a user with a role and project assignments, then the invitee receives an email valid for 7 days, and on acceptance has exactly those roles.

**AC-RBAC-03 — No escalation.** Given any user, when they attempt to grant a permission they don't hold (role edit, assignment, API key), then the request fails with 403 PRIVILEGE_ESCALATION and is audited.

**AC-RBAC-04 — Project scoping.** Given a non-admin user, when they browse, then they only see projects they are a member of, and Viewers only see shared/published content.

**AC-RBAC-05 — Deactivation.** Given an Admin deactivates a member, then within 60 s that member can no longer call the API or receive realtime messages, and their past records remain attributed.

**AC-RBAC-06 — Custom roles.** Given an Enterprise Admin, when they create a custom role cloned from Inspector and add `inspection:approve`, then assigned users can approve inspections (except their own) within 5 minutes of the change.

## Projects

**AC-PROJECT-01 — Create.** Given an authorized PM, when they create a project with valid fields, then it appears in their list, they are a member with PM role, and an audit entry exists. Duplicate codes are rejected.

**AC-PROJECT-02 — Team.** Given a PM, when they add org members with project roles, then those members see the project within 5 s and get notified.

**AC-PROJECT-03 — Archive.** Given an archived project, when anyone attempts a write, then it is rejected (409) while reads remain available, and it no longer counts toward the plan's active project limit.

**AC-PROJECT-04 — Overview.** Given a project with data, when a member opens it, then KPIs (% complete, SV, missions, media, open findings by severity, next milestone) load in < 2 s p75 and match the API values.

## Sites

### Site Creation

**AC-SITE-01.** Given an authorized project manager,
when they create a site,
then the system must:
- Validate required fields (name, code, timezone, boundary).
- Store coordinates (boundary as a WGS 84 MultiPolygon; computed centroid and area).
- Associate the site with the organization and project.
- Apply permissions (visible only to the project's members and org-wide roles).
- Display the site on the map immediately (boundary visible without reload).
- Create an audit log entry (`site.created`).

**AC-SITE-02 — Geometry validation.** Given an invalid polygon (self-intersection, unclosed ring, < 100 m², out-of-range coordinates), when submitted, then it is rejected with a specific reason and the offending location is highlighted on the map.

**AC-SITE-03 — Import.** Given a KML/KMZ, GeoJSON or zipped Shapefile, when imported, then the boundary is reprojected to WGS 84 with < 0.1 m vertex error and previewed before saving.

**AC-SITE-04 — No-fly zones.** Given a site with no-fly zones, when a mission is planned, then waypoints inside them are rejected.

## Assets

**AC-ASSET-01.** Given a site, when a user with `asset:create` adds an asset with a unique tag and location, then it appears on the map with its type icon and in the asset tree.

**AC-ASSET-02.** Given an asset hierarchy, when a parent from another site or a cycle is set, then the change is rejected.

**AC-ASSET-03.** Given a CSV of 10,000 assets, when imported, then the dry run reports row-level errors within 30 s and the commit imports only valid rows.

## Drones

**AC-DRONE-01.** Given a pilot, when they register a drone with a unique serial, then it appears in the fleet as `available` with provider-derived capabilities.

**AC-DRONE-02.** Given a drone with expired registration or in maintenance, when it is assigned, then assignment is blocked unless an Admin overrides with a reason (audited).

**AC-DRONE-03.** Given a pilot with an expired license, when they are assigned, then assignment is blocked with the same override rule. Warnings were sent at 30/7/0 days.

**AC-DRONE-04.** Given a simulator drone, when it is shown anywhere (fleet, missions, live ops, reports), then it carries the `Simulated` label.

## Missions

**AC-MISSION-01 — Planning.** Given a PM, when they draw a grid area and set parameters, then waypoints and estimates (duration, distance, photos, GSD, batteries) are shown within 2 s for areas ≤ 50 ha.

**AC-MISSION-02 — Validation.** Given a plan with waypoints outside boundary + buffer, inside a no-fly zone, or above max altitude, when saved, then it is rejected with each offending waypoint listed and highlighted.

**AC-MISSION-03 — Scheduling.** Given a drone or pilot already booked in an overlapping window, when assigned, then the system rejects the double booking.

**AC-MISSION-04 — Lifecycle.** Given any mission state, when a transition outside the state machine is attempted, then it is rejected (409). Valid transitions record timestamps, actor and audit.

**AC-MISSION-05 — Pre-flight.** Given an assigned pilot, when they try to start a mission, then Start is disabled until the checklist is complete and they confirm they are pilot in command.

**AC-MISSION-06 — Execution honesty.** Given a drone without verified `missionControl`, when the mission is started, then no command is sent to any provider and the UI states that the flight is executed in the provider app.

**AC-MISSION-07 — Completion.** Given an in-progress mission, when completed or aborted (with reason), then the drone is released, a flight summary is computed, stakeholders are notified, and the media upload prompt appears for the pilot.

## Telemetry

**AC-TELEM-01 — Live view.** Given an in-progress mission, when a member opens Live Operations, then the drone position, altitude, speed, heading, battery, GPS and flight time update at ≥ 1 Hz with p95 end-to-end latency < 1 s internally (simulator) and < 2 s for provider-connected drones.

**AC-TELEM-02 — Validation.** Given malformed or implausible telemetry, when ingested, then it is rejected or flagged and never shown as live position.

**AC-TELEM-03 — Alerts.** Given battery ≤ 30%/20%, a geofence breach, altitude exceedance or signal loss > 10 s, when it occurs, then a toast appears for viewers within 2 s and the event is recorded on the mission.

**AC-TELEM-04 — Resilience.** Given a dropped connection, when the network returns within 60 s, then the client reconnects automatically and backfills missed positions without a page reload.

## Video

**AC-VIDEO-01.** Given an uploaded 1080p/4K video, when processing completes (≤ 1× realtime p95), then it plays with adaptive quality, poster and scrub previews.

**AC-VIDEO-02.** Given an unauthorized user or expired URL, when playback is attempted, then it fails.

**AC-VIDEO-03 (Phase 2).** Given a provider with live video, when an authorized user opens the live panel, then video starts within 3 s with < 1.5 s latency on WebRTC, falling back to LL-HLS (< 6 s) on restrictive networks.

## Media

**AC-MEDIA-01 — Upload.** Given a pilot with 500 images (6 GB), when uploaded on a 100 Mbps connection, then the upload saturates ≥ 80% of the link, survives a network interruption by resuming, and all items are ready within 10 min after the upload finishes.

**AC-MEDIA-02 — Validation.** Given a file whose content doesn't match an allowed type, when uploaded, then it is rejected.

**AC-MEDIA-03 — Malware.** Given an infected file, when scanned, then it is quarantined, never downloadable, and the uploader and Admins are notified.

**AC-MEDIA-04 — Auto-linking.** Given images captured during a mission inside the site boundary, when processed, then ≥ 99% are linked to the mission automatically and the rest are flagged for review.

**AC-MEDIA-05 — Browse.** Given 50,000 media items in a project, when filtering in grid or map view, then results render within 1.5 s p75.

**AC-MEDIA-06 — Download.** Given an authorized user, when downloading, then a 5-minute signed URL is used and an audit entry is written.

## Surveys

**AC-SURVEY-01.** Given a georeferenced GeoTIFF orthomosaic ≤ 10 GB, when uploaded to a survey, then within 30 min it is available as a map layer at the correct location (≤ 0.5 m offset vs. source) with its capture date.

**AC-SURVEY-02.** Given no connected processing engine, when a user wants to process raw images, then the UI shows the `Integration Required` state and no job is created.

**AC-SURVEY-03.** Given a DSM, when a volume is computed for a stockpile polygon, then cut/fill/net are reported within ±2% of a reference computation.

## Maps

**AC-MAP-01.** Given a site, when the map opens, then the first tiles render in < 1.5 s p75 and the user can switch between Streets, Satellite, Terrain and 3D.

**AC-MAP-02.** Given layers for boundary, assets, flight paths, survey areas, findings and orthomosaics, when toggled, then each shows or hides with its legend, and orthomosaics are selectable by date.

**AC-MAP-03.** Given two capture dates, when compare mode is used, then a swipe view shows both aligned and the state is shareable by URL.

**AC-MAP-04.** Given measurement tools, when measuring a known 1 km distance, then the error is < 0.1%.

## Digital Twin

AC-TWIN-01 – AC-TWIN-04 are defined in [Digital Twin §10](../10-GIS-3D/Digital-Twin.md#10-acceptance-criteria-summary).

## Inspections

**AC-INSPECTION-01.** Given a published template, when an inspection is created, then the checklist is snapshotted and unaffected by later template versions.

**AC-INSPECTION-02.** Given an inspector on site, when they add a finding with severity, asset and an annotated photo, then it appears on the map with the severity color within 5 s and the assignee is notified.

**AC-INSPECTION-03.** Given incomplete required items, when the inspector submits, then submission is blocked with the list of missing items.

**AC-INSPECTION-04.** Given a submitted inspection, when the engineer approves (not the assignee), then it becomes immutable with the approver, time and optional reference recorded. Rejection requires a comment and returns it to the inspector.

**AC-INSPECTION-05.** Given a finding, when it is resolved, then resolution notes (and evidence if required) are captured, and closure requires verification.

**AC-INSPECTION-06.** Given overdue findings, when the daily job runs, then assignees and site managers receive one reminder per day.

## Progress

**AC-PROGRESS-01.** Given weighted milestones, when the PM views Progress, then normalized weights sum to 100% and the S-curve shows planned vs. actual.

**AC-PROGRESS-02.** Given approved records, when actual % is computed, then it equals Σ(weight × latest approved %) and matches the dashboard, the API and reports exactly.

**AC-PROGRESS-03.** Given a PM without approval rights in a four-eyes project, when they record progress, then it stays pending until approved by another authorized user.

**AC-PROGRESS-04.** Given two captures, when comparing, then before/after imagery is shown aligned and can be added to a report.

**AC-PROGRESS-05 (Phase 2).** Given an AI progress analysis, when completed, then nothing changes in official progress until the PM accepts or edits proposals. Accepted ones are labelled AI-sourced with the reviewer recorded.

## AI

**AC-AI-01.** Given an analysis request, when it completes, then the output validates against its schema and includes model, version, prompt version, confidence and the disclaimer.

**AC-AI-02.** Given AI suggestions, when reviewed, then accept/edit/reject decisions are recorded with the reviewer, and only accepted or edited suggestions create records.

**AC-AI-03.** Given the AI assistant, when a user asks about data they cannot access, then the answer contains none of that data and does not reveal its existence (0 leaks in the authorization eval set).

**AC-AI-04.** Given prompt-injection content in tenant data, when processed by the assistant, then no tool is invoked outside the allow-list and no unauthorized data is returned (100% of critical red-team cases).

**AC-AI-05.** Given exhausted AI credits, when AI is requested, then the user sees a clear limit message and core features are unaffected.

## Reports

**AC-REPORT-01.** Given a PM, when they generate a monthly progress report for a project with ≤ 200 images, then a branded PDF is ready within 120 s (p95) with all selected sections and a footer containing the report ID, version, timestamp and hash.

**AC-REPORT-02.** Given the report and the dashboard at the same as-of date, when compared, then all KPIs match exactly.

**AC-REPORT-03.** Given a requester lacking access to some sites, when they generate a project report, then content from those sites is excluded.

**AC-REPORT-04.** Given a published report, when a Viewer opens Reports, then they can view and download it. Drafts are never visible to them.

**AC-REPORT-05.** Given an external share link with expiry and passcode, when accessed after expiry or revocation, then access is denied. Each access is logged.

## Notifications

**AC-NOTIF-01.** Given a critical finding or geofence breach, when it occurs, then in-app notifications arrive within 5 s and email within 60 s (p95).

**AC-NOTIF-02.** Given a user who lost access to a project, when an event occurs in it, then they receive no notification.

**AC-NOTIF-03.** Given repeated identical alerts within 10 minutes, then one notification with a counter is shown.

**AC-NOTIF-04.** Given preferences (Phase 2), when a user disables email for a category, then no emails are sent for it, except mandatory security/billing events.

## Audit

**AC-AUDIT-01.** Given any state-changing action, when it succeeds, then exactly one audit entry exists. When it fails, none exists.

**AC-AUDIT-02.** Given the audit table, when any attempt to modify or delete entries is made through the application role, then it fails, and direct tampering is detected by the daily hash-chain verification.

**AC-AUDIT-03.** Given an Admin, when they filter and export audit logs, then results match filters and the export itself is audited.

## Analytics

**AC-ANALYTICS-01.** Given a user, when they view analytics, then all aggregates include only projects they can access.

**AC-ANALYTICS-02.** Given dashboards, then data freshness ≤ 15 min is displayed and CSV exports match on-screen values.

## Integrations

**AC-INTEG-01.** Given an Admin connecting an integration, when credentials are saved, then they are never displayed or returned again and "Test connection" reports a specific success or error.

**AC-INTEG-02.** Given a webhook, when events fire, then signed deliveries are attempted with retries and are visible in the delivery log. Private-network URLs are rejected.

**AC-INTEG-03.** Given an API key with limited permissions, when used, then it can only perform those actions on the allowed projects and is audited as `api_key`.

## Billing

**AC-BILLING-01.** Given an Owner, when they upgrade via hosted checkout, then new limits apply within 60 s of the provider webhook.

**AC-BILLING-02.** Given usage at 80% and 100% of a limit, then the Owner is notified once per threshold per period and hard limits block only new consumption.

**AC-BILLING-03.** Given a failed payment, when 14 days of grace pass, then the org becomes read-only without data loss and returns to active on payment.

## Platform Admin

**AC-ADMIN-01.** Given platform staff, when they sign in, then WebAuthn and IP allow-listing are required, and staff tokens cannot call tenant APIs.

**AC-ADMIN-02.** Given an org suspension with a reason, then all tenant sessions are revoked within 60 s and users see a suspension page.

**AC-ADMIN-03.** Given a break-glass request with ticket and approval, then read-only tenant access lasts at most the approved duration (≤ 4 h), the Owner is notified at start and end, and all actions appear in the tenant audit log as platform staff.
