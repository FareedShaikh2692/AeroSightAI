# AeroSight AI — Documentation Package

> **See Every Site. Track Every Progress. Build Smarter.**

| | |
|---|---|
| **Document** | Documentation Index & Conventions |
| **Project** | AeroSight AI — Drone-Powered Construction Intelligence Platform |
| **Doc ID** | ASAI-DOC-00 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product & Engineering |
| **Reviewer** | _Pending — Product Owner, Head of Engineering_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product & Engineering | Initial documentation package (45 documents) |

---

## 1. Purpose

This folder is the single source of truth for what AeroSight AI is, how it is built, how it is secured, how it is tested, and how it is operated. It is written so that a product manager, UI/UX designer, frontend developer, backend developer, DevOps engineer, QA engineer, security engineer, and client can each implement or evaluate the platform consistently.

## 2. Current Implementation State

> **As of 2026-10-06 a Phase 1 demo build exists in `src/`** (single Next.js app, in-memory seeded data, simulated telemetry — see ADR-013). Its capabilities are at most **Prototype**; everything else is **Planned**. Each document states the *target* status a feature must reach for its release phase. When code lands, the owning engineer updates the status in [13-Product/MVP.md](13-Product/MVP.md#4-implementation-status-register) and in the relevant spec.

### 2.1 Implementation Status Legend

These labels are mandatory wherever a capability is described to a client, in the UI, or in sales material.

| Label | Meaning | UI treatment |
|---|---|---|
| **Implemented** | Production code, backed by real data, covered by automated tests, passing acceptance criteria. | No badge. |
| **Prototype** | Works end-to-end but with limited accuracy, scale or hardening. Results must be human-reviewed. | `Beta` badge. |
| **Simulated** | Behaviour is driven by a simulator or synthetic data (e.g. the Drone Simulator adapter). Never presented as a real flight. | `Simulated` badge plus a striped banner on live screens. |
| **Integration Required** | Architecture and contracts exist, but the feature needs a third-party provider, credentials, or a processing engine before it works. | Hidden or shown as `Connect provider` empty state. |
| **Planned** | Specified only. | Not shown. |

## 3. Document Map (45 required documents)

| # | Document | Location |
|---|---|---|
| 1 | Business Requirements Document (BRD) | [01-BRD/Business-Requirements-Document.md](01-BRD/Business-Requirements-Document.md) |
| 2 | Product Requirements Document (PRD) | [02-PRD/Product-Requirements-Document.md](02-PRD/Product-Requirements-Document.md) |
| 3 | Software Requirements Specification (SRS) | [03-SRS/Software-Requirements-Specification.md](03-SRS/Software-Requirements-Specification.md) |
| 4 | Functional Requirements Document | [03-SRS/Functional-Requirements.md](03-SRS/Functional-Requirements.md) |
| 5 | Non-Functional Requirements Document | [03-SRS/Non-Functional-Requirements.md](03-SRS/Non-Functional-Requirements.md) |
| 6 | System Architecture Document | [04-Architecture/System-Architecture.md](04-Architecture/System-Architecture.md) (+ [Multi-Tenancy.md](04-Architecture/Multi-Tenancy.md)) |
| 7 | Technical Design Document | [04-Architecture/Technical-Design.md](04-Architecture/Technical-Design.md) |
| 8 | Database Design Document | [05-Database/Database-Design.md](05-Database/Database-Design.md) (+ [ERD.md](05-Database/ERD.md)) |
| 9 | API Specification | [06-API/API-Specification.md](06-API/API-Specification.md) |
| 10 | Authentication & Authorization Specification | [07-Security/Authentication-Authorization.md](07-Security/Authentication-Authorization.md) |
| 11 | RBAC / Permission Matrix | [07-Security/RBAC.md](07-Security/RBAC.md) |
| 12 | UI/UX Design Specification | [08-UX/UX-Specification.md](08-UX/UX-Specification.md) (+ [Design-System.md](08-UX/Design-System.md)) |
| 13 | Screen & User Flow Document | [08-UX/User-Flows.md](08-UX/User-Flows.md) |
| 14 | Drone Integration Architecture | [04-Architecture/Drone-Architecture.md](04-Architecture/Drone-Architecture.md) |
| 15 | Real-Time Telemetry Architecture | [04-Architecture/Real-Time-Architecture.md](04-Architecture/Real-Time-Architecture.md) |
| 16 | Video Streaming Architecture | [04-Architecture/Video-Architecture.md](04-Architecture/Video-Architecture.md) |
| 17 | AI Feature Specification | [09-AI/AI-Requirements.md](09-AI/AI-Requirements.md) |
| 18 | GIS / Mapping Specification | [10-GIS-3D/GIS-Specification.md](10-GIS-3D/GIS-Specification.md) |
| 19 | 3D Digital Twin Specification | [10-GIS-3D/Digital-Twin.md](10-GIS-3D/Digital-Twin.md) |
| 20 | Construction Progress Monitoring Specification | [02-PRD/Features/Construction-Progress-Monitoring.md](02-PRD/Features/Construction-Progress-Monitoring.md) |
| 21 | Asset Inspection Specification | [02-PRD/Features/Asset-Inspection.md](02-PRD/Features/Asset-Inspection.md) |
| 22 | Reporting Specification | [02-PRD/Features/Reporting.md](02-PRD/Features/Reporting.md) |
| 23 | Notification Specification | [02-PRD/Features/Notifications.md](02-PRD/Features/Notifications.md) |
| 24 | Audit Logging Specification | [07-Security/Audit-Logging.md](07-Security/Audit-Logging.md) |
| 25 | Security Requirements | [07-Security/Security-Requirements.md](07-Security/Security-Requirements.md) |
| 26 | Privacy & Data Protection Requirements | [07-Security/Privacy.md](07-Security/Privacy.md) |
| 27 | DevOps & Deployment Document | [12-DevOps/Deployment.md](12-DevOps/Deployment.md) (+ [CI-CD.md](12-DevOps/CI-CD.md)) |
| 28 | Testing / QA Strategy | [11-QA/Test-Strategy.md](11-QA/Test-Strategy.md) |
| 29 | Test Case Specification | [11-QA/Test-Cases.md](11-QA/Test-Cases.md) |
| 30 | Performance Testing Plan | [11-QA/Performance-Testing-Plan.md](11-QA/Performance-Testing-Plan.md) |
| 31 | Disaster Recovery & Backup Plan | [12-DevOps/Disaster-Recovery.md](12-DevOps/Disaster-Recovery.md) |
| 32 | Monitoring & Observability Plan | [12-DevOps/Monitoring.md](12-DevOps/Monitoring.md) |
| 33 | Product Roadmap | [13-Product/Roadmap.md](13-Product/Roadmap.md) |
| 34 | MVP Scope | [13-Product/MVP.md](13-Product/MVP.md) |
| 35 | Future Scope | [13-Product/Future-Scope.md](13-Product/Future-Scope.md) |
| 36 | User Stories | [02-PRD/User-Stories.md](02-PRD/User-Stories.md) |
| 37 | Acceptance Criteria | [11-QA/Acceptance-Criteria.md](11-QA/Acceptance-Criteria.md) |
| 38 | Risk Register | [13-Product/Risks.md](13-Product/Risks.md) |
| 39 | Assumptions & Dependencies | [13-Product/Assumptions-Dependencies.md](13-Product/Assumptions-Dependencies.md) |
| 40 | Glossary | [13-Product/Glossary.md](13-Product/Glossary.md) |
| 41 | Release Checklist | [12-DevOps/Release-Checklist.md](12-DevOps/Release-Checklist.md) |
| 42 | Developer Setup Guide | [14-Guides/Developer-Setup.md](14-Guides/Developer-Setup.md) |
| 43 | Environment Configuration Guide | [12-DevOps/Environment-Configuration.md](12-DevOps/Environment-Configuration.md) |
| 44 | Production Deployment Guide | [12-DevOps/Production-Deployment-Guide.md](12-DevOps/Production-Deployment-Guide.md) |
| 45 | Admin / User Manual | [14-Guides/Admin-Guide.md](14-Guides/Admin-Guide.md), [14-Guides/User-Guide.md](14-Guides/User-Guide.md) |
| — | Requirements Traceability Matrix | [03-SRS/Traceability-Matrix.md](03-SRS/Traceability-Matrix.md) |

## 4. Folder Structure

```text
docs/
├── README.md                       ← this index
├── 01-BRD/                         Business requirements
├── 02-PRD/                         Product requirements, user stories, feature specs
│   └── Features/                   Progress, Inspection, Reporting, Notifications
├── 03-SRS/                         SRS, functional & non-functional reqs, traceability
├── 04-Architecture/                System, tenancy, technical design, drone, real-time, video
├── 05-Database/                    ERD and table-level design
├── 06-API/                         REST + WebSocket contracts
├── 07-Security/                    AuthN/Z, RBAC, security, privacy, audit
├── 08-UX/                          Screens, flows, design system
├── 09-AI/                          AI capabilities and guardrails
├── 10-GIS-3D/                      Mapping and digital twin
├── 11-QA/                          Strategy, test cases, acceptance criteria, performance
├── 12-DevOps/                      Environments, CI/CD, deployment, monitoring, DR, release
├── 13-Product/                     Roadmap, MVP, future scope, risks, assumptions, glossary
└── 14-Guides/                      Developer setup, admin guide, user guide
```

## 5. Identifier Conventions

Every requirement has an ID. Each ID traces forward to design and tests, and backward to a business need.

| Artifact | Pattern | Example | Defined in |
|---|---|---|---|
| Business requirement | `BR-NN` | `BR-05` | BRD |
| Product feature | `FEAT-<MOD>` | `FEAT-MISSION` | PRD |
| Functional requirement | `<MOD>-NNN` | `MISSION-004` | Functional Requirements |
| Non-functional requirement | `NFR-<CAT>-NNN` | `NFR-PERF-002` | NFR Document |
| Security requirement | `SEC-NNN` | `SEC-014` | Security Requirements |
| Privacy requirement | `PRIV-NNN` | `PRIV-006` | Privacy |
| User story | `US-<MOD>-NN` | `US-INSP-03` | User Stories |
| Acceptance criterion | `AC-<MOD>-NN` | `AC-SITE-01` | Acceptance Criteria |
| Test case | `TC-<MOD>-NNN` | `TC-TENANT-004` | Test Cases |
| Risk | `R-NN` | `R-07` | Risk Register |
| Assumption / Dependency | `A-NN` / `D-NN` | `D-03` | Assumptions & Dependencies |
| Architecture decision | `ADR-NNN` | `ADR-004` | Technical Design |

**Module codes:** `AUTH`, `ORG`, `RBAC`, `PROJECT`, `SITE`, `ASSET`, `DRONE`, `MISSION`, `TELEM`, `VIDEO`, `MEDIA`, `SURVEY`, `MAP`, `TWIN`, `INSPECTION`, `PROGRESS`, `AI`, `REPORT`, `NOTIF`, `AUDIT`, `ANALYTICS`, `INTEG`, `BILLING`, `ADMIN`, `PRIV`, `TENANT`.

## 6. Document Version Control Policy

1. Every document begins with the metadata block (Document, Project, Doc ID, Version, Status, Author, Reviewer, Created, Last Updated) and a Change History table.
2. **Status values:** `Draft` → `In Review` → `Approved` → `Superseded`.
3. **Versioning:** `0.x` while in Draft or In Review. `1.0` on first approval. Minor bumps (`1.1`) for additive changes, major bumps (`2.0`) for changes that break existing contracts (API, schema, permissions).
4. Documents live in Git next to the code. Changes go through the same pull-request review as code.
5. Reviewers by document type:

| Document type | Required reviewer(s) |
|---|---|
| BRD, PRD, Roadmap, MVP | Product Owner |
| Architecture, Technical Design, Database, API | Tech Lead + one backend engineer |
| Security, AuthN/Z, RBAC, Privacy, Audit | Security Engineer |
| UX, Design System | Design Lead |
| QA documents | QA Lead |
| DevOps, DR, Monitoring | DevOps / SRE Lead |

## 7. Documentation Synchronization Rule (mandatory)

The documentation must stay synchronized with the implementation. A pull request that changes behaviour **must** update:

| If the PR changes… | …it must also update |
|---|---|
| A REST/WebSocket endpoint | `06-API/API-Specification.md` (and the generated OpenAPI file once it exists) |
| A table, column, index or enum | `05-Database/Database-Design.md`, `05-Database/ERD.md` |
| A permission or role | `07-Security/RBAC.md` and the permission seed |
| A screen or flow | `08-UX/UX-Specification.md` / `User-Flows.md` |
| A feature's capability status | `13-Product/MVP.md §4` and the relevant spec |
| An environment variable | `12-DevOps/Environment-Configuration.md` |
| A requirement's implementation or test | `03-SRS/Traceability-Matrix.md` |

The PR template includes a **"Docs updated"** checkbox. CI fails if files under `apps/api/src/**/routes` or `db/migrations/**` change without a matching change under `docs/` (planned check; see [CI-CD.md](12-DevOps/CI-CD.md#5-documentation-gate)).
