# Disaster Recovery & Backup Plan

| | |
|---|---|
| **Document** | Disaster Recovery & Backup Plan |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-31 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI SRE |
| **Reviewer** | _Pending — SRE Lead, Security Engineer, CTO_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | SRE | Initial plan |

---

## 1. Objectives

| Data / service | RPO (max data loss) | RTO (max downtime) |
|---|---|---|
| PostgreSQL (system of record) | **15 min** (continuous WAL archiving; typically < 5 min) | **4 h** (region failure), **1 h** (instance/AZ failure: automatic Multi-AZ failover ≈ 1–2 min) |
| Object storage (media, reports, models) | **≤ 1 h** (cross-region replication; S3 RTC 15 min for Enterprise) | **8 h** (serving from the DR region) |
| Telemetry (live) | Live data in flight may be lost (≤ 60 s). Persisted telemetry follows the DB RPO. | Same as DB |
| Redis (cache, queues) | Queued jobs: ≤ 1 min (AOF everysec + replica). Cache: none required. | 30 min |
| Audit logs | 15 min (DB) + daily immutable exports | 4 h |
| Configuration / IaC | 0 (Git) | Rebuild ≤ 2 h |
| Secrets | 0 (Secrets Manager multi-region replication) | 30 min |

## 2. Backup Strategy

| Asset | Mechanism | Frequency | Retention | Location | Protection |
|---|---|---|---|---|---|
| PostgreSQL | Automated snapshots + PITR (WAL) | Snapshots daily; WAL continuous | 35 days PITR; monthly snapshots 12 months; yearly 7 years (Enterprise audit needs) | Primary region + copy to DR region (daily) | KMS-encrypted; AWS Backup vault with **Vault Lock** (immutable) |
| PostgreSQL logical | `pg_dump` per org on demand (export) + weekly full logical dump | Weekly | 8 weeks | Backup account (separate AWS account) | Encrypted, Object Lock |
| S3 media/report buckets | Versioning + Cross-Region Replication (CRR) | Continuous | Non-current versions 30 days. DR replica follows primary lifecycle. | DR region | SSE-KMS (multi-region keys), Object Lock on the backup bucket |
| Audit exports | Daily partition export | Daily | Per retention (1–7 y) | Backup account | Object Lock compliance mode |
| Redis | RDB snapshots | Every 6 h | 7 days | Primary region | Encrypted |
| Secrets | Secrets Manager replication | Continuous | Versions | DR region | KMS |
| IaC/Git | GitHub + nightly mirror | Nightly | 90 days | Backup account (CodeCommit/S3 mirror) | — |
| Container images | ECR replication | On push | 180 days | DR region | Signed |

Org deletion (ORG-011) relies on crypto-shredding: backups older than the purge remain encrypted under a deleted org data key and are unreadable. They expire naturally within 35 days (PITR) / per snapshot policy.

## 3. Disaster Scenarios & Procedures

### 3.1 Single instance / AZ failure (automatic)
- RDS Multi-AZ failover (60–120 s). The app retries with backoff and returns 503 + Retry-After meanwhile.
- ElastiCache auto-failover. Clients reconnect. BullMQ resumes.
- K8s reschedules pods across the remaining AZs (topology spread).
- **Action:** on-call verifies recovery and checks the queue backlog. No manual steps expected.

### 3.2 Data corruption / accidental deletion (logical)
1. Freeze writes for the affected scope if needed (feature flag / org read-only).
2. Identify the corruption time T from audit logs.
3. Restore PITR to a **new** instance at T − 1 min.
4. Extract affected rows (by org/entity) and repair the production DB via a reviewed script. Never swap whole databases for single-tenant issues.
5. For S3 objects: restore previous versions (versioning).
6. Write an audit entry `system.data_restored` in the affected org. Notify the customer if impact is confirmed.

### 3.3 Region outage (manual failover)
**Decision:** Incident commander + CTO declare DR when region recovery ETA > 2 h.
1. **Database:** promote the cross-region read replica (if running; Enterprise cells) or restore the latest cross-region snapshot + WAL (standard cells) in the DR region. Target 2 h.
2. **Infrastructure:** `terraform apply` of the DR environment (pre-provisioned "pilot light": VPC, EKS control plane, minimal node groups always on). Scale up node groups. Target 1 h, in parallel with step 1.
3. **Apps:** Argo CD syncs the DR cluster with the current release tag. Secrets come from replicated Secrets Manager.
4. **Storage:** switch bucket config to the DR replicas (env var `S3_REGION_OVERRIDE`). CloudFront origin failover groups switch automatically.
5. **DNS:** Route 53 failover records to the DR ingress (TTL 60 s).
6. **Validation:** synthetic checks, tenant isolation smoke, data spot-checks.
7. **Communicate:** status page. Customers informed of the RPO window (data written after the last replicated WAL may be missing).
8. **Failback:** after recovery, reverse replication, schedule a maintenance window, switch back.

Data residency: DR regions are within the same legal jurisdiction as the primary (e.g. eu-central-1 → eu-west-1; me-central-1 → me-south-1 subject to service availability). This is stated in the DPA.

### 3.4 Security incident requiring rebuild (e.g. compromised cluster)
Isolate (network policies, revoke credentials) → preserve evidence (snapshots, logs) → rebuild from IaC with rotated secrets and verified signed images → restore data from a known-good backup if integrity is in doubt → postmortem.

### 3.5 Third-party outage (drone provider, AI, email, payment)
Not a DR event. Handled by graceful degradation ([System Architecture §9](../04-Architecture/System-Architecture.md#9-failure-modes--degradation)).

## 4. Testing

| Test | Frequency | Success criteria |
|---|---|---|
| Backup restore test (random snapshot → new instance, integrity checks, row counts, RLS policies present) | Monthly (automated) | Restore < 1 h; checks pass |
| PITR drill to an arbitrary timestamp | Quarterly | Data at T verified |
| S3 version restore drill | Quarterly | Objects restored |
| Full region failover game day (staging) | Twice a year | RTO ≤ 4 h, RPO ≤ 15 min achieved |
| Tabletop exercise (security + DR) | Yearly | Action items closed |

Results are recorded in `docs/12-DevOps/dr-tests/`.

## 5. Roles

| Role | Responsibility |
|---|---|
| Incident Commander (on-call SRE lead) | Declares, coordinates, decides failover with the CTO |
| DB Owner | Restore/promote, integrity validation |
| Platform Engineer | Infrastructure, DNS, cluster |
| Communications | Status page, customer emails |
| Security | Involved for any suspected malicious cause |
