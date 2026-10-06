# Risk Register

| | |
|---|---|
| **Document** | Risk Register |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-38 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product & Engineering |
| **Reviewer** | _Pending — Product Owner, CTO_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product & Eng | Initial register (18 risks) |

---

## Scales

- **Probability (P):** 1 Rare · 2 Unlikely · 3 Possible · 4 Likely · 5 Almost certain
- **Impact (I):** 1 Negligible · 2 Minor · 3 Moderate · 4 Major · 5 Severe
- **Score = P × I:** 1–6 Low · 8–12 Medium · 15–25 High
- **Status:** Open · Mitigating · Monitoring · Closed
- Reviewed every sprint (top 5) and monthly (full) by the Product Owner and the CTO.

## Register

| ID | Risk | P | I | Score | Mitigation | Contingency | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| **R-01** | **Drone API availability:** provider APIs are restricted, change without notice, require partnerships, or are rate-limited, delaying live telemetry/video and mission upload | 4 | 4 | **16 High** | Provider-agnostic adapter layer (ADR-004). Simulator + manual adapters for MVP. Early partnership outreach (D-01). Conformance tests with recorded fixtures. Circuit breakers. | KMZ/WPML export + post-flight media upload keeps core value. Prioritize an alternative provider. | CTO | Mitigating |
| **R-02** | **Multi-tenant security:** a defect exposes one customer's data to another | 2 | 5 | **10 Medium** (impact severe) | Defense in depth (org from token, RLS, composite FKs, storage prefixes, channel auth). Generated isolation suite on every PR. Schema linter. Pentest focus. CODEOWNERS on sensitive code. | Incident response, customer notification, forensic audit trail | Security Engineer | Mitigating |
| **R-03** | **Regulatory restrictions:** aviation rules (BVLOS, remote ID, airspace near airports, privacy-in-imagery laws) limit customer flights or certain features (remote control) | 4 | 3 | **12 Medium** | Pilot-in-command model. Logical execution by default. License/registration tracking. Configurable altitude limits. No remote takeoff. Legal review per market. | Disable features per jurisdiction via flags | Product Owner | Monitoring |
| **R-04** | **Real-time streaming reliability:** poor site connectivity and NAT/firewalls cause unstable telemetry and live video | 4 | 3 | **12 Medium** | WebRTC with TURN over 443. LL-HLS fallback. Reconnect/resume with backfill. Stale indicators. Adaptive fan-out rate. | Recorded video + replay remains available | Tech Lead | Open |
| **R-05** | **Large video & media storage costs** exceed plan revenue | 4 | 4 | **16 High** | Usage metering and plan limits. Lifecycle to infrequent-access/Glacier. H.264 ladder sizing. Dedup by hash. Per-org anomaly alerts. Pricing review quarterly. | Storage add-on pricing, retention defaults tightened | Product Owner + FinOps | Open |
| **R-06** | **3D performance:** large meshes/point clouds render poorly on customer hardware | 3 | 3 | **9 Medium** | 3D Tiles with LOD, Draco/KTX2, device tiers, memory budgets, 2D fallback, perf tests PT-10 | Server-side rendered snapshots/videos | Frontend Lead | Open |
| **R-07** | **AI accuracy:** AI estimates are wrong or misleading, leading to bad decisions or liability | 4 | 4 | **16 High** | Human review gate. Confidence display. Disclaimers. Evaluation gates before promotion. Prototype/Beta labelling. No AI-set critical severity. | Disable a capability per org/globally via flags | AI Lead | Open |
| **R-08** | **GPS accuracy:** consumer GNSS errors (2–5 m), altitude datum confusion, cause mis-linked media and imprecise measurements | 4 | 3 | **12 Medium** | Store datum metadata. Support RTK/GCP accuracy fields. Tolerances in auto-linking. Show accuracy disclaimers. Manual alignment tools. | Manual link review queue | GIS Lead | Open |
| **R-09** | **Data privacy:** imagery captures people/property. Location data is personal. Regulatory complaints. | 3 | 4 | **12 Medium** | Privacy by design (PRIV-*). Retention controls. Minimal EXIF. Access controls. Planned blurring. DPA and sub-processor transparency. | Legal response plan | DPO | Open |
| **R-10** | **Vendor lock-in** (cloud, map provider, LLM provider, drone vendor) | 3 | 3 | **9 Medium** | Abstractions (S3 API, MapLibre + swappable styles, LlmClient, adapters). Terraform modules. OSS components (MediaMTX, TiTiler). | Migration playbooks | CTO | Monitoring |
| **R-11** | **Cloud costs** (GPU, transcoding, egress) grow faster than revenue | 3 | 4 | **12 Medium** | Spot instances, scale-to-zero GPU, CDN caching, unit-economics KPI, budgets/alerts per env | Throttle non-critical processing, renegotiate commitments | SRE Lead | Open |
| **R-12** | **Scope creep** delays MVP | 4 | 3 | **12 Medium** | Fixed MVP scope (MVP.md). Change control via PO. Phased roadmap. | Cut Could-have items | Product Owner | Mitigating |
| **R-13** | **Geospatial complexity** (CRS, large rasters, 3D conversion tools) underestimated | 3 | 3 | **9 Medium** | Dedicated GIS engineer. Proven OSS (GDAL, PDAL, TiTiler). Golden test fixtures. Spikes early (sprint 3). | Accept only COG/GeoTIFF in 4326/UTM in MVP | GIS Lead | Open |
| **R-14** | **Site connectivity** prevents large uploads from the field | 4 | 2 | **8 Medium** | Resumable multipart uploads, background job tray, office-upload workflow guidance | Provider media sync (Phase 2) | Product Owner | Open |
| **R-15** | **Hiring/key-person risk** for specialized skills (3D, GIS, ML) | 3 | 3 | **9 Medium** | Documentation (this package), pairing, contractors for spikes | Re-sequence roadmap | Engineering Manager | Open |
| **R-16** | **AI cost overrun** (LLM tokens, GPU) | 3 | 3 | **9 Medium** | Credits, model routing, caching, batch, per-org caps | Raise AI credit pricing | AI Lead | Open |
| **R-17** | **Third-party licensing** (basemap/terrain caching terms, Cesium assets, codec patents) restricts commercial use | 2 | 3 | **6 Low** | Legal review of each provider's terms. Self-hosted OSM/Copernicus alternatives. | Switch provider | Legal | Open |
| **R-18** | **Customer adoption:** field teams don't change workflow | 3 | 4 | **12 Medium** | Design partners, onboarding wizard, pilot-friendly UX, training, reporting time savings as the hook | Services-led onboarding | Product Owner | Open |

## Heat Map (current)

| P \ I | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **5** | | | | | |
| **4** | | R-14 | R-03, R-04, R-08, R-12 | R-01, R-05, R-07 | |
| **3** | | | R-06, R-10, R-13, R-15, R-16 | R-09, R-11, R-18 | |
| **2** | | | R-17 | | R-02 |
| **1** | | | | | |

> R-02 has a medium score but is treated as a **top-priority** risk because the impact would be existential.
