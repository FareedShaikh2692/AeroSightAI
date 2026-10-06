# CI/CD Pipeline

| | |
|---|---|
| **Document** | CI/CD Pipeline |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-27a |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI DevOps |
| **Reviewer** | _Pending — SRE Lead, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | DevOps | Initial pipeline design |

---

## 1. Flow

```text
Git (feature branch, Conventional Commits)
   ↓
Pull Request  ──► CI: lint · typecheck · unit · integration · tenant & RBAC suites · build
   ↓               ──► Security scan: SAST · secrets · SCA · container scan · IaC scan
Automated Tests     ──► Preview environment + E2E smoke + Lighthouse
   ↓
Security Scan  (blocking on high/critical)
   ↓
Build (images signed + SBOM)  ── merge to main ──► Development (auto)
   ↓
Staging  (release candidate tag vX.Y.Z-rc.N: full E2E, DAST, perf subset, UAT)
   ↓
Approval  (Release Manager + QA Lead + Security for flagged changes; GitHub Environment protection)
   ↓
Production  (Argo CD sync → canary 10% → 50% → 100% with automated analysis)
```

Platform: GitHub Actions (CI) + Argo CD (CD, GitOps) + Argo Rollouts (progressive delivery).

## 2. PR Pipeline (required checks)

| Stage | Job | Tooling | Blocking |
|---|---|---|---|
| Setup | Install with cache, Turborepo affected graph | pnpm, turbo, uv | — |
| Quality | Lint, format, typecheck, module boundaries, unguarded-route lint, schema linter | ESLint, Prettier, tsc, dependency-cruiser, custom | ✓ |
| Unit | TS + Python unit tests with coverage | Vitest, pytest | ✓ (coverage thresholds) |
| Integration | Testcontainers (PostGIS/Timescale, Redis, MinIO, ClamAV) | Vitest | ✓ |
| Security suites | Tenant isolation (affected modules), RBAC matrix | custom | ✓ |
| Contract | OpenAPI generation + breaking-change diff vs. main (`oasdiff`) | oasdiff | ✓ (unless labelled `api-breaking` with approval) |
| Migrations | `squawk` lint. Apply up + down on an empty DB and on a seeded snapshot. | squawk | ✓ |
| SAST & secrets | Semgrep, CodeQL, gitleaks | | ✓ high/critical |
| SCA | OSV-Scanner / Dependabot alerts | | ✓ critical |
| IaC scan | tfsec/Checkov on `infra/` changes | | ✓ high |
| Build | Docker build (affected), Trivy scan, cosign sign, SBOM | | ✓ |
| Preview deploy | Helm install to `pr-<n>` namespace | Argo CD ApplicationSet | — |
| E2E smoke | Playwright critical journeys on preview | Playwright | ✓ |
| Frontend perf | Lighthouse CI, bundle-size budget | | ✓ (budget) |
| Accessibility | axe on Storybook + key pages | | ✓ serious/critical |
| Docs gate | See §5 | custom | ✓ |
| RTM | Generate traceability summary, comment on PR | `scripts/rtm` | info |

Branch protection: required checks, ≥ 1 approval (2 for CODEOWNERS paths: `apps/api/src/modules/{auth,iam}`, `db/migrations`, `packages/permissions`, `infra/`), linear history, signed tags for releases.

## 3. Main & Release Pipelines

| Trigger | Actions |
|---|---|
| Merge to `main` | Build/sign images for the SHA → update `envs/dev` values (GitOps commit) → Argo CD syncs dev → smoke tests |
| Tag `vX.Y.Z-rc.N` | Promote the same images to staging → migrations → full E2E (3 browsers), DAST (ZAP baseline + API scan), performance smoke, AI eval suite → release notes draft |
| Tag `vX.Y.Z` (after approval) | Promote to production cells sequentially (smallest cell first) with canary analysis. Post-deploy synthetic checks. Status page note for notable changes. |
| Nightly | Full tenant isolation suite, Schemathesis fuzzing, full E2E, AI evals, dependency audit |
| Weekly | Perf env PT-01/03/06 |

## 4. Versioning & Release Notes

SemVer for the platform release. Changesets for packages. Release notes are generated from Conventional Commits and curated by the PM (customer-facing changelog + internal notes, including capability-status changes such as "Live video: Integration Required → Implemented for DJI Cloud").

## 5. Documentation Gate

Enforces the [documentation synchronization rule](../README.md#7-documentation-synchronization-rule-mandatory):

| If the PR changes | Then the PR must also change | Override |
|---|---|---|
| `apps/api/src/**/*.controller.ts` or route decorators | `docs/06-API/API-Specification.md` | label `docs-not-needed` + reviewer approval |
| `db/migrations/**` | `docs/05-Database/Database-Design.md` (and ERD if relationships change) | same |
| `packages/permissions/**` | `docs/07-Security/RBAC.md` | none (always required) |
| `packages/config/env.ts` | `docs/12-DevOps/Environment-Configuration.md` | none |
| Feature flag lifecycle / capability status | `docs/13-Product/MVP.md` §4 | label |

Additionally: Markdown link check (`lychee`) and Mermaid render check on `docs/**`.

## 6. Secrets in CI

GitHub OIDC → AWS IAM roles (no long-lived cloud keys). Third-party tokens are stored in GitHub Environments with required reviewers for staging/prod. Forked PRs get no secrets (preview deploys only for internal branches).

## 7. Pipeline SLOs

PR pipeline p50 ≤ 12 min, p90 ≤ 20 min (via affected-only builds and caching). Flaky-test quarantine with auto-issue creation. Flake rate < 1%.
