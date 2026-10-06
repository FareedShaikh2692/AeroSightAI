# Monitoring & Observability Plan

| | |
|---|---|
| **Document** | Monitoring & Observability Plan |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-32 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI SRE |
| **Reviewer** | _Pending — SRE Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | SRE | Initial plan |

---

## 1. Stack

| Signal | Collection | Backend (proposed) |
|---|---|---|
| Metrics | OpenTelemetry SDK + Prometheus exporters, kube-state-metrics, node-exporter, CloudWatch (managed services via exporter) | Prometheus-compatible (Amazon Managed Prometheus or Grafana Mimir) |
| Logs | stdout JSON → OTel Collector / Fluent Bit | Grafana Loki (or OpenSearch). 30 d hot, 1 y cold in S3. |
| Traces | OpenTelemetry (W3C tracecontext) across web → gateway → api → workers → ai | Grafana Tempo. 10% head sampling + 100% of errors/slow (tail sampling). |
| Frontend | web-vitals RUM, Sentry browser SDK (source maps) | Sentry + Grafana |
| Errors | Sentry (backend + frontend), with PII scrubbing | Sentry |
| Synthetic | Checkly/Grafana Synthetic: login, dashboard, upload small file, report generate, simulator telemetry latency | Grafana |
| Uptime / status | External probes from 3 regions | Status page (public) |
| Alerting | Grafana Alerting / Alertmanager → PagerDuty (P1/P2), Slack (P3/P4) | |

## 2. What We Monitor

| Component | Key metrics | Why |
|---|---|---|
| **API** | RPS, error rate (5xx, 4xx by code), latency p50/p95/p99 per route, saturation (CPU/mem), event-loop lag, in-flight requests | Core SLO |
| **Database** | CPU, connections (used/max), replication lag, slow queries (> 200 ms), locks/deadlocks, IOPS, free storage, cache hit ratio, autovacuum lag, Timescale chunk/compression jobs | Most common bottleneck |
| **Redis** | Memory usage/fragmentation, evictions (must be 0 for queue DB), ops/s, latency, replication, connected clients, stream lengths | Queues, WS fan-out |
| **WebSockets** | Active connections, connect/disconnect rate, close codes, messages out/s, per-connection backpressure, ticket failures | Live ops UX |
| **Telemetry pipeline** | Ingest msg/s by provider, invalid rate by reason, stream lag per consumer group, e2e latency histogram, alerts emitted | NFR-PERF-004 |
| **Drone integrations** | Adapter health per provider/connection, circuit breaker state, command success rate and latency, provider API error codes, rate-limit hits | Third-party risk R-01 |
| **Video processing** | Queue depth/age, transcode duration vs. realtime ratio, failures, GPU/CPU usage; live: active streams, viewers, ICE failures, fallback rate | BR-07 |
| **Storage** | Bytes per bucket/org, growth rate, 4xx/5xx from S3, CloudFront hit ratio, signed-URL generation errors, quarantine count | Cost & integrity |
| **AI services** | Job queue depth/age, latency per capability, failures by code, tokens/credits per org, GPU utilization, provider error/rate-limit, eval-score drift | Cost & quality |
| **Background jobs** | Per-queue depth, age of oldest job, throughput, failure/retry/DLQ counts, per-org concurrency | Reliability |
| **Auth/security** | Login success/failure, lockouts, refresh reuse, MFA failures, cross-tenant 404 bursts, WAF blocks, break-glass sessions | Security monitoring (SEC-054) |
| **Business** | Active orgs/users, flights/day, uploads/day, reports/day, AI acceptance rate | Product health |
| **Kubernetes/infra** | Node pressure, pod restarts, OOMKills, HPA/KEDA scaling events, certificate expiry | Platform |

## 3. SLOs

| Service | SLI | SLO (28-day) |
|---|---|---|
| API availability | % of non-5xx responses for valid requests | 99.9% |
| API latency | % of standard read requests < 500 ms | 99% |
| Web app | % of page loads with LCP < 3 s (RUM) | 90% |
| Telemetry freshness | % of telemetry messages delivered < 2 s | 99% |
| Media processing | % of images ready < 60 s after upload complete | 99% |
| Report generation | % of reports ready < 180 s | 95% |
| Notification delivery (critical in-app) | % delivered < 10 s | 99% |

Error budgets drive release pace: when > 50% of budget is burned within the window, releases require SRE approval. When 100% is burned, only fixes ship.

## 4. Alerts

| Alert | Condition | Severity | Route |
|---|---|---|---|
| API SLO fast burn | 14.4× burn rate over 1 h (and 5 min) | P1 | PagerDuty |
| API SLO slow burn | 6× over 6 h | P2 | PagerDuty (business hours) |
| 5xx spike | > 2% for 5 min | P1 | PagerDuty |
| DB CPU | > 85% for 10 min | P2 | PagerDuty |
| DB connections | > 85% of max for 5 min | P2 | PagerDuty |
| DB replication lag | > 30 s for 5 min | P2 | Slack + PD |
| DB free storage | < 15% | P2 | PD |
| Redis memory | > 80% / any eviction on queue DB | P2 / P1 | PD |
| Queue age | Oldest job > 10 min (media), > 30 min (video/geo), > 5 min (notify) | P2 | PD |
| DLQ | Any message in `*.dead` | P3 | Slack |
| Telemetry e2e p95 | > 2 s for 5 min | P2 | PD |
| Stream lag | > 5 s for 2 min | P2 | PD |
| WS disconnect storm | Close rate > 20%/min | P2 | PD |
| Provider adapter down | Circuit open > 5 min | P3 | Slack (P2 if > 25% of active missions affected) |
| Transcode failures | > 5% in 30 min | P3 | Slack |
| AI provider errors | > 10% in 15 min | P3 | Slack |
| AI cost anomaly | Org spend > 3× 7-day avg | P3 | Slack + billing |
| Storage growth anomaly | > 3× daily avg | P3 | Slack |
| Audit hash mismatch | Any | P1 (security) | PD + Security |
| Refresh-token reuse spike | > 20/h platform-wide | P2 (security) | Security on-call |
| Cross-tenant 404 burst | > 50 404s on valid foreign IDs per actor/10 min | P2 (security) | Security on-call |
| Certificate expiry | < 14 days | P3 | Slack |
| Backup failure | Any failed snapshot/PITR gap | P2 | PD |
| Synthetic check failure | 2 consecutive regions | P1 | PD |

Every alert links to a runbook (`docs/12-DevOps/runbooks/<alert>.md`, to be written per alert before GA).

## 5. Dashboards

1. **Executive/Service overview:** SLOs, error budgets, traffic, incidents.
2. **API:** RED per route, top slow endpoints, error codes.
3. **Data stores:** Postgres, Redis, S3, CloudFront.
4. **Realtime & telemetry:** connections, ingest, lag, latency heatmap, alerts by type.
5. **Workers:** queues, throughput, failures, autoscaling.
6. **Video & streaming.**
7. **AI:** jobs, latency, cost per capability/org, acceptance rates, eval scores.
8. **Security:** auth events, WAF, tenant-denial anomalies, break-glass.
9. **Tenant drill-down:** filter all panels by `org_id` (for support, metadata only).
10. **Frontend RUM:** web vitals by route/browser/country.

## 6. Logging Standards

- JSON fields: `ts, level, msg, service, version, env, requestId, traceId, spanId, orgId, userId (UUID only), route, statusCode, durationMs, errorCode`.
- Levels: `error` (actionable), `warn`, `info` (request summaries, state changes), `debug` (off in prod; per-org temporary enablement via flag).
- Never logged: passwords, tokens, cookies, signed URLs, API keys, MFA secrets, full request bodies, EXIF GPS of private media, AI prompts/responses.
- Retention: 30 days hot, 1 year archive (security logs 1 year hot-searchable).

## 7. On-call & Incident Management

- 24/7 rotation (primary + secondary) from GA. Business hours before GA.
- Severity: SEV1 (outage/data leak/safety), SEV2 (major degradation), SEV3 (minor), SEV4.
- Process: declare → incident channel → commander/communicator roles → status page updates every 30 min (SEV1/2) → resolve → blameless postmortem within 5 business days with action items tracked.
