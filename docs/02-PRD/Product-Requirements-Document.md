# Product Requirements Document (PRD)

| | |
|---|---|
| **Document** | Product Requirements Document |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-02 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product Team |
| **Reviewer** | _Pending — Product Owner, Design Lead, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product Team | Initial draft covering 24 product features |

---

## 1. Purpose and How to Read This Document

This PRD translates the [BRD](../01-BRD/Business-Requirements-Document.md) into product features. Each feature uses the same template:

**Feature · Business purpose · User roles · Preconditions · User flow · Functional requirements · UI requirements · API requirements · Data requirements · Permission requirements · Error states · Acceptance criteria**

- Detailed, testable requirements live in [Functional Requirements](../03-SRS/Functional-Requirements.md). This PRD lists the IDs and the most important requirements.
- Full API contracts are in [API Specification](../06-API/API-Specification.md). Full table definitions are in [Database Design](../05-Database/Database-Design.md).
- Permission keys (e.g. `mission:start`) are defined in [RBAC](../07-Security/RBAC.md).
- Detailed Given/When/Then criteria are in [Acceptance Criteria](../11-QA/Acceptance-Criteria.md).
- Four features have their own deep-dive specs under [Features/](Features/).

## 2. Product Vision

> Every construction site, every flight, every change — captured, located, compared and explained in one trusted place.

**Design principles**

1. **Location first.** Every object can be placed on a map.
2. **Time is a dimension.** Everything is versioned by capture date and can be compared.
3. **Evidence over opinion.** Progress and findings link to the media that proves them.
4. **Humans decide.** AI proposes. Authorized people approve.
5. **Tenant isolation is non-negotiable.**
6. **Honest capability labelling.** Simulated or integration-dependent features are labelled as such in the UI.

## 3. Personas

| Persona | Goals | Pain points | Primary screens |
|---|---|---|---|
| **Olivia — Org Owner** (VP Operations, GC) | Portfolio visibility, cost control, compliance | No consolidated view, many vendor tools | Dashboard, Analytics, Billing |
| **Adam — Org Admin** | Easy user management, SSO, security | Offboarding across many tools | Team, Roles, Integrations, Audit |
| **Priya — Project Manager** | On-time delivery, accurate progress, fast reporting | Reports take days, disputes about dates | Project Detail, Progress, Reports, Maps |
| **Sam — Site Manager** | Know what changed on site, act on issues | Info arrives late | Site Detail, Inspections, Notifications |
| **Diego — Drone Pilot** | Clear assignments, compliant flights, easy upload | Multiple apps, manual transfers | Missions, Drone Fleet, Media Upload |
| **Mei — Surveyor** | Accurate maps, controlled CRS, layers | Large files, versioning | Survey, Maps |
| **Ivan — Inspector** | Fast evidence capture, findings tied to assets | Findings lost in email | Inspections, Asset detail |
| **Elena — Engineer** | Reliable evidence for sign-off | Unclear provenance | Inspection review, AI review |
| **Chris — Client Viewer** | Trustworthy status without noise | Inconsistent contractor reporting | Shared dashboard, Reports |

## 4. Feature Index

| Feature ID | Feature | Phase | BR | Target status at release |
|---|---|---|---|---|
| FEAT-AUTH | Authentication & Account Security | 1 | BR-02, BR-17 | Implemented |
| FEAT-ORG | Organization Onboarding & Settings | 1 | BR-01, BR-02 | Implemented |
| FEAT-RBAC | Roles, Permissions & Team | 1 | BR-03 | Implemented |
| FEAT-PROJECT | Projects | 1 | BR-04 | Implemented |
| FEAT-SITE | Sites | 1 | BR-04 | Implemented |
| FEAT-ASSET | Assets | 1 | BR-04, BR-09 | Implemented |
| FEAT-DRONE | Drone Fleet & Pilots | 1 | BR-05 | Implemented |
| FEAT-MISSION | Missions | 1 | BR-05 | Implemented (logical execution) |
| FEAT-TELEM | Live Telemetry & Live Operations | 1 (simulated) / 2 (real) | BR-06 | Simulated → Integration Required |
| FEAT-VIDEO | Live & Recorded Video | 1 (recorded) / 2 (live) | BR-06, BR-07 | Recorded: Implemented; Live: Integration Required |
| FEAT-MEDIA | Media Library | 1 | BR-07 | Implemented |
| FEAT-SURVEY | Surveys | 1 | BR-07, BR-08 | Implemented (upload); processing Integration Required |
| FEAT-MAP | Maps & GIS | 1 | BR-08 | Implemented |
| FEAT-TWIN | 3D Digital Twin | 3 | BR-08 | Planned |
| FEAT-INSPECTION | Asset Inspections | 2 | BR-09 | Planned |
| FEAT-PROGRESS | Construction Progress | 1 (basic) / 2 (AI) | BR-10 | Implemented / Prototype |
| FEAT-AI | AI Analysis & Assistant | 2 | BR-11 | Prototype |
| FEAT-REPORT | Reports | 1 | BR-12 | Implemented |
| FEAT-NOTIF | Notifications | 2 (in-app in 1) | BR-13 | Implemented |
| FEAT-AUDIT | Audit Logs | 1 | BR-14 | Implemented |
| FEAT-ANALYTICS | Analytics Dashboards | 2 | BR-18 | Planned |
| FEAT-INTEG | Integrations & Webhooks | 2–3 | BR-16 | Integration Required |
| FEAT-BILLING | Billing & Usage | 1 | BR-15 | Implemented |
| FEAT-ADMIN | Platform Administration | 1 | BR-02, BR-15, BR-17 | Implemented |

---

## 5. Feature Specifications

### 5.1 FEAT-AUTH — Authentication & Account Security

| Field | Specification |
|---|---|
| **Business purpose** | Secure, low-friction access. This is the foundation for tenant isolation (BR-02) and enterprise trust (BR-17). |
| **User roles** | All users. Platform staff use a separate admin realm. |
| **Preconditions** | Email can receive mail. For signup: no existing account with that email. For login: account is `active`. |
| **User flow** | **Signup:** Landing → Signup → enter name, work email, password, organization name → verify email (6-digit code or link) → organization created with user as Owner → onboarding wizard. **Login:** email + password → (if 2FA) TOTP code → choose organization (if member of several) → Dashboard. **Reset:** Forgot password → email link (valid 30 min, single use) → new password → all sessions revoked. |
| **Functional requirements** | AUTH-001 – AUTH-020. Key points: argon2id hashing. 15-minute access JWT. Rotating refresh tokens with reuse detection. TOTP 2FA with recovery codes. Admin can enforce org-wide 2FA. Account lockout after 10 failures in 15 min. Enterprise SSO (OIDC/SAML) in Phase 3. |
| **UI requirements** | Login, Signup, Verify Email, Forgot/Reset Password, 2FA Challenge, 2FA Setup (QR + manual key + 10 recovery codes), Organization Switcher, Active Sessions list in Settings → Security. Password strength meter (zxcvbn score ≥ 3 required). Error messages never reveal whether an email exists. |
| **API requirements** | `POST /auth/register`, `/auth/verify-email`, `/auth/login`, `/auth/mfa/verify`, `/auth/refresh`, `/auth/logout`, `/auth/password/forgot`, `/auth/password/reset`, `/auth/mfa/setup`, `/auth/mfa/enable`, `/auth/mfa/disable`, `/auth/switch-organization`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `GET /me`. |
| **Data requirements** | `users`, `refresh_tokens`, `email_verification_tokens`, `password_reset_tokens`, `mfa_recovery_codes`, `organization_members`. |
| **Permission requirements** | Public endpoints are rate-limited. Session management applies only to the user's own sessions. Admins can revoke other users' sessions with `user:manage`. |
| **Error states** | Invalid credentials (generic). Account locked (with retry-after). Email not verified. 2FA code invalid or expired. Refresh-token reuse detected (all sessions revoked, security email sent). Organization suspended. Password breached (HIBP k-anonymity check). |
| **Acceptance criteria** | AC-AUTH-01 – AC-AUTH-08. |

### 5.2 FEAT-ORG — Organization Onboarding & Settings

| Field | Specification |
|---|---|
| **Business purpose** | Each customer is a tenant with its own data boundary, branding and policies. |
| **User roles** | Owner (all), Admin (all except ownership transfer and org deletion). |
| **Preconditions** | Authenticated user. Creating an additional org requires a verified email. |
| **User flow** | After signup → **Onboarding wizard**: 1) Organization profile (name, industry, country, timezone, logo) → 2) Invite team (emails + role) → 3) Create first project (optional) → 4) Register first drone (optional) → Dashboard with a "Getting started" checklist. **Settings:** profile, branding (logo, primary color used in reports), units (metric/imperial), default CRS, security policies (2FA enforcement, session lifetime, allowed email domains), data retention, danger zone (export organization data, delete organization). |
| **Functional requirements** | ORG-001 – ORG-012, TENANT-001 – TENANT-008. |
| **UI requirements** | Onboarding wizard (stepper, skippable steps). Settings with tabs: General, Branding, Security, Data & Retention, Danger Zone. Deletion needs the typed org slug plus re-authentication and has a 30-day grace period. |
| **API requirements** | `GET/POST /organizations`, `GET/PATCH /organizations/current`, `POST /organizations/current/logo`, `POST /organizations/current/export`, `DELETE /organizations/current`, `POST /organizations/current/transfer-ownership`. |
| **Data requirements** | `organizations` (settings JSONB, retention policies), `organization_members`, `retention_policies`. |
| **Permission requirements** | `org:read`, `org:update`, `org:delete` (Owner only), `retention:manage`. |
| **Error states** | Slug already taken. Logo too large or unsupported type. Plan limit reached. Deletion blocked by an active subscription that has not been cancelled. |
| **Acceptance criteria** | AC-ORG-01 – AC-ORG-05. |

### 5.3 FEAT-RBAC — Roles, Permissions & Team

| Field | Specification |
|---|---|
| **Business purpose** | Give each stakeholder exactly the capabilities they need (least privilege), including client access limited to specific projects. |
| **User roles** | Owner and Admin manage. Everyone can view their own role. |
| **Preconditions** | Organization exists. Seat available under the plan. |
| **User flow** | Team → Invite member (email, org role, optional project assignments with project role) → invitee receives an email (valid 7 days) → accepts → signs up or logs in → joins org. Roles → Create custom role → clone from a system role or start blank → toggle permissions grouped by module → save → assign. |
| **Functional requirements** | RBAC-001 – RBAC-012. System roles cannot be edited or deleted. Custom roles are per-org. Effective permissions = org-role permissions ∪ project-role permissions (for that project). Owner/Admin have implicit access to all projects. Every authorization decision is server-side. |
| **UI requirements** | Team table (name, email, role, projects, status, last active, 2FA). Invite modal. Member drawer with role and project assignments. Roles list. Permission matrix editor with module grouping and a "what can this role do?" preview. Disabled UI controls show a tooltip "Requires permission X". |
| **API requirements** | `GET/POST /members`, `PATCH/DELETE /members/:id`, `POST /invitations`, `POST /invitations/:token/accept`, `DELETE /invitations/:id`, `GET/POST /roles`, `PATCH/DELETE /roles/:id`, `GET /permissions`, `GET /me/permissions`. |
| **Data requirements** | `roles`, `permissions`, `role_permissions`, `user_roles`, `project_members`, `site_members`, `invitations`. |
| **Permission requirements** | `user:invite`, `user:manage`, `role:manage`. You cannot grant permissions you do not hold. The last Owner cannot be demoted or removed. |
| **Error states** | Seat limit reached. Invitation expired or already used. Role in use (on delete → reassign required). Escalation attempt (403 + audit). |
| **Acceptance criteria** | AC-RBAC-01 – AC-RBAC-06. |

### 5.4 FEAT-PROJECT — Projects

| Field | Specification |
|---|---|
| **Business purpose** | The project is the commercial and organizational unit for construction work. It groups sites, team, milestones and reports. |
| **User roles** | Owner, Admin, PM create. Project members view according to role. |
| **Preconditions** | Plan's active-project limit not exceeded. |
| **User flow** | Projects → New project → name, code (unique in org), client name, type (building, road, bridge, utility, industrial, other), start/end dates, location (search or map pin), description, cover image → Create → Project Detail (Overview, Sites, Team, Milestones, Missions, Media, Inspections, Progress, Reports, Activity). |
| **Functional requirements** | PROJECT-001 – PROJECT-012. |
| **UI requirements** | Card/table toggle list with filters (status, type, PM, date). Project Detail header shows status, % complete, schedule variance and next milestone. Overview tab: site map, KPI cards, recent activity, latest captures. Archive and restore. |
| **API requirements** | `GET/POST /projects`, `GET/PATCH /projects/:id`, `POST /projects/:id/archive`, `POST /projects/:id/restore`, `GET/POST /projects/:id/members`, `DELETE /projects/:id/members/:userId`, `GET /projects/:id/summary`. |
| **Data requirements** | `projects`, `project_members`. |
| **Permission requirements** | `project:create`, `project:read` (membership-scoped), `project:update`, `project:archive`, `project:member_manage`. |
| **Error states** | Duplicate code. End date before start date. Project limit reached. Archived project is read-only (409 on writes). |
| **Acceptance criteria** | AC-PROJECT-01 – AC-PROJECT-04. |

### 5.5 FEAT-SITE — Sites

| Field | Specification |
|---|---|
| **Business purpose** | A site is a physical, geo-bounded location where work and flights happen. It is the spatial anchor for all data. |
| **User roles** | Owner, Admin, PM, Site Manager manage. Members view. |
| **Preconditions** | Parent project exists and is not archived. |
| **User flow** | Project → Sites → New site → name, code, address (geocoded) → draw boundary polygon on the map, or upload KML/GeoJSON/Shapefile (zip) → optional: no-fly sub-zones, elevation, airspace notes, site contacts → Save → Site Detail (Map, Assets, Missions, Media timeline, Surveys, Inspections, Progress, Twin). |
| **Functional requirements** | SITE-001 – SITE-012. Boundary must be a valid, non-self-intersecting polygon. Area is computed server-side (PostGIS geography). The site centroid is derived automatically. |
| **UI requirements** | Map drawing tools (polygon, edit vertices, delete). Import dropzone. Area readout in m²/ha or ft²/acres. Site Detail with a timeline slider over captures. |
| **API requirements** | `GET/POST /sites`, `GET/PATCH/DELETE /sites/:id`, `POST /sites/import-boundary`, `GET /sites/:id/timeline`. |
| **Data requirements** | `sites` (`boundary geography(MultiPolygon,4326)`, `centroid geography(Point,4326)`), `site_members`. |
| **Permission requirements** | `site:create`, `site:read`, `site:update`, `site:delete`. |
| **Error states** | Invalid geometry. Boundary > 500 km² (soft warning; hard limit configurable). Unsupported import file. Coordinates outside the valid range. |
| **Acceptance criteria** | AC-SITE-01 – AC-SITE-04 (see the BRD-level example in [Acceptance Criteria](../11-QA/Acceptance-Criteria.md#site-creation)). |

### 5.6 FEAT-ASSET — Assets

| Field | Specification |
|---|---|
| **Business purpose** | Physical things on a site (buildings, structures, cranes, towers, roads, utilities, equipment) that are inspected and tracked. |
| **User roles** | Owner, Admin, PM, Site Manager, Inspector create and edit. Others view. |
| **Preconditions** | Site exists. |
| **User flow** | Site → Assets → Add asset → type, name, tag (unique in site), parent asset (hierarchy, e.g. Building A → Level 3 → Column C3-12), location (map click or coordinates + elevation), optional geometry, attributes (custom key/values), condition rating → Save. Bulk import via CSV/GeoJSON. |
| **Functional requirements** | ASSET-001 – ASSET-010. |
| **UI requirements** | Tree and table views. Asset drawer with tabs: details, inspections, findings, media, history. Map markers with type icons. |
| **API requirements** | `GET/POST /assets`, `GET/PATCH/DELETE /assets/:id`, `POST /assets/import`, `GET /assets/:id/history`. |
| **Data requirements** | `assets`. |
| **Permission requirements** | `asset:create`, `asset:read`, `asset:update`, `asset:delete`. |
| **Error states** | Duplicate tag. Parent in another site. Circular hierarchy. Import row errors (row-level report). |
| **Acceptance criteria** | AC-ASSET-01 – AC-ASSET-03. |

### 5.7 FEAT-DRONE — Drone Fleet & Pilots

| Field | Specification |
|---|---|
| **Business purpose** | A reliable record of the fleet, its status and maintenance, and of pilot qualifications. This is a prerequisite for safe mission assignment. |
| **User roles** | Owner, Admin, Pilot manage drones. Admin manages pilot records. PM and Site Manager view. |
| **Preconditions** | For connected drones: an integration configured (FEAT-INTEG). |
| **User flow** | Drone Fleet → Register drone → choose provider (`Manual`, `Simulator`, or a connected provider) → manufacturer, model, serial, name, registration/remote-ID number, payloads, max flight time, home site → Save. For connected providers: "Sync from provider" lists discovered aircraft to import. Pilot profiles: Team → member → Pilot tab → license number, type, issuing authority, expiry, certificates (upload). |
| **Functional requirements** | DRONE-001 – DRONE-014. Status lifecycle `available → in_mission → available`, `maintenance`, `offline`, `retired`. Maintenance log. Flight-hours accumulator. License-expiry warnings at 30/7/0 days. A drone with an expired registration, or a pilot with an expired license, cannot be assigned to a mission (hard block, Admin override with reason, audited). |
| **UI requirements** | Fleet grid with status badges, battery (if live), last seen, provider badge (`Simulated` where applicable). Drone detail: specs, missions, flight log, maintenance, media. |
| **API requirements** | `GET/POST /drones`, `GET/PATCH /drones/:id`, `POST /drones/:id/retire`, `POST /drones/:id/maintenance`, `GET /drones/:id/flight-log`, `POST /integrations/:id/sync-drones`, `GET/POST/PATCH /pilots`. |
| **Data requirements** | `drones`, `drone_pilots`, `drone_maintenance_logs`. |
| **Permission requirements** | `drone:register`, `drone:read`, `drone:update`, `drone:retire`, `pilot:manage`. |
| **Error states** | Duplicate serial. Provider sync failure. Drone in mission cannot be retired. |
| **Acceptance criteria** | AC-DRONE-01 – AC-DRONE-04. |

### 5.8 FEAT-MISSION — Missions

| Field | Specification |
|---|---|
| **Business purpose** | Plan, approve, assign, execute and record drone flights tied to a project, site and purpose (survey, inspection, progress capture, video). |
| **User roles** | PM / Site Manager create and request. Pilot accepts and executes. Admin / PM approve (if approval is required by org policy). All project members view. |
| **Preconditions** | Site with boundary. Drone `available`. Pilot with a valid license. |
| **User flow** | Missions → New mission → site → type → template (grid survey, orbit around asset, corridor/linear, waypoint path, freeform video) → draw area or path on the map → parameters (altitude AGL, speed, front/side overlap, gimbal pitch, capture mode) → auto-generated waypoints shown with estimated duration, photo count, battery count → schedule → assign drone + pilot → submit for approval (optional) → approved → **Ready** → pilot opens mission → completes pre-flight checklist → **Start** → live tracking (telemetry) → **Complete** or **Abort** (reason required) → upload media (auto-linked to mission) → post-flight report. |
| **State machine** | `draft → planned → (pending_approval → approved \| rejected) → ready → in_progress ⇄ paused → completed \| aborted \| failed`; `cancelled` from any pre-flight state. |
| **Functional requirements** | MISSION-001 – MISSION-020. Waypoint generation runs server-side so results are deterministic. Geofence check: all waypoints must be within the site boundary + buffer (default 50 m) and outside no-fly sub-zones. Altitude must not exceed the org-configured max (default 120 m AGL). **Start/Stop are logical state transitions unless the drone's adapter declares `missionControl`**. Even then, the pilot confirms in the provider app. |
| **UI requirements** | Mission planner (map + side panel). Calendar and list views. Mission detail with status timeline, checklist, live view link, media, flight log. `Simulated` banner for simulator missions. |
| **API requirements** | `GET/POST /missions`, `GET/PATCH /missions/:id`, `POST /missions/:id/generate-waypoints`, `PUT /missions/:id/waypoints`, `POST /missions/:id/submit`, `/approve`, `/reject`, `/start`, `/pause`, `/resume`, `/stop`, `/abort`, `/cancel`, `PUT /missions/:id/checklist`, `GET /missions/:id/telemetry`. |
| **Data requirements** | `drone_missions`, `mission_waypoints`, `mission_events`, `telemetry`. |
| **Permission requirements** | `mission:create`, `mission:read`, `mission:update`, `mission:approve`, `mission:start` (assigned pilot, or Owner/Admin), `mission:abort`. |
| **Error states** | Geofence violation (lists offending waypoints). Drone unavailable or double-booked. Pilot license expired. Invalid state transition (409). Provider rejected upload. Telemetry lost (> 10 s no data → `signal_lost` warning). |
| **Acceptance criteria** | AC-MISSION-01 – AC-MISSION-07. |

### 5.9 FEAT-TELEM — Live Telemetry & Live Operations

| Field | Specification |
|---|---|
| **Business purpose** | Real-time situational awareness of active flights for safety oversight and remote stakeholders. |
| **User roles** | Anyone with `telemetry:read` on the project. |
| **Preconditions** | Mission `in_progress` with an adapter that provides telemetry (Simulator in MVP). |
| **User flow** | Live Operations → map of all active missions in accessible projects → select drone → HUD panel (altitude, speed, heading, battery, GPS fix, satellites, signal, flight time) + breadcrumb trail + planned path → alerts (low battery 30% / 20%, geofence breach, signal lost, altitude exceeded) → open live video (if available). |
| **Functional requirements** | TELEM-001 – TELEM-012. See [Real-Time Architecture](../04-Architecture/Real-Time-Architecture.md). |
| **UI requirements** | Full-bleed map, glass HUD overlays, alert toasts with severity colors, connection-state indicator (Live / Reconnecting / Offline), `Simulated` striped banner. |
| **API requirements** | `POST /realtime/ticket`, WebSocket `wss://…/realtime` channels `mission.{id}.telemetry`, `org.live-ops`. `GET /missions/:id/telemetry?from&to&resolution` for replay. |
| **Data requirements** | `telemetry` (time-series). |
| **Permission requirements** | `telemetry:read`, project-scoped. |
| **Error states** | WebSocket auth failure (close 4401). Forbidden channel (4403). Stale data indicator after 3 s without updates. |
| **Acceptance criteria** | AC-TELEM-01 – AC-TELEM-04. |

### 5.10 FEAT-VIDEO — Live & Recorded Video

| Field | Specification |
|---|---|
| **Business purpose** | Visual evidence and remote observation. |
| **User roles** | `media:read` (recorded), `livevideo:view` (live). |
| **Preconditions** | Recorded: uploaded video. Live: provider adapter with `liveVideo` capability and a configured streaming gateway. |
| **User flow** | Recorded: Media → video → HLS player with timeline, telemetry-synced minimap (if flight log exists), frame capture → "Create finding from frame". Live: Live Ops → drone → "Watch live" → WebRTC player (fallback LL-HLS). |
| **Functional requirements** | VIDEO-001 – VIDEO-010. See [Video Architecture](../04-Architecture/Video-Architecture.md). |
| **UI requirements** | Player with quality selector, latency indicator for live, fullscreen, snapshot. |
| **API requirements** | `GET /media/:id/playback` (signed HLS URL), `POST /live-streams/:droneId/session` (viewer token). |
| **Data requirements** | `media`, `media_metadata`, `live_stream_sessions`. |
| **Permission requirements** | `media:read`, `livevideo:view`. |
| **Error states** | Transcoding failed (retry). Stream offline. Viewer limit reached. Unsupported codec. |
| **Acceptance criteria** | AC-VIDEO-01 – AC-VIDEO-03. |

### 5.11 FEAT-MEDIA — Media Library

| Field | Specification |
|---|---|
| **Business purpose** | Central, searchable, geolocated store of all aerial and ground media. |
| **User roles** | Upload: Owner, Admin, PM, Site Manager, Pilot, Surveyor, Inspector. View: all members on the project (Viewer sees only `shared_with_viewers = true` media). |
| **Preconditions** | Project/site selected. Storage quota available. |
| **User flow** | Media → Upload → drag files/folders (up to 2,000 files or 50 GB per batch) → choose project/site/mission (auto-suggested from EXIF GPS + timestamp) → resumable multipart upload with per-file progress → server scan → processing (thumbnails, EXIF, HLS) → appears in grid/map/timeline views → tag, share, download, compare. |
| **Functional requirements** | MEDIA-001 – MEDIA-016. |
| **UI requirements** | Grid, list, map and timeline views. Filters (date, type, mission, tag, AI tag, asset). Lightbox with EXIF panel and mini-map. Side-by-side and swipe comparison. Bulk actions. |
| **API requirements** | `POST /media/uploads` (initiate multipart), `POST /media/uploads/:id/parts`, `POST /media/uploads/:id/complete`, `GET /media`, `GET /media/:id`, `PATCH /media/:id`, `DELETE /media/:id`, `GET /media/:id/download`, `POST /media/:id/tags`, `POST /media/bulk`. |
| **Data requirements** | `media`, `media_metadata`, `media_tags`, `upload_sessions`. |
| **Permission requirements** | `media:upload`, `media:read`, `media:download`, `media:delete`, `media:share`. |
| **Error states** | Unsupported type. File > 20 GB. Quota exceeded. Malware detected (quarantined, uploader and Admin notified). Corrupt file. |
| **Acceptance criteria** | AC-MEDIA-01 – AC-MEDIA-06. |

### 5.12 FEAT-SURVEY — Surveys

| Field | Specification |
|---|---|
| **Business purpose** | Manage survey campaigns and their geospatial outputs (orthomosaic, DSM/DTM, point cloud, contours, volumes). |
| **User roles** | Surveyor, PM, Site Manager create. Pilot uploads raw captures. |
| **Preconditions** | Site exists. For processing: a processing integration connected. |
| **User flow** | Survey → New survey → site, type, survey areas (polygons), target GSD, CRS → link mission(s) → upload raw images **or** processed outputs (GeoTIFF/COG, LAS/LAZ, 3D Tiles, OBJ/GLB) → if a processing engine is connected: "Process" → job status → outputs registered as map layers / twin models → QA checklist (GCP RMSE entry) → Publish. |
| **Functional requirements** | SURVEY-001 – SURVEY-010. |
| **UI requirements** | Survey list. Survey detail with outputs, processing status, accuracy report, publish toggle. |
| **API requirements** | `GET/POST /surveys`, `GET/PATCH /surveys/:id`, `POST /surveys/:id/areas`, `POST /surveys/:id/outputs`, `POST /surveys/:id/process`, `POST /surveys/:id/publish`. |
| **Data requirements** | `surveys`, `survey_areas`, `maps`, `map_layers`, `twin_models`. |
| **Permission requirements** | `survey:create`, `survey:read`, `survey:upload`, `survey:process`, `survey:publish`. |
| **Error states** | No processing engine (show `Integration Required` empty state). Invalid GeoTIFF (no georeference). CRS unsupported. Processing failed (provider error surfaced). |
| **Acceptance criteria** | AC-SURVEY-01 – AC-SURVEY-03. |

### 5.13 FEAT-MAP — Maps & GIS

| Field | Specification |
|---|---|
| **Business purpose** | The spatial workspace. Every object in context. |
| **User roles** | All members (read). Surveyor, PM, Site Manager (layer management, annotation). |
| **User flow** | Maps → choose site → basemap switcher (2D streets / satellite / terrain / 3D) → layer panel (boundaries, assets, flight paths, survey areas, inspection points, drone live positions, orthomosaics by date) → tools (measure distance/area/elevation, annotate, draw, compare dates with swipe) → export view (PNG/PDF), export layer (GeoJSON/KML). |
| **Functional requirements** | MAP-001 – MAP-014. See [GIS Specification](../10-GIS-3D/GIS-Specification.md). |
| **UI requirements** | Map controls per the [Design System](../08-UX/Design-System.md#11-map-controls). |
| **API requirements** | `GET /maps`, `GET /maps/:id`, `GET /map-layers?siteId`, `POST /map-layers`, `PATCH /map-layers/:id`, `GET /tiles/{layerId}/{z}/{x}/{y}` (signed), `POST /annotations`, `GET /sites/:id/features` (GeoJSON FeatureCollection). |
| **Data requirements** | `maps`, `map_layers`, `annotations`. |
| **Permission requirements** | `map:read`, `map:annotate`, `map:layer_manage`. |
| **Error states** | Basemap provider unavailable (fallback to OSM raster). Tile 404 outside bounds. WebGL unavailable (2D raster fallback). |
| **Acceptance criteria** | AC-MAP-01 – AC-MAP-04. |

### 5.14 FEAT-TWIN — 3D Digital Twin

See [Digital Twin Specification](../10-GIS-3D/Digital-Twin.md). Summary: CesiumJS-based scene of terrain, photogrammetry meshes (3D Tiles), BIM (IFC → 3D Tiles), point clouds, assets, inspection markers, flight paths, with a historical model slider. Requirements: TWIN-001 – TWIN-012. Permissions: `twin:read`, `twin:model_upload`. AC: AC-TWIN-01 – AC-TWIN-04. Phase 3. A **Prototype** viewer for uploaded 3D Tiles may ship in Phase 2.

### 5.15 FEAT-INSPECTION — Asset Inspections

See [Asset Inspection Specification](Features/Asset-Inspection.md). Requirements INSPECTION-001 – INSPECTION-016. Phase 2.

### 5.16 FEAT-PROGRESS — Construction Progress

See [Construction Progress Monitoring Specification](Features/Construction-Progress-Monitoring.md). Requirements PROGRESS-001 – PROGRESS-012.

### 5.17 FEAT-AI — AI Analysis & Assistant

See [AI Feature Specification](../09-AI/AI-Requirements.md). Requirements AI-001 – AI-016. **Mandatory rule: AI respects the same permissions as the requesting user.**

### 5.18 FEAT-REPORT — Reports

See [Reporting Specification](Features/Reporting.md). Requirements REPORT-001 – REPORT-012.

### 5.19 FEAT-NOTIF — Notifications

See [Notification Specification](Features/Notifications.md). Requirements NOTIF-001 – NOTIF-010.

### 5.20 FEAT-AUDIT — Audit Logs

See [Audit Logging Specification](../07-Security/Audit-Logging.md). Requirements AUDIT-001 – AUDIT-010.

### 5.21 FEAT-ANALYTICS — Analytics Dashboards

| Field | Specification |
|---|---|
| **Business purpose** | Portfolio and operational insight for decision-makers. |
| **User roles** | Owner, Admin, PM (org-wide within accessible projects). Site Manager (own sites). Viewer (shared project dashboards). |
| **User flow** | Analytics → choose scope (org / project / site) and period → widgets: flights & flight hours, media volume, survey coverage, progress vs. plan (S-curve), open findings by severity and age, mean time to resolve, pilot utilization, drone utilization, storage and AI usage → export CSV. |
| **Functional requirements** | ANALYTICS-001 – ANALYTICS-008. Analytics respect project membership (aggregations only over accessible projects). |
| **API requirements** | `GET /analytics/overview`, `GET /analytics/operations`, `GET /analytics/progress`, `GET /analytics/inspections`, `GET /analytics/usage`. |
| **Data requirements** | Read-only materialized views refreshed every 15 min (`mv_project_kpis`, `mv_flight_stats`, `mv_finding_stats`). |
| **Permission requirements** | `analytics:read`. |
| **Error states** | Insufficient data (empty states with guidance). |
| **Acceptance criteria** | AC-ANALYTICS-01 – AC-ANALYTICS-02. |

### 5.22 FEAT-INTEG — Integrations & Webhooks

| Field | Specification |
|---|---|
| **Business purpose** | Fit into the customer's ecosystem (BR-16). |
| **User roles** | Owner, Admin. |
| **Catalog** | **Drone providers:** DJI Cloud API / FlightHub 2, Skydio Cloud, MAVLink edge bridge (Phase 2–4). **Processing:** Pix4D, DroneDeploy, OpenDroneMap/NodeODM (Phase 2). **Construction PM:** Procore, Autodesk Construction Cloud (Phase 3). **Collaboration:** Slack, Microsoft Teams (Phase 2). **Identity:** OIDC, SAML 2.0, SCIM (Phase 3). **Generic:** outbound webhooks, API keys (Phase 2). |
| **User flow** | Integrations → catalog → Connect → OAuth consent or credential form (stored in the secrets manager, never displayed again) → test connection → configure mappings (e.g. Procore project ↔ AeroSight project) → status card with last sync and errors. |
| **Functional requirements** | INTEG-001 – INTEG-010. |
| **API requirements** | `GET /integrations/catalog`, `GET/POST /integrations`, `PATCH/DELETE /integrations/:id`, `POST /integrations/:id/test`, `GET/POST /webhooks`, `PATCH/DELETE /webhooks/:id`, `GET /webhooks/:id/deliveries`, `GET/POST /api-keys`, `DELETE /api-keys/:id`. |
| **Data requirements** | `integrations`, `webhooks`, `webhook_deliveries`, `api_keys`. |
| **Permission requirements** | `integration:manage`, `apikey:manage`. |
| **Error states** | OAuth denied. Credentials invalid. Provider rate-limited. Webhook endpoint failing (auto-disable after 20 consecutive failures, Admin notified). |
| **Acceptance criteria** | AC-INTEG-01 – AC-INTEG-03. |

### 5.23 FEAT-BILLING — Billing & Usage

| Field | Specification |
|---|---|
| **Business purpose** | Monetization and cost control (BR-15). |
| **User roles** | Owner. Admin if delegated (`billing:manage`). |
| **User flow** | Billing → current plan, seats used, usage meters (storage GB, AI credits, video minutes, flight minutes) with 80%/100% thresholds → Change plan → hosted checkout (Stripe) → invoices list → payment methods (hosted portal; AeroSight never handles card data). |
| **Functional requirements** | BILLING-001 – BILLING-010. Soft limits warn. Hard limits block new uploads or AI calls. Existing data is never deleted for non-payment until the retention period after cancellation ends. |
| **API requirements** | `GET /billing/subscription`, `POST /billing/checkout-session`, `POST /billing/portal-session`, `GET /billing/invoices`, `GET /billing/usage`, `POST /webhooks/stripe` (provider webhook, signature-verified). |
| **Data requirements** | `plans`, `subscriptions`, `usage_records`. |
| **Permission requirements** | `billing:manage`. |
| **Error states** | Payment failed (`past_due` → 14-day grace → read-only). Downgrade blocked by usage above the target plan. |
| **Acceptance criteria** | AC-BILLING-01 – AC-BILLING-03. |

### 5.24 FEAT-ADMIN — Platform Administration

| Field | Specification |
|---|---|
| **Business purpose** | Operate the SaaS safely. |
| **User roles** | Platform Administrator, Support (read-only). Separate admin app at `admin.` subdomain. Separate identity realm with enforced hardware-key 2FA (WebAuthn). |
| **Screens** | Organizations (list, detail, suspend, reactivate, schedule deletion), Users (search by email, lock, reset 2FA with verified ticket), Subscriptions, Usage, System Health, Audit Logs (platform-wide, includes staff actions), Feature flags. |
| **Functional requirements** | ADMIN-001 – ADMIN-010. Staff cannot view tenant content (media, findings, reports) except through **break-glass**: a justification and ticket number are required, access is time-boxed (max 4 h), the Org Owner is notified, and everything is audited. |
| **API requirements** | `/admin/v1/*` (separate gateway route, IP allow-list, staff tokens only). |
| **Acceptance criteria** | AC-ADMIN-01 – AC-ADMIN-03. |

---

## 6. Cross-Cutting Product Requirements

| Area | Requirement |
|---|---|
| **Search** | Global command palette (⌘K) searches projects, sites, assets, missions, media (by filename/tag) and reports. Results are permission-filtered. |
| **Comments & mentions** | Comments with @mentions on missions, findings, media, inspections and reports. Mentions notify (subject to permission to view the entity). |
| **Activity feed** | Per-project feed derived from audit events (human-readable). |
| **Units & locale** | Metric/imperial per user preference, falling back to the org default. Timezone per site for flight times. Dates shown in the user's timezone with site-time tooltip. i18n-ready (English at launch; Arabic RTL planned). |
| **Accessibility** | WCAG 2.2 AA (see [NFR](../03-SRS/Non-Functional-Requirements.md#8-accessibility-nfr-a11y)). |
| **Empty states** | Every list has an educational empty state with a primary action. |
| **Capability labels** | Use the README status legend in the UI (`Simulated`, `Beta`, `Connect provider`). |

## 7. Release Phasing

See [Roadmap](../13-Product/Roadmap.md) and [MVP Scope](../13-Product/MVP.md).
