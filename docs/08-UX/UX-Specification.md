# UI/UX Design Specification

| | |
|---|---|
| **Document** | UI/UX Design Specification (Screen Inventory) |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-12 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Design |
| **Reviewer** | _Pending — Design Lead, Product Owner, Frontend Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Design | Initial screen inventory (44 screens) |

---

## 1. Experience Principles

| Principle | Meaning in the UI |
|---|---|
| **Map is home** | Every spatial entity opens in context. Split views (list + map) are the default for sites, missions, media, findings. |
| **Time travel** | A capture-date timeline is available on site views. Comparisons are one click away. |
| **Calm command center** | Dark, low-glare operational surfaces for live ops. Light, document-like surfaces for reports and settings. |
| **Progressive disclosure** | Summary → drawer → full page. Advanced parameters are collapsed by default. |
| **Honest states** | `Simulated`, `Beta`, `Connect provider`, `AI-assisted` labels are always visible where relevant. |
| **Field-ready** | Large touch targets on tablet, a Sunlight high-contrast theme, offline-tolerant forms. |

Visual language: **premium 3D enterprise construction intelligence**. Defined in [Design System](Design-System.md).

## 2. Global Layout (application)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top bar: Org switcher ▾ | Breadcrumb | ⌘K Search | Live ops pill (●2 live) | 🔔 | Help | Avatar ▾ │
├────────┬─────────────────────────────────────────────────────────────────────┤
│ Side   │ Page header: Title · status chips · primary action · secondary menu │
│ nav    ├─────────────────────────────────────────────────────────────────────┤
│ (icons │ Content (tabs / split view / full-bleed map)                         │
│ +labels│                                                                     │
│ collap-│                                                                     │
│ sible) │                                              Job tray (uploads,     │
│        │                                              reports, AI) ▲         │
└────────┴─────────────────────────────────────────────────────────────────────┘
```

**Side navigation (grouped):**
- **Overview:** Dashboard, Analytics
- **Work:** Projects, Sites, Maps, 3D Twin
- **Operations:** Live Operations, Missions, Drone Fleet
- **Data:** Media, Surveys, Inspections, Progress, Reports
- **Organization:** Team, Roles, Integrations, Billing, Settings

Items are hidden when the user lacks the permission for the entire area (e.g. Billing). Breakpoints: ≥ 1440 wide, 1024–1439 standard, 768–1023 tablet (nav collapses to icons), < 768 mobile (bottom tab bar: Home, Projects, Missions, Inspections, More).

## 3. Screen Inventory

Each screen lists: **Route · Purpose · Roles · Key components · Data/API · States · Permissions**. Standard states (loading skeleton, empty, error with retry and request ID, forbidden, offline) apply to all screens and are specified in [Design System §15](Design-System.md#15-loading-empty--error-states).

### 3.1 Public (marketing site — statically generated)

| # | Screen | Route | Purpose | Key components |
|---|---|---|---|---|
| P1 | **Landing** | `/` | Convert visitors | Hero with an interactive 3D site (pre-rendered Cesium scene or video fallback), tagline "See Every Site. Track Every Progress. Build Smarter.", value props (Visibility, Progress, Inspections, AI), product tour carousel, logos, metrics, CTA (Start free trial / Book demo) |
| P2 | **Features** | `/features` | Explain modules | Sticky module nav: Drone Ops, Live Telemetry, Mapping & 3D, Progress, Inspections, AI, Reports, Security. Each has a screenshot and status labels (Beta/Coming soon) |
| P3 | **Industries** | `/industries` | Vertical messaging | Commercial building, Infrastructure (roads/bridges/rail), Energy & utilities, Mining & earthworks, Real-estate developers & lenders |
| P4 | **Pricing** | `/pricing` | Plans | 3 plan cards, monthly/annual toggle, feature comparison table, usage add-ons, FAQ, Enterprise contact |
| P5 | **About** | `/about` | Trust | Mission, team, security & compliance summary, careers |
| P6 | **Contact** | `/contact` | Leads | Form (name, work email, company, size, message, consent), sales/support emails. Form posts to the CRM with spam protection (honeypot + rate limit; no CAPTCHA solving required by users beyond an invisible challenge) |
| P7 | **Login** | `/login` | Sign in | Email, password, "Forgot password", SSO button ("Continue with SSO" → org slug), 2FA step |
| P8 | **Signup** | `/signup` | Trial signup | Name, work email, password + strength meter, organization name, country, terms checkbox → Verify email screen |
| P9 | Verify / Forgot / Reset / Accept invitation | `/verify`, `/forgot`, `/reset`, `/invite/[token]` | Auth support | 6-digit code input, resend timer |

### 3.2 Application

| # | Screen | Route | Purpose | Roles | Key components | Data / API |
|---|---|---|---|---|---|---|
| A1 | **Dashboard** | `/app/[org]/dashboard` | Portfolio at a glance | All | KPI cards (active projects, portfolio % complete, flights this week, open critical/high findings, storage use), portfolio map (project pins colored by schedule status), "Needs attention" list (overdue findings, approvals pending, at-risk milestones, expiring licenses), recent captures carousel, upcoming missions, getting-started checklist. Viewer variant: shared projects only. | `/projects?limit=…`, `/analytics/overview`, `/missions?from=today`, `/findings?overdue` |
| A2 | **Projects** | `/projects` | Browse projects | All | Card/table toggle, filters (status, type, PM, date), search, "New project" (PM+) | `/projects` |
| A3 | **Project Detail** | `/projects/[id]` | Project workspace | Members | Header (code, name, status chip, % complete ring, SV chip, next milestone). Tabs: **Overview** (map of sites, KPIs, activity, latest captures), **Sites**, **Team**, **Milestones**, **Missions**, **Media**, **Inspections**, **Progress**, **Reports**, **Activity**, **Settings** | `/projects/:id`, `/projects/:id/summary` |
| A4 | **Sites** | `/sites` | All accessible sites | Members | Split list + map, filters by project | `/sites` |
| A5 | **Site Detail** | `/sites/[id]` | Site workspace | Members | Full-bleed map with boundary, assets, no-fly zones. Left panel tabs: Overview, Assets (tree), Missions, Media timeline, Surveys, Inspections, Progress. Bottom **capture timeline** slider. "Open in 3D" button. | `/sites/:id`, `/sites/:id/features`, `/sites/:id/timeline` |
| A6 | **3D Digital Twin** | `/sites/[id]/twin` | Immersive 3D | Members with `twin:read` | Cesium viewport, model/layer panel, history slider, compare split, measurement tools, identify panel, viewpoints, 3D controls (Design System §12), quality selector, fallback banner | `/twin/models`, tilesets |
| A7 | **Live Operations** | `/live` | Monitor active flights | `telemetry:read` | Dark full-bleed map, active mission list (left), drone HUD (right): altitude, speed, heading compass, battery gauge, GPS/satellites, signal, flight time, mode. Planned path + flown trail. Alert feed. Video panel (PiP, dockable). Connection indicator. `Simulated` striped banner. | WS `org:…:liveops`, mission channels |
| A8 | **Drone Fleet** | `/fleet` | Manage drones | `drone:read` | Grid of drone cards (render/photo, name, model, status badge, battery, last seen, provider badge, hours), filters, "Register drone", Pilots tab (license status) | `/drones`, `/pilots` |
| A9 | Drone Detail | `/fleet/[id]` | Drone record | `drone:read` | Specs, capabilities chips, status timeline, maintenance log, flight log, media, documents | `/drones/:id` |
| A10 | **Missions** | `/missions` | Plan and track flights | `mission:read` | List / Calendar (day/week/month with drone & pilot lanes) / Map views. "My missions" toggle for pilots. Status filters. | `/missions` |
| A11 | Mission Planner | `/missions/new`, `/missions/[id]/edit` | Create/edit plan | `mission:create/update` | Map with drawing tools. Template picker. Parameters panel (altitude, speed, overlaps, gimbal, camera). Live estimates card (duration, distance, photos, GSD, batteries). Validation list with offending waypoints highlighted. Schedule + assignment step. Review step. | `/missions`, `/missions/:id/generate-waypoints` |
| A12 | Mission Detail | `/missions/[id]` | Execute and review | `mission:read` | Status stepper, details, checklist (pilot), primary actions (Submit/Approve/Start/Pause/Complete/Abort per state + permission), live panel link, flight replay, events log, media, export menu | `/missions/:id` |
| A13 | **Survey** | `/surveys`, `/surveys/[id]` | Survey campaigns | `survey:read` | List; detail with areas map, linked missions, outputs (orthomosaic/DSM/point cloud/mesh) with processing status, QA form, Publish, volume tool | `/surveys/*` |
| A14 | **Maps** | `/maps` | GIS workspace | `map:read` | Site picker, basemap switcher (Streets / Satellite / Terrain / 3D), layer manager, date picker per raster layer, tools (measure, profile, annotate, draw, compare swipe), coordinates readout, export | `/maps`, `/map-layers`, tiles |
| A15 | **Media** | `/media` | Media library | `media:read` | Views: Grid / List / Map / Timeline. Facets: project, site, mission, date, type, tag, AI tag, asset, uploader, shared. Bulk action bar. Lightbox (zoom, EXIF, mini-map, tags, linked entities, "Create finding", "Compare"). Upload modal with batch progress. Trash view. | `/media`, uploads |
| A16 | **Inspections** | `/inspections`, `/inspections/[id]` | Inspection workflow | `inspection:read` | List tabs (My, All, Awaiting review, Overdue). Detail: checklist pane, evidence/map pane, findings list, status bar with the primary action. Finding drawer with annotation canvas. Templates sub-page. | `/inspections/*`, `/findings/*` |
| A17 | **Progress** | `/progress`, project tab | Progress tracking | `progress:read` | KPI strip, S-curve, milestone Gantt, milestone table, pending approvals, Compare view, AI analysis review screen | `/projects/:id/progress*` |
| A18 | **Reports** | `/reports`, `/reports/[id]` | Generate and share | `report:read` | List, Generate wizard (4 steps), detail with PDF viewer, versions, share links, publish. Templates sub-page. | `/reports/*` |
| A19 | **Analytics** | `/analytics` | Insight | `analytics:read` | Scope + period selectors, widget grid (Operations, Progress, Inspections, Usage), CSV export, "data as of" stamp | `/analytics/*` |
| A20 | **Team** | `/team` | Members | `user:manage` (full) / `org:read` (directory) | Members table, invite modal, member drawer (role, projects, pilot profile, 2FA status, sessions revoke), pending invitations | `/members`, `/invitations` |
| A21 | **Roles** | `/roles` | Roles & permissions | `role:manage` | Roles list (system locked), role editor (permission matrix grouped by module, sensitive markers, diff preview), "Compare roles" | `/roles`, `/permissions` |
| A22 | **Notifications** | `/notifications` | Notification center | All | List with filters (category, severity, unread), mark read, link to entity | `/notifications` |
| A23 | **Integrations** | `/integrations` | Connect systems | `integration:manage` | Catalog cards (status label: Available / Connected / Error / Coming soon / Integration Required), connect flows, webhooks, API keys tabs | `/integrations/*`, `/webhooks`, `/api-keys` |
| A24 | **Billing** | `/billing` | Plan & usage | `billing:manage` | Plan card, usage meters with thresholds, change plan, invoices, payment method (portal) | `/billing/*` |
| A25 | **Settings** | `/settings/*` | Configuration | Varies | Tabs: Profile, Security (password, 2FA, sessions), Notifications (preferences matrix), Organization General, Branding, Security policy, Data & Retention, Audit Logs, Danger Zone | various |
| A26 | AI Assistant | Slide-over panel (⌘J) | Ask questions | `ai:assistant` | Chat with streaming answers, citations as entity chips, scope selector (project), disclaimer, "New conversation", history | `/ai/assistant/*` |
| A27 | Public report viewer | `/share/reports/[token]` | External viewing | Anyone with link | Org branding, passcode gate, PDF viewer, download, expiry notice | `/public/reports/:token` |

### 3.3 Platform Admin (separate app `admin.aerosight.ai`)

| # | Screen | Purpose | Key components |
|---|---|---|---|
| X1 | **Organizations** | Tenant management | Table (name, slug, plan, status, seats, storage, created, last active, region), detail (overview, members count, usage, subscription, status actions with reason modal, deletion schedule) |
| X2 | **Users** | Identity support | Email search, user detail (memberships, status, MFA, last login), lock/unlock, reset MFA (ticket ref required) |
| X3 | **Subscriptions** | Commercial ops | Status filters (trialing, past_due…), overrides (trial extension, custom limits) |
| X4 | **Usage** | Cost oversight | Top consumers (storage, AI, video), anomalies, trends |
| X5 | **System Health** | Operations | Service status tiles, SLO burn rates, queue depths, WS connections, adapter health per provider, AI latency/cost, storage growth, recent incidents. Links to Grafana. |
| X6 | **Audit Logs** | Accountability | Platform audit (staff actions) + break-glass sessions log |
| X7 | Feature Flags | Rollouts | Flag list, targeting rules |
| X8 | Break-glass | Controlled access | Request form (org, ticket, justification, duration), approvals, active sessions with countdown |

## 4. Key Interaction Specifications

### 4.1 Map interactions
- Click a feature → popup (summary + "Open"). Shift-click → multi-select. Drag on empty space → pan. Right-click → context menu (copy coordinates, measure from here, create annotation, plan mission here).
- The URL reflects map state (`?lng&lat&z&layers&date`) for shareable views.

### 4.2 Capture timeline
Horizontal track of capture dates (dots sized by media count). Drag to change the active date for raster layers and media filters. Two handles in compare mode.

### 4.3 Uploads
Drag-drop anywhere on Media/Mission/Survey pages. Uploads continue during navigation (job tray). If a tab closes mid-upload, re-opening offers "Resume N files". Per-file states: queued, uploading %, verifying, scanning, processing, ready, needs review, failed (retry).

### 4.4 Destructive actions
Modal with consequences ("This will remove 1,240 images (18.2 GB) to trash for 30 days"). Irreversible actions (purge, org delete) require typing the name.

### 4.5 Permissions in UI
Actions the user lacks permission for are **hidden** when the whole feature is irrelevant to the role, and **disabled with a tooltip** ("Requires Mission approver permission") when the user can see the object but not act on it.

### 4.6 Status labelling
| Label | Placement |
|---|---|
| `Simulated` | Drone cards, mission headers, live HUD banner (striped amber), telemetry exports |
| `Beta` | Nav items and feature headers for Prototype features |
| `AI-assisted` | Every AI output block, report sections, findings with `ai_generated` |
| `Connect provider` / `Integration required` | Empty states of features that depend on integrations |

## 5. Content & Microcopy Guidelines
- Use construction vocabulary (site, capture, milestone, finding) rather than generic tech terms.
- Use sentence case. Buttons use verbs ("Start mission", "Generate report").
- Errors follow: what happened → why → what to do → request ID.
- Units always shown (m, m², %, km/h or mph per preference). Coordinates to 6 decimals.
- Dates: relative for < 7 days ("3 h ago") with an absolute tooltip. Site-local time with a timezone suffix for flight schedules.

## 6. Accessibility Specifics
- All map/3D features are reachable through list equivalents (e.g. findings list synced with markers).
- Keyboard: `⌘K` search, `⌘J` assistant, `G then P` go to projects, `?` shortcuts help. In the lightbox: arrows, `+/-` zoom. In the player: space, `,` `.` frame step.
- Focus rings visible (2 px accent + offset). Live regions announce telemetry alerts (polite) and critical alerts (assertive).

## 7. Internationalization
ICU messages. Logical CSS properties (`margin-inline-start`) for RTL readiness (Arabic planned). Number and date formatting via `Intl`.
