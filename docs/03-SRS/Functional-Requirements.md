# Functional Requirements Document (FRD)

| | |
|---|---|
| **Document** | Functional Requirements Document |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-04 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Engineering & Product |
| **Reviewer** | _Pending — Tech Lead, Product Owner, QA Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Engineering & Product | Initial catalog of 308 functional requirements |

---

## How to read this catalog

| Column | Meaning |
|---|---|
| **ID** | Stable identifier. Never reused. Deprecated IDs are struck through. |
| **Requirement** | "The system shall…" statement (subject omitted for brevity). |
| **Pri** | M = Must, S = Should, C = Could. |
| **Ph** | Release phase (1 = MVP). |
| **BR** | Parent business requirement. |
| **V** | Verification: T = test, D = demonstration, I = inspection, A = analysis. |

Every requirement implicitly includes: tenant scoping (TENANT-*), server-side authorization (RBAC-*), and an audit event for state-changing actions (AUDIT-*).

---

## AUTH — Authentication

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| AUTH-001 | Allow self-service signup with full name, work email, password and organization name. Create the user, the organization and an Owner membership in one transaction. | M | 1 | BR-02 | T |
| AUTH-002 | Require email verification (6-digit code or link, valid 24 h, single use) before granting access to organization data. | M | 1 | BR-17 | T |
| AUTH-003 | Hash passwords with argon2id (m=64 MiB, t=3, p=1, 16-byte salt). Never store or log plaintext. | M | 1 | BR-17 | I/T |
| AUTH-004 | Enforce password policy: ≥ 12 characters, zxcvbn score ≥ 3, not in a breached-password corpus (k-anonymity HIBP range API or local list), not equal to email. | M | 1 | BR-17 | T |
| AUTH-005 | Authenticate with email + password and return a 15-minute access token (JWT, ES256) and a refresh token (opaque, 256-bit, httpOnly Secure SameSite=Strict cookie). | M | 1 | BR-17 | T |
| AUTH-006 | Rotate refresh tokens on every use. Detect reuse of a rotated token and revoke the whole token family, emailing the user. | M | 1 | BR-17 | T |
| AUTH-007 | Respond to failed logins with a generic message. Lock the account for 15 min after 10 failures in 15 min (per account), and throttle per IP. | M | 1 | BR-17 | T |
| AUTH-008 | Provide forgot/reset password via an emailed single-use link valid 30 min. Revoke all sessions on reset. Do not reveal account existence. | M | 1 | BR-17 | T |
| AUTH-009 | Support TOTP 2FA (RFC 6238, 30 s, 6 digits, ±1 step) with QR enrollment and 10 single-use recovery codes (hashed). | M | 1 | BR-17 | T |
| AUTH-010 | Require a 2FA challenge after password verification when the user has 2FA enabled. Issue an intermediate `mfa_token` valid 5 min. | M | 1 | BR-17 | T |
| AUTH-011 | Allow Admins to enforce 2FA org-wide. Non-compliant users must enroll before accessing data. | M | 1 | BR-17 | T |
| AUTH-012 | Support WebAuthn/passkeys as a second factor (and passwordless in Phase 3). | S | 2 | BR-17 | T |
| AUTH-013 | Allow users to list and revoke their active sessions (device, IP-derived city, last used). | M | 1 | BR-17 | T |
| AUTH-014 | Revoke all sessions and close WebSocket connections within 60 s when a user is deactivated or removed from an org. | M | 1 | BR-02 | T |
| AUTH-015 | Let users who belong to multiple organizations switch the active organization. This issues a new access token scoped to that org. | M | 1 | BR-02 | T |
| AUTH-016 | Expire idle sessions after a configurable period (default 12 h without refresh). Absolute refresh lifetime is 30 days (configurable down to 1 day by the org). | M | 1 | BR-17 | T |
| AUTH-017 | Support enterprise SSO via OIDC and SAML 2.0 with just-in-time provisioning and domain verification (DNS TXT). | S | 3 | BR-16 | T |
| AUTH-018 | Support SCIM 2.0 user provisioning and deprovisioning. | C | 3 | BR-16 | T |
| AUTH-019 | Send a "new sign-in" email for logins from an unrecognized device fingerprint + country. | S | 2 | BR-17 | T |
| AUTH-020 | Re-authenticate (password + 2FA) within the last 5 min for sensitive actions: ownership transfer, org deletion, 2FA disable, API key creation, export. | M | 1 | BR-17 | T |

## ORG — Organization

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| ORG-001 | Create an organization with name, unique slug (3–40 chars, `[a-z0-9-]`), country, timezone and industry. | M | 1 | BR-02 | T |
| ORG-002 | Provide an onboarding wizard (profile, invite, first project, first drone) with skippable steps and a persistent checklist. | S | 1 | BR-01 | D |
| ORG-003 | Allow Owner/Admin to update profile, logo (PNG/SVG/JPG ≤ 2 MB, SVG sanitized), brand color, units and default CRS. | M | 1 | BR-12 | T |
| ORG-004 | Store organization settings (security policy, session lifetime, 2FA enforcement, allowed email domains for invites, external sharing toggle). | M | 1 | BR-17 | T |
| ORG-005 | Restrict invitations to allowed email domains when configured. | S | 1 | BR-17 | T |
| ORG-006 | List the organizations a user belongs to and their role in each. | M | 1 | BR-02 | T |
| ORG-007 | Enforce plan limits (seats, active projects, storage) at creation time with clear errors. | M | 1 | BR-15 | T |
| ORG-008 | Allow configuration of data retention policies per data class within plan bounds (see [Privacy](../07-Security/Privacy.md)). | S | 2 | BR-14 | T |
| ORG-009 | Allow the Owner to transfer ownership to an existing Admin, with re-authentication and dual email notification. | S | 1 | BR-14 | T |
| ORG-010 | Allow the Owner to request a full organization export (metadata JSON/CSV + original media + reports) delivered via signed link. | M | 1 | BR-14 | T |
| ORG-011 | Allow the Owner to delete the organization with a 30-day cancellable grace period, followed by a cryptographic purge (KMS key deletion for org data key) and hard delete. | M | 1 | BR-14 | T |
| ORG-012 | Display org-level usage (seats, storage, AI credits, flight minutes) to Owner/Admin. | M | 1 | BR-15 | T |

## TENANT — Tenant Isolation

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| TENANT-001 | Every tenant-owned row shall contain a non-null `organization_id`. | M | 1 | BR-02 | I |
| TENANT-002 | Enforce PostgreSQL Row-Level Security on all tenant tables using the session variable `app.current_org_id`. The application DB role shall not have `BYPASSRLS`. | M | 1 | BR-02 | T |
| TENANT-003 | Derive the organization context only from the authenticated token. Never derive it from client-supplied IDs or headers. | M | 1 | BR-02 | T |
| TENANT-004 | Return `404 Not Found` (not 403) for resources in another organization, to avoid confirming that they exist. | M | 1 | BR-02 | T |
| TENANT-005 | Prefix object storage keys with `org/{organizationId}/`. Issue signed URLs only after an authorization check. Never use public buckets. | M | 1 | BR-02 | T |
| TENANT-006 | WebSocket subscriptions shall be authorized per channel and the channel's organization must equal the token's organization. | M | 1 | BR-02 | T |
| TENANT-007 | Background jobs carry `organizationId` in their payload and set the RLS context before any DB access. Jobs without it are rejected. | M | 1 | BR-02 | T |
| TENANT-008 | Caches (Redis keys) and search/vector indices shall be namespaced by organization ID. | M | 1 | BR-02 | I/T |

## RBAC — Roles, Permissions & Team

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| RBAC-001 | Allow users with `user:invite` to invite by email with an org role and optional project assignments. | M | 1 | BR-03 | T |
| RBAC-002 | Invitations expire after 7 days, can be resent (new token) or revoked, and are single-use. | M | 1 | BR-03 | T |
| RBAC-003 | Enforce seat limits at invite and acceptance. | M | 1 | BR-15 | T |
| RBAC-004 | Seed system roles: Owner, Admin, Project Manager, Site Manager, Drone Pilot, Surveyor, Inspector, Engineer, Viewer, with the permission sets in [RBAC](../07-Security/RBAC.md). They are immutable. | M | 1 | BR-03 | T |
| RBAC-005 | Allow users with `role:manage` to create, edit and delete custom roles per organization (Professional: up to 5; Enterprise: unlimited). | S | 1 | BR-03 | T |
| RBAC-006 | Prevent privilege escalation: a user cannot create or assign a role containing permissions they do not hold. | M | 1 | BR-17 | T |
| RBAC-007 | Prevent deleting a role that is assigned. Require reassignment. | M | 1 | BR-03 | T |
| RBAC-008 | Compute effective permissions as the union of the org role permissions and the project role permissions for the target project. Owner/Admin have implicit access to all projects. | M | 1 | BR-03 | T |
| RBAC-009 | Allow Admins to change roles, deactivate and remove members. The last Owner cannot be removed or demoted. | M | 1 | BR-03 | T |
| RBAC-010 | Non-admin users see only projects where they are members. The Viewer role sees only published/shared content. | M | 1 | BR-03 | T |
| RBAC-011 | Expose `GET /me/permissions` (org-level + per-project) so the UI can hide or disable controls. The server remains authoritative. | M | 1 | BR-03 | T |
| RBAC-012 | Cache permission sets per (user, org) in Redis (TTL 5 min) and invalidate on any role, membership or permission change. | M | 1 | BR-17 | T |

## PROJECT — Projects

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| PROJECT-001 | Create a project with name, code (unique per org, `[A-Z0-9-]{2,20}`), type, client name, start/end dates, location point, description, cover image. | M | 1 | BR-04 | T |
| PROJECT-002 | Validate that end date ≥ start date and the location is valid WGS 84. | M | 1 | BR-04 | T |
| PROJECT-003 | List projects with filtering (status, type, PM, date range, text search) and sorting, membership-scoped. | M | 1 | BR-04 | T |
| PROJECT-004 | Update project fields. Changes are audited with before/after. | M | 1 | BR-14 | T |
| PROJECT-005 | Manage project members with a project role (subset of system/custom roles with `scope=project`). | M | 1 | BR-03 | T |
| PROJECT-006 | Status lifecycle: `planning → active ⇄ on_hold → completed → archived`. Archived projects are read-only. | M | 1 | BR-04 | T |
| PROJECT-007 | Archive and restore projects. Archived projects don't count toward the active-project limit. | M | 1 | BR-15 | T |
| PROJECT-008 | Project overview summary: % complete, SV, sites count, missions (last 30 d), media count, open findings by severity, next milestone. | M | 1 | BR-10 | T |
| PROJECT-009 | Per-project activity feed derived from audit events, filtered by the viewer's permissions. | S | 1 | BR-01 | T |
| PROJECT-010 | Viewer-role project dashboard showing only published reports and shared media. | M | 1 | BR-03 | T |
| PROJECT-011 | Project settings: mission approval required (bool), four-eyes progress approval (bool), auto AI analysis (bool), default report template. | S | 1 | BR-05 | T |
| PROJECT-012 | Soft-delete projects only when they have no missions/media. Otherwise only archive is allowed. | M | 1 | BR-14 | T |

## SITE — Sites

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| SITE-001 | Create a site within a project with name, code (unique per project), address, timezone, boundary (MultiPolygon) and optional elevation. | M | 1 | BR-04 | T |
| SITE-002 | Validate boundary geometry (`ST_IsValid`, closed rings, ≥ 3 distinct vertices, area > 100 m²). Reject self-intersections with a reason. | M | 1 | BR-04 | T |
| SITE-003 | Compute and store area (m²) and centroid server-side. | M | 1 | BR-04 | T |
| SITE-004 | Import a boundary from GeoJSON, KML/KMZ or zipped Shapefile (≤ 10 MB). Reproject to EPSG:4326. | S | 1 | BR-04 | T |
| SITE-005 | Geocode addresses and reverse-geocode pins through the configured geocoding provider. | S | 1 | BR-04 | T |
| SITE-006 | Define no-fly sub-zones (polygons) and a geofence buffer (default 50 m) used by mission validation. | M | 1 | BR-05 | T |
| SITE-007 | Store site contacts and airspace notes (free text) and an optional max altitude override. | S | 1 | BR-05 | T |
| SITE-008 | Show the site on the map with its boundary and assets immediately after creation. | M | 1 | BR-08 | D |
| SITE-009 | Site timeline aggregating missions, media batches, surveys, findings and progress records by day. | S | 1 | BR-10 | T |
| SITE-010 | Update and soft-delete sites (delete is blocked if missions are in progress). | M | 1 | BR-04 | T |
| SITE-011 | Site membership override: restrict project members to specific sites (optional). | C | 2 | BR-03 | T |
| SITE-012 | Export site boundary and features as GeoJSON/KML. | S | 1 | BR-08 | T |

## ASSET — Assets

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| ASSET-001 | Create assets with type, name, tag (unique per site), location (PointZ), optional geometry, attributes JSON, condition rating (1–5). | M | 1 | BR-04 | T |
| ASSET-002 | Support a parent-child hierarchy within one site, with cycle prevention. | M | 1 | BR-04 | T |
| ASSET-003 | List/filter assets by type, condition, open findings, and spatially (within bbox/polygon). | M | 1 | BR-04 | T |
| ASSET-004 | Bulk import via CSV or GeoJSON (≤ 10,000 rows) with dry-run validation and a row-level error report. | S | 1 | BR-04 | T |
| ASSET-005 | Show assets on map and twin with type icons and a condition color. | M | 1 | BR-08 | D |
| ASSET-006 | Asset detail aggregates inspections, findings, media within 30 m (or linked), and history. | M | 2 | BR-09 | T |
| ASSET-007 | Asset change history (audit-derived). | S | 1 | BR-14 | T |
| ASSET-008 | Soft-delete assets. Deleting a parent requires reassigning or deleting its children. | M | 1 | BR-04 | T |
| ASSET-009 | Org-configurable asset types and attribute schemas (JSON Schema per type). | C | 2 | BR-04 | T |
| ASSET-010 | Link assets to BIM element GUIDs (IFC GlobalId) for twin integration. | C | 3 | BR-08 | T |

## DRONE — Drones & Pilots

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| DRONE-001 | Register a drone with provider (`manual`, `simulator`, or an integration), manufacturer, model, serial (unique per org), name, registration number, registration expiry, Remote ID, payloads, max flight time, home site. | M | 1 | BR-05 | T |
| DRONE-002 | Drone status lifecycle `available, in_mission, maintenance, offline, retired`. Status changes are audited. | M | 1 | BR-05 | T |
| DRONE-003 | Prevent assigning drones in `maintenance`, `retired`, or with expired registration (Admin override with reason). | M | 1 | BR-05 | T |
| DRONE-004 | Warn about registration expiry at 30/7/0 days. | S | 1 | BR-05 | T |
| DRONE-005 | Maintenance log (date, type, description, technician, next due, attachments). Putting a drone in maintenance blocks assignment. | S | 1 | BR-05 | T |
| DRONE-006 | Accumulate flight hours and flight count from completed missions/telemetry. | S | 1 | BR-18 | T |
| DRONE-007 | Drone flight log listing missions with duration, distance, max altitude, incidents. | S | 1 | BR-05 | T |
| DRONE-008 | Fleet list with filters (status, model, provider, site) and live indicators (battery, last seen) when telemetry is available. | M | 1 | BR-06 | T |
| DRONE-009 | Retire drones (blocked while `in_mission`). Retired drones remain in historical records. | M | 1 | BR-05 | T |
| DRONE-010 | Sync/import drones from a connected provider (discover, map, import) without duplicates (matched on provider drone ID or serial). | S | 2 | BR-16 | T |
| DRONE-011 | Pilot profile per member: license number, type, issuing authority, expiry, certificates (uploads), insurance expiry. | M | 1 | BR-05 | T |
| DRONE-012 | Block mission assignment to pilots with expired or missing license (Admin override with reason). Warn at 30/7/0 days. | M | 1 | BR-05 | T |
| DRONE-013 | Display the `Simulated` badge on simulator drones everywhere they appear. | M | 1 | BR-17 | I |
| DRONE-014 | Expose adapter capabilities per drone (`telemetry`, `liveVideo`, `missionUpload`, `missionControl`, `mediaSync`) and gate UI actions accordingly. | M | 1 | BR-05 | T |

## MISSION — Missions

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| MISSION-001 | Create a mission with project, site, type (`survey, inspection, progress, video, custom`), name, objective and schedule window. | M | 1 | BR-05 | T |
| MISSION-002 | Mission templates: grid (lawnmower) survey, double-grid, orbit (POI), corridor, waypoint path, freeform. | M | 1 | BR-05 | T |
| MISSION-003 | Generate waypoints server-side from area/path and parameters (altitude AGL, speed, front/side overlap, sensor model, gimbal pitch). Return estimated duration, distance, photo count, GSD and battery count. | M | 1 | BR-05 | T |
| MISSION-004 | Validate the plan: every waypoint inside the site boundary + geofence buffer, outside no-fly zones, altitude ≤ max (org/site), speed ≤ drone max. Return offending waypoints. | M | 1 | BR-05 | T |
| MISSION-005 | Allow manual waypoint editing (add/move/delete, per-waypoint altitude, action, hover time). Re-validate on save. | S | 1 | BR-05 | T |
| MISSION-006 | Save missions as recurring templates (weekly/bi-weekly/monthly) that create planned missions automatically. | S | 1 | BR-10 | T |
| MISSION-007 | Assign drone and pilot. Detect double-booking (overlapping windows) for both. | M | 1 | BR-05 | T |
| MISSION-008 | "My Missions" view for pilots (upcoming/today/overdue) and iCal feed (tokenized URL, revocable). | M | 1 | BR-05 | T |
| MISSION-009 | Approval workflow when project setting `missionApprovalRequired`: submit → approve/reject (with comment) by `mission:approve`. | S | 1 | BR-05 | T |
| MISSION-010 | Enforce the state machine in [PRD §5.8](../02-PRD/Product-Requirements-Document.md#58-feat-mission--missions). Invalid transitions return 409. | M | 1 | BR-05 | T |
| MISSION-011 | Org-configurable pre-flight checklist that must be fully confirmed by the assigned pilot before `start`. | M | 1 | BR-05 | T |
| MISSION-012 | `start` sets `in_progress`, `actual_start`, drone `in_mission`, and opens the telemetry subscription via the adapter. For the simulator, it starts simulated flight along the waypoints. | M | 1 | BR-06 | T |
| MISSION-013 | `pause`/`resume` are recorded. They are forwarded to the provider only if the adapter has `missionControl`. | S | 1 | BR-05 | T |
| MISSION-014 | `stop` (complete) sets `completed`, `actual_end`, releases the drone and computes the flight summary (duration, distance, max alt, min battery). | M | 1 | BR-05 | T |
| MISSION-015 | `abort` requires a reason (`weather, technical, airspace, safety, other` + text). Sets `aborted` and notifies. | M | 1 | BR-05 | T |
| MISSION-016 | Upload the mission to the provider when the adapter has `missionUpload` (Phase 2+). Store `provider_mission_id`. | S | 2 | BR-05 | T |
| MISSION-017 | Mission events log (`mission_events`): state changes, checklist completion, alerts, provider responses. | M | 1 | BR-14 | T |
| MISSION-018 | Calendar view (day/week/month) with drone and pilot lanes. | S | 1 | BR-05 | D |
| MISSION-019 | Flight replay: play back recorded telemetry over the planned path with a time scrubber. | S | 2 | BR-06 | D |
| MISSION-020 | Export the mission plan as KML/KMZ (DJI WPML-compatible) and GeoJSON for manual loading into provider apps. | S | 1 | BR-05 | T |

## TELEM — Telemetry

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| TELEM-001 | Normalize provider telemetry into the canonical schema ([Real-Time Architecture §3](../04-Architecture/Real-Time-Architecture.md#3-canonical-telemetry-schema)). | M | 1 | BR-06 | T |
| TELEM-002 | Validate each message (schema, ranges, monotonic timestamp, drone ↔ mission ↔ org consistency). Reject and count invalid messages. | M | 1 | BR-06 | T |
| TELEM-003 | Accept ingestion at 1–10 Hz per drone. Fan out to clients at a configurable rate (default 2 Hz). | M | 1 | BR-06 | T |
| TELEM-004 | Deliver telemetry to subscribed clients with p95 end-to-end latency < 2 s from provider receipt (< 1 s internal). | M | 2 | BR-06 | T |
| TELEM-005 | Persist telemetry to a time-series store (1 Hz downsampled minimum, full rate configurable) for replay and analytics. | M | 1 | BR-06 | T |
| TELEM-006 | Evaluate alert rules in-stream: battery ≤ 30/20%, geofence breach, altitude > max, signal lost > 10 s, GPS satellites < 6. | M | 1 | BR-06 | T |
| TELEM-007 | Provide WebSocket subscription with ticket auth, heartbeats, reconnection with resume (last sequence). | M | 1 | BR-06 | T |
| TELEM-008 | Live Operations map showing all active missions accessible to the user. | M | 1 | BR-06 | D |
| TELEM-009 | Telemetry history API with time range and resolution (`raw, 1s, 5s, 1m`). | S | 1 | BR-06 | T |
| TELEM-010 | Simulator adapter generating realistic telemetry (wind noise, battery drain model, GPS jitter) along mission waypoints. | M | 1 | BR-06 | T |
| TELEM-011 | Stale-data indication in UI after 3 s without updates. Offline after 10 s. | M | 1 | BR-06 | T |
| TELEM-012 | Telemetry retention per org policy (default 365 days raw-downsampled, 30 days full rate). | S | 2 | BR-14 | T |

## VIDEO — Video

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| VIDEO-001 | Transcode uploaded video (H.264/H.265, MP4/MOV) to an HLS ABR ladder (1080p, 720p, 480p) plus a poster and thumbnail sprite. | M | 1 | BR-07 | T |
| VIDEO-002 | Play back via signed HLS URLs/cookies (TTL ≤ 1 h) only after authorization. | M | 1 | BR-07 | T |
| VIDEO-003 | Extract video metadata (duration, codec, resolution, fps, embedded GPS/SRT telemetry if present). | S | 1 | BR-07 | T |
| VIDEO-004 | Sync DJI SRT/flight-log telemetry with playback (minimap position, altitude). | C | 2 | BR-07 | T |
| VIDEO-005 | Live stream ingest via the streaming gateway (RTMP/RTSP/WHIP) for adapters with `liveVideo`. | S | 2 | BR-06 | T |
| VIDEO-006 | Live playback via WebRTC (WHEP) with LL-HLS fallback. Per-viewer short-lived token. Target glass-to-glass latency < 1.5 s WebRTC, < 6 s LL-HLS. | S | 2 | BR-06 | T |
| VIDEO-007 | Capture a frame from recorded or live video as an image media item linked to source and timestamp. | S | 2 | BR-09 | T |
| VIDEO-008 | Optional recording of live streams to object storage as media (org setting). | C | 2 | BR-07 | T |
| VIDEO-009 | Enforce concurrent viewer limits per stream (plan-based) and show viewer count. | C | 2 | BR-15 | T |
| VIDEO-010 | Meter video processing minutes and live minutes as usage records. | S | 1 | BR-15 | T |

## MEDIA — Media

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| MEDIA-001 | Resumable multipart upload direct to object storage via presigned part URLs (part size 8–64 MB), up to 20 GB per file and 2,000 files per batch. | M | 1 | BR-07 | T |
| MEDIA-002 | Accept types: JPEG, PNG, TIFF/GeoTIFF, DNG, HEIC, MP4, MOV, PDF, GLB/GLTF, OBJ (zip), LAS/LAZ, 3D Tiles (zip), KML/GeoJSON. Validate by magic bytes, not extension. | M | 1 | BR-07 | T |
| MEDIA-003 | Scan every upload for malware in a quarantine bucket before it becomes accessible. Quarantine positives and notify. | M | 1 | BR-17 | T |
| MEDIA-004 | Extract EXIF/XMP (GPS, altitude, gimbal, camera, timestamp) into `media_metadata` and set `location`. | M | 1 | BR-07 | T |
| MEDIA-005 | Generate thumbnails (256 px) and previews (2048 px WebP) for images. Generate deep-zoom tiles for images > 40 MP. | M | 1 | BR-07 | T |
| MEDIA-006 | Auto-link media to mission/site by timestamp window and GPS within boundary. Flag unmatched items for review. | M | 1 | BR-07 | T |
| MEDIA-007 | Browse media in grid, list, map and timeline views with filters (date, type, mission, site, asset, tag, uploader). | M | 1 | BR-07 | T |
| MEDIA-008 | Lightbox with metadata panel, mini-map, keyboard navigation, zoom. | M | 1 | BR-07 | D |
| MEDIA-009 | Manual tags and AI tags (with confidence). Tag search. | S | 1 | BR-07 | T |
| MEDIA-010 | Download originals via signed URL (TTL 5 min). Bulk download as zip (async) for ≤ 10 GB. | M | 1 | BR-07 | T |
| MEDIA-011 | Soft-delete with 30-day trash, restore, and permanent purge by Admin (or automatically by retention). | M | 1 | BR-14 | T |
| MEDIA-012 | Compare two images or capture dates side-by-side / swipe with synced zoom. | M | 1 | BR-10 | D |
| MEDIA-013 | Mark media `shared_with_viewers` to make it visible to Viewer role. | M | 1 | BR-03 | T |
| MEDIA-014 | Duplicate detection by SHA-256 per org (warn and allow skip). | S | 1 | BR-07 | T |
| MEDIA-015 | Track storage usage per org and enforce quota (soft 100%, hard 110%). | M | 1 | BR-15 | T |
| MEDIA-016 | Strip GPS from derivatives shared externally when the org setting `stripLocationOnExternalShare` is on. | S | 2 | BR-14 | T |

## SURVEY — Surveys

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| SURVEY-001 | Create surveys with site, type (`orthomosaic, topographic, volumetric, progress, inspection, as_built`), capture date, target GSD, CRS (EPSG code). | M | 1 | BR-07 | T |
| SURVEY-002 | Define one or more survey areas (polygons inside the site boundary). | M | 1 | BR-08 | T |
| SURVEY-003 | Link missions and raw media to a survey. | M | 1 | BR-07 | T |
| SURVEY-004 | Upload processed outputs: orthomosaic (GeoTIFF/COG), DSM/DTM (GeoTIFF), point cloud (LAS/LAZ), mesh (3D Tiles/OBJ/GLB), contours (GeoJSON/DXF). | M | 1 | BR-08 | T |
| SURVEY-005 | Convert GeoTIFF to Cloud-Optimized GeoTIFF and register it as a map layer with bounds, CRS and resolution. | M | 1 | BR-08 | T |
| SURVEY-006 | Convert LAS/LAZ to 3D Tiles (or COPC) and meshes to 3D Tiles for streaming (Phase 3 twin; stored in Phase 1). | S | 2 | BR-08 | T |
| SURVEY-007 | Submit raw imagery to a connected processing engine and track job status. | S | 2 | BR-16 | T |
| SURVEY-008 | Ingest processing outputs automatically when the job completes. | S | 2 | BR-16 | T |
| SURVEY-009 | Volume calculation on DSM for a polygon with base plane (lowest point, average edge, custom elevation, or prior-survey surface). Report cut/fill/net. | S | 2 | BR-10 | T |
| SURVEY-010 | QA fields: GCP count, RMSE X/Y/Z, checkpoint RMSE, notes. Publishing requires QA fields when org setting `requireSurveyQA` is on. | S | 1 | BR-17 | T |

## MAP — Maps & GIS

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| MAP-001 | Interactive 2D map with streets, satellite and terrain (hillshade) basemaps. | M | 1 | BR-08 | D |
| MAP-002 | Display org/project/site boundaries, assets, flight paths, waypoints, survey areas, inspection findings and live drone positions as toggleable layers. | M | 1 | BR-08 | D |
| MAP-003 | Cluster markers at low zoom (> 200 points). | M | 1 | NFR | T |
| MAP-004 | Feature popups with summary and deep link. | M | 1 | BR-08 | D |
| MAP-005 | Display orthomosaic/DSM layers from COG via a tile endpoint with signed access. | M | 1 | BR-08 | T |
| MAP-006 | Layer manager: order, opacity, visibility, per-date selection. | M | 1 | BR-08 | D |
| MAP-007 | Draw and edit tools (point, line, polygon) for annotations and planning. | M | 1 | BR-08 | T |
| MAP-008 | Measurement tools: geodesic distance, area, elevation profile (with DSM), point elevation. | S | 1 | BR-08 | T |
| MAP-009 | Temporal comparison: swipe/split between two dates of orthomosaics. | M | 1 | BR-10 | D |
| MAP-010 | Coordinates readout in WGS 84 decimal/DMS and a selected projected CRS. | S | 1 | BR-08 | T |
| MAP-011 | Export current view to PNG/PDF and layers to GeoJSON/KML. | S | 1 | BR-12 | T |
| MAP-012 | 3D terrain mode (tilted, extruded terrain) in the 2D map engine. | S | 2 | BR-08 | D |
| MAP-013 | Annotations stored per site with author, visibility (private/project). | S | 1 | BR-08 | T |
| MAP-014 | Fallback to raster OSM basemap if the primary provider fails. Fallback to static image if WebGL is unavailable. | M | 1 | NFR | T |

## TWIN — Digital Twin

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| TWIN-001 | 3D scene with global terrain and imagery (Cesium World Terrain or customer DTM). | M | 3 | BR-08 | D |
| TWIN-002 | Stream photogrammetry meshes as 3D Tiles with LOD. | M | 3 | BR-08 | T |
| TWIN-003 | Display BIM models converted from IFC to 3D Tiles, georeferenced. | S | 3 | BR-08 | T |
| TWIN-004 | Display point clouds (3D Tiles pnts / COPC) with point budget control. | S | 3 | BR-08 | T |
| TWIN-005 | Overlay site boundary, assets, inspection markers, survey areas, flight paths (planned and flown). | M | 3 | BR-08 | D |
| TWIN-006 | Historical model slider to switch between captures and compare (split view). | M | 3 | BR-10 | D |
| TWIN-007 | Click to identify objects (asset, finding, BIM element properties). | M | 3 | BR-08 | T |
| TWIN-008 | Measurements in 3D (distance, height, area). | S | 3 | BR-08 | T |
| TWIN-009 | Live drone position as a 3D model in the scene during missions. | S | 3 | BR-06 | D |
| TWIN-010 | Adaptive quality: device tier detection, screen-space error tuning, max memory. | M | 3 | NFR | T |
| TWIN-011 | Fallback to 2D map when WebGL2 is unsupported or the device tier is low. | M | 3 | NFR | T |
| TWIN-012 | Saved viewpoints (camera positions) shareable within the project and usable in reports. | S | 3 | BR-12 | T |

## INSPECTION — Inspections

Authoritative text: [Asset Inspection Specification §3](../02-PRD/Features/Asset-Inspection.md#3-functional-requirements).

| ID | Summary | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| INSPECTION-001 | Inspection templates with typed items | M | 2 | BR-09 | T |
| INSPECTION-002 | Template versioning | M | 2 | BR-09 | T |
| INSPECTION-003 | Create inspection (project/site/asset/mission) | M | 2 | BR-09 | T |
| INSPECTION-004 | Scheduling and recurrence | S | 2 | BR-09 | T |
| INSPECTION-005 | Create findings with severity, category, location, assignee | M | 2 | BR-09 | T |
| INSPECTION-006 | Attachments with vector annotations | M | 2 | BR-09 | T |
| INSPECTION-007 | Finding from media/video frame | S | 2 | BR-09 | T |
| INSPECTION-008 | Findings on map and twin | M | 2 | BR-08 | D |
| INSPECTION-009 | Comments and mentions | S | 2 | BR-13 | T |
| INSPECTION-010 | Submit with completion rules | M | 2 | BR-09 | T |
| INSPECTION-011 | Approve/reject, no self-approval | M | 2 | BR-09 | T |
| INSPECTION-012 | Immutability after approval | M | 2 | BR-14 | T |
| INSPECTION-013 | Finding workflow and resolution evidence | M | 2 | BR-09 | T |
| INSPECTION-014 | Overdue notifications | S | 2 | BR-13 | T |
| INSPECTION-015 | AI-suggested findings via review queue | S | 2 | BR-11 | T |
| INSPECTION-016 | Inspection PDF report | M | 2 | BR-12 | T |

## PROGRESS — Construction Progress

Authoritative text: [Progress Monitoring Specification §4](../02-PRD/Features/Construction-Progress-Monitoring.md#4-functional-requirements).

| ID | Summary | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| PROGRESS-001 | Milestone CRUD with scope | M | 1 | BR-10 | T |
| PROGRESS-002 | Weight normalization | M | 1 | BR-10 | T |
| PROGRESS-003 | Milestone CSV import | S | 1 | BR-10 | T |
| PROGRESS-004 | Progress records with evidence | M | 1 | BR-10 | T |
| PROGRESS-005 | Approval of progress records | M | 1 | BR-10 | T |
| PROGRESS-006 | Actual/planned/SV computation | M | 1 | BR-10 | T |
| PROGRESS-007 | Progress dashboard (S-curve, Gantt) | M | 1 | BR-10 | D |
| PROGRESS-008 | Before/after capture comparison | M | 1 | BR-10 | D |
| PROGRESS-009 | AI analysis → pending record | S | 2 | BR-11 | T |
| PROGRESS-010 | Survey-metric-driven progress | C | 2 | BR-10 | T |
| PROGRESS-011 | Progress notifications | S | 2 | BR-13 | T |
| PROGRESS-012 | Immutable approved records | M | 1 | BR-14 | T |

## AI — Artificial Intelligence

Authoritative text: [AI Feature Specification](../09-AI/AI-Requirements.md).

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| AI-001 | Progress analysis from aerial imagery against baseline and milestones. Output per the schema in AI spec §4.1. | S | 2 | BR-11 | T |
| AI-002 | Change detection between two co-registered orthomosaics (changed regions as GeoJSON with class + confidence). | S | 2 | BR-11 | T |
| AI-003 | All AI analyses are asynchronous jobs with status and are stored in `ai_analyses` with model, version, prompt version, inputs and outputs. | M | 2 | BR-14 | T |
| AI-004 | AI outputs never change official records without human acceptance. | M | 2 | BR-11 | T |
| AI-005 | Defect detection on inspection imagery (crack, corrosion, spalling, water ingress, missing PPE) producing suggested findings with bounding boxes. | S | 2 | BR-09 | T |
| AI-006 | Review queue for AI suggestions: accept / edit / reject with reason. | M | 2 | BR-11 | T |
| AI-007 | Record reviewer, decision and edits for every AI suggestion (feedback dataset, org opt-in for model improvement). | M | 2 | BR-11 | T |
| AI-008 | Report narrative generation from structured data (no raw PII), editable before publishing. | S | 2 | BR-12 | T |
| AI-009 | Conversational assistant over the user's authorized organization data. | C | 2 | BR-11 | T |
| AI-010 | The assistant retrieves data only via tools that execute with the requesting user's permissions. | M | 2 | BR-02 | T |
| AI-011 | The assistant cites sources (entity links) for factual claims and states uncertainty. | M | 2 | BR-11 | T |
| AI-012 | Prompt-injection defenses: tenant content is treated as data, tool allow-list, no cross-tenant tools, output filtering. | M | 2 | BR-17 | T |
| AI-013 | Media auto-tagging (scene/object tags with confidence). | C | 2 | BR-07 | T |
| AI-014 | Metering of AI credits per org. Hard stop at the plan limit with a clear message. | M | 2 | BR-15 | T |
| AI-015 | Display "AI-assisted — not an engineering certification" disclaimer on all AI outputs and in reports containing AI content. | M | 2 | BR-17 | I |
| AI-016 | Org-level AI controls: enable/disable AI features, data-processing region, opt-in/out of feedback use. | M | 2 | BR-14 | T |

## REPORT — Reports

Authoritative text: [Reporting Specification §4](../02-PRD/Features/Reporting.md#4-functional-requirements).

| ID | Summary | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| REPORT-001 | Generate report by type/template/scope/period/sections | M | 1 | BR-12 | T |
| REPORT-002 | Async generation with statuses and notification | M | 1 | BR-12 | T |
| REPORT-003 | PDF (P1); DOCX/XLSX/HTML (P2) | M | 1 | BR-12 | T |
| REPORT-004 | Branded templates | M | 1 | BR-12 | T |
| REPORT-005 | Permission-respecting content | M | 1 | BR-03 | T |
| REPORT-006 | Evidence deep links | S | 1 | BR-12 | T |
| REPORT-007 | Signed, audited download | M | 1 | BR-14 | T |
| REPORT-008 | Publish to Viewers | M | 1 | BR-12 | T |
| REPORT-009 | External share links | S | 1 | BR-12 | T |
| REPORT-010 | Scheduled reports | S | 2 | BR-12 | T |
| REPORT-011 | AI narrative | S | 2 | BR-11 | T |
| REPORT-012 | Versioning | S | 1 | BR-14 | T |

## NOTIF — Notifications

Authoritative text: [Notification Specification §4](../02-PRD/Features/Notifications.md#4-functional-requirements).

| ID | Summary | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| NOTIF-001 | Transactional outbox and fan-out | M | 1 | BR-13 | T |
| NOTIF-002 | Re-authorize recipients at send time | M | 1 | BR-02 | T |
| NOTIF-003 | In-app list, read state, live unread count | M | 1 | BR-13 | T |
| NOTIF-004 | Critical delivery latency targets | M | 1 | BR-13 | T |
| NOTIF-005 | User preferences | S | 2 | BR-13 | T |
| NOTIF-006 | Org routing rules, Slack/Teams | S | 2 | BR-16 | T |
| NOTIF-007 | Daily digest | S | 2 | BR-13 | T |
| NOTIF-008 | Deduplication | M | 1 | BR-13 | T |
| NOTIF-009 | Minimal email content, unsubscribe | M | 1 | BR-14 | T |
| NOTIF-010 | Delivery tracking and bounces | S | 2 | BR-13 | T |

## AUDIT — Audit Logging

Authoritative text: [Audit Logging Specification](../07-Security/Audit-Logging.md).

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| AUDIT-001 | Record an audit event for every state-changing API action, authentication event, permission change, data export/download and break-glass access. | M | 1 | BR-14 | T |
| AUDIT-002 | Each event captures actor (type, id), org, action, entity type/id, before/after diff (sensitive fields redacted), IP, user agent, request ID, timestamp. | M | 1 | BR-14 | T |
| AUDIT-003 | Audit writes happen in the same DB transaction as the change (or via the outbox for external effects). No action without its audit record. | M | 1 | BR-14 | T |
| AUDIT-004 | The audit table is append-only: the app role has INSERT/SELECT only. A hash chain (`prev_hash`, `hash`) per org detects tampering. | M | 1 | BR-14 | T |
| AUDIT-005 | Admins with `audit:read` search/filter by actor, action, entity, date range, IP. | M | 1 | BR-14 | T |
| AUDIT-006 | Export audit logs to CSV/JSON (async for > 10k rows). | M | 1 | BR-14 | T |
| AUDIT-007 | No UI or API for editing or deleting audit entries. Purge only by retention policy (min 1 year; Enterprise up to 7 years). | M | 1 | BR-14 | T |
| AUDIT-008 | Stream audit events to a customer SIEM via webhook or S3 export (Enterprise). | C | 3 | BR-16 | T |
| AUDIT-009 | Platform-staff actions in a tenant are recorded in the tenant's audit log with `actor_type=platform_staff`. | M | 1 | BR-14 | T |
| AUDIT-010 | Daily hash-chain verification job alerts on mismatch. | S | 2 | BR-14 | T |

## ANALYTICS — Analytics

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| ANALYTICS-001 | Org overview dashboard (projects by status, portfolio % complete, flights, media, open findings). | S | 2 | BR-18 | D |
| ANALYTICS-002 | Operations analytics: flights, flight hours, drone utilization, pilot utilization, aborted mission rate. | S | 2 | BR-18 | T |
| ANALYTICS-003 | Progress analytics: S-curves per project, SV distribution, delayed milestones. | S | 2 | BR-18 | T |
| ANALYTICS-004 | Inspection analytics: findings by severity/category, ageing, MTTR, SLA compliance. | S | 2 | BR-18 | T |
| ANALYTICS-005 | Usage analytics: storage growth, AI credits, video minutes. | M | 1 | BR-15 | T |
| ANALYTICS-006 | All aggregations restricted to the user's accessible projects. | M | 2 | BR-03 | T |
| ANALYTICS-007 | Date range, project and site filters; CSV export. | S | 2 | BR-18 | T |
| ANALYTICS-008 | Data freshness ≤ 15 min (materialized views). Last refreshed time shown. | S | 2 | BR-18 | T |

## INTEG — Integrations

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| INTEG-001 | Integration catalog with availability status per plan. | S | 2 | BR-16 | D |
| INTEG-002 | Connect integrations via OAuth 2.0 or credentials. Secrets stored in the secrets manager, referenced by ID, never returned by the API. | M | 2 | BR-16 | T |
| INTEG-003 | Test connection and health status (last success, last error, error count). | M | 2 | BR-16 | T |
| INTEG-004 | Drone provider adapters registered via the Drone Integration Service (see Drone Architecture). | S | 2 | BR-05 | T |
| INTEG-005 | Photogrammetry engine connectors (NodeODM first, then Pix4D/DroneDeploy). | S | 2 | BR-16 | T |
| INTEG-006 | Outbound webhooks for subscribed event types, HMAC-SHA256 signature, retries with exponential backoff (up to 24 h), delivery log. | S | 2 | BR-16 | T |
| INTEG-007 | API keys scoped to a permission subset and optional project list, with expiry, last-used tracking, revocation. Shown only once. | S | 2 | BR-16 | T |
| INTEG-008 | Slack/Teams notification connectors. | S | 2 | BR-13 | T |
| INTEG-009 | Procore / Autodesk Construction Cloud project linking and document push (reports, photos). | C | 3 | BR-16 | T |
| INTEG-010 | Auto-disable failing integrations/webhooks after 20 consecutive failures and notify Admins. | S | 2 | BR-16 | T |

## BILLING — Billing & Usage

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| BILLING-001 | Plans catalog with limits (seats, projects, storage, AI credits, video minutes, features). | M | 1 | BR-15 | T |
| BILLING-002 | 14-day trial on Professional for new orgs without payment method. | S | 1 | BR-15 | T |
| BILLING-003 | Hosted checkout and customer portal through the payment provider. No card data stored. | M | 1 | BR-15 | I |
| BILLING-004 | Process signed provider webhooks idempotently to update subscription status. | M | 1 | BR-15 | T |
| BILLING-005 | Record usage (`usage_records`) hourly for storage, daily aggregated for AI credits, flight minutes, video minutes. | M | 1 | BR-15 | T |
| BILLING-006 | Usage dashboard with thresholds and notifications at 80/100%. | M | 1 | BR-15 | T |
| BILLING-007 | `past_due` → 14-day grace → read-only mode (no uploads, missions, AI). Data is preserved. | M | 1 | BR-15 | T |
| BILLING-008 | Plan downgrade validation (usage must fit the target plan or a remediation list is shown). | S | 1 | BR-15 | T |
| BILLING-009 | Invoices list with PDF links from the provider. | M | 1 | BR-15 | T |
| BILLING-010 | Usage-based overage reporting to the provider (metered billing) for Professional/Enterprise. | S | 2 | BR-15 | T |

## ADMIN — Platform Administration

| ID | Requirement | Pri | Ph | BR | V |
|---|---|---|---|---|---|
| ADMIN-001 | Separate admin application and API realm with staff-only identities, WebAuthn MFA, IP allow-list. | M | 1 | BR-17 | T |
| ADMIN-002 | Organizations list/search with plan, status, seats, storage, created date, last activity. | M | 1 | BR-02 | T |
| ADMIN-003 | Suspend/reactivate organizations with a required reason. Schedule/cancel deletion. | M | 1 | BR-02 | T |
| ADMIN-004 | User lookup by email. Lock/unlock. Reset 2FA after verified identity (ticket reference required). | M | 1 | BR-17 | T |
| ADMIN-005 | Subscription overrides (extend trial, apply credit, custom limits) with audit. | S | 1 | BR-15 | T |
| ADMIN-006 | Usage overview across tenants (top storage, AI, video consumers). | S | 1 | BR-15 | T |
| ADMIN-007 | System health dashboard (API, DB, Redis, queues, WS, adapters, AI services, storage). | M | 1 | BR-17 | D |
| ADMIN-008 | Feature flags per org/plan/percentage. | S | 1 | BR-17 | T |
| ADMIN-009 | Break-glass tenant access: ticket + justification + approval, ≤ 4 h, Owner notified, full audit. | S | 2 | BR-14 | T |
| ADMIN-010 | Platform audit log of all staff actions, immutable, retained 7 years. | M | 1 | BR-14 | T |
