# System Architecture Document

| | |
|---|---|
| **Document** | System Architecture |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-06 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Architecture |
| **Reviewer** | _Pending — Tech Lead, Security Engineer, SRE Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Architecture | Initial draft |

---

## 1. Architectural Goals

| Goal | Driven by | Architectural response |
|---|---|---|
| Strict tenant isolation | BR-02 | Org-scoped tokens, PostgreSQL RLS, prefixed storage, authorized channels ([Multi-Tenancy](Multi-Tenancy.md)) |
| Provider independence | BR-05 | Drone Integration Layer with adapters ([Drone Architecture](Drone-Architecture.md)) |
| Real-time at moderate scale | BR-06 | Dedicated Realtime Gateway, Redis Streams, WebSocket fan-out ([Real-Time](Real-Time-Architecture.md)) |
| Heavy media | BR-07 | Direct-to-storage uploads, async worker pipeline, CDN + signed URLs ([Video](Video-Architecture.md)) |
| Geospatial first | BR-04, BR-08 | PostGIS, COG tiling, 3D Tiles streaming ([GIS](../10-GIS-3D/GIS-Specification.md)) |
| Safe AI | BR-11 | Isolated AI service, permission-scoped tools, human review ([AI](../09-AI/AI-Requirements.md)) |
| Fast team velocity | — | **Modular monolith** for the core domain. Separate services only where the runtime profile differs (realtime, workers, AI, drone integration). |

## 2. Context Diagram (C4 Level 1)

```text
   ┌──────────────┐  ┌────────────┐  ┌───────────────┐  ┌─────────────┐
   │ Tenant users │  │ Client     │  │ Platform staff│  │ API clients │
   │ (browser)    │  │ viewers    │  │ (admin app)   │  │ (API keys)  │
   └──────┬───────┘  └─────┬──────┘  └──────┬────────┘  └──────┬──────┘
          └────────────────┴───────┬────────┴──────────────────┘
                                   ▼
                   ┌───────────────────────────────┐
                   │          AeroSight AI          │
                   └───────────────┬───────────────┘
   ┌───────────────┬───────────────┼────────────────┬───────────────┬──────────────┐
   ▼               ▼               ▼                ▼               ▼              ▼
Drone provider  Photogrammetry  Basemap/terrain  LLM & vision    Email / Push   Payment
clouds & edge   engines         & geocoding      model APIs      providers      provider
bridges                                                                         + IdPs
```

## 3. Container Diagram (C4 Level 2)

```text
                          Web Application (Next.js SPA/SSR, CDN-hosted)
                                         │ HTTPS / WSS
                                         ▼
                ┌──────────────── Edge: CDN + WAF + DDoS protection ────────────────┐
                                         │
                                         ▼
                               API Gateway (Envoy/Kong)
          ── TLS termination, JWT pre-validation, rate limiting, request IDs, routing ──
                 │                 │                    │                    │
                 ▼                 ▼                    ▼                    ▼
        ┌────────────────┐ ┌────────────────┐ ┌──────────────────┐ ┌─────────────────┐
        │ Core API       │ │ Realtime       │ │ Drone Integration│ │ Admin API       │
        │ (NestJS        │ │ Gateway (WS)   │ │ Service          │ │ (staff realm)   │
        │ modular        │ │                │ │ (adapters,       │ │                 │
        │ monolith)      │ │                │ │ telemetry ingest)│ │                 │
        │ Auth · Orgs ·  │ └───────┬────────┘ └────────┬─────────┘ └────────┬────────┘
        │ RBAC · Projects│         │                   │                    │
        │ Sites · Assets │         │                   │                    │
        │ Drones ·       │         │                   │                    │
        │ Missions ·     │         │                   │                    │
        │ Media · Survey │         │                   │                    │
        │ Maps · Inspect.│         │                   │                    │
        │ Progress ·     │         │                   │                    │
        │ Reports ·      │         │                   │                    │
        │ Notif · Audit ·│         │                   │                    │
        │ Billing        │         │                   │                    │
        └──────┬─────────┘         │                   │                    │
               │                   │                   │                    │
     ┌─────────┼───────────────────┼───────────────────┼────────────────────┘
     ▼         ▼                   ▼                   ▼
 PostgreSQL 16 + PostGIS      Redis 7 (cluster)              Object Storage (S3)
 + TimescaleDB                 · cache · rate limits          · quarantine bucket
 · RLS per tenant              · pub/sub (WS fan-out)         · media bucket (SSE-KMS)
 · read replica                · Streams (telemetry, events)  · tiles/derivatives
                               · BullMQ queues                · reports, exports
     │                              │                               │
     │            ┌─────────────────┼────────────────┬──────────────┘
     ▼            ▼                 ▼                ▼
          Workers (Node.js, BullMQ)            AI Service (Python/FastAPI)
          · media-processor (sharp, exiftool)  · progress / change detection
          · video-transcoder (FFmpeg)          · defect detection (GPU pool)
          · geo-processor (GDAL, PDAL,         · LLM orchestration (report
            py3dtiles via sidecar)               narrative, assistant tools)
          · report-renderer (Playwright)       · embeddings (per-org index)
          · notifier (email/push/chat)
          · scanner (ClamAV)
          · scheduler (cron jobs)
                       │
                       ▼
             Streaming Gateway (MediaMTX / LiveKit) ◄── RTMP/RTSP/WHIP from drone/provider
                       │ WebRTC (WHEP) / LL-HLS
                       ▼
                    Browser
                       ▲
             GIS / Maps / 3D delivery: COG tile server (TiTiler) + CDN,
             3D Tiles static hosting via CDN (signed cookies)
```

## 4. Component Catalog

| Component | Responsibility | Why it exists | Tech (proposed) | Scales by |
|---|---|---|---|---|
| **Web Application** | UI for all tenant users. Map, 3D, live ops. | Primary product surface. | Next.js 15 (React 19, TypeScript), TanStack Query, Zustand, Tailwind + Radix, MapLibre GL JS, CesiumJS, deck.gl | CDN |
| **Admin Application** | Platform staff console. | Separate blast radius and identity realm. | Next.js (separate deployment, `admin.` subdomain) | CDN |
| **CDN + WAF** | Static assets, tile/3D caching, OWASP rule set, bot and DDoS protection. | Performance and protection at the edge. | CloudFront + AWS WAF (or Cloudflare) | Managed |
| **API Gateway** | Single entry for APIs. TLS, JWT pre-check, rate limits, routing, request IDs, CORS. | Cross-cutting concerns in one place. Lets services evolve independently. | Envoy Gateway / Kong OSS on Kubernetes | Horizontal |
| **Core API** | Domain logic and REST API for all business modules. | Most features share the transactional data model. A modular monolith avoids distributed-transaction complexity early. | Node.js 22, NestJS 11, Drizzle ORM / Kysely, zod | Horizontal (stateless) |
| **Auth module** (in Core API) | Signup, login, tokens, 2FA, sessions, SSO. | Identity is foundational. Kept in-process for latency. Extractable later. | `@node-rs/argon2`, `jose`, `otplib`, `openid-client`, `samlify` | — |
| **Realtime Gateway** | WebSocket connections, channel auth, fan-out of telemetry/notifications/job progress. | Long-lived connections have a different scaling profile from REST. | Node.js + `uWebSockets.js`, Redis pub/sub | Horizontal by connections |
| **Drone Integration Service** | Provider adapters, credential use, telemetry ingestion and normalization, mission upload, media sync, simulator. | Isolates third-party protocols (MQTT, vendor SDKs) and failures from the core. | Node.js (adapters), MQTT client, MAVSDK bridge (edge) | Horizontal, partitioned by drone |
| **Workers** | Async jobs: media, video, geo, reports, notifications, scanning, scheduled jobs. | Keeps heavy and slow work off the request path (NFR-PERF-016). | BullMQ on Redis. FFmpeg, sharp, exiftool, GDAL, PDAL, Playwright, ClamAV | Per-queue autoscaling (KEDA on queue depth) |
| **AI Service** | Vision inference, LLM orchestration, embeddings. | Python ML ecosystem. GPU scheduling. Separate scaling and cost controls. | Python 3.12, FastAPI, PyTorch, Anthropic SDK (Claude), pgvector | GPU node pool (Karpenter), concurrency caps |
| **PostgreSQL + PostGIS + TimescaleDB** | System of record, spatial queries, telemetry time series. | Strong consistency, RLS for tenancy, best-in-class spatial support. | AWS RDS/Aurora PostgreSQL 16 (Timescale on self-managed or Timescale Cloud if Aurora lacks it — see ADR-003) | Vertical + read replicas + partitioning |
| **Redis** | Cache, rate limiting, sessions blacklist, pub/sub, Streams, job queues. | Low-latency shared state for stateless services. | ElastiCache Redis 7 (cluster mode) | Shards |
| **Object Storage** | Media, derivatives, tiles, 3D Tiles, reports, exports, backups. | Cheap, durable (11 9s) storage for large binaries. | S3 (SSE-KMS, versioning, Object Lock for audit exports) | Managed |
| **Streaming Gateway** | Live video ingest and WebRTC/LL-HLS egress. | Specialized real-time media server. | MediaMTX (MVP), LiveKit (scale) | Per stream |
| **Tile Server** | Dynamic tiles from COGs (orthomosaics, DSM hillshade). | Avoid pre-tiling every capture. | TiTiler (Python) behind CDN | Horizontal |
| **Notifications** | Outbox relay, recipient resolution, multi-channel delivery. | Reliable, deduplicated delivery. | Worker + SES/Postmark + Web Push | Queue |
| **Observability stack** | Metrics, logs, traces, alerts, RUM. | Operability (NFR-OBS). | OpenTelemetry, Prometheus/Grafana (or managed), Loki, Tempo, Sentry | Managed |
| **Secrets & keys** | Secrets, KMS keys, per-org data keys. | Security (SEC-030+). | AWS Secrets Manager, KMS | Managed |

## 5. Key Runtime Flows

### 5.1 Authenticated API request
```text
Browser ─(Bearer JWT)─► CDN/WAF ─► Gateway: verify signature/exp (JWKS cache), rate-limit (org+user+route)
  ─► Core API: TenantContextInterceptor sets ctx {userId, orgId, roles}
      ─► BEGIN; SET LOCAL app.current_org_id = :orgId; SET LOCAL app.current_user_id = :userId
      ─► PolicyEngine.can(ctx, 'mission:start', mission) ─► domain service ─► repository (RLS-filtered)
      ─► audit insert (same TX) ─► outbox insert (same TX) ─► COMMIT
  ◄─ JSON response (+ X-Request-Id)
```

### 5.2 Media upload
```text
UI → POST /media/uploads (files metadata) → API creates upload_sessions + presigned multipart URLs (quarantine bucket)
UI → PUT parts directly to S3 (parallel 4–6, resumable)
UI → POST /media/uploads/:id/complete → API completes multipart, media.status=scanning, enqueue scan
scanner → clean? copy to media bucket (org/{orgId}/media/{mediaId}/original) : quarantine + notify
media-processor → EXIF, thumbnail, preview, auto-link → status=ready → event media.ready → WS update
video-transcoder (if video) → HLS ladder → status=ready
```

### 5.3 Live telemetry
```text
Provider (MQTT/WS/HTTP) → Drone Integration Service adapter → normalize + validate
 → XADD telemetry:{cell} (Redis Stream, partition by droneId)
   ├─► Fan-out consumer → PUBLISH rt:org:{orgId}:mission:{missionId} → Realtime Gateway nodes → subscribed sockets
   ├─► Persister consumer → batch COPY into telemetry hypertable (every 1 s or 500 rows)
   └─► Alert consumer → rule evaluation → domain_events → notifications
```

## 6. Deployment Topology

```text
Region (e.g. eu-central-1) — one "cell" per region for Phase 1–2
 ├── VPC (3 AZs)
 │    ├── Public subnets: ALB/NLB (ingress), NAT gateways
 │    ├── Private app subnets: EKS node groups
 │    │     ├── general (API, realtime, gateway)      m7g.large+
 │    │     ├── workers (CPU-heavy: FFmpeg, GDAL)      c7g.2xlarge, spot-eligible
 │    │     └── gpu (AI inference)                     g6.xlarge, scale-to-zero
 │    └── Private data subnets: RDS PostgreSQL (Multi-AZ), ElastiCache (Multi-AZ)
 ├── S3 buckets (quarantine, media, derived, reports, backups) + CloudFront
 ├── KMS keys (platform CMK, per-org data keys wrapped by CMK)
 └── Streaming gateway (EC2/EKS with UDP for WebRTC, TURN via coturn)
Global: Route 53, CloudFront, WAF, status page
```

Multi-region (data residency) uses independent cells per region. A small global **directory service** maps `org_slug → region` for login routing and holds no tenant content.

## 7. Technology Decisions (summary)

Full ADRs are in [Technical Design §2](Technical-Design.md#2-architecture-decision-records).

| Decision | Choice | Main alternative | Reason |
|---|---|---|---|
| Backend style | Modular monolith + 4 satellite services | Microservices | Team size, transactional integrity, faster delivery. Extraction path preserved. |
| Language | TypeScript (Node.js) + Python (AI/geo) | Go, Java | Shared types with frontend. Python for ML/geo libs. |
| DB | PostgreSQL + PostGIS + TimescaleDB | MongoDB, separate TSDB | RLS, spatial, time-series in one engine. |
| Queue | BullMQ on Redis (Phase 1–2) | Kafka, SQS | Simplicity. Kafka/MSK considered when event volume > 50k/s. |
| 2D map | MapLibre GL JS | Mapbox GL, Leaflet, OpenLayers | Open-source, vector tiles, WebGL performance, no per-load fees. |
| 3D | CesiumJS | three.js, Unreal Pixel Streaming | Native 3D Tiles, terrain, geospatial accuracy. |
| Live video | MediaMTX → LiveKit | Wowza, AWS IVS | Open-source, WebRTC (WHIP/WHEP), low latency. |
| LLM | Claude (Anthropic API) via provider abstraction | OpenAI, self-hosted | Quality for long-context structured reasoning. Abstraction allows a swap. |

## 8. Cross-Cutting Concerns

| Concern | Approach | Reference |
|---|---|---|
| Tenant isolation | 5 layers (DB, API, authorization, storage, realtime) | [Multi-Tenancy](Multi-Tenancy.md) |
| Authorization | Central `PolicyEngine` (RBAC + resource scoping) | [RBAC](../07-Security/RBAC.md) |
| Auditing | Same-transaction audit + hash chain | [Audit](../07-Security/Audit-Logging.md) |
| Idempotency | `Idempotency-Key` header on POST endpoints with side effects (24 h) | [API §3.6](../06-API/API-Specification.md#36-idempotency) |
| Configuration | 12-factor env vars, secrets from manager | [Env Config](../12-DevOps/Environment-Configuration.md) |
| Feature flags | DB-backed flags with per-org targeting (OpenFeature SDK) | [Technical Design](Technical-Design.md) |
| Internationalization | ICU message format, RTL-ready layout | [UX Spec](../08-UX/UX-Specification.md) |

## 9. Failure Modes & Degradation

| Failure | Impact | Degradation behavior |
|---|---|---|
| AI Service down | AI features unavailable | Buttons show "AI temporarily unavailable". Jobs queue and retry. Core unaffected. |
| Drone provider API down | No live telemetry from that provider | Adapter circuit opens. Live Ops shows "Provider unavailable". Missions can still be completed manually. |
| Redis primary failover | Brief WS disconnects, queue pause | Clients auto-reconnect and resume. Jobs resume (persisted in Redis AOF + replicas). |
| Streaming gateway down | No live video | Telemetry still works. Video panel shows offline state. |
| Basemap provider down | No vector basemap | Fallback to OSM raster tiles (MAP-014). |
| DB primary failure | Writes unavailable ≤ 60–120 s | Multi-AZ automatic failover. API returns 503 with Retry-After during the window. |
| Region outage | Full outage for that cell | DR procedure ([DR Plan](../12-DevOps/Disaster-Recovery.md)). |
