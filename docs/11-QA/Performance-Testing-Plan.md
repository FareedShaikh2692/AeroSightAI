# Performance Testing Plan

| | |
|---|---|
| **Document** | Performance Testing Plan |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-30 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI QA & SRE |
| **Reviewer** | _Pending — SRE Lead, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | QA & SRE | Initial plan |

---

## 1. Objectives

Validate the [NFR](../03-SRS/Non-Functional-Requirements.md) design targets under the reference load model, find bottlenecks and breaking points, and set capacity baselines. **The targets are hypotheses until this plan's tests pass on production-like infrastructure.**

## 2. Environment

- **perf** environment: same Terraform modules as production at 50% scale (results extrapolated linearly only where scaling has been verified horizontally).
- Data volume seeded to Year-1 scale: 300 orgs, 6,000 users, 3,000 projects, 9,000 sites, 50M media rows (metadata, with 1% real objects), 2B telemetry rows (compressed), 5M audit rows/month.
- Load generators: k6 (HTTP + WebSocket) on separate nodes in the same region. Telemetry generator (Go) emulating providers. Browser metrics via Lighthouse CI and Playwright traces.
- Observability: Grafana dashboards + traces. Coordinated-omission-aware latency measurement (k6 constant-arrival-rate executors).

## 3. Workload Model (normal day, per region)

| Journey | Share of requests | Notes |
|---|---|---|
| Dashboard / project overview | 20% | Mostly reads, cached KPIs |
| Map browsing (features + tiles) | 25% | Tiles mostly CDN; measure origin on cache miss |
| Media browse/search/lightbox | 20% | Pagination, filters, signed URL generation |
| Missions/inspections CRUD | 10% | Writes with audit |
| Uploads (initiate/parts/complete) | 5% | Large object traffic goes direct to S3 |
| Live ops (WS) | separate | 50 drones × 5 Hz ingest, 1,500 WS clients |
| Reports/AI jobs | 2% | Async, measure queue throughput |
| Auth (login/refresh) | 8% | Refresh every ~14 min per active user |
| Other | 10% | |

## 4. Test Catalog

| ID | Test | Load profile | Pass criteria | NFR |
|---|---|---|---|---|
| PT-01 | **API baseline load** | 150 req/s constant, 60 min, mix §3 | p95 < 300 ms, p99 < 500 ms for standard queries; error rate < 0.1%; CPU < 60% | NFR-PERF-002/003 |
| PT-02 | **API peak/stress** | Ramp 150 → 800 req/s over 30 min, hold 15 min, then ramp until failure | At 800 req/s: p95 < 500 ms, errors < 0.5%. Identify the breaking point and first bottleneck. Autoscaling reacts < 3 min. | NFR-SCAL-001/002 |
| PT-03 | **Telemetry latency** | 50 drones × 5 Hz (250 msg/s), 1,500 WS subscribers; then 300 drones × 10 Hz (3,000 msg/s), 8,000 subscribers | Normal: e2e p95 < 1 s (internal). Peak: p95 < 1.5 s, no message loss for persisted data, stream lag < 2 s | NFR-PERF-004, TELEM-004 |
| PT-04 | **WebSocket connection storm** | 8,000 clients reconnect within 60 s (simulated gateway restart) | All reconnect < 2 min; no gateway OOM; ticket endpoint p95 < 300 ms | NFR-AVAIL-007 |
| PT-05 | **Dashboard web vitals** | Lighthouse CI (desktop, simulated 50 Mbps) + RUM in staging with 50 synthetic users | LCP < 3.0 s p75; INP < 200 ms; JS shell < 300 KB gz | NFR-PERF-001/005/006 |
| PT-06 | **Upload throughput** | 20 concurrent users each uploading 500 × 12 MB images | Per-user throughput ≥ 80% of the simulated 100 Mbps uplink; processing backlog cleared < 15 min; per-image processing p95 < 10 s | NFR-PERF-011/012 |
| PT-07 | **Video transcoding** | 40 h of mixed 1080p/4K video submitted in 1 h | ≤ 1× realtime p95 per video with autoscaled workers; no failures | NFR-PERF-013 |
| PT-08 | **Report generation** | 50 concurrent progress reports (200 images each) | p95 < 120 s; no worker OOM; DB replica CPU < 70% | NFR-PERF-014 |
| PT-09 | **Soak** | PT-01 load for 24 h + telemetry normal | No memory growth > 10%/24 h per pod; no connection leaks; stable p95 | NFR-AVAIL |
| PT-10 | **Map & 3D client performance** | Scripted Playwright traces on reference laptop (integrated GPU, 16 GB) and tablet (iPad 10th gen class) | Map 5,000 features ≥ 50 fps; twin first frame < 5 s, ≥ 30 fps desktop / ≥ 20 fps tablet | NFR-PERF-008/009/010 |

Additional targeted tests: tenant fairness (one org floods uploads/AI jobs while others keep normal latency), RLS overhead (A/B with and without RLS on the hot queries: < 5% delta), tile server cache-miss latency (p95 < 300 ms).

## 5. Methodology

1. Warm-up 5 min (excluded from results).
2. Constant-arrival-rate executors to avoid coordinated omission.
3. Each test is run 3 times. Report the median run. Variance > 10% → investigate.
4. Capture: latency histograms (p50/p90/p95/p99/max), throughput, error codes, saturation (CPU, memory, DB connections, locks, IOPS, Redis ops, queue depth, stream lag), GC pauses, top slow queries (`pg_stat_statements`).
5. Bottleneck analysis → fix → re-run → record in the results log.

## 6. Schedule

| When | Tests |
|---|---|
| Every merge to main (CI, small scale) | PT-05 (Lighthouse), smoke k6 (20 req/s, 2 min) with regression threshold +20% p95 |
| Weekly (perf env) | PT-01, PT-03 normal, PT-06 |
| Pre-release (phase gates) | Full catalog PT-01 – PT-10 |
| After major architecture changes | Relevant subset |

## 7. Reporting

Report template: summary (pass/fail per PT), environment and versions, workload, results tables and graphs, bottlenecks found, fixes, capacity model update (pods per 100 req/s, WS connections per pod, telemetry msg/s per ingest pod), risks. Stored under `docs/11-QA/perf-results/YYYY-MM-DD.md`.

## 8. Exit Criteria

All P1 targets met or covered by an approved ADR deviation with a remediation date. No unresolved S1/S2 performance defects.
