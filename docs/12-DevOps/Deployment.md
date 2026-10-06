# DevOps & Deployment Document

| | |
|---|---|
| **Document** | DevOps & Deployment |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-27 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI DevOps / SRE |
| **Reviewer** | _Pending — SRE Lead, Security Engineer_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | DevOps | Initial draft |

---

## 1. Environments

| Environment | Purpose | Infrastructure | Data | Access | Deploys |
|---|---|---|---|---|---|
| **Local** | Development | Docker Compose ([Developer Setup](../14-Guides/Developer-Setup.md)) | Seeds/fixtures | Developer | Manual |
| **Preview** (per PR) | Review, E2E smoke | Namespace per PR in the `dev` EKS cluster. Shared RDS instance with a DB per PR. MinIO. | Fixtures (two-org) | Team SSO | Automatic on PR, destroyed on close |
| **Development** | Integration of main | `dev` EKS cluster, small RDS | Synthetic | Team SSO | Every merge to `main` |
| **Staging** | Pre-production, UAT, perf (scaled), DAST | `staging` account: same Terraform as prod, smaller sizes | Synthetic + anonymized samples. **Never production data.** | Team SSO, pilot customers (UAT) | Release candidates (tag `vX.Y.Z-rc.N`) |
| **Production** | Customers | `prod` account(s), one per region cell | Customer | JIT access only (SEC-056) | Approved releases (tag `vX.Y.Z`) |
| **Perf** | Performance tests | Ephemeral, prod-like at 50% | Generated Year-1 volume | SRE | On demand |

Accounts are separated per environment (AWS Organizations) with SCP guardrails. Production has no direct human write access to data stores.

## 2. Infrastructure as Code

| Layer | Tool | Repo path |
|---|---|---|
| Cloud resources (VPC, EKS, RDS, ElastiCache, S3, CloudFront, KMS, IAM, WAF, Route 53) | Terraform (≥ 1.8) with remote state in S3 + DynamoDB lock | `infra/terraform/{modules,envs/{dev,staging,prod-eu,prod-me,prod-us}}` |
| Kubernetes add-ons (ingress, cert-manager, external-secrets, KEDA, Karpenter, OTel collector, Argo CD) | Helm via Argo CD app-of-apps | `infra/helm/platform` |
| Application workloads | Helm charts per app, values per env | `infra/helm/apps/*` |
| Policies | OPA Gatekeeper / Kyverno | `infra/policies` |

All changes go through a PR with `terraform plan` output posted. `apply` runs only from CI with an approval for staging/prod.

## 3. Containers (Docker)

| Image | Base | Notes |
|---|---|---|
| `web`, `admin` | `node:22-alpine` build → `gcr.io/distroless/nodejs22` runtime (or static export to CDN where possible) | Next.js standalone output |
| `api`, `realtime`, `drone-integration` | distroless nodejs22 | Non-root UID 10001, read-only FS |
| `workers` | Debian slim + FFmpeg, libvips, exiftool, GDAL/PDAL (pinned), Chromium (Playwright) for the report variant | Separate images per heavy toolchain: `workers-media`, `workers-geo`, `workers-report` |
| `ai` | `python:3.12-slim` (+ CUDA runtime variant for GPU) | uv-locked deps |
| `tiles` | TiTiler official image pinned | |
| `streaming` | MediaMTX pinned | UDP ports for WebRTC |
| `migrator` | api image with the migration entrypoint | Runs as a K8s Job pre-deploy |

Images are built once per commit, tagged with the git SHA, scanned (Trivy), signed (cosign), get an SBOM attached, and are promoted (not rebuilt) between environments.

## 4. Kubernetes Workloads

| Workload | Kind | Replicas (prod min/max) | Scaling signal | Resources (req) |
|---|---|---|---|---|
| api | Deployment | 3 / 30 | CPU 60%, RPS | 500m / 1 Gi |
| realtime | Deployment | 3 / 20 | WS connections (custom metric) | 500m / 1 Gi |
| drone-integration | StatefulSet-like Deployment with sharding | 2 / 10 | stream lag, connections | 500m / 1 Gi |
| workers-media | Deployment | 2 / 50 | KEDA: queue depth `media.*` | 1 / 2 Gi |
| workers-video | Deployment (spot) | 0 / 40 | KEDA: `video.transcode` | 4 / 8 Gi |
| workers-geo | Deployment (spot) | 0 / 20 | KEDA: `geo.*` | 4 / 16 Gi |
| workers-report | Deployment | 1 / 20 | KEDA: `report.generate` | 1 / 3 Gi |
| workers-notify | Deployment | 2 / 10 | KEDA | 250m / 512 Mi |
| ai | Deployment (GPU pool for vision; CPU for LLM orchestration) | 1 / 10 (GPU 0 / 8) | KEDA: `ai.dispatch` | per variant |
| tiles | Deployment | 2 / 20 | CPU | 1 / 2 Gi |
| scheduler (cron) | CronJobs | — | — | small |

PodDisruptionBudgets on all stateless services (minAvailable 2). Topology spread across 3 AZs. Liveness/readiness/startup probes. Graceful shutdown (SIGTERM → stop accepting, drain 30 s; realtime sends a `reconnect` hint to clients).

## 5. Database Migrations

- Tool: SQL migrations (`db/migrations`) run by the `migrator` Job **before** the app rollout (Argo CD PreSync hook).
- **Expand → migrate → contract** pattern:
  1. *Expand:* add nullable columns/tables/indexes (`CREATE INDEX CONCURRENTLY`). Old code still works.
  2. Deploy code that writes both and reads new (feature-flagged if needed).
  3. *Backfill* via batched background job (≤ 5,000 rows per batch, throttled).
  4. *Contract:* drop old columns in a later release (≥ 1 release later).
- Lint: `squawk` checks for locking-dangerous operations (e.g. `ALTER TABLE … ADD COLUMN … DEFAULT` volatile, non-concurrent index).
- Every migration includes RLS policies for new tenant tables (schema linter TC-TENANT-012).
- Rollback: forward-fix preferred. Down migrations exist for expand steps. Contract steps are irreversible and run only after the verification period.

## 6. Deployment Strategy

| Component | Strategy |
|---|---|
| api, realtime, workers | Rolling update (maxUnavailable 0, maxSurge 25%) with automated **canary analysis** in prod (Argo Rollouts: 10% → 50% → 100% over 30 min, gates on error rate and p95 vs. baseline) |
| web/admin | Immutable static assets to S3/CloudFront (hashed filenames). The HTML entry is switched atomically. Old assets are kept 7 days. |
| ai | Blue/green per model version. Shadow mode for new models (run both, compare, serve old). |
| streaming gateway | Drain-aware rolling update outside active streams (wait for sessions to end, max 2 h) |
| DB | Migrations as above. Major-version upgrades by blue/green (RDS Blue/Green Deployments). |

Feature flags decouple deploy from release (gradual exposure per org).

## 7. Rollback

| Situation | Action | Target time |
|---|---|---|
| Canary analysis fails | Automatic abort → previous ReplicaSet | < 5 min |
| Post-release incident (app) | `argo rollouts undo` or redeploy previous tag | < 10 min |
| Bad feature | Disable the feature flag | < 1 min |
| Bad migration (expand) | Run the down migration or forward-fix | < 30 min |
| Data corruption | Point-in-time restore to a new instance + targeted repair ([DR Plan](Disaster-Recovery.md)) | per RTO |

## 8. Secrets & Configuration

- Secrets in AWS Secrets Manager, synced to K8s via External Secrets Operator (never committed). Rotated per SEC-042.
- Non-secret config in Helm values per environment. All env vars are documented in [Environment Configuration](Environment-Configuration.md) and validated at boot.
- Workload identity via IRSA (no static AWS keys).

## 9. Monitoring, Logs, Alerts

See [Monitoring & Observability Plan](Monitoring.md). Deploy markers are annotated on dashboards automatically.

## 10. CI/CD

See [CI-CD.md](CI-CD.md).

## 11. Cost Management

Tags on all resources (`env`, `service`, `cell`). Spot for workers. Karpenter consolidation. S3 lifecycle tiers. CloudFront caching. Monthly FinOps review with the unit-economics KPI (cost per active org).
