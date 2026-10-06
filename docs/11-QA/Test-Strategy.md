# Testing / QA Strategy

| | |
|---|---|
| **Document** | Testing & QA Strategy |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-28 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI QA |
| **Reviewer** | _Pending — QA Lead, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | QA | Initial strategy |

---

## 1. Objectives

1. Prove every Must requirement of the release phase works (traceable via the [RTM](../03-SRS/Traceability-Matrix.md)).
2. Guarantee **zero cross-tenant leakage** and correct RBAC for every role × permission.
3. Prevent regressions with fast, reliable automation in CI.
4. Validate non-functional targets (performance, security, accessibility, resilience).
5. Ensure honest labelling of simulated, prototype and integration-dependent features.

## 2. Test Levels & Ownership

| Level | Scope | Tools | Owner | Runs |
|---|---|---|---|---|
| **Static** | Types, lint, module boundaries, unguarded routes, schema linter (RLS presence) | TypeScript strict, ESLint, dependency-cruiser, custom lints, mypy, ruff | Devs | Every commit |
| **Unit** | Domain logic (state machines, ProgressCalculator, validators, PolicyEngine rules, adapters' normalizers) | Vitest, pytest | Devs | Every PR |
| **Integration** | Repositories with RLS, workers, queues, storage, PostGIS queries | Vitest + Testcontainers (Postgres/PostGIS/Timescale, Redis, MinIO, ClamAV) | Devs | Every PR |
| **API / contract** | Endpoint behavior, validation, errors, OpenAPI conformance | Supertest/Pact-style schema checks, Schemathesis (property-based fuzzing from OpenAPI) | Devs + QA | Every PR (smoke), nightly (fuzz) |
| **Tenant isolation suite** | Every endpoint, channel, storage path with a two-org fixture | Custom harness (generated from OpenAPI) | QA + Security | Every PR touching data access; nightly full |
| **RBAC matrix suite** | Role × permission × resource rule | Table-driven tests generated from `packages/permissions` | Devs + QA | Every PR |
| **Component** | UI components, accessibility | Vitest + Testing Library, Storybook + axe | Frontend | Every PR |
| **Visual regression** | Design system, key screens, themes | Playwright snapshots / Chromatic | Frontend | Every PR (changed stories) |
| **E2E** | Critical user journeys in the browser | Playwright (Chromium, WebKit, Firefox) against ephemeral preview env | QA | Every PR (smoke), nightly (full) |
| **Realtime** | WS lifecycle, reconnection, ordering, auth | Custom Node clients + k6 WebSocket | Devs + QA | Nightly |
| **Performance** | Load, stress, soak, spike | k6, Lighthouse CI, custom telemetry generator | QA + SRE | Weekly + pre-release ([Perf Plan](Performance-Testing-Plan.md)) |
| **Security** | SAST, SCA, secrets, DAST, pentest | Semgrep, CodeQL, gitleaks, Trivy, ZAP, external pentest | Security | Per PR / release / yearly |
| **AI evaluation** | Accuracy, authorization leaks, injection | Eval harness (pytest + datasets) | AI team | Nightly on model/prompt changes |
| **Resilience / chaos** | Provider outage, Redis failover, DB failover, worker crash | Toxiproxy, chaos experiments in staging | SRE | Monthly |
| **DR** | Backup restore, region failover | Runbooks | SRE | Quarterly |
| **UAT** | Business acceptance with pilot customers | Acceptance criteria scripts | Product + customers | Per phase |
| **Exploratory** | Risk-based sessions (maps, uploads, live ops, field tablets) | Charters | QA | Each sprint |

Test pyramid target (count): unit 70%, integration/API 20%, E2E 10%.

## 3. Coverage Requirements

| Area | Requirement |
|---|---|
| Domain/services line coverage | ≥ 80% |
| PolicyEngine & permission rules | 100% of rules, every role |
| State machines | 100% of transitions (valid and invalid) |
| Endpoints | 100% have ≥ 1 happy-path + ≥ 1 authz-negative + cross-tenant test |
| Must requirements (phase) | 100% linked to ≥ 1 passing test before release |
| E2E critical journeys | F-01, F-02, F-04, F-05, F-06, F-09, F-12, F-13 (+ F-10, F-11 in Phase 2) |

## 4. Coverage Areas (from the brief)

| Area | What we test | Test cases |
|---|---|---|
| **Authentication** | Login, signup, verification, password reset, 2FA (TOTP, recovery), lockout, refresh rotation/reuse, session revocation, org switching, SSO (Phase 3) | TC-AUTH-001 – 015 |
| **Authorization** | Every system role × every permission (generated), custom roles, escalation prevention, resource rules (assigned pilot, no self-approval, viewer shared-only) | TC-RBAC-001 – 012 |
| **Multi-tenancy** | Company A cannot read/write/list/subscribe/download Company B data via API, WS, storage, jobs, reports, AI, notifications, search | TC-TENANT-001 – 012 |
| **Drone** | Registration, uniqueness, status lifecycle, license/registration blocks, mission planning and validation, state machine, checklist, telemetry ingest/validation/alerts/latency, simulator labelling | TC-DRONE-*, TC-MISSION-*, TC-TELEM-* |
| **Media** | Upload (multipart, resume, quotas), type validation, malware, processing, preview, download (signed, audited), permissions (viewer shared only), trash/restore | TC-MEDIA-001 – 010, TC-VIDEO-* |
| **Inspections** | Create, assign, checklist, findings with annotations, submit rules, approval/rejection, no self-approval, immutability, finding lifecycle, overdue notifications | TC-INSPECTION-001 – 010 |
| **Reports** | Generate (async), content correctness, permission-respecting content, download, publish, share links (expiry, passcode, revoke), versioning | TC-REPORT-001 – 008 |
| **AI** | Analysis job lifecycle, output schema validation, human review gate, authorization (inputs and assistant tools), prompt injection, credit limits, failure handling, labelling | TC-AI-001 – 010 |

## 5. Test Data & Environments

| Environment | Purpose | Data |
|---|---|---|
| Local | Dev tests | Factories + seed `demo` org |
| CI ephemeral | Integration/API/tenant suites | Testcontainers, fresh per run |
| Preview (per PR) | E2E smoke | Seeded fixtures: **Org A "Atlas Construction"**, **Org B "Borealis Infra"** with identical structures (2 projects, 3 sites, 4 drones incl. simulator, missions in each state, media incl. a GeoTIFF and a video, inspections, reports) and one user per role in each org |
| Staging | Full E2E, perf, DAST, UAT | Synthetic + anonymized samples. **No production data.** |
| Production | Synthetic monitoring only | `__synthetic` org |

Golden geospatial fixtures: valid/invalid polygons (self-intersecting, unclosed, antimeridian), GeoTIFF without georeference, multi-CRS samples (UTM 40N, 3857), LAS sample, 3D Tiles sample, DJI images with XMP, video with an SRT track, EICAR test file for malware tests.

## 6. Defect Management

| Severity | Definition | Release impact | Fix SLA |
|---|---|---|---|
| S1 Critical | Data leak, security vuln (high/critical), data loss, outage, unsafe drone behavior | Blocks release. Hotfix in prod. | 24 h |
| S2 Major | Core flow broken, no workaround | Blocks release | 3 days |
| S3 Moderate | Feature impaired, workaround exists | Release with PO approval | Next sprint |
| S4 Minor | Cosmetic | Does not block | Backlog |

Any tenant-isolation or authorization defect is **S1 by default**.

## 7. Entry & Exit Criteria

**Entry (to QA for a story):** acceptance criteria defined, unit/integration tests passing, deployed to preview, docs updated (README §7).

**Exit (release):** see [Release Checklist](../12-DevOps/Release-Checklist.md): all Must requirements traced and passing; 0 open S1/S2; tenant + RBAC suites 100%; performance targets met or ADR-approved deviations; DAST no high alerts; accessibility scan no serious/critical violations on key screens; UAT sign-off.

## 8. Reporting

- CI publishes JUnit + coverage + RTM coverage summary per PR.
- Release test report: scope, results by module, open defects, NFR results, risks, sign-offs (QA Lead, Product Owner, Security).

## 9. Roles

QA Lead (strategy, release sign-off), QA engineers (automation, exploratory), developers (unit/integration, fix), Security Engineer (security tests), SRE (perf/chaos/DR), Product Owner (UAT acceptance).
