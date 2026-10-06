# Security Requirements

| | |
|---|---|
| **Document** | Security Requirements |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-25 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Security |
| **Reviewer** | _Pending — Security Engineer, CTO_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Security | Initial draft (SEC-001 – SEC-070) |

---

## 1. Security Objectives

1. **Confidentiality:** tenant data is accessible only to authorized users of that tenant.
2. **Integrity:** records, evidence and audit logs cannot be altered undetected.
3. **Availability:** meet the SLOs in the [NFR](../03-SRS/Non-Functional-Requirements.md#4-availability--reliability-nfr-avail).
4. **Accountability:** every significant action is attributable.
5. **Safety:** the platform never causes unsafe drone behavior.

Baselines: OWASP ASVS 4.0 L2 (L3 for auth/tenancy), OWASP API Security Top 10 (2023), CIS Kubernetes/AWS benchmarks, SOC 2 trust criteria.

## 2. Threat Model Summary (STRIDE, top items)

| # | Threat | Asset | STRIDE | Mitigations (SEC IDs) |
|---|---|---|---|---|
| T1 | Cross-tenant data access via IDOR | All tenant data | I | SEC-016–022 |
| T2 | Account takeover | User accounts | S | SEC-001–015 |
| T3 | Malicious file upload (malware, polyglot, zip bomb, SVG XSS) | Users, workers | T, E | SEC-040–048 |
| T4 | Leaked signed URLs | Media | I | SEC-049–052 |
| T5 | SSRF via webhooks/integrations/tile URLs | Internal network, cloud metadata | E | SEC-033–035 |
| T6 | Prompt injection via tenant content into AI | AI, tenant data | I, T | SEC-060–064 |
| T7 | Spoofed telemetry / commands | Live ops, safety | S, T | SEC-036–039 |
| T8 | Insider access by staff | Tenant data | I | SEC-055–057 |
| T9 | Supply-chain compromise | Codebase | T | SEC-065–068 |
| T10 | Audit tampering | Audit logs | R | [Audit-Logging](Audit-Logging.md) |
| T11 | DoS / resource exhaustion (huge uploads, expensive queries, AI cost) | Availability, cost | D | SEC-030–032 |

The threat model is reviewed every phase and for every new external integration.

## 3. Requirements

### 3.1 Authentication (detail in [AuthN/Z](Authentication-Authorization.md))

| ID | Requirement |
|---|---|
| SEC-001 | Passwords hashed with argon2id (AUTH-003). Never logged or emailed. |
| SEC-002 | NIST 800-63B password policy with breached-password check (AUTH-004). |
| SEC-003 | TOTP 2FA available to all. Org-enforceable. WebAuthn in Phase 2. Platform staff require WebAuthn. |
| SEC-004 | Brute-force protection per account and per IP (AUTH-007). WAF bot control on auth endpoints. |
| SEC-005 | Short-lived access tokens (15 min, ES256). Rotating refresh tokens with reuse detection. |
| SEC-006 | Refresh token only in an httpOnly, Secure, SameSite=Strict cookie. Access token in memory. |
| SEC-007 | Session listing and revocation by the user. Admin revocation for members. |
| SEC-008 | Re-authentication for sensitive operations (AUTH-020). |
| SEC-009 | No user enumeration in login, signup, reset or invite flows. |
| SEC-010 | Email change requires verification of the new address and notification to the old one. |
| SEC-011 | SSO (OIDC/SAML) validates signatures, audience, issuer, timestamps (≤ 5 min skew), and replay (assertion ID cache). |
| SEC-012 | JWT validation: algorithm allow-list (`ES256` only), `kid` lookup, `iss`/`aud`/`exp`/`nbf` checked. |
| SEC-013 | Signing keys stored in KMS/secrets manager and rotated every 90 days. |
| SEC-014 | New-device login notifications (AUTH-019). |
| SEC-015 | Idle and absolute session timeouts, configurable per org within secure bounds. |

### 3.2 Authorization & tenant isolation

| ID | Requirement |
|---|---|
| SEC-016 | Deny-by-default authorization. Every route declares its permission (CI lint). |
| SEC-017 | Object-level authorization on every resource access, including nested and bulk operations. |
| SEC-018 | Tenant context only from the verified token (TENANT-003). |
| SEC-019 | PostgreSQL RLS forced on all tenant tables. The runtime role lacks BYPASSRLS (TENANT-002). |
| SEC-020 | Cross-tenant access returns 404 (TENANT-004). |
| SEC-021 | Mass-assignment protection: DTOs allow-list writable fields. `organizationId`, `createdBy`, `status` (except via transitions) and similar are never client-writable. |
| SEC-022 | Automated cross-tenant test suite for every endpoint and channel (TC-TENANT-*). |

### 3.3 API security

| ID | Requirement |
|---|---|
| SEC-023 | TLS 1.2+ only (TLS 1.3 preferred). HSTS `max-age=63072000; includeSubDomains; preload`. |
| SEC-024 | Strict CORS allow-list (app origins only). Credentials only for the auth path. |
| SEC-025 | Input validation with zod schemas at every boundary. Reject unknown fields (`strict()`). |
| SEC-026 | Output encoding. JSON only. No reflection of input in error messages beyond field paths. |
| SEC-027 | Parameterized queries only (Kysely/Drizzle). Raw SQL requires review and `sql` tagged templates. |
| SEC-028 | Security headers on web responses: CSP (nonce-based, `default-src 'self'`, explicit tile/CDN hosts, `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation only where needed). |
| SEC-029 | Error responses never include stack traces, SQL, or internal hostnames. |
| SEC-030 | Rate limiting per tier ([API §3.8](../06-API/API-Specification.md#38-rate-limit-tiers)) and per-org caps. |
| SEC-031 | Resource limits: request body ≤ 1 MB (JSON), pagination max 100/500, query timeouts (statement_timeout 5 s for API, 60 s for reports), GraphQL not used. |
| SEC-032 | Cost controls: per-org concurrency caps on AI, transcoding and exports. Usage anomaly alerts. |
| SEC-033 | SSRF protection for every outbound request built from user input (webhooks, integration URLs, WMS layers): HTTPS only, DNS resolution checked against private, loopback, link-local and cloud-metadata ranges (including IPv6 and redirects), egress via a dedicated proxy. |
| SEC-034 | The OAuth flows for integrations use PKCE + state + exact redirect URI matching. |
| SEC-035 | Outbound webhooks are signed (HMAC-SHA256) with timestamps. Secrets are rotatable. |

### 3.4 Drone & telemetry security

| ID | Requirement |
|---|---|
| SEC-036 | Provider ingest endpoints authenticate with per-connection HMAC or mTLS. Unauthenticated telemetry is dropped. |
| SEC-037 | Telemetry drone ↔ org binding is validated server-side (TELEM-002). Mismatches raise security alerts. |
| SEC-038 | Outbound drone commands require the `missionControl` capability, a feature flag, an authorized assigned pilot, an idempotency key, and are audited. A global kill switch is available ([Drone Architecture §6](../04-Architecture/Drone-Architecture.md#6-safety-model)). |
| SEC-039 | Edge bridges use per-device certificates (revocable) and outbound-only connections. |

### 3.5 Encryption & key management

| ID | Requirement |
|---|---|
| SEC-040 | Data at rest encrypted: RDS (KMS), ElastiCache (at-rest + in-transit TLS), S3 (SSE-KMS with per-org encryption context), EBS volumes, backups. |
| SEC-041 | Application-level encryption (AES-256-GCM, KMS data keys) for secrets in the DB: TOTP secrets, integration tokens (if not in the secrets manager), webhook secrets. |
| SEC-042 | Secrets managed in AWS Secrets Manager (or Vault). Never in code, images, env files in Git, or logs. Rotation: DB credentials 30 days (automated), third-party keys per provider policy. |
| SEC-043 | Per-org KMS context. Org deletion schedules data-key deletion (crypto-shredding of backups). |

### 3.6 File upload security

| ID | Requirement |
|---|---|
| SEC-044 | Uploads land in a **quarantine bucket** with no public or app read access until scanned (MEDIA-003). |
| SEC-045 | Malware scanning with ClamAV (signatures updated hourly). Optional commercial engine for Enterprise. Files that fail scanning are quarantined, never served, and the event is audited and notified. |
| SEC-046 | Type validation by magic bytes + allow-list. The extension must match the detected type. Polyglot detection for images (re-encode previews). |
| SEC-047 | Archive safety (zip for Shapefile/3D Tiles/OBJ): max entries 50,000, max uncompressed 50 GB, ratio ≤ 100:1, no absolute paths or `..` traversal, no symlinks. |
| SEC-048 | Processing in sandboxed workers: non-root, read-only root FS, no network except S3/queue endpoints, seccomp, CPU/memory/time limits. Image libraries patched (libvips, ImageMagick not used). SVG logos sanitized (DOMPurify server-side) or rasterized. |

### 3.7 Signed URLs & content delivery

| ID | Requirement |
|---|---|
| SEC-049 | All media access uses short-lived signed URLs/cookies issued after authorization ([Video §4](../04-Architecture/Video-Architecture.md#4-signed-url-policy-all-media)). |
| SEC-050 | Signed URLs are never logged, never cached server-side, never placed in emails (emails link to the app). |
| SEC-051 | `Content-Disposition: attachment` for downloads. User-uploaded content is served from a separate cookieless domain (`media.aerosight-cdn.com`) to isolate it from the app origin. |
| SEC-052 | External report share links: 256-bit tokens, hashed at rest, expiry ≤ 30 days, optional passcode, revocable, access-logged, rate-limited. |

### 3.8 Audit, monitoring & response

| ID | Requirement |
|---|---|
| SEC-053 | Audit logging per [Audit-Logging](Audit-Logging.md) (append-only, hash-chained). |
| SEC-054 | Security event monitoring: alerts on refresh reuse, lockout spikes, cross-tenant denials (404 bursts on valid IDs of other orgs), privilege changes, break-glass, quarantine events, WAF blocks. |
| SEC-055 | Staff access only via break-glass (ADMIN-009) with ticket, justification, approval, a time limit and Owner notification. |
| SEC-056 | Production access for engineers uses SSO + MFA. Just-in-time and time-bound (≤ 8 h). Session recording for shell access (SSM). No shared accounts. |
| SEC-057 | Quarterly access reviews for production and admin roles. |
| SEC-058 | Incident response plan with severity levels, a 24/7 on-call rotation, and customer notification of personal-data breaches within contractual/legal timelines (GDPR: authority within 72 h). |
| SEC-059 | Backups encrypted, immutable (Object Lock for the backup vault), and restore-tested quarterly ([DR Plan](../12-DevOps/Disaster-Recovery.md)). |

### 3.9 AI security

| ID | Requirement |
|---|---|
| SEC-060 | AI tools execute with the requesting user's `AuthContext` (AI-010). There is no service-level data access path for the assistant. |
| SEC-061 | Prompt-injection defenses: tenant content in prompts is wrapped as data with clear delimiters, a system prompt with tool-use policy, a tool allow-list, no tool that can send data externally, and outputs validated against JSON schemas. |
| SEC-062 | LLM providers are configured for zero data retention / no training on customer data where available. The provider and region are disclosed in the sub-processor list. |
| SEC-063 | PII minimization in prompts (names → role labels where not needed). No credentials or signed URLs in prompts. |
| SEC-064 | AI cost and abuse controls (per-user/org rate limits, credit caps, max context size). |

### 3.10 Secure SDLC & supply chain

| ID | Requirement |
|---|---|
| SEC-065 | SAST (Semgrep + CodeQL) and secret scanning (gitleaks) on every PR. Blocking on high severity. |
| SEC-066 | SCA (Dependabot/Renovate + OSV scanning). Lockfiles committed. Critical vulns patched ≤ 7 days, high ≤ 30 days. |
| SEC-067 | Container images: minimal/distroless bases, Trivy scan in CI, signed with cosign, SBOM (CycloneDX) per release, admission policy that only allows signed images. |
| SEC-068 | Protected main branch. ≥ 1 review (2 for auth/tenancy/RBAC code via CODEOWNERS). Signed commits for release tags. |
| SEC-069 | DAST (OWASP ZAP baseline) against staging on every release. Annual third-party pentest plus before GA. |
| SEC-070 | Security training for engineers yearly. Secure-coding checklist in the PR template. |

## 4. Kubernetes & Cloud Hardening

- Private EKS API endpoint. Nodes in private subnets. IMDSv2 required (hop limit 1).
- Pod Security Standards: `restricted`. NetworkPolicies default-deny with explicit allows.
- IRSA per workload with least-privilege IAM policies (S3 prefix-level where possible).
- WAF managed rule groups (core, known bad inputs, SQLi, bot control) + custom rate rules.
- GuardDuty, Security Hub, CloudTrail (org trail, immutable), VPC Flow Logs.
- Database not publicly accessible. Security groups restrict to app subnets.

## 5. Security Acceptance (release gate)

A release cannot go to production unless:
- No open critical/high findings from SAST/SCA/container scans without an approved exception.
- The tenant-isolation suite passes 100%.
- The RBAC matrix suite passes 100%.
- DAST baseline shows no high alerts.
- Security-impacting changes have been reviewed by the Security Engineer.
