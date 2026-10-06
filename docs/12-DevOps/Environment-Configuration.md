# Environment Configuration Guide

| | |
|---|---|
| **Document** | Environment Configuration Guide |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-43 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI DevOps |
| **Reviewer** | _Pending — SRE Lead, Security Engineer_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | DevOps | Initial variable catalog (planned — becomes authoritative once `packages/config/env.ts` exists) |

---

## 1. Principles

1. **12-factor:** all configuration via environment variables. There are no environment-specific code branches beyond `APP_ENV`.
2. **Validated at boot** with a zod schema (`packages/config/env.ts`). Apps exit with a clear message on missing or invalid values.
3. **Secrets** (marked 🔒) come from AWS Secrets Manager via External Secrets in deployed environments, and from `.env.local` (git-ignored) locally. Never commit real secrets. `.env.example` contains placeholders only.
4. Every variable is documented here (CI docs gate, [CI-CD §5](CI-CD.md#5-documentation-gate)).

## 2. Variable Catalog

### 2.1 Common (all Node services)

| Variable | Required | Example (non-secret) | Description |
|---|---|---|---|
| `APP_ENV` | ✓ | `local` \| `preview` \| `development` \| `staging` \| `production` | Environment name |
| `APP_REGION` | ✓ | `eu-central-1` | Deployment region / cell |
| `CELL_ID` | ✓ | `eu1` | Cell identifier |
| `LOG_LEVEL` | | `info` | `debug` \| `info` \| `warn` \| `error` |
| `PORT` | | `3000` | HTTP port |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | ✓ (deployed) | `http://otel-collector:4317` | Traces/metrics |
| `OTEL_SERVICE_NAME` | ✓ | `aerosight-api` | |
| `SENTRY_DSN` 🔒 | | | Error tracking |
| `PUBLIC_APP_URL` | ✓ | `https://app.aerosight.ai` | Used in links/emails |
| `PUBLIC_API_URL` | ✓ | `https://api.aerosight.ai` | |
| `PUBLIC_REALTIME_URL` | ✓ | `wss://rt.aerosight.ai/v1` | |
| `CORS_ALLOWED_ORIGINS` | ✓ | `https://app.aerosight.ai,https://admin.aerosight.ai` | Comma-separated |

### 2.2 Database & cache

| Variable | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` 🔒 | ✓ | `postgres://app_user:***@db:5432/aerosight` | Runtime role (RLS enforced) |
| `DATABASE_REPLICA_URL` 🔒 | | | Read replica for analytics/reports |
| `DATABASE_MIGRATOR_URL` 🔒 | migrator only | | DDL role |
| `DATABASE_POOL_MAX` | | `10` | Per pod |
| `DATABASE_STATEMENT_TIMEOUT_MS` | | `5000` | API default |
| `REDIS_URL` 🔒 | ✓ | `rediss://:***@redis:6379/0` | Cache, rate limit, pub/sub |
| `REDIS_QUEUE_URL` 🔒 | ✓ | `rediss://…/1` | BullMQ (noeviction policy) |
| `REDIS_STREAMS_URL` 🔒 | ✓ | `rediss://…/2` | Telemetry streams |

### 2.3 Auth & security

| Variable | Required | Example | Description |
|---|---|---|---|
| `JWT_ISSUER` | ✓ | `https://api.aerosight.ai` | |
| `JWT_AUDIENCE` | ✓ | `aerosight-api` | |
| `JWT_SIGNING_KEY_ARN` 🔒 | ✓ (deployed) | KMS key ARN | ES256 signing via KMS |
| `JWT_PRIVATE_KEY_PEM` 🔒 | local only | | Dev signing key |
| `ACCESS_TOKEN_TTL_SECONDS` | | `900` | |
| `REFRESH_TOKEN_IDLE_HOURS` | | `12` | |
| `REFRESH_TOKEN_ABSOLUTE_DAYS` | | `30` | |
| `COOKIE_DOMAIN` | ✓ | `.aerosight.ai` | |
| `APP_ENCRYPTION_KEY_ARN` 🔒 | ✓ | KMS key ARN | Envelope encryption (TOTP secrets etc.) |
| `HIBP_API_ENABLED` | | `true` | Breached-password check |
| `RATE_LIMIT_ENABLED` | | `true` | |
| `ADMIN_IP_ALLOWLIST` | admin only | `203.0.113.0/24` | |

### 2.4 Storage & CDN

| Variable | Required | Example | Description |
|---|---|---|---|
| `S3_REGION` | ✓ | `eu-central-1` | |
| `S3_ENDPOINT` | local | `http://minio:9000` | MinIO locally |
| `S3_BUCKET_QUARANTINE` | ✓ | `asai-eu1-quarantine` | |
| `S3_BUCKET_MEDIA` | ✓ | `asai-eu1-media` | |
| `S3_BUCKET_DERIVED` | ✓ | `asai-eu1-derived` | |
| `S3_BUCKET_REPORTS` | ✓ | `asai-eu1-reports` | |
| `S3_BUCKET_EXPORTS` | ✓ | `asai-eu1-exports` | |
| `S3_REGION_OVERRIDE` | DR only | `eu-west-1` | DR failover |
| `CDN_MEDIA_BASE_URL` | ✓ | `https://media.aerosight-cdn.com` | Cookieless media domain |
| `CDN_SIGNING_KEY_ID` | ✓ | | CloudFront key pair ID |
| `CDN_SIGNING_PRIVATE_KEY` 🔒 | ✓ | | |
| `SIGNED_URL_TTL_DOWNLOAD_SECONDS` | | `300` | |
| `SIGNED_COOKIE_TTL_SECONDS` | | `3600` | |
| `UPLOAD_MAX_FILE_BYTES` | | `21474836480` | 20 GB |
| `UPLOAD_PART_SIZE_BYTES` | | `16777216` | 16 MB |

### 2.5 Media, geo & workers

| Variable | Required | Example | Description |
|---|---|---|---|
| `CLAMAV_HOST` / `CLAMAV_PORT` | ✓ | `clamav` / `3310` | Malware scanning |
| `FFMPEG_PATH` | | `/usr/bin/ffmpeg` | |
| `GDAL_CACHEMAX` | | `1024` | MB |
| `TITILER_URL` | ✓ | `http://tiles:8000` | Internal tile server |
| `WORKER_QUEUES` | ✓ (workers) | `media.scan,media.process` | Queues this worker consumes |
| `WORKER_CONCURRENCY` | | `4` | |
| `PER_ORG_CONCURRENCY_DEFAULT` | | `3` | Fairness cap per queue |
| `PLAYWRIGHT_CHROMIUM_PATH` | report worker | | PDF rendering |

### 2.6 Maps

| Variable | Required | Example | Description |
|---|---|---|---|
| `NEXT_PUBLIC_MAP_STYLE_URL` | ✓ | `https://tiles.example.com/styles/streets.json` | Vector basemap style |
| `NEXT_PUBLIC_MAP_SATELLITE_URL` | ✓ | XYZ template | Satellite imagery |
| `NEXT_PUBLIC_MAP_TERRAIN_URL` | ✓ | Terrain-RGB template | |
| `NEXT_PUBLIC_MAP_FALLBACK_URL` | ✓ | OSM raster template | |
| `MAP_PROVIDER_API_KEY` 🔒* | | | *Public-restricted key (referrer-locked) if the provider requires a browser key |
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` 🔒* | Phase 3 | | Referrer-restricted |
| `GEOCODING_PROVIDER` / `GEOCODING_API_KEY` 🔒 | | `mapbox` | Server-side geocoding |

### 2.7 Drone integration & realtime

| Variable | Required | Example | Description |
|---|---|---|---|
| `DRONE_ADAPTERS_ENABLED` | ✓ | `simulator,manual` | Phase 2 adds `dji_cloud` |
| `DRONE_COMMANDS_ENABLED` | ✓ | `false` | Global kill switch for outbound commands |
| `SIMULATOR_TICK_HZ` | | `5` | |
| `TELEMETRY_FANOUT_HZ` | | `2` | |
| `TELEMETRY_STREAM_SHARDS` | | `16` | |
| `DJI_CLOUD_APP_ID` / `DJI_CLOUD_APP_KEY` 🔒 / `DJI_CLOUD_LICENSE` 🔒 | Phase 2 | | DJI Cloud API credentials |
| `MQTT_BROKER_URL` 🔒 | Phase 2 | | |
| `WS_HEARTBEAT_SECONDS` | | `15` | |
| `WS_MAX_SUBSCRIPTIONS` | | `50` | |
| `STREAM_GATEWAY_URL` | Phase 2 | `https://live.aerosight.ai` | |
| `STREAM_VIEWER_JWT_KEY` 🔒 | Phase 2 | | |
| `TURN_URLS` / `TURN_SECRET` 🔒 | Phase 2 | | coturn |

### 2.8 AI

| Variable | Required | Example | Description |
|---|---|---|---|
| `AI_ENABLED` | ✓ | `false` (Phase 1) | Global switch |
| `AI_SERVICE_URL` | Phase 2 | `http://ai:8000` | |
| `AI_CALLBACK_HMAC_KEY` 🔒 | Phase 2 | | Signs AI → API callbacks |
| `LLM_PROVIDER` | Phase 2 | `anthropic` | |
| `ANTHROPIC_API_KEY` 🔒 | Phase 2 | | |
| `AI_MODEL_DEFAULT` | Phase 2 | `claude-sonnet-5-5` | |
| `AI_MODEL_FAST` | Phase 2 | `claude-haiku-4-5-20251001` | |
| `AI_MODEL_ADVANCED` | Phase 2 | `claude-opus-5-5` | |
| `AI_VISION_MODEL_REGISTRY` | Phase 2 | `s3://asai-models/registry.json` | Self-hosted vision models |
| `AI_MAX_CONCURRENT_JOBS_PER_ORG` | | `5` | |

### 2.9 Email, notifications, billing, integrations

| Variable | Required | Example | Description |
|---|---|---|---|
| `EMAIL_PROVIDER` | ✓ | `ses` \| `postmark` \| `smtp` (local: Mailpit) | |
| `EMAIL_FROM` | ✓ | `AeroSight AI <no-reply@aerosight.ai>` | |
| `SMTP_URL` 🔒 | local | `smtp://mailpit:1025` | |
| `POSTMARK_TOKEN` 🔒 | if postmark | | |
| `WEB_PUSH_VAPID_PUBLIC_KEY` / `WEB_PUSH_VAPID_PRIVATE_KEY` 🔒 | Phase 2 | | |
| `BILLING_PROVIDER` | ✓ | `stripe` | |
| `STRIPE_SECRET_KEY` 🔒 | ✓ | | Test keys outside production |
| `STRIPE_WEBHOOK_SECRET` 🔒 | ✓ | | |
| `WEBHOOK_EGRESS_PROXY_URL` | ✓ (deployed) | `http://egress-proxy:3128` | SSRF control |
| `OAUTH_<PROVIDER>_CLIENT_ID` / `_CLIENT_SECRET` 🔒 | per integration | | Procore, ACC, Slack, Teams |

### 2.10 Feature flags

| Variable | Example | Description |
|---|---|---|
| `FEATURE_FLAGS_PROVIDER` | `db` | OpenFeature provider |
| `FEATURE_FLAGS_DEFAULTS` | `{"twin.viewer":false,"ai.progress_analysis":false}` | Bootstrap defaults (JSON) |

### 2.11 Demo build (`src/`) — variables actually read today

| Variable | Required | Description |
|---|---|---|
| `AUTH_SECRET` 🔒 | ✓ (production) | ≥ 32 chars. Signs session/2FA cookies and derives the AES-256-GCM key for stored secrets. |
| `ANTHROPIC_API_KEY` 🔒 | Optional | Enables Claude for AI progress analysis, report narratives and the assistant. Without it AI runs in heuristic mode and the assistant is disabled. |
| `AI_MODEL` | Optional | Claude model ID (default `claude-opus-5-5`). |
| `CRON_SECRET` 🔒 | ✓ for cron | Authenticates `/api/cron/daily` (Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`). The route refuses to run without it. |
| `PUBLIC_APP_URL` | Optional | Base URL for links in Slack/Teams/webhook payloads. Defaults to the Vercel production URL. |
| `DRONE_COMMANDS_DISABLED` | Optional | `1` or `true` = platform-wide kill switch: no flight command (pause/resume/RTH) is sent to any drone; missions fall back to record-only status changes. |

## 3. Per-Environment Differences

| Setting | Local | Preview/Dev | Staging | Production |
|---|---|---|---|---|
| Storage | MinIO | MinIO / S3 dev | S3 | S3 + CRR |
| Email | Mailpit (captured) | Mailpit | SES sandbox (allow-listed recipients) | SES/Postmark |
| Billing | Stripe test | Stripe test | Stripe test | Stripe live |
| Drone adapters | simulator, manual | simulator, manual | + provider sandboxes | Per phase |
| AI | Mock LLM (`LLM_PROVIDER=mock`) | Mock or capped real key | Real, capped | Real |
| Log level | debug | debug | info | info |
| Rate limits | Relaxed ×10 | Relaxed ×5 | Production values | Production values |

## 4. Adding a New Variable

1. Add it to `packages/config/env.ts` (zod) with a type, default and description.
2. Add it to `.env.example` (placeholder) and to Helm values / External Secrets mappings.
3. Document it in this file (same PR — CI gate).
4. If it's a secret: create it in Secrets Manager for each environment before deploying.
