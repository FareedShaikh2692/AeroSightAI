# Product Roadmap

| | |
|---|---|
| **Document** | Product Roadmap |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-33 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product |
| **Reviewer** | _Pending — Product Owner, Executive Sponsor, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product | Initial 4-phase roadmap |

---

## 1. Timeline Overview (indicative)

Durations are relative to the engineering kickoff (**M0**) and assume the [team plan](#5-indicative-team) below. Dates are fixed at phase planning once velocity is known.

```text
M0 ────── M5 ──────────── M10 ──────────────── M16 ───────────────── M24+
│ Phase 1 MVP │  Phase 2           │  Phase 3                │  Phase 4
│ (~20 weeks) │  (~20 weeks)       │  (~24 weeks)            │  (ongoing)
│ Pilot GA    │  Live & AI (Beta)  │  3D twin, Enterprise    │  Predictive, BIM, ecosystem
```

| Phase | Theme | Duration | Exit milestone |
|---|---|---|---|
| **Phase 1 — MVP** | Trusted foundation: tenancy, RBAC, projects/sites, maps, fleet & missions, media, basic progress, reports, audit | ~20 weeks | Pilot GA with 3–5 design-partner customers |
| **Phase 2** | Live operations & intelligence | ~20 weeks | Commercial GA (Professional plan) |
| **Phase 3** | Immersive & enterprise | ~24 weeks | Enterprise plan GA |
| **Phase 4** | Predictive & ecosystem | Ongoing | — |

## 2. Phase Contents

### Phase 1 — MVP

| Capability | Target status | Key requirements |
|---|---|---|
| Authentication (password, TOTP 2FA, sessions) | Implemented | AUTH-001–016, 019–020 |
| Company onboarding & org settings | Implemented | ORG-001–007, 009–012 |
| Multi-tenancy (RLS, isolation suite) | Implemented | TENANT-001–008 |
| RBAC (system + custom roles) | Implemented | RBAC-001–012 |
| Projects | Implemented | PROJECT-001–012 |
| Sites & assets | Implemented | SITE-001–010, 012; ASSET-001–005, 007–008 |
| Maps (2D, satellite, terrain; orthomosaic layers; measure; compare) | Implemented | MAP-001–011, 013–014 |
| Drone registration & pilots | Implemented | DRONE-001–009, 011–014 |
| Missions (planning, validation, approval, logical execution) | Implemented | MISSION-001–015, 017–018, 020 |
| Telemetry (simulator) & Live Ops view | **Simulated** | TELEM-001–003, 005–011 |
| Media (upload, scan, process, library, compare, recorded video) | Implemented | MEDIA-001–015, VIDEO-001–003, 010 |
| Surveys (upload processed outputs) | Implemented | SURVEY-001–005, 010 |
| Basic progress monitoring | Implemented | PROGRESS-001–008, 012 |
| Reports (PDF, templates, publish, share links) | Implemented | REPORT-001–009, 012 |
| Notifications (in-app + email essentials) | Implemented | NOTIF-001–004, 008–009 |
| Audit logs | Implemented | AUDIT-001–007, 009 |
| Billing & usage | Implemented | BILLING-001–009 |
| Platform admin | Implemented | ADMIN-001–008, 010 |

### Phase 2

| Capability | Target status | Notes |
|---|---|---|
| Live telemetry from a real provider (first adapter, DJI Cloud API) | Integration Required → Implemented | Dependent on D-01 |
| Live video (WebRTC/LL-HLS) | Integration Required → Implemented | Streaming gateway |
| Advanced mapping (3D terrain, volumes, elevation profiles, DXF) | Implemented | MAP-012, SURVEY-009 |
| Inspections (templates, findings, approvals) | Implemented | INSPECTION-001–016 |
| AI analysis (progress, change detection, defect assist, narrative, tagging, assistant) | **Prototype (Beta)** | AI-001–016 |
| Processing integrations (NodeODM, Pix4D/DroneDeploy) | Integration Required | SURVEY-006–008 |
| Notifications (preferences, digests, Slack/Teams, push) | Implemented | NOTIF-005–007, 010 |
| Mobile/tablet optimization (field checklists, offline drafts) | Implemented | |
| Analytics dashboards | Implemented | ANALYTICS-001–008 |
| Webhooks & API keys | Implemented | INTEG-006–007 |
| Retention policies, legal holds, DSAR tooling | Implemented | PRIV-002, PRIV-005 |
| WebAuthn 2FA, break-glass | Implemented | AUTH-012, ADMIN-009 |
| Twin viewer prototype (uploaded 3D Tiles) | Prototype (flag) | TWIN-001–002 subset |

### Phase 3

| Capability | Target status |
|---|---|
| 3D Digital Twin (meshes, BIM, point clouds, history, measurements) | Implemented |
| Advanced AI (AI promoted from Prototype to Implemented where eval gates pass; multi-project assistant) | Implemented / Prototype |
| Autonomous mission integrations (dock workflows, verified `missionControl`) | Integration Required → Implemented per provider |
| Advanced analytics (portfolio benchmarking, custom dashboards) | Implemented |
| External integrations (Procore, Autodesk Construction Cloud, SIEM export) | Implemented |
| Enterprise SSO (OIDC/SAML), SCIM | Implemented |
| Multi-region data residency, dedicated cells | Implemented |
| MAVLink edge bridge | Integration Required → Implemented |

### Phase 4

| Capability | Notes |
|---|---|
| Predictive analytics (delay prediction, risk scoring) | Requires historical data volume |
| Automated site intelligence (scheduled autonomous captures + automatic analysis pipelines) | Depends on dock providers and regulation |
| Advanced BIM integration (4D/5D: schedule- and cost-linked models, BIM-vs-as-built deviation) | |
| Multi-provider drone ecosystem (Skydio, Parrot, Autel, others; marketplace) | |
| Enterprise automation (workflow builder, rules engine) | |

## 3. Release Gates per Phase

Each phase ends with: the Release Checklist, the performance plan subset, an external pentest (before Phase 1 GA and Phase 3 GA), UAT with design partners, and an update to the [MVP status register](MVP.md#4-implementation-status-register).

## 4. Dependencies & Critical Path

1. Tenancy + RBAC foundations (weeks 1–6) block everything else.
2. Media pipeline (weeks 4–12) blocks surveys, progress compare and reports.
3. The first drone provider partnership (D-01) must be signed by mid-Phase 1 to hit Phase 2 live telemetry.
4. AI evaluation datasets (D-06) must be collected with design partners during Phase 1 (with consent) to meet Phase 2 quality gates.

## 5. Indicative Team

| Role | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Product Manager | 1 | 1 | 2 |
| Product Designer | 1 | 1 | 2 |
| Frontend engineers | 3 | 3 | 4 (incl. 1 3D specialist) |
| Backend engineers | 3 | 4 | 4 |
| GIS/geo engineer | 1 | 1 | 2 |
| AI/ML engineers | 0 (0.5 data) | 2 | 3 |
| DevOps/SRE | 1 | 1.5 | 2 |
| QA engineers | 1 | 2 | 2 |
| Security engineer | 0.5 | 0.5 | 1 |
