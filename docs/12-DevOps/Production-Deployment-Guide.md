# Production Deployment Guide

| | |
|---|---|
| **Document** | Production Deployment Guide |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-44 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI DevOps / SRE |
| **Reviewer** | _Pending — SRE Lead, Release Manager_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | DevOps | Initial runbook (procedures valid once infra and pipelines exist) |

---

> **Applicability:** This guide describes the target procedure. Commands reference tooling and repo paths defined in [Technical Design §3](../04-Architecture/Technical-Design.md#3-repository-layout-monorepo) and [Deployment](Deployment.md). They become executable once those are implemented.

## Part A — First-Time Provisioning of a Production Cell

### A.1 Prerequisites
- AWS Organization with `prod-<cell>` account, SCPs applied, CloudTrail org trail, GuardDuty and Security Hub enabled.
- Domain(s) in Route 53. ACM certificates for `app.`, `api.`, `rt.`, `admin.`, `live.`, `ingest.` and the media CDN domain.
- GitHub OIDC trust to the deploy role in the account.
- Access to the Terraform state bucket and lock table.
- Approved change request.

### A.2 Infrastructure
1. Create the env folder from the template: `infra/terraform/envs/prod-<cell>/` (region, CIDRs, sizes, retention).
2. Open a PR. CI posts the `terraform plan`. Get reviews (SRE + Security).
3. Merge → CI runs `terraform apply` with environment approval. This creates the VPC (3 AZ), EKS (private endpoint), RDS PostgreSQL 16 Multi-AZ (+ parameter group with `shared_preload_libraries=timescaledb,pg_stat_statements` where supported, or the Timescale-compatible alternative per ADR-003), ElastiCache Redis (Multi-AZ, TLS, AUTH), S3 buckets (Block Public Access, versioning, SSE-KMS, CRR to the DR region, lifecycle), CloudFront distributions (app, media with key groups), WAF, KMS keys (multi-region), Secrets Manager entries (empty placeholders), the AWS Backup plan + vault lock, and DR pilot-light resources.
4. Bootstrap the cluster platform via Argo CD app-of-apps: ingress controller, cert-manager, external-secrets, KEDA, Karpenter, OTel collector, Kyverno policies, metrics stack agents.

### A.3 Secrets
Populate Secrets Manager (via the security-approved procedure; never via chat or tickets): DB passwords (`app_user`, `app_migrator`, `app_readonly`), Redis AUTH, CDN signing key, Stripe live keys, email provider token, Sentry DSN, AI keys (Phase 2). The JWT signing key is created in KMS (asymmetric ECC_NIST_P256).

### A.4 Database bootstrap
1. Run the `db-bootstrap` Job (as master user, once): create the roles `app_migrator`, `app_user` (NOBYPASSRLS), `app_readonly`, `app_platform`, extensions, schemas, and grants.
2. Rotate the master password into Secrets Manager. Master is not used afterwards.
3. Run migrations (`migrator` Job) and seeds: permissions, system roles, plans, system report templates.
4. Verify: schema linter passes. `SELECT` with no tenant context returns 0 rows from tenant tables.

### A.5 First deploy
Follow Part B with the initial release tag. Then:
- Create the `__synthetic` org and synthetic checks.
- Register the cell in the global directory service.
- Configure the status page components.
- Run the smoke and tenant isolation subset against production (synthetic orgs only).

## Part B — Standard Release Procedure

### B.1 Pre-deployment (T−1 day)
- [ ] Release candidate `vX.Y.Z-rc.N` passed staging: full E2E, DAST, perf subset, AI evals (if applicable), UAT sign-off.
- [ ] [Release Checklist](Release-Checklist.md) items complete. Go/no-go approved.
- [ ] Migration plan reviewed (expand-only or contract with completed backfill). Estimated lock impact = none.
- [ ] Customer-facing notes prepared. Maintenance notice sent if any user-visible downtime (target: none).
- [ ] On-call informed. No conflicting change freezes.

### B.2 Deployment (T)
1. Create the signed tag `vX.Y.Z` on the approved RC commit. CI promotes the RC images (same digests).
2. CI updates `infra/helm/apps/*/values-prod-<cell>.yaml` with image digests (GitOps PR auto-merged after approval in the GitHub Environment `production`).
3. Argo CD sync per cell, in order: **smallest cell first**, then the others with 30 min spacing.
   - PreSync: `migrator` Job (expand migrations). Failure stops the sync.
   - Rollout: canary 10% (10 min) → 50% (10 min) → 100% with automated analysis (5xx rate, p95 latency, WS errors vs. the stable baseline).
   - Web assets: uploaded to S3 before the API rollout (backward compatible). The HTML entry is switched after the API reaches 100%.
4. Post-sync hooks: smoke tests (login, dashboard, create/delete synthetic project, upload small image, telemetry simulator check, report generation).

### B.3 Verification (T + 30 min)
- [ ] SLO dashboards nominal (error rate, p95, queue ages, WS connections recovered).
- [ ] No new Sentry error classes above baseline.
- [ ] Synthetic checks green in all regions.
- [ ] Feature flags for new features set per the rollout plan (start with internal/pilot orgs).
- [ ] Release annotated on dashboards. Release notes published. Status page updated if relevant.

### B.4 Rollback
| Trigger | Procedure |
|---|---|
| Canary analysis fails | Automatic abort. Investigate. Release blocked. |
| Issue found after 100% | `kubectl argo rollouts undo <app> -n <ns>` (or revert the GitOps values commit). Web: re-point the HTML entry to the previous build. Migrations are expand-only, so no DB rollback is needed. |
| Feature-specific issue | Disable the feature flag |
| Data issue | Follow [DR Plan §3.2](Disaster-Recovery.md#32-data-corruption--accidental-deletion-logical) |

Decision time budget: if not healthy within 15 min of detection → roll back first, investigate second.

## Part C — Special Procedures

### C.1 Contract migrations
Scheduled ≥ 1 release after expand. Confirm via metrics or logs that no code reads the old columns, then run them in a low-traffic window, with `lock_timeout=5s` and retries.

### C.2 PostgreSQL major upgrade
RDS Blue/Green Deployment: create green → replicate → test with read-only smoke → switchover (≈ 1 min write pause) during a maintenance window → keep blue for 24 h.

### C.3 Secret rotation
Automated for DB credentials (dual-user rotation). For JWT signing keys: add the new key to JWKS → switch signing after 24 h → remove the old key after access-token TTL + 24 h.

### C.4 Emergency hotfix
Branch from the release tag → PR with an expedited review (2 approvers including on-call) → full CI (no skipping security/tenant suites) → staging smoke → production with canary (shortened to 5 min steps) → back-merge to main.

### C.5 Enabling a new region / dedicated cell
Part A with the region parameters. Update the directory service, DPA sub-processor/region list and status page. Run full DR drill before onboarding customers.
