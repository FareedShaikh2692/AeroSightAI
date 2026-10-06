# Non-Functional Requirements Document

| | |
|---|---|
| **Document** | Non-Functional Requirements |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-05 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Engineering |
| **Reviewer** | _Pending — Tech Lead, SRE Lead, Security Engineer_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Engineering | Initial draft |

---

> **Validation note:** The numeric targets below are *design targets*. Before GA, they must be validated by the [Performance Testing Plan](../11-QA/Performance-Testing-Plan.md) on production-like infrastructure. Targets that are not met need an approved deviation (ADR) or remediation.

## 1. Reference Load Model

The targets apply under this "normal conditions" model per regional deployment (Year 1):

| Dimension | Normal | Peak (design) |
|---|---|---|
| Organizations | 300 | 1,000 |
| Registered users | 6,000 | 25,000 |
| Concurrent active users | 600 | 2,500 |
| API requests | 150 req/s | 800 req/s |
| Concurrently flying drones (telemetry) | 50 | 300 |
| Telemetry ingest | 250 msg/s | 3,000 msg/s |
| WebSocket connections | 1,500 | 8,000 |
| Media uploaded / day | 150 GB | 1.5 TB |
| Video transcode / day | 40 h | 300 h |
| Total object storage | 200 TB (Y1) | 1 PB (Y3) |

## 2. Performance (NFR-PERF)

| ID | Requirement | Target | Measured by |
|---|---|---|---|
| NFR-PERF-001 | Dashboard initial load (cold cache, broadband 50 Mbps, mid-range laptop) — Largest Contentful Paint | < 3.0 s p75; < 2.5 s goal | RUM (web-vitals) + Lighthouse CI |
| NFR-PERF-002 | API response for standard queries (single entity read, paginated list ≤ 50 items, filters on indexed columns) | < 300 ms p95, < 500 ms p99 server time | APM histograms |
| NFR-PERF-003 | API write operations (create/update, excluding uploads) | < 500 ms p95 | APM |
| NFR-PERF-004 | Real-time telemetry end-to-end latency (provider receipt → browser render) | < 1 s p95 internal; < 2 s p95 including provider where infrastructure permits | Synthetic probe with timestamps |
| NFR-PERF-005 | Interaction to Next Paint (INP) | < 200 ms p75 | RUM |
| NFR-PERF-006 | JS initial bundle (app shell, gzipped) | < 300 KB; map/3D engines lazy-loaded | CI bundle-size check |
| NFR-PERF-007 | Map: first tiles visible after site open | < 1.5 s p75 | RUM custom mark |
| NFR-PERF-008 | Map rendering with 5,000 features | ≥ 50 fps on reference laptop (integrated GPU) | Manual perf test |
| NFR-PERF-009 | 3D twin first meaningful frame (3D Tiles mesh ≤ 2 GB source) | < 5 s p75 on reference laptop | RUM custom mark |
| NFR-PERF-010 | 3D twin frame rate | ≥ 30 fps desktop reference; ≥ 20 fps tablet reference | Manual perf test |
| NFR-PERF-011 | Image upload throughput | Saturates ≥ 80% of client uplink up to 200 Mbps with 4–6 parallel parts | Upload benchmark |
| NFR-PERF-012 | Image processing (thumbnail + preview + EXIF) | < 10 s p95 per image after upload completes | Queue metrics |
| NFR-PERF-013 | Video transcoding | ≤ 1× realtime for 1080p (1 min of video ≤ 1 min processing) p95 | Queue metrics |
| NFR-PERF-014 | Report generation (≤ 200 images) | < 120 s p95 | Job metrics |
| NFR-PERF-015 | Search (command palette) | < 400 ms p95 | APM |
| NFR-PERF-016 | Large media and heavy computation (transcode, COG conversion, AI) | Always asynchronous. API returns `202 Accepted` with a job/resource ID in < 500 ms. | Code review / tests |

## 3. Scalability (NFR-SCAL)

| ID | Requirement |
|---|---|
| NFR-SCAL-001 | Stateless API, realtime and worker tiers scale horizontally (Kubernetes HPA on CPU + custom metrics: queue depth, WS connections). |
| NFR-SCAL-002 | Support the Peak column of §1 without architecture change. Beyond that, scale by regional cells (cell-based architecture: a set of orgs per cell). |
| NFR-SCAL-003 | The telemetry pipeline is partitioned by `drone_id` (Redis Streams consumer groups) so that it can scale to 3,000 msg/s per cell. |
| NFR-SCAL-004 | Database: read replicas for analytics/reporting. Partition `telemetry` (Timescale chunks: 1 day) and `audit_logs` (monthly range). |
| NFR-SCAL-005 | Object storage has no per-tenant bucket limit (prefix-per-tenant model). Lifecycle rules tier cold media (> 180 days untouched) to infrequent-access storage. |
| NFR-SCAL-006 | Per-tenant fairness: queue jobs are scheduled with per-org concurrency caps so one tenant cannot starve others. |

## 4. Availability & Reliability (NFR-AVAIL)

| ID | Requirement | Target |
|---|---|---|
| NFR-AVAIL-001 | Monthly availability of core API and web app (excluding scheduled maintenance ≤ 4 h/month announced 72 h ahead) | 99.9% (Enterprise SLA), 99.5% (other plans) |
| NFR-AVAIL-002 | Multi-AZ deployment for all stateful services (DB, Redis, brokers) | Required |
| NFR-AVAIL-003 | RPO / RTO | Database RPO ≤ 15 min, RTO ≤ 4 h; media RPO ≤ 1 h, RTO ≤ 8 h (see [DR Plan](../12-DevOps/Disaster-Recovery.md)) |
| NFR-AVAIL-004 | Graceful degradation: failure of AI, video, telemetry provider or basemap must not take down core CRUD. Circuit breakers + feature-level error states. | Required |
| NFR-AVAIL-005 | Background jobs are idempotent and retried with exponential backoff + jitter. Poison messages go to a DLQ with alerting. | Required |
| NFR-AVAIL-006 | Zero-downtime deploys (rolling/blue-green) and backward-compatible DB migrations (expand → migrate → contract). | Required |
| NFR-AVAIL-007 | WebSocket clients reconnect automatically and resume streams without a page reload. | Required |

## 5. Security (NFR-SEC)

The full set is in [Security Requirements](../07-Security/Security-Requirements.md) (`SEC-001`…). Headline NFRs:

| ID | Requirement |
|---|---|
| NFR-SEC-001 | Zero cross-tenant data exposure. Automated tenant-isolation test suite runs in CI on every PR touching data access. |
| NFR-SEC-002 | OWASP ASVS 4.0 Level 2 compliance for the web app and API. Level 3 controls for auth and tenant isolation. |
| NFR-SEC-003 | Encryption in transit (TLS 1.2+) and at rest (AES-256, KMS-managed keys). |
| NFR-SEC-004 | No critical/high vulnerabilities older than 7/30 days in production dependencies (SCA). |
| NFR-SEC-005 | Annual third-party penetration test and before GA. |
| NFR-SEC-006 | SOC 2 Type II readiness by end of Phase 3. ISO 27001 alignment. |

## 6. Privacy (NFR-PRIV)

See [Privacy](../07-Security/Privacy.md). GDPR, UK GDPR and UAE PDPL alignment. Data minimization. Configurable retention. DSAR support within 30 days.

## 7. Usability (NFR-USE)

| ID | Requirement |
|---|---|
| NFR-USE-001 | A new PM can create a project, site and mission without help in ≤ 15 min (usability test, ≥ 80% of 5+ participants). |
| NFR-USE-002 | Every async operation shows progress state and survives navigation (global job tray). |
| NFR-USE-003 | Every destructive action needs confirmation. Irreversible ones need typed confirmation. |
| NFR-USE-004 | Error messages state what happened, why, and what to do next, and include a request ID for support. |
| NFR-USE-005 | Field-friendly: touch targets ≥ 44×44 px on tablet/phone; high-contrast "Sunlight" theme for outdoor use. |

## 8. Accessibility (NFR-A11Y)

| ID | Requirement |
|---|---|
| NFR-A11Y-001 | WCAG 2.2 Level AA for all non-map/non-3D UI. |
| NFR-A11Y-002 | Map and 3D views provide accessible alternatives: list/table of features, keyboard navigation of layers, text descriptions of selected objects. |
| NFR-A11Y-003 | Color is never the only carrier of meaning (severity also uses icon + label). |
| NFR-A11Y-004 | Automated axe-core checks in CI. Manual screen-reader pass (NVDA, VoiceOver) per release. |
| NFR-A11Y-005 | Respect `prefers-reduced-motion`. Disable camera fly-to animations and parallax. |

## 9. Maintainability (NFR-MAINT)

| ID | Requirement |
|---|---|
| NFR-MAINT-001 | TypeScript strict mode. Python typed (mypy strict) for the AI service. |
| NFR-MAINT-002 | Unit test coverage ≥ 80% lines on domain/services. 100% of permission policies covered. |
| NFR-MAINT-003 | Modular monolith with enforced module boundaries (dependency-cruiser rules). Modules communicate via public service interfaces or domain events. |
| NFR-MAINT-004 | OpenAPI spec generated from code and diff-checked in CI for breaking changes. |
| NFR-MAINT-005 | ADRs recorded for significant decisions in `docs/04-Architecture/Technical-Design.md §ADR` (or `docs/adr/` when > 20). |
| NFR-MAINT-006 | Documentation synchronization rule (see [README §7](../README.md#7-documentation-synchronization-rule-mandatory)). |

## 10. Portability & Compatibility (NFR-PORT)

| ID | Requirement |
|---|---|
| NFR-PORT-001 | All services containerized (OCI images). Infrastructure as code (Terraform) with a cloud-agnostic module boundary (AWS reference implementation). |
| NFR-PORT-002 | S3-compatible storage API only (works with AWS S3, MinIO, Cloudflare R2, Azure via gateway). |
| NFR-PORT-003 | Browser support per [SRS §2.3](Software-Requirements-Specification.md#23-operating-environment). |
| NFR-PORT-004 | Standard geospatial formats: GeoJSON, KML, Shapefile, GeoTIFF/COG, LAS/LAZ/COPC, 3D Tiles, glTF, IFC. |

## 11. Observability (NFR-OBS)

| ID | Requirement |
|---|---|
| NFR-OBS-001 | Structured JSON logs with `requestId`, `traceId`, `orgId` (no PII in logs beyond user ID). |
| NFR-OBS-002 | Distributed tracing (OpenTelemetry) across gateway, API, workers, AI service, realtime. |
| NFR-OBS-003 | RED metrics per endpoint. USE metrics per resource. SLO dashboards and burn-rate alerts. |
| NFR-OBS-004 | Frontend RUM (web-vitals) and error tracking with source maps. |

Details: [Monitoring & Observability Plan](../12-DevOps/Monitoring.md).

## 12. Compliance (NFR-COMP)

| ID | Requirement |
|---|---|
| NFR-COMP-001 | Regulatory support artifacts: pilot license tracking, flight logs and checklists retained ≥ 2 years by default (configurable to match local aviation rules). |
| NFR-COMP-002 | Data residency: customer data at rest stays within the chosen region. Sub-processors listed publicly. |
| NFR-COMP-003 | AI transparency: label AI-generated content. Keep model/version provenance (EU AI Act transparency alignment). |
| NFR-COMP-004 | Accessibility statement and VPAT available for Enterprise procurement by GA. |

## 13. Capacity & Cost Guardrails (NFR-COST)

| ID | Requirement |
|---|---|
| NFR-COST-001 | Per-tenant storage, AI and video usage metered (BILLING-005) and alerted on anomalies (> 3× 7-day average). |
| NFR-COST-002 | Media lifecycle: originals to infrequent-access after 180 days. Derived previews kept in standard storage. |
| NFR-COST-003 | AI calls use the smallest model that meets the quality bar for each task (model routing, see AI spec §3). Prompt caching where available. |
| NFR-COST-004 | Monthly cloud cost per active organization tracked as a unit-economics KPI. |
