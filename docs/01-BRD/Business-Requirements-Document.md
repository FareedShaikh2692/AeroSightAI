# Business Requirements Document (BRD)

| | |
|---|---|
| **Document** | Business Requirements Document |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-01 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product Team |
| **Reviewer** | _Pending — Product Owner, Executive Sponsor_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product Team | Initial draft |

---

## 1. Executive Summary

AeroSight AI is a multi-tenant SaaS platform for construction and infrastructure organizations. It brings drone technology, GIS, 3D visualization, AI, live telemetry, aerial imagery, inspections and progress analytics together so these organizations can monitor and manage their construction sites.

The platform gives one secure environment, isolated per organization, for:

- Drone operations: fleet, pilots, missions, live telemetry and live video
- Site monitoring and aerial surveying
- Mapping (2D, satellite, terrain) and 3D digital twins
- Asset inspections with findings tracked to resolution
- Construction progress tracking against milestones
- Comparing a site against its own history
- AI-assisted analysis, always with human review
- Professional reporting
- Team collaboration and notifications

Today, a site's aerial data, inspection records and progress reports sit in many separate tools. AeroSight AI replaces that with one auditable record per site. This gives project stakeholders, from the drone pilot to the client executive, a shared view of what is happening on site and how it is changing.

## 2. Business Problem

### 2.1 Current State

Construction monitoring today typically relies on:

| Practice | Consequence |
|---|---|
| Manual site visits | Expensive, slow, unsafe at height or in hazardous zones. Coverage is sparse. |
| Ad-hoc photographs | No geolocation consistency, no standard angles, hard to compare over time. |
| Spreadsheets for progress | Subjective percentages, version conflicts, no link to evidence. |
| Separate drone apps (one per manufacturer) | Flight data, media and logs are siloed. No connection to the project record. |
| Disconnected inspection tools | Findings are not tied to a location or asset. Resolution is hard to track. |
| Manual progress reports | Take days to assemble. Out of date when delivered. |
| Limited historical visualization | Disputes over when work was done are hard to settle. |
| Delayed communication | Issues surface after they become expensive. |

### 2.2 Problem Statement

> Construction and infrastructure organizations lack a single, secure, evidence-based system that turns drone-captured data into timely, trustworthy site intelligence. As a result, decisions are slower, reporting costs more, disputes are harder to resolve, and risk is identified late.

### 2.3 Target State

One platform where every flight, image, survey, model, inspection finding and progress measurement is:

- tied to an organization, project, site and (where relevant) asset;
- geolocated and time-stamped;
- permission-controlled and audited;
- comparable over time;
- open to AI analysis whose results a human reviews before they are relied on.

## 3. Business Objectives & Success Metrics

| ID | Objective | KPI | Target (12 months after GA) |
|---|---|---|---|
| OBJ-01 | Improve construction visibility | % of active sites with an aerial capture in the last 14 days | ≥ 80% |
| OBJ-02 | Reduce manual monitoring effort | Site-visit hours per site per month (customer-reported baseline vs. after) | −30% |
| OBJ-03 | Centralize drone data | % of customer flights whose media is stored in AeroSight | ≥ 90% |
| OBJ-04 | Improve inspection workflows | Median time from finding raised to resolved | −25% vs. baseline |
| OBJ-05 | Track construction progress | % of projects with milestones and ≥ 1 progress record per month | ≥ 75% |
| OBJ-06 | Maintain historical site records | Sites with ≥ 3 historical captures that can be compared | ≥ 60% |
| OBJ-07 | Improve reporting | Median time to produce a monthly progress report | < 30 minutes (from days) |
| OBJ-08 | Support multiple sites | Average sites per paying organization | ≥ 5 |
| OBJ-09 | Improve decision-making | Customer NPS / CSAT on "confidence in site status" | NPS ≥ 40 |
| OBJ-10 | Provide real-time visibility | Telemetry end-to-end latency (p95) for connected providers | < 2 s |
| OBJ-11 | Enable AI-assisted analysis | % of AI outputs accepted (or accepted after edits) by reviewers | ≥ 70% |
| OBJ-12 | Platform trust | Cross-tenant data exposure incidents | **0** |

## 4. Stakeholders

### 4.1 Customer-side stakeholders (tenant users)

| Stakeholder | Description | Responsibilities in AeroSight AI | Default role |
|---|---|---|---|
| **Organization Owner** | Executive or account holder who signed up the organization. Legally responsible for the account. | Owns the subscription and billing. Can do anything an Admin can. Transfers ownership. Approves data deletion and export of the whole organization. Accountable for regulatory compliance of the organization's drone operations. | `org_owner` |
| **Organization Administrator** | IT or operations administrator. | Manages users, invitations, roles and custom roles. Configures integrations, SSO, notification rules and data retention. Reviews audit logs. Manages billing if delegated. | `org_admin` |
| **Project Manager** | Runs one or more construction projects. | Creates and configures projects and sites. Assigns team members. Defines milestones. Requests missions and surveys. Reviews progress. Generates and shares reports. | `project_manager` |
| **Site Manager** | Responsible for day-to-day operations at a site. | Maintains site data and assets. Coordinates missions on site. Reviews media and inspections. Records progress. Acknowledges alerts. | `site_manager` |
| **Drone Pilot** | Licensed remote pilot in command. | Registers and maintains drones. Completes pre-flight checklists. Executes assigned missions. Uploads media. Reports incidents. Keeps license data current. **Retains legal responsibility for the flight.** | `drone_pilot` |
| **Surveyor** | Geospatial or survey professional. | Plans survey areas. Uploads and validates survey data. Manages map layers and coordinate reference systems. Checks measurement accuracy. | `surveyor` |
| **Inspector** | Quality, safety or structural inspector. | Runs inspections against assets. Records findings with evidence. Assigns remediation. Submits inspections for review. | `inspector` |
| **Engineer** | Design, structural or civil engineer. | Reviews findings and AI outputs. Approves or rejects inspections. Validates progress measurements. Provides professional conclusions **outside** the AI. | `engineer` |
| **Client / Viewer** | Project owner's representative, investor, lender or other external party. | Read-only access to the projects shared with them: dashboards, maps, approved media, and published reports. | `viewer` |

### 4.2 Provider-side stakeholders

| Stakeholder | Description | Responsibilities |
|---|---|---|
| **Platform Administrator** | AeroSight AI staff who operate the SaaS. | Manage tenant lifecycle (create, suspend, delete), plans and subscriptions. Monitor system health and usage. Respond to incidents. **No routine access to tenant content.** Content access only through audited break-glass. |
| **Support Team** | AeroSight AI customer support. | Triage tickets. View tenant metadata (not content). Use time-boxed, customer-approved impersonation when needed. Every action is audited. |
| **Drone Integration Provider** | Third-party fleet or cloud API (e.g. DJI Cloud API / FlightHub 2, Skydio Cloud, MAVLink-based fleets) and photogrammetry engines (e.g. Pix4D, DroneDeploy, OpenDroneMap). | Provide stable APIs, credentials and documentation. Notify of breaking changes. Meet the agreed SLAs for telemetry, mission upload and media transfer. |

### 4.3 RACI for key business processes

R = Responsible, A = Accountable, C = Consulted, I = Informed

| Process | Owner | Admin | PM | Site Mgr | Pilot | Surveyor | Inspector | Engineer | Viewer |
|---|---|---|---|---|---|---|---|---|---|
| Organization onboarding | A | R | I | – | – | – | – | – | – |
| User & role management | A | R | C | – | – | – | – | – | – |
| Project setup | I | C | A/R | C | I | C | I | C | I |
| Mission planning | – | – | A | C | R | C | C | – | – |
| Flight execution | – | – | I | I | A/R | – | – | – | – |
| Survey processing | – | – | A | I | C | R | – | C | – |
| Inspection | – | – | A | C | C | – | R | C | I |
| Inspection approval | – | – | I | I | – | – | C | A/R | I |
| Progress reporting | I | – | A/R | C | – | C | – | C | I |
| Data retention configuration | A | R | C | – | – | – | – | – | – |

## 5. Business Requirements

| ID | Business Requirement | Rationale | Priority |
|---|---|---|---|
| **BR-01** | Centralize all drone, survey, media, inspection and progress data for an organization in one platform. | Removes silos, creates one site record. | Must |
| **BR-02** | Operate as multi-tenant SaaS with strict isolation between organizations. | Customers are competitors. A cross-tenant leak would be existential for the business. | Must |
| **BR-03** | Control access with roles tailored to construction stakeholders, including custom roles. | Different stakeholders need different capabilities. Clients must see only what is shared. | Must |
| **BR-04** | Manage multiple projects and sites with geospatial context (coordinates, boundaries, assets). | Customers run portfolios of sites. Location is the organizing principle of the data. | Must |
| **BR-05** | Manage the drone fleet and pilots, and plan and track missions, without depending on a single drone manufacturer. | Customers run mixed fleets. Vendor lock-in is a commercial and supply-chain risk. | Must |
| **BR-06** | Give real-time visibility of active operations (telemetry, live video) where the provider supports it. | Safety oversight and remote stakeholder visibility. | Should (Phase 2) |
| **BR-07** | Capture, store, process and securely share aerial media (images, video, panoramas, models). | Media is the primary evidence. | Must |
| **BR-08** | Show sites on 2D, satellite and terrain maps and in a 3D digital twin, including history. | Spatial and temporal context drives understanding. | Must (2D) / Could (3D, Phase 3) |
| **BR-09** | Provide a structured asset-inspection workflow, from finding to verified resolution. | Quality, safety and contractual compliance. | Should (Phase 2) |
| **BR-10** | Track construction progress against milestones and compare it over time. | Core value proposition for PMs and clients. | Must |
| **BR-11** | Provide AI-assisted analysis with mandatory human oversight and permission-aware access. | Efficiency at scale without unsafe automation. | Should (Phase 2) |
| **BR-12** | Generate and distribute professional, branded reports. | Reporting is the main output customers pay for. | Must |
| **BR-13** | Notify stakeholders of relevant events through configurable channels. | Faster response to issues. | Should |
| **BR-14** | Make all significant actions auditable, and support data retention, export and deletion. | Contractual disputes, regulatory and privacy obligations. | Must |
| **BR-15** | Support subscription plans, billing and usage metering. | Commercial viability. Controls storage and AI costs. | Must |
| **BR-16** | Integrate with external systems: drone providers, processing engines, construction PM tools, identity providers, webhooks. | Fits into existing customer ecosystems. | Should |
| **BR-17** | Meet enterprise expectations for security, reliability, performance and accessibility. | Enterprise sales requirement. | Must |
| **BR-18** | Provide analytics dashboards for operational and portfolio decisions. | Decision support for leadership. | Should |

## 6. Business Scope

### 6.1 In Scope

Organization management · Multi-tenancy · Authentication · RBAC · Projects · Sites · Assets · Drone fleet · Missions · Telemetry · Live monitoring · Media · Surveys · Maps · 3D visualization · Inspections · Progress tracking · AI analysis · Reports · Notifications · Audit logs · Analytics · Integrations · Billing · Platform administration.

### 6.2 Out of Scope for MVP

| Item | Reason | Treatment |
|---|---|---|
| Direct autonomous flight control without a verified drone-provider integration | Safety and regulatory risk. Requires provider certification. | Missions are planned and tracked. Execution happens in the provider's app. Start and stop commands are logical state changes unless a verified adapter declares `missionControl` capability. |
| Certified engineering conclusions from AI | Liability. AI cannot sign off structural integrity. | AI output is labelled *"AI-assisted — not an engineering certification"* and requires human review. |
| Fully automated regulatory compliance (e.g. airspace authorization, Part 107 / EASA / DGCA filings) | Jurisdiction-specific. Requires authority integrations. | Checklists and pilot-license tracking only. Compliance stays with the pilot and operator. |
| Advanced photogrammetry processing when no processing engine is connected | Compute-heavy. Specialized engines exist. | Integration with external engines. Upload of pre-processed outputs (orthomosaic GeoTIFF, 3D Tiles, LAS/LAZ) is supported. |
| Native mobile apps | Web-first. Responsive design covers field use. | Responsive web. Native apps are Future Scope. |
| On-premise deployment | SaaS-first. | Future Scope (single-tenant dedicated deployment). |

### 6.3 Capability Delivery Classification (target at MVP)

| Capability | Target status at MVP | Notes |
|---|---|---|
| Auth, Orgs, RBAC, Projects, Sites, Assets | **Implemented** | |
| Drone registration, pilot records | **Implemented** | |
| Mission planning, scheduling, lifecycle | **Implemented** | Execution is logical (see 6.2). |
| Drone telemetry | **Simulated** | Drone Simulator adapter. Real providers are Phase 2 and **Integration Required**. |
| Live video | **Integration Required** | Phase 2. |
| Media upload, processing, preview | **Implemented** | |
| 2D / satellite / terrain maps | **Implemented** | Basemap provider key required. |
| Orthomosaic display | **Implemented** for uploaded GeoTIFF/COG. **Integration Required** for in-platform processing. | |
| Basic progress monitoring (manual, milestone-based) | **Implemented** | |
| AI progress analysis | **Prototype** (Phase 2) | |
| Reports (PDF) | **Implemented** | |
| Audit logs | **Implemented** | |
| 3D digital twin | **Planned** (Phase 3); **Prototype** viewer for uploaded 3D Tiles may come earlier | |

## 7. Business Constraints

- **Regulatory:** Drone operations are governed by national aviation authorities (FAA, EASA, UK CAA, DGCA, GCAA and others). The platform supports compliance but does not replace it.
- **Data residency:** Enterprise customers may require data to stay in a region (EU, US, ME). The architecture must support regional deployments (see [System Architecture](../04-Architecture/System-Architecture.md)).
- **Cost:** Video and 3D storage costs grow with usage. Plans must meter storage and AI usage (BR-15).
- **Connectivity:** Construction sites often have poor connectivity. Uploads must be resumable and the UI must tolerate latency.
- **Provider dependency:** Real-time capabilities depend on third-party drone APIs (see [Risk Register](../13-Product/Risks.md) R-01).

## 8. Business Assumptions

See [Assumptions & Dependencies](../13-Product/Assumptions-Dependencies.md) for the full register. The key ones:

1. Customers already own drones and employ or contract licensed pilots.
2. At least one drone provider exposes a cloud or SDK API suitable for telemetry in Phase 2.
3. Customers accept AI output as advisory only.
4. Customers will pay per-seat plus usage (storage, AI credits).

## 9. Commercial Model (indicative)

| Plan | Target customer | Included | Metered |
|---|---|---|---|
| **Starter** | Small contractor, 1–3 sites | 5 seats, 3 active projects, 250 GB storage, maps, missions, media, reports | Extra storage |
| **Professional** | Mid-size contractor | 25 seats, unlimited projects, 2 TB, inspections, AI credits (monthly pool), integrations | Storage, AI credits, video minutes |
| **Enterprise** | Large GC / infrastructure owner | Custom seats, SSO/SAML, custom roles, data residency, retention policies, audit export, SLA 99.9% | Negotiated |

## 10. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Executive Sponsor | | | |
| Product Owner | | | |
| Head of Engineering | | | |
