# Assumptions & Dependencies

| | |
|---|---|
| **Document** | Assumptions & Dependencies |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-39 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product & Engineering |
| **Reviewer** | _Pending — Product Owner, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product & Eng | Initial register |

---

## 1. Assumptions

An assumption is believed true but not yet verified. Each one has a validation method and an owner. If it proves false, the linked risk/decision is revisited.

| ID | Assumption | Impact if false | Validation | Owner | Status |
|---|---|---|---|---|---|
| A-01 | Customers already own drones and employ or contract licensed pilots | Need for a drone-service marketplace | Design-partner interviews | Product | Open |
| A-02 | Customers accept AI outputs as advisory with mandatory human review | AI value proposition weakened | Pilot feedback, acceptance rates | Product | Open |
| A-03 | Customers can produce processed outputs (orthomosaics) with existing tools during MVP | MVP value limited without in-platform processing | Interviews; usage of the survey upload | Product | Open |
| A-04 | Most customers start in a single region (EU or Middle East) | Earlier multi-region work required | Sales pipeline | Product | Open |
| A-05 | Web (desktop + tablet) is sufficient for field use in MVP | Native app needed earlier | Field usability tests | Design | Open |
| A-06 | Per-seat + usage pricing is acceptable | Commercial model change | Pricing tests with design partners | Product | Open |
| A-07 | 1–5 Hz telemetry is sufficient for situational awareness | Higher-rate pipeline needed | Pilot/site manager feedback | Tech Lead | Open |
| A-08 | Average site boundary ≤ 500 ha, average capture ≤ 2,000 images | Pipeline sizing changes | Pilot data | Tech Lead | Open |
| A-09 | English-only UI is acceptable at launch. Arabic follows. | Earlier i18n investment | Sales | Product | Open |
| A-10 | Organizations accept the cloud-hosted SaaS model (no on-prem) for MVP | Deployment model change | Sales/security questionnaires | Product | Open |
| A-11 | The development team will use TypeScript/Node + Python as proposed | Re-plan architecture docs | Team formation | Tech Lead | Open |
| A-12 | The "premium 3D enterprise construction intelligence" visual language from the original UI prompt matches the [Design System](../08-UX/Design-System.md) baseline. **The UI prompt was not provided with this documentation request.** | Design tokens and components need revision | Design Lead reconciles with the UI prompt | Design Lead | Open |
| A-13 | No application code exists yet (as of 2026-10-06). All capability statuses are Planned. | Docs must be reconciled with existing code | Repository review (confirmed empty) | Tech Lead | Confirmed |
| A-14 | AWS is the reference cloud | Terraform modules re-targeted | Business decision | CTO | Open |

## 2. Dependencies

| ID | Dependency | Type | Needed for | Phase | Risk link | Owner | Status |
|---|---|---|---|---|---|---|---|
| D-01 | Drone provider partnership + API access (DJI Cloud API developer account and licensing first; MAVLink bridge later) | External | Real telemetry, live video, mission upload | 2 | R-01 | CTO / BizDev | Not started |
| D-02 | Photogrammetry engine (NodeODM self-hosted and/or Pix4D/DroneDeploy partnership) | External | In-platform processing | 2 | R-13 | GIS Lead | Not started |
| D-03 | Basemap, satellite imagery and terrain providers with commercial SaaS terms | External | Maps | 1 | R-17 | GIS Lead | Not started |
| D-04 | Cloud provider accounts, quotas (GPU, EKS), enterprise support | External | All | 1 | R-11 | SRE | Not started |
| D-05 | LLM provider (Anthropic) with zero-retention terms and regional availability | External | AI features | 2 | R-07, R-16 | AI Lead | Not started |
| D-06 | Labelled evaluation datasets from design partners (with consent) | External/Internal | AI quality gates | 1–2 | R-07 | AI Lead | Not started |
| D-07 | Payment provider (Stripe) account and tax configuration | External | Billing | 1 | — | Finance | Not started |
| D-08 | Transactional email provider with domain authentication (SPF, DKIM, DMARC) | External | Auth, notifications | 1 | — | DevOps | Not started |
| D-09 | External penetration-testing vendor | External | GA gates | 1, 3 | R-02 | Security | Not started |
| D-10 | Legal review: DPA, privacy policy, terms, drone-imagery law per market | External | GA | 1 | R-03, R-09 | Legal | Not started |
| D-11 | Design partners (3–5) for discovery, UAT and pilot | External | MVP validation | 1 | R-18 | Product | Not started |
| D-12 | Cesium ion / terrain licensing or self-hosted terrain pipeline | External | 3D twin | 3 | R-06, R-17 | GIS Lead | Not started |
| D-13 | IFC conversion tooling (IfcOpenShell or commercial) | External | BIM in twin | 3 | R-13 | GIS Lead | Not started |
| D-14 | Tenancy + RBAC foundation complete before feature modules | Internal | Everything | 1 | R-02 | Tech Lead | Not started |
| D-15 | Media pipeline complete before surveys/progress/reports | Internal | Phase 1 features | 1 | — | Tech Lead | Not started |
