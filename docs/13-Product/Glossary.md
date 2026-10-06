# Glossary

| | |
|---|---|
| **Document** | Glossary |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-40 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product |
| **Reviewer** | _Pending — Product Owner_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product | Initial glossary |

---

| Term | Definition |
|---|---|
| **3D Tiles** | OGC community standard for streaming massive 3D geospatial content (meshes, point clouds, BIM) with hierarchical level of detail. |
| **Adapter (drone provider adapter)** | A module implementing the `DroneProviderAdapter` interface that translates between AeroSight and a specific drone platform's API. |
| **AGL / AMSL** | Above Ground Level / Above Mean Sea Level — altitude references. |
| **AI-assisted** | Label for any output generated or proposed by AI. It requires human review and is not an engineering certification. |
| **Asset** | A physical object on a site (building, structure, element, crane, road segment, utility, equipment) that can be inspected and tracked. |
| **Audit log** | Append-only, tamper-evident record of significant actions (who, what, when, where, what changed). |
| **Baseline (capture)** | The earlier capture used as reference in comparisons or change detection. |
| **BIM** | Building Information Modeling. Digital representation of a building's physical and functional characteristics (e.g. IFC files). |
| **Break-glass** | Time-boxed, approved, audited emergency access by platform staff to a tenant's data. |
| **BVLOS** | Beyond Visual Line of Sight — drone operations requiring special regulatory approval. |
| **Capability (adapter)** | A feature an adapter supports: `telemetry`, `liveVideo`, `missionUpload`, `missionControl`, `mediaSync`, `flightLogs`, `fleetDiscovery`, `healthStatus`. |
| **Capture** | A dated set of imagery/survey outputs of a site, usually from one mission or upload batch. |
| **Cell** | An independent regional deployment of the full AeroSight stack serving a set of organizations. |
| **COG** | Cloud-Optimized GeoTIFF. A GeoTIFF organized for efficient HTTP range requests and tiling. |
| **CRS** | Coordinate Reference System (e.g. EPSG:4326 WGS 84, EPSG:3857 Web Mercator, UTM zones). |
| **Custom role** | An organization-defined role with a chosen subset of permissions. |
| **Digital Twin** | A georeferenced 3D representation of a site combining reality capture, BIM, assets and operational data over time. |
| **DSM / DTM** | Digital Surface Model (top of surfaces including buildings) / Digital Terrain Model (bare earth). |
| **Expand/contract** | A zero-downtime database migration pattern: add new structures, migrate, remove old ones later. |
| **Finding** | An issue identified during an inspection, with severity, status, location and evidence. |
| **Four-eyes** | A control requiring a second person to approve an action (e.g. progress approval). |
| **Geofence** | A virtual boundary (site boundary + buffer minus no-fly zones) that missions must respect. |
| **GCP** | Ground Control Point. A surveyed marker used to improve photogrammetric accuracy. |
| **GSD** | Ground Sample Distance. Real-world size of one image pixel (cm/px). |
| **HLS / LL-HLS** | HTTP Live Streaming / Low-Latency HLS — adaptive video streaming protocols. |
| **IDOR** | Insecure Direct Object Reference. Accessing objects by guessing or altering identifiers. |
| **Integration Required** | Status label: the architecture exists but the feature needs a third-party provider/engine to work. |
| **KMZ / WPML** | Zipped KML / DJI WayPoint Markup Language for waypoint missions. |
| **LOD** | Level of Detail. Progressively detailed representations loaded by distance/screen-space error. |
| **Logical execution** | Mission start/stop recorded in AeroSight without sending flight commands to the aircraft. |
| **MAVLink / MAVSDK** | Open drone communication protocol / SDK used by PX4 and ArduPilot autopilots. |
| **Milestone** | A weighted, scheduled unit of construction work used to compute progress. |
| **Mission** | A planned and tracked drone flight tied to a project, site and purpose. |
| **No-fly zone** | A polygon within or near a site where missions must not plan waypoints. |
| **Organization (tenant)** | A customer account. The top-level isolation boundary for all data. |
| **Orthomosaic** | A geometrically corrected, georeferenced aerial image mosaic with uniform scale. |
| **Outbox (transactional)** | Pattern where events are written in the same DB transaction as business changes and published asynchronously. |
| **Pilot in command (PIC)** | The licensed person legally responsible for a drone flight. |
| **Point cloud** | A set of 3D points (from photogrammetry or LiDAR) representing surfaces (LAS/LAZ/COPC). |
| **Progress record** | A dated, evidence-backed measurement of percent complete for a milestone, requiring approval. |
| **Project** | A construction or infrastructure undertaking grouping sites, team, milestones and reports. |
| **Prototype** | Status label: working end to end with limited accuracy/hardening. Shown as Beta. Results need human review. |
| **RBAC** | Role-Based Access Control. |
| **RLS** | PostgreSQL Row-Level Security. Database-enforced row filtering per tenant. |
| **RPO / RTO** | Recovery Point Objective (max data loss) / Recovery Time Objective (max downtime). |
| **RTK** | Real-Time Kinematic GNSS positioning with centimeter-level accuracy. |
| **S-curve** | Cumulative planned vs. actual progress chart over time. |
| **Schedule variance (SV%)** | Actual % − planned % at a date. |
| **Signed URL / cookie** | Time-limited, cryptographically signed access to a storage object or path. |
| **Simulated** | Status label: behavior driven by the simulator or synthetic data, never presented as a real flight. |
| **Site** | A geo-bounded physical location within a project where work and flights happen. |
| **SLO / SLI** | Service Level Objective / Indicator. |
| **Survey** | A geospatial capture campaign and its outputs (orthomosaic, DSM/DTM, point cloud, mesh, volumes). |
| **Telemetry** | Real-time flight data (position, altitude, speed, heading, battery, GPS, signal, flight time). |
| **Tenant isolation** | The guarantee that an organization's data is inaccessible to other organizations. |
| **UUIDv7** | Time-ordered UUID format used for all primary keys. |
| **Viewer (client)** | Read-only role limited to shared/published content of assigned projects. |
| **WebRTC / WHIP / WHEP** | Real-time media protocol / WebRTC-HTTP ingestion and egress protocols. |
