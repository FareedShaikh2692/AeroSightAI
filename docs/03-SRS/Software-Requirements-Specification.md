# Software Requirements Specification (SRS)

| | |
|---|---|
| **Document** | Software Requirements Specification |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-03 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Engineering |
| **Reviewer** | _Pending — Tech Lead, QA Lead, Security Engineer_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Engineering | Initial draft (structure loosely follows ISO/IEC/IEEE 29148) |

---

## 1. Introduction

### 1.1 Purpose
This SRS specifies the software requirements for AeroSight AI in a form that can be implemented, verified and traced. It is the contract between product, engineering and QA.

### 1.2 Scope
AeroSight AI is a cloud-hosted, multi-tenant web platform (web application, REST/WebSocket API, background workers, AI services, platform admin console). It covers the in-scope capabilities of the [BRD §6.1](../01-BRD/Business-Requirements-Document.md#61-in-scope).

### 1.3 Document set
| Part | Document |
|---|---|
| Functional requirements (catalog of all `<MOD>-NNN` IDs) | [Functional-Requirements.md](Functional-Requirements.md) |
| Non-functional requirements (`NFR-*`) | [Non-Functional-Requirements.md](Non-Functional-Requirements.md) |
| Security (`SEC-*`) and privacy (`PRIV-*`) requirements | [Security-Requirements.md](../07-Security/Security-Requirements.md), [Privacy.md](../07-Security/Privacy.md) |
| Traceability | [Traceability-Matrix.md](Traceability-Matrix.md) |

### 1.4 Definitions
See [Glossary](../13-Product/Glossary.md).

### 1.5 Requirement wording
- **shall** = mandatory, verifiable.
- **should** = recommended. Deviations are recorded in an ADR.
- **may** = optional.

Priority uses MoSCoW: Must / Should / Could / Won't (this release).

## 2. Overall Description

### 2.1 Product perspective

```text
                ┌───────────────────────── AeroSight AI (cloud) ─────────────────────────┐
 Browser (SPA) ─┤ CDN/WAF → API Gateway → Core API (modular monolith) ─ PostgreSQL+PostGIS │
 Admin console ─┤                        → Realtime Gateway (WS)        ─ Redis            │
 API clients  ──┤                        → Workers (media, report, notify, AI orchestration)│
                │                        → AI Service (Python)          ─ Object storage   │
                │                        → Drone Integration Service    ─ Streaming gateway│
                └──────────────────────────────────────────────┬────────────────────────────┘
                                                               │
      External: Drone provider APIs · Photogrammetry engines · Basemap/terrain tiles ·
                Email provider · Payment provider · LLM/vision model APIs · IdPs (OIDC/SAML)
```

Details are in [System Architecture](../04-Architecture/System-Architecture.md).

### 2.2 User classes
Organization Owner, Organization Admin, Project Manager, Site Manager, Drone Pilot, Surveyor, Inspector, Engineer, Client/Viewer, Platform Administrator, Support. See [BRD §4](../01-BRD/Business-Requirements-Document.md#4-stakeholders) and [RBAC](../07-Security/RBAC.md).

### 2.3 Operating environment
| Component | Requirement |
|---|---|
| Browsers | Latest 2 versions of Chrome, Edge, Firefox, Safari. WebGL 2 required for 3D (2D fallback otherwise). |
| Devices | Desktop ≥ 1280 px (primary). Tablet ≥ 768 px (field use). Phone ≥ 360 px (read, notifications, checklists, uploads). |
| Server runtime | Linux containers on Kubernetes. Node.js 22 LTS. Python 3.12. PostgreSQL 16 + PostGIS 3.4 (+ TimescaleDB 2.x). Redis 7. S3-compatible object storage. |
| Regions | One primary region per deployment (default `eu-central-1` / `me-central-1` / `us-east-1`). Data residency by deployment. |

### 2.4 Design and implementation constraints
- C-01: All tenant data **shall** carry `organization_id` and be protected by PostgreSQL Row-Level Security in addition to application checks ([Multi-Tenancy](../04-Architecture/Multi-Tenancy.md)).
- C-02: The drone layer **shall** be provider-agnostic through the adapter interface ([Drone Architecture](../04-Architecture/Drone-Architecture.md)).
- C-03: AeroSight **shall not** issue flight-control commands unless a verified adapter declares the capability and the pilot confirms.
- C-04: AI outputs **shall** be advisory and require human review before becoming official records.
- C-05: No payment card data in AeroSight systems (PCI scope reduced by using hosted checkout).
- C-06: All external interfaces use TLS 1.2+ (TLS 1.3 preferred).
- C-07: Open-source dependencies must have licenses compatible with commercial SaaS (no AGPL in distributed or linked server code without legal review).

### 2.5 Assumptions and dependencies
See [Assumptions & Dependencies](../13-Product/Assumptions-Dependencies.md).

## 3. External Interface Requirements

### 3.1 User interfaces
Specified in [UX Specification](../08-UX/UX-Specification.md), [User Flows](../08-UX/User-Flows.md) and [Design System](../08-UX/Design-System.md).

### 3.2 Software interfaces

| ID | Interface | Direction | Protocol | Spec |
|---|---|---|---|---|
| IF-01 | AeroSight REST API | Inbound | HTTPS/JSON, OpenAPI 3.1 | [API Spec](../06-API/API-Specification.md) |
| IF-02 | Realtime API | Inbound | WSS, JSON messages | [Real-Time Architecture](../04-Architecture/Real-Time-Architecture.md) |
| IF-03 | Drone provider APIs | Outbound/Inbound | HTTPS, MQTT, WebSocket (per provider) | [Drone Architecture](../04-Architecture/Drone-Architecture.md) |
| IF-04 | Live video ingest | Inbound | RTMP / RTSP / WHIP (WebRTC) | [Video Architecture](../04-Architecture/Video-Architecture.md) |
| IF-05 | Live video playback | Outbound | WebRTC (WHEP), LL-HLS | same |
| IF-06 | Photogrammetry engines | Outbound | HTTPS (provider APIs, NodeODM API) | [GIS Spec](../10-GIS-3D/GIS-Specification.md) |
| IF-07 | Basemap / terrain tiles | Outbound (client) | HTTPS XYZ / vector tiles / quantized-mesh | GIS Spec |
| IF-08 | LLM / vision model APIs | Outbound | HTTPS | [AI Requirements](../09-AI/AI-Requirements.md) |
| IF-09 | Payment provider | Outbound + signed webhooks | HTTPS | API Spec §6.20 |
| IF-10 | Email provider | Outbound + bounce webhooks | HTTPS/SMTP | [Notifications](../02-PRD/Features/Notifications.md) |
| IF-11 | Identity providers | Outbound/Inbound | OIDC, SAML 2.0, SCIM 2.0 | [AuthN/Z](../07-Security/Authentication-Authorization.md) |
| IF-12 | Customer webhooks | Outbound | HTTPS POST, HMAC-SHA256 signed | API Spec §7 |

### 3.3 Hardware interfaces
No direct hardware interface. Drones are reached only through provider clouds or an edge bridge (MAVLink → MAVSDK → HTTPS/WSS) operated by the customer or provider.

### 3.4 Communication interfaces
HTTPS (TLS 1.2+), WSS, HTTP/2 for API, HTTP/3 at CDN where supported. All outbound webhooks go through a dedicated egress proxy with an allow-list of resolved IPs. Private ranges are blocked (SSRF protection).

## 4. System Features (Functional Requirements)

Functional requirements are grouped by module in [Functional-Requirements.md](Functional-Requirements.md):

| Module | ID range | Count |
|---|---|---|
| Authentication | AUTH-001 – AUTH-020 | 20 |
| Organization | ORG-001 – ORG-012 | 12 |
| Tenant isolation | TENANT-001 – TENANT-008 | 8 |
| RBAC & Team | RBAC-001 – RBAC-012 | 12 |
| Projects | PROJECT-001 – PROJECT-012 | 12 |
| Sites | SITE-001 – SITE-012 | 12 |
| Assets | ASSET-001 – ASSET-010 | 10 |
| Drones & Pilots | DRONE-001 – DRONE-014 | 14 |
| Missions | MISSION-001 – MISSION-020 | 20 |
| Telemetry | TELEM-001 – TELEM-012 | 12 |
| Video | VIDEO-001 – VIDEO-010 | 10 |
| Media | MEDIA-001 – MEDIA-016 | 16 |
| Surveys | SURVEY-001 – SURVEY-010 | 10 |
| Maps & GIS | MAP-001 – MAP-014 | 14 |
| Digital Twin | TWIN-001 – TWIN-012 | 12 |
| Inspections | INSPECTION-001 – INSPECTION-016 | 16 |
| Progress | PROGRESS-001 – PROGRESS-012 | 12 |
| AI | AI-001 – AI-016 | 16 |
| Reports | REPORT-001 – REPORT-012 | 12 |
| Notifications | NOTIF-001 – NOTIF-010 | 10 |
| Audit | AUDIT-001 – AUDIT-010 | 10 |
| Analytics | ANALYTICS-001 – ANALYTICS-008 | 8 |
| Integrations | INTEG-001 – INTEG-010 | 10 |
| Billing | BILLING-001 – BILLING-010 | 10 |
| Platform Admin | ADMIN-001 – ADMIN-010 | 10 |
| **Total** | | **308** |

## 5. Non-Functional Requirements

See [Non-Functional-Requirements.md](Non-Functional-Requirements.md): performance, scalability, availability, reliability, security, privacy, usability, accessibility, maintainability, portability, observability, compliance.

## 6. Data Requirements

- **Logical model:** [ERD](../05-Database/ERD.md). **Physical model:** [Database Design](../05-Database/Database-Design.md).
- **Coordinate reference:** all stored geometries use **EPSG:4326 (WGS 84)** as `geography`, plus ellipsoidal height in metres. Survey outputs keep their native CRS in metadata and are reprojected for display (EPSG:3857 tiles).
- **Time:** all timestamps are `timestamptz` in UTC. Sites store an IANA timezone for display and scheduling.
- **Units:** SI internally (metres, m/s, °, %). Converted at the presentation layer.
- **Identifiers:** UUIDv7 (time-ordered) for all primary keys. Human-friendly codes (`PRJ-0042`) for display.

## 7. Verification

Each requirement is verified by one or more methods: **T** (test), **D** (demonstration), **I** (inspection/review), **A** (analysis). The method is listed per requirement in the Functional Requirements catalog. Test cases are in [Test Cases](../11-QA/Test-Cases.md). Mapping is in the [Traceability Matrix](Traceability-Matrix.md).

## 8. Appendices
- A. [API Specification](../06-API/API-Specification.md)
- B. [RBAC Matrix](../07-Security/RBAC.md)
- C. [Risk Register](../13-Product/Risks.md)
