# Release Checklist

| | |
|---|---|
| **Document** | Release Checklist |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-41 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Release Management |
| **Reviewer** | _Pending — Release Manager, QA Lead, Security Engineer_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Release Mgmt | Initial checklist |

---

Copy this checklist into the release issue for every `vX.Y.Z`. Each item needs an owner and evidence (link). Items marked **[Gate]** block the release.

## 1. Scope & Product

- [ ] Release scope (stories, requirements) frozen and listed — *Product Owner*
- [ ] **[Gate]** Every Must requirement in scope has ≥ 1 linked, passing test (RTM report attached) — *QA Lead*
- [ ] Capability status labels reviewed: features are labelled Implemented / Prototype (Beta) / Simulated / Integration Required correctly in UI and release notes — *Product Owner*
- [ ] [MVP status register](../13-Product/MVP.md#4-implementation-status-register) updated — *Product Owner*
- [ ] Feature-flag rollout plan defined (internal → pilot orgs → all) — *PM*
- [ ] Customer-facing release notes and internal notes drafted — *PM*

## 2. Quality

- [ ] **[Gate]** CI green on the RC commit (all required checks) — *Tech Lead*
- [ ] **[Gate]** Full E2E (Chromium, Firefox, WebKit) pass on staging — *QA*
- [ ] **[Gate]** 0 open S1/S2 defects. S3 defects accepted by the PO — *QA Lead*
- [ ] Exploratory testing sessions completed for changed areas (maps, uploads, live ops, tablets) — *QA*
- [ ] UAT sign-off (phase releases) — *Product Owner / pilot customers*
- [ ] Accessibility: axe no serious/critical issues. Manual screen-reader check for new screens — *Frontend*

## 3. Security & Privacy

- [ ] **[Gate]** Tenant isolation suite 100% pass (full, nightly on the RC) — *Security*
- [ ] **[Gate]** RBAC matrix suite 100% pass — *Security*
- [ ] **[Gate]** No unresolved critical/high SAST, SCA, container or IaC findings (or approved exceptions with expiry) — *Security*
- [ ] **[Gate]** DAST baseline on staging: no high alerts — *Security*
- [ ] Security review completed for changes to auth, RBAC, tenancy, uploads, integrations, AI tools — *Security*
- [ ] Privacy review / DPIA for new personal-data, location or AI processing — *DPO*
- [ ] Sub-processor list updated if new vendors were introduced — *Legal*

## 4. Performance & Reliability

- [ ] Performance tests for the phase executed. Results within targets or ADR deviations approved — *SRE*
- [ ] Lighthouse/bundle budgets met — *Frontend*
- [ ] New alerts and dashboards for new components exist, with runbooks — *SRE*
- [ ] Backup and restore verified in the last 30 days — *SRE*
- [ ] Capacity check: autoscaling limits, DB headroom (CPU < 60% at peak, storage > 30% free) — *SRE*

## 5. Data & Migrations

- [ ] **[Gate]** Migrations reviewed: expand-only or approved contract. `squawk` clean. Tested on a staging snapshot with production-like volume — *DBA*
- [ ] New tenant tables have `organization_id` + RLS (schema linter pass) — *DBA*
- [ ] Backfill jobs planned with throttling and monitoring — *Backend*
- [ ] Retention/purge jobs affected? Dry-run reviewed — *Backend*

## 6. Documentation

- [ ] **[Gate]** Docs gate passed (API, DB, RBAC, env, MVP status updated) — *Tech Lead*
- [ ] Admin Guide / User Guide updated for user-visible changes — *PM / Tech Writer*
- [ ] Environment variables documented and secrets created in all environments — *DevOps*
- [ ] API changelog published. Deprecations announced with Sunset dates — *Backend*

## 7. Operations

- [ ] Go/no-go meeting held. Decision recorded — *Release Manager*
- [ ] On-call aware. Rollback owner named — *SRE*
- [ ] Deployment window outside customer peak hours for the affected regions — *Release Manager*
- [ ] Status page / customer comms prepared (if user-visible impact) — *Support*
- [ ] Support team briefed (new features, known issues, FAQ) — *PM*

## 8. Post-Release (within 24 h)

- [ ] Verification checklist ([Production Deployment Guide §B.3](Production-Deployment-Guide.md#b3-verification-t--30-min)) done — *SRE*
- [ ] Error budget impact reviewed — *SRE*
- [ ] Feature flags progressed per plan — *PM*
- [ ] Release retrospective items captured — *Release Manager*

## Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Product Owner | | Go / No-go | |
| QA Lead | | | |
| Security Engineer | | | |
| SRE Lead | | | |
| Release Manager | | | |
