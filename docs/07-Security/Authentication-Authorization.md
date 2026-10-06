# Authentication & Authorization Specification

| | |
|---|---|
| **Document** | Authentication & Authorization Specification |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-10 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Security |
| **Reviewer** | _Pending — Security Engineer, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Security | Initial draft |

---

## 1. Scope

Covers identity, credentials, sessions, tokens, multi-factor authentication, SSO, service authentication, and the authorization decision flow. Requirements: AUTH-001 – AUTH-020, RBAC-001 – RBAC-012, TENANT-003, SEC-001 – SEC-015.

## 2. Identity Model

| Concept | Description |
|---|---|
| User | Global identity (email unique). Can be a member of many orgs. |
| Membership | `organization_members` row. Status `active` is required to access the org. |
| Session | A refresh-token family created at login on one device. |
| Active organization | Org bound into the access token (`org` claim). Switched explicitly. |
| Actor types | `user`, `api_key`, `system` (jobs), `platform_staff` (break-glass), `share_link` (public report) |

## 3. Credentials

| Item | Specification |
|---|---|
| Password hashing | argon2id, m=65536 KiB, t=3, p=1, 16-byte salt, 32-byte hash. Parameters stored in the PHC string to allow upgrades. Rehash on login if parameters change. |
| Password policy | ≥ 12 chars, ≤ 128. zxcvbn ≥ 3. Breached-password check (HIBP k-anonymity, 5-char SHA-1 prefix). Not containing the email local-part. No composition rules (NIST SP 800-63B). |
| Password change | Requires the current password. Revokes all other sessions. |
| Reset | Single-use token (32 bytes, SHA-256 stored), 30-min TTL, revokes all sessions, notification email. |
| Email verification | 6-digit code (5 attempts max) or link token, 24 h TTL. |
| TOTP | RFC 6238, SHA-1, 6 digits, 30 s, ±1 window. Replay prevention (last used step stored). Secret encrypted with AES-256-GCM (KMS data key). |
| Recovery codes | 10 codes × 10 chars (base32), argon2id-hashed, single use, regenerate on demand. |
| WebAuthn (Phase 2) | Passkeys as 2nd factor. Passwordless in Phase 3. Platform staff: **mandatory** hardware-bound WebAuthn. |

## 4. Tokens & Sessions

### 4.1 Access token
- JWT signed with **ES256**. Keys in KMS (asymmetric signing) or the secrets manager. `kid` header. JWKS at `/.well-known/jwks.json`.
- TTL 15 min. Claims in [API §2](../06-API/API-Specification.md#2-authentication).
- Rotation: new signing key every 90 days. The old key remains in JWKS for 24 h.
- Stored **in memory only** in the SPA (never localStorage).

### 4.2 Refresh token
- Opaque 256-bit random value. SHA-256 hash stored. Delivered as cookie `asai_rt` with `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`.
- **Rotation on every refresh.** The old token is marked `rotated_at`. A 10 s grace window handles concurrent tab refreshes (returns the same new token).
- **Reuse detection:** presenting a rotated token (outside the grace window) revokes the entire family, emails the user, and writes audit `auth.refresh_reuse_detected`.
- Lifetimes: idle 12 h (configurable), absolute 30 days (org policy can reduce to 1 day).

### 4.3 CSRF
API calls use `Authorization: Bearer` (not cookie-authenticated), so they are CSRF-immune. The refresh endpoint is cookie-authenticated and is protected by `SameSite=Strict`, an `Origin` header check against the allow-list, and a custom header `X-Requested-With: aerosight`.

### 4.4 Revocation
| Trigger | Effect | Latency |
|---|---|---|
| Logout | Revoke the refresh family | Immediate |
| Password change/reset | Revoke all families | Immediate. Access tokens expire ≤ 15 min, plus a deny-list (`denylist:user:{id}:before={ts}`) checked at the gateway → immediate |
| Deactivation / removal from org | Deny-list + revoke families + WS kick (`session.revoked`) | ≤ 60 s (AUTH-014) |
| Role/permission change | Increment `ver` in Redis. Gateway rejects tokens with lower `ver` → client silently refreshes and gets new claims. | ≤ 5 s |
| Admin "sign out everywhere" | Same as password reset | Immediate |

## 5. Authentication Flows

### 5.1 Login with 2FA

```text
Browser                         API                                  Redis / DB
  │ POST /auth/login {email,pw}  │                                      │
  │─────────────────────────────►│ rate-limit (IP, email)               │
  │                              │ load user; verify argon2id (const-time even if user missing)
  │                              │ status checks (verified, locked)      │
  │                              │ mfa_enabled? → mfa_token (5 min) ────►│ store
  │◄─────────────────────────────│ {mfaRequired, mfaToken}              │
  │ POST /auth/mfa/verify {mfaToken, code}                              │
  │─────────────────────────────►│ verify TOTP (window ±1, no replay)   │
  │                              │ create refresh family; access JWT    │
  │◄─────────────────────────────│ {accessToken, orgs} + Set-Cookie asai_rt
```

### 5.2 Org-enforced 2FA
If `org.settings.mfaRequired` and the user lacks 2FA: login succeeds with a **restricted token** (`scope: mfa_enrollment`) that allows only `/auth/mfa/setup|enable` and `/me`. Everything else → `403 MFA_ENROLLMENT_REQUIRED`.

### 5.3 Organization switch
`POST /auth/switch-organization` → verify active membership and org status → new access token with the new `org` claim (refresh family unchanged; it is org-agnostic but records the last active org). The client clears its query cache.

### 5.4 Enterprise SSO (Phase 3)
- OIDC (Authorization Code + PKCE) and SAML 2.0 (SP-initiated; signed assertions required; encrypted assertions optional).
- Domain verification by DNS TXT `aerosight-verification=<token>` before SSO enforcement.
- Options: `ssoEnforced` (password login disabled for verified-domain users, except a break-glass Owner account), JIT provisioning with a default role, group → role mapping.
- SCIM 2.0 for automated deprovisioning (`active=false` → deactivation flow).

### 5.5 Re-authentication for sensitive actions
`POST /auth/reauth` sets `reauth_until = now + 5 min` on the session. Required by AUTH-020 actions. If 2FA is enabled, the code is required.

## 6. Authorization

### 6.1 Decision flow
```text
Gateway: valid JWT? not deny-listed? ver current? → else 401
Core API:
  1. TenantContext (org from token) → DB SET LOCAL
  2. Org status check (suspended/read_only/pending_deletion) → 403 ORG_*
  3. Route guard: @RequirePermission(p) coarse check (org-level or "any project")
  4. Load resource via RLS-scoped repository → null → 404
  5. PolicyEngine.can(ctx, p, resource) → project membership + resource rules → 403 or 404
       (404 when the user cannot read the resource at all; 403 when they can read it but not perform the action)
  6. Execute + audit
```

### 6.2 Principles
- **Deny by default.** Routes without an explicit permission decorator fail the CI lint (`no-unguarded-route`).
- **Server-side only.** UI checks are cosmetic.
- **Object-level checks** on every request (no trusting list-endpoint filtering for detail access).
- **Field-level filtering** for Viewer and limited roles (serializers by audience).
- **Consistent enforcement** for REST, WebSocket, background jobs (snapshot of requester permissions), AI tools, notifications (re-authorize at send), exports and reports.

### 6.3 Service-to-service
- Internal services authenticate with short-lived service JWTs (5 min) signed by an internal issuer, or mTLS within the mesh. Workload identity is used for cloud APIs (IRSA on EKS). There are no static cloud keys.
- Internal calls on behalf of a user carry the user `AuthContext` (signed) so downstream checks run as that user (used by AI assistant tools).

### 6.4 API keys
Format `asai_live_<8-char prefix>_<32-byte base62 secret>`. SHA-256 stored. Shown once. Permission subset + optional projects + expiry ≤ 1 year. Rate-limited per key. Audited as `actor_type=api_key`. Revocation is immediate (lookup per request, cached 60 s with an invalidation event).

## 7. Security Controls Summary

| Threat | Control |
|---|---|
| Credential stuffing | Rate limits (IP + account), breached-password checks, 2FA, new-device emails, bot detection at WAF |
| Account enumeration | Generic responses, constant-time hashing for unknown users, same response for existing-email signup |
| Session hijacking | Short access TTL, httpOnly refresh, rotation + reuse detection, Secure cookies, HSTS |
| Token theft from XSS | Access token in memory only, strict CSP, Trusted Types (Phase 2) |
| Privilege escalation | RR-10, server-side checks, matrix tests |
| IDOR / cross-tenant | RLS, org from token, object-level checks, 404 semantics, tenant test suite |
| Insider (staff) | Separate realm, no default tenant access, break-glass with approval + audit |

## 8. Test Coverage

See TC-AUTH-001 – TC-AUTH-015 and TC-RBAC-001 – TC-RBAC-012 in [Test Cases](../11-QA/Test-Cases.md).
