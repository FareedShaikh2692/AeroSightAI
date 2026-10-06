# Privacy & Data Protection Requirements

| | |
|---|---|
| **Document** | Privacy & Data Protection Requirements |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-26 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Security & Legal |
| **Reviewer** | _Pending — DPO / Legal Counsel, Security Engineer_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Security & Legal | Initial draft — requires legal review before GA |

---

> **Note:** This document defines product and engineering requirements. It is not legal advice. Legal counsel must review the final positions on GDPR, UK GDPR, UAE PDPL, Saudi PDPL, CCPA/CPRA and local drone-imagery laws before GA.

## 1. Roles

| Context | AeroSight AI role | Customer role |
|---|---|---|
| Tenant content (media, sites, inspections, user data entered by the customer) | **Processor** | Controller |
| Account/billing data of customer admins, product telemetry, security logs | **Controller** | — |

A Data Processing Agreement (DPA) with Standard Contractual Clauses (where applicable) is offered to all customers. A sub-processor list is published (cloud, email, payment, LLM provider, error tracking) with 30-day advance notice of changes.

## 2. Data Inventory

| Category | Examples | Personal data? | Sensitivity | Default retention |
|---|---|---|---|---|
| User account data | Name, email, phone, avatar, locale | Yes | Medium | Life of account + 30 days |
| Authentication data | Password hash, TOTP secret, sessions, IPs | Yes | High | Sessions 30 days after expiry. Login IPs 90 days. |
| Pilot data | License numbers, certificates, insurance | Yes | High | Life of membership + 2 years (regulatory evidence) |
| Drone data | Serials, registrations, flight logs | Indirect (linked to pilot) | Medium | Life of org |
| Location data | Telemetry tracks, media GPS, site boundaries | Indirect (operator location, people/property in imagery) | Medium–High | Per [Database Design §6](../05-Database/Database-Design.md#6-data-lifecycle--retention-defaults) |
| Media | Aerial imagery and video that may incidentally capture people, vehicles (number plates), private property | Potentially | High | Per retention policy |
| Customer business data | Projects, inspections, findings, reports | Mostly no (names of staff) | Medium | Life of org |
| AI interaction data | Prompts, assistant conversations, AI outputs | Possibly | Medium | Conversations 90 days. Analyses with their entity. |
| Audit logs | Actor IDs, IPs, actions | Yes | Medium | 1–7 years (plan) |
| Billing data | Billing contact, invoices (card data held by the payment provider only) | Yes | Medium | 7–10 years (tax law) |
| Product analytics | Pseudonymous usage events | Pseudonymous | Low | 13 months |

## 3. Requirements

| ID | Requirement | Phase |
|---|---|---|
| PRIV-001 | **Data minimization:** collect only the fields listed in §2. Optional fields are clearly optional. EXIF fields not needed for function (e.g. camera owner name, device serial in EXIF) are stripped from `media_metadata.exif`. | 1 |
| PRIV-002 | **Configurable retention** per data class (ORG-008) within plan bounds, enforced daily by `retention.enforce`, with a preview of impact and audit of deletions. Legal holds override retention. | 2 |
| PRIV-003 | **Deletion:** soft-delete → 30-day trash → hard delete of DB rows and storage objects (all variants). Backups expire on rotation (≤ 35 days). Org deletion adds crypto-shredding of the org data key (ORG-011). | 1 |
| PRIV-004 | **Export / portability:** org-level export (ORG-010) and user-level DSAR export (`POST /me/export`) in machine-readable formats (JSON/CSV + original files). Delivered via a signed link valid 7 days. | 1 |
| PRIV-005 | **Data subject requests:** tooling for the controller (customer Admin) to find, export, rectify and delete a person's data (members). AeroSight supports controller DSARs within 30 days. Platform-controller DSARs are handled by support with identity verification. | 2 |
| PRIV-006 | **Access control:** least privilege per [RBAC](RBAC.md). Viewers see only shared/published content. Staff access only via break-glass. | 1 |
| PRIV-007 | **Location privacy:** live telemetry is visible only to authorized project members. Option `stripLocationOnExternalShare` removes GPS from media in external shares and public reports (MEDIA-016). | 2 |
| PRIV-008 | **Bystander privacy (Phase 3):** optional AI face and licence-plate blurring on derivatives shared outside the org. Originals stay restricted. Customers remain responsible for lawful capture (flight notices, consent signage). | 3 |
| PRIV-009 | **Data residency:** tenant content stored and processed in the selected region. AI processing region configurable (AI-016). Cross-border transfers are documented. | 1 (single region), 2 (multi-region) |
| PRIV-010 | **AI data use:** customer data is **not** used to train models (AeroSight or provider) unless the org explicitly opts in to feedback improvement (AI-007, AI-016). LLM providers with zero-retention terms. | 2 |
| PRIV-011 | **Transparency:** in-app privacy notice, cookie banner with necessary-only default (analytics opt-in), published sub-processors, AI labelling. | 1 |
| PRIV-012 | **Privacy by design:** a DPIA template is completed for new features processing location, imagery of people, or AI. A privacy review is part of the PRD sign-off for such features. | 1 |

## 4. Retention Policy Configuration

**Settings → Data & Retention** (Owner/Admin, `retention:manage`):

| Data class | Min | Default | Max (Pro) | Max (Enterprise) | Action options |
|---|---|---|---|---|---|
| Raw media (originals) | 90 d | Project life + 365 d | 5 y | Unlimited | delete, archive (cold storage) |
| Processed media (derivatives) | 90 d | Same as originals | 5 y | Unlimited | delete |
| Video | 30 d | 2 y | 5 y | Unlimited | delete, archive |
| Telemetry (full rate) | 7 d | 30 d | 365 d | 365 d | delete (aggregates kept) |
| Telemetry (aggregates) | 30 d | 365 d | 3 y | 7 y | delete |
| Audit logs | 365 d | 365 d / 7 y (Ent.) | 3 y | 7 y | delete |
| Reports | 365 d | Project life | 7 y | Unlimited | delete |
| AI conversations | 0 d | 90 d | 365 d | 365 d | delete |
| Deleted items (trash) | 7 d | 30 d | 90 d | 90 d | purge |

Rules:
- A change that shortens retention shows "N items (X GB) will be permanently deleted on <date>". It requires re-authentication and a 7-day delay before the first purge (cancellable).
- Per-project overrides are allowed (e.g. a contractual retention on one project).
- **Legal hold** (org or project) suspends all deletion for the scope until released. Both actions are audited.

## 5. Access Control Matrix for Personal Data

| Data | Who can see |
|---|---|
| Member name, avatar | Members of the same org |
| Member email, phone | Admins. Project members see email of co-members (configurable). |
| Pilot license details | Admins, the pilot, PM/Site Manager on projects where the pilot is assigned (number masked except last 4) |
| Login IPs / sessions | The user (own), Admins (audit) |
| Telemetry tracks | Project members with `telemetry:read` |
| Media with GPS | Project members with `media:read`. Viewers only when shared. |
| AI conversations | The creating user only (RR-08) |

## 6. Cookies & Tracking

| Cookie | Purpose | Type |
|---|---|---|
| `asai_rt` | Refresh token | Strictly necessary |
| `asai_csrf` | CSRF double-submit (auth path) | Strictly necessary |
| CloudFront signed cookies | Media access | Strictly necessary |
| `asai_consent` | Consent record | Strictly necessary |
| Product analytics (PostHog/Amplitude, self-hosted or EU) | Usage analytics | **Opt-in** |

## 7. Breach Handling

Follows SEC-058. Customer (controller) notification without undue delay after confirmation, with nature, scope, likely consequences and measures taken.
