# MVP Scope

| | |
|---|---|
| **Document** | MVP Scope |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-34 |
| **Version** | 0.3 |
| **Status** | Draft |
| **Author** | AeroSight AI Product |
| **Reviewer** | _Pending — Product Owner, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product | Initial MVP definition and implementation status register |
| 0.2 | 2026-10-06 | Engineering | Status register updated for the Phase 1 demo build |
| 0.3 | 2026-10-06 | Engineering | Phase 2 capabilities added to the demo build |
| 0.5 | 2026-10-06 | Engineering | Phase 4 capabilities added: predictive insights, capture schedules + weather, BIM 4D/5D, drone ecosystem, automations |
| 0.4 | 2026-10-06 | Engineering | Phase 3 capabilities added: mission control, Cesium digital twin, OIDC SSO + SCIM, edge telemetry ingest, analytics v2, Procore/ACC connectors, SIEM export |

---

## 1. MVP Goal

Within ~20 weeks, ship a **secure, multi-tenant** platform that lets design-partner contractors:

1. Set up their organization, team and roles.
2. Model projects, sites (with boundaries) and assets on a map.
3. Register drones and pilots, plan and validate missions, and track them (logical execution, simulated telemetry).
4. Upload and organize aerial media and processed survey outputs (orthomosaics).
5. Compare captures over time and record milestone-based progress with evidence.
6. Generate branded PDF progress reports and share them with clients.
7. Trust the platform: audit logs, tenant isolation, 2FA, signed media access.

**MVP success criteria (pilot, 8 weeks after Pilot GA):**
- ≥ 3 design-partner orgs, ≥ 10 active sites, ≥ 50 missions recorded, ≥ 25,000 media items.
- ≥ 1 monthly report per active project generated in AeroSight (vs. manual).
- 0 security incidents. 0 cross-tenant defects found in pentest.
- Report generation time reduced from days to < 30 min end-to-end (customer-reported).

## 2. In Scope (MVP)

| Area | Included |
|---|---|
| Auth | Email/password, email verification, TOTP 2FA (+ org enforcement), sessions, password reset, org switching |
| Org & team | Onboarding wizard, settings, branding, invitations, system + custom roles, deactivation |
| Projects/sites/assets | CRUD, boundaries (draw/import), no-fly zones, asset hierarchy + CSV import, site timeline |
| Maps | Streets/satellite/terrain basemaps, layers, orthomosaic display (COG), measurement (distance/area/elevation), swipe compare, export |
| Fleet | Drone registry, maintenance log, pilot licenses with expiry blocks, simulator drones |
| Missions | Templates (grid, double-grid, orbit, corridor, waypoint), server waypoint generation and validation, scheduling, double-booking prevention, approval, checklist, logical start/complete/abort, KMZ/WPML export, calendar |
| Live ops | Live Operations map with **simulated** telemetry, HUD, alerts (battery, geofence, signal) |
| Media | Resumable uploads, malware scanning, EXIF, thumbnails/previews, recorded video HLS, auto-link, library views, compare, tags, sharing to viewers, trash |
| Surveys | Survey records, areas, upload of processed outputs (GeoTIFF→COG), QA fields, publish |
| Progress | Milestones (weighted, CSV import), progress records with evidence and approval, S-curve, SV, compare |
| Reports | Progress, survey and mission reports (PDF), templates/branding, publish, external links, versions |
| Notifications | In-app + transactional email for core events |
| Audit | Full audit trail, search, export, hash chain |
| Billing | Plans, trial, hosted checkout/portal, usage meters, limits |
| Platform admin | Orgs, users, subscriptions, usage, health, flags, platform audit |

## 3. Out of Scope (MVP)

| Item | Phase |
|---|---|
| Real provider telemetry and live video | 2 |
| Inspections module | 2 |
| AI features (all) | 2 (Prototype) |
| Processing-engine integrations | 2 |
| Slack/Teams, web push, digests, preferences | 2 |
| Analytics dashboards (beyond usage) | 2 |
| Webhooks, API keys | 2 |
| 3D Digital Twin | 3 (prototype viewer possibly 2) |
| SSO/SCIM | 3 |
| Multi-region | 3 (MVP runs in one region) |
| Native mobile apps, offline mode | Future |
| Autonomous flight control | Not before verified provider integration (Phase 3+) |

## 4. Implementation Status Register

**This table is the single source of truth for capability status.** Update it in the same PR that changes a capability (docs gate).

Legend: see [README §2.1](../README.md#21-implementation-status-legend).

| Capability | Phase | Target status at phase release | **Current status** | Last updated | Evidence |
|---|---|---|---|---|---|
| Authentication & 2FA | 1 | Implemented | Prototype — password + TOTP 2FA (QR, recovery codes, replay protection, org enforcement), lockout, signed sessions | 2026-10-06 | Demo build (`src/`), `npm test` |
| Organizations & onboarding | 1 | Implemented | Prototype — signup creates org + owner (in-memory) | 2026-10-06 | Demo build (`src/`), `npm test` |
| Tenant isolation (RLS + suite) | 1 | Implemented | Prototype — PolicyEngine + repository scoping, tests (no RLS: in-memory store) | 2026-10-06 | Demo build (`src/`), `npm test` |
| RBAC & custom roles | 1 | Implemented | Prototype — 9 system roles × 75 permissions enforced server-side (no custom roles) | 2026-10-06 | Demo build (`src/`), `npm test` |
| Projects | 1 | Implemented | Prototype | 2026-10-06 | Demo build (`src/`), `npm test` |
| Sites & assets | 1 | Implemented | Prototype — boundary drawing + validation; assets seeded | 2026-10-06 | Demo build (`src/`), `npm test` |
| 2D / satellite / terrain maps | 1 | Implemented | Prototype | 2026-10-06 | Demo build (`src/`), `npm test` |
| Orthomosaic display (uploaded COG) | 1 | Implemented | Planned | 2026-10-06 | — |
| Photogrammetry processing | 2 | Integration Required | Integration Required — NodeODM connector with live /info connection test | 2026-10-06 | Demo build (`src/`), `npm test` |
| Drone registry & pilots | 1 | Implemented | Prototype | 2026-10-06 | Demo build (`src/`), `npm test` |
| Mission planning & lifecycle | 1 | Implemented (logical execution) | Prototype — server-validated planning, approval, checklist, logical start/stop, KML export | 2026-10-06 | Demo build (`src/`), `npm test` |
| Mission upload to provider | 2 | Integration Required | Planned | 2026-10-06 | — |
| Mission control commands | 3 | Integration Required (verified adapters only) | Prototype — pause / resume / return-to-home for the Simulator adapter (the only verified adapter); pilot confirmation, org setting, platform kill switch (`DRONE_COMMANDS_DISABLED`), command + ack log, audit | 2026-10-06 | Demo build (`src/`), `npm test` |
| Telemetry — simulator | 1 | Simulated | Simulated — SSE stream with alerts | 2026-10-06 | Demo build (`src/`), `npm test` |
| Telemetry — real provider | 2 | Integration Required → Implemented | Prototype — edge-bridge ingestion (`POST /api/v1/ingest/telemetry`, per-drone device tokens, validation, ordering, clock-skew checks) + reference bridge `scripts/edge-bridge.mjs`; DJI Cloud API still Integration Required | 2026-10-06 | Demo build (`src/`), `npm test` |
| Recorded video | 1 | Implemented | Planned | 2026-10-06 | — |
| Live video | 2 | Integration Required | Integration Required | 2026-10-06 | Demo build (`src/`), `npm test` |
| Media library | 1 | Implemented | Prototype — seeded items with synthetic previews; uploads disabled | 2026-10-06 | Demo build (`src/`), `npm test` |
| Surveys | 1 | Implemented | Prototype — records + QA metadata only | 2026-10-06 | Demo build (`src/`), `npm test` |
| Progress (manual, milestones) | 1 | Implemented | Prototype | 2026-10-06 | Demo build (`src/`), `npm test` |
| AI progress analysis | 2 | Prototype | Prototype — Claude (when ANTHROPIC_API_KEY set) or heuristic; human review queue | 2026-10-06 | Demo build (`src/`), `npm test` |
| AI change detection | 2 | Prototype | Integration Required — needs vision model + imagery storage | 2026-10-06 | Demo build (`src/`), `npm test` |
| AI defect detection | 2 | Prototype | Integration Required — needs vision model + imagery storage | 2026-10-06 | Demo build (`src/`), `npm test` |
| AI report narrative | 2 | Prototype | Prototype — Claude with number verification, template fallback | 2026-10-06 | Demo build (`src/`), `npm test` |
| AI assistant | 2 | Prototype | Prototype — Claude tool loop, permission-scoped tools (needs ANTHROPIC_API_KEY) | 2026-10-06 | Demo build (`src/`), `npm test` |
| Inspections | 2 | Implemented | Prototype — templates with versioning, scheduling, checklist, findings, approvals | 2026-10-06 | Demo build (`src/`), `npm test` |
| Reports (PDF) | 1 | Implemented | Prototype — generate/publish; PDF via browser print | 2026-10-06 | Demo build (`src/`), `npm test` |
| Notifications (core) | 1 | Implemented | Prototype — in-app only | 2026-10-06 | Demo build (`src/`), `npm test` |
| Audit logs | 1 | Implemented | Prototype — hash-chained, CSV export, SIEM JSONL pull export with `since` cursor | 2026-10-06 | Demo build (`src/`), `npm test` |
| Analytics | 2 | Implemented | Prototype — v2: project benchmarking, finding SLA compliance, MTTR, fleet utilization, period filter, CSV export (formula-injection safe) | 2026-10-06 | Demo build (`src/`), `npm test` |
| Integrations (webhooks, API keys) | 2 | Implemented | Prototype — signed webhooks + delivery log, scoped API keys, Slack/Teams routing, SSRF guard | 2026-10-06 | Demo build (`src/`), `npm test` |
| Integrations (Procore, ACC) | 3 | Integration Required | Integration Required — OAuth 2.0 connectors (authorize, token exchange/refresh, connection test) built; finding/report sync Planned; needs customer developer apps | 2026-10-06 | Demo build (`src/`), `npm test` |
| 3D Digital Twin | 3 | Implemented (Prototype viewer in 2) | Prototype — CesiumJS globe: procedural asset models growing with approved progress (history slider), synthetic point cloud, planned/flown paths, findings, live drone, identify, 3D measure, saved viewpoints, 2D fallback. No photogrammetry 3D Tiles / BIM yet | 2026-10-06 | Demo build (`src/`), `npm test` |
| SSO / SCIM | 3 | Implemented | Prototype — OIDC (discovery, auth code + PKCE, JWKS-verified id_token, nonce), DNS-TXT domain verification, JIT provisioning, enforcement (owners keep password recovery); SCIM 2.0 Users (list/filter, create, replace, patch, delete→deactivate). SAML Integration Required | 2026-10-06 | Demo build (`src/`), `npm test` |
| Billing & usage | 1 | Implemented | Planned | 2026-10-06 | — |
| Notifications v2 (preferences, Slack/Teams, digest, dedupe) | 2 | Implemented | Prototype | 2026-10-06 | Demo build (`src/`) |
| Retention policies, legal holds, DSAR & org export | 2 | Implemented | Prototype | 2026-10-06 | Demo build (`src/`), `npm test` |
| Break-glass support access | 2 | Implemented | Prototype — read-only, time-boxed, audited, Owner notified | 2026-10-06 | Demo build (`src/`), `npm test` |
| Advanced mapping (3D terrain, elevation profile, volumes) | 2 | Implemented | Prototype — real public DEM (~30 m); survey DSM needs processing | 2026-10-06 | Demo build (`src/`), `npm test` |
| Multi-region data residency | 3 | Implemented | Planned — infrastructure (per-region stacks, region-pinned storage; see docs/04-Architecture/Deployment-Architecture.md). The demo runs in one Vercel region; `organization.region` is recorded only | 2026-10-06 | — |
| Predictive analytics (delay forecast, risk scoring) | 4 | Implemented | Prototype — Earned Schedule forecast (data-date SPI(t), P10/P50/P90, on-time probability) + explainable 0–100 risk score; daily risk alerts. Statistical, not trained ML | 2026-10-06 | Demo build (`src/`), `npm test` |
| Automated site intelligence (scheduled captures + analysis) | 4 | Implemented | Prototype — recurring capture schedules (timezone/DST aware) generate missions via cron, Open-Meteo weather go/no-go, auto AI analysis on completion. Dock auto-launch Integration Required | 2026-10-06 | Demo build (`src/`), `npm test` |
| Advanced BIM (4D/5D, BIM-vs-as-built) | 4 | Implemented | Prototype — milestone-linked elements, 4D plan-vs-built in the 3D twin, EVM (SPI/CPI/EAC/VAC/TCPI), deviation checks → findings. IFC & ERP import Integration Required; seeded elements/costs/as-built are synthetic | 2026-10-06 | Demo build (`src/`), `npm test` |
| Multi-provider drone ecosystem | 4 | Implemented | Prototype — adapter registry + capability matrix (Simulator, Manual, MAVLink β, DJI, Skydio, Parrot, Autel), per-org enablement; vendor adapters Integration Required | 2026-10-06 | Demo build (`src/`), `npm test` |
| Enterprise automation (workflow builder, rules engine) | 4 | Implemented | Prototype — 11 triggers, conditions, 7 actions, run-as-creator permissions, loop prevention, throttling, run log | 2026-10-06 | Demo build (`src/`), `npm test` |
| Platform admin | 1 | Implemented | Prototype — tenant metadata overview | 2026-10-06 | Demo build (`src/`), `npm test` |

"Evidence" links to the PR, test report or release where the status changed.

> **Demo build note (2026-10-06):** The capabilities marked *Prototype* above are implemented in the Phase 1 demo build in `src/` — a single Next.js app with an in-memory, seeded data store, deployed to Vercel. They are *Prototype* rather than *Implemented* because the build has no persistent database (PostgreSQL/RLS), object storage, email or production auth hardening (2FA enrollment, refresh-token rotation). See ADR-013 in [Technical Design](../04-Architecture/Technical-Design.md#2-architecture-decision-records).

## 5. MVP Delivery Plan (indicative sprints, 2 weeks each)

| Sprint | Focus |
|---|---|
| 1 | Repo scaffold, CI, infra (dev), DB baseline + RLS, auth core |
| 2 | 2FA, sessions, orgs, onboarding, invitations, RBAC engine + matrix tests |
| 3 | Projects, sites (geometry, import), maps foundation |
| 4 | Assets, media upload pipeline (multipart, scan, EXIF, thumbnails) |
| 5 | Media library views, compare, video HLS, drones & pilots |
| 6 | Mission planner, waypoint generation, validation, scheduling |
| 7 | Mission lifecycle, checklist, simulator adapter, realtime gateway, Live Ops |
| 8 | Surveys + COG layers, measurements, swipe compare, milestones & progress |
| 9 | Reports (templates, PDF rendering, sharing), notifications, audit UI, billing |
| 10 | Platform admin, hardening, performance tests, pentest, pilot onboarding |

## 6. MVP Risks (top)

R-02 (multi-tenant security), R-05 (large media cost), R-12 (scope creep), R-13 (geospatial complexity). See the [Risk Register](Risks.md).
