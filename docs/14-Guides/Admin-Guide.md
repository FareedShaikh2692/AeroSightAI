# Administrator Manual

| | |
|---|---|
| **Document** | Administrator Manual (Organization & Platform) |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-45a |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product |
| **Reviewer** | _Pending — Product Owner, Support Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product | Pre-release draft written from the specifications. Screenshots will be added when the UI exists. |

---

> This manual describes the product as specified. Features marked **(Phase 2)** or **(Phase 3)** are not available in the first release.

# Part 1 — Organization Owners & Administrators

## 1. Getting Started

1. **Sign up** at `app.aerosight.ai/signup` with your work email. Verify your email with the 6-digit code.
2. The **onboarding wizard** asks for:
   - Organization profile: name, industry, country, timezone, logo.
   - Team invitations (you can skip and invite later).
   - First project and first drone (optional).
3. Your dashboard shows a **Getting started** checklist until everything is set up.

## 2. Organization Settings (Settings → Organization)

| Tab | What you can configure |
|---|---|
| General | Name, industry, timezone, units (metric/imperial), default coordinate system |
| Branding | Logo and brand color (used in the app header and reports) |
| Security | Require 2FA for all members. Session lifetime. Allowed email domains for invitations. External report sharing on/off. |
| Data & Retention **(Phase 2)** | Retention per data type, legal holds |
| Audit Logs | Search and export the activity history |
| Danger Zone | Export all data. Transfer ownership (Owner). Delete the organization (Owner). |

**Recommended security baseline:** enforce 2FA, restrict invitations to your company domain(s), keep session lifetime ≤ 14 days, and review audit logs monthly.

## 3. Managing People (Team)

### 3.1 Invite members
**Team → Invite** → enter one or more emails → choose an **organization role** → optionally add **project assignments** with a project role → **Send**. Invitations expire after 7 days. You can resend or revoke them from the **Pending** tab.

### 3.2 Roles at a glance

| Role | Typical person | Can… |
|---|---|---|
| Owner | Account holder | Everything, including billing, deletion, ownership transfer |
| Admin | IT / operations admin | Everything except deleting the org or transferring ownership |
| Project Manager | PM | Create and run projects, approve missions and progress, generate and share reports |
| Site Manager | Site lead | Manage sites and assets, coordinate missions, record progress, manage inspections |
| Drone Pilot | Licensed pilot | Manage drones, fly assigned missions, upload media |
| Surveyor | Survey professional | Surveys, map layers, measurements, progress updates |
| Inspector | QA/safety inspector | Inspections and findings |
| Engineer | Reviewing engineer | Approve inspections, review AI suggestions |
| Viewer | Client / external | Read-only access to shared media and published reports |

Full details: [RBAC matrix](../07-Security/RBAC.md#4-permission-matrix-system-roles).

**Org role vs. project role:** the org role is the baseline everywhere. A project role adds permissions in one project only (e.g. a Site Manager who acts as PM on one project). Owners and Admins can access all projects automatically.

### 3.3 Custom roles (Professional: up to 5; Enterprise: unlimited)
**Roles → New role** → clone an existing role or start blank → toggle permissions by module → **Save**. You can't grant permissions you don't have yourself. Sensitive permissions (billing, roles, audit, integrations) ask you to re-enter your password.

### 3.4 Deactivate or remove someone
Open the member → **Deactivate** (keeps them in history and can be undone) or **Remove**. Access ends within a minute everywhere, including live sessions. Their missions are flagged for reassignment. The last Owner can't be removed. Transfer ownership first.

### 3.5 Pilot records
Team → member → **Pilot** tab: license number, type, issuing authority, expiry date, certificates, insurance. AeroSight blocks mission assignment when a license is expired and warns 30/7/0 days ahead.

## 4. Drone Fleet Administration

- Register drones (Drone Fleet → **Register drone**). The serial number must be unique in your organization.
- Use **Simulator** drones for training and demos. Everything they produce is labelled `Simulated`.
- Put a drone in **Maintenance** to block assignment. Log maintenance with the next due date.
- **Connect a provider (Phase 2):** Integrations → Drone providers → connect your account → **Sync drones**.
- Overriding an expired registration or license requires a written reason and is recorded in the audit log.

## 5. Integrations **(Phase 2–3)**

| Integration | What it does |
|---|---|
| Drone providers (e.g. DJI Cloud API) | Live telemetry, live video, mission upload, media sync |
| Processing engines (NodeODM, Pix4D, DroneDeploy) | Turn raw images into orthomosaics/models inside AeroSight |
| Slack / Microsoft Teams | Route notifications to channels |
| Procore / Autodesk Construction Cloud (Phase 3) | Link projects, push reports and photos |
| SSO (OIDC/SAML) and SCIM (Phase 3) | Single sign-on and automatic provisioning |
| Webhooks & API keys | Connect your own systems |

Credentials are stored securely and never displayed again. Use **Test connection** after setup. Failing integrations are disabled automatically after repeated errors, and admins are notified.

## 6. Billing (Owner / delegated Admin)

**Billing** shows your plan, seats, storage, AI credits and video minutes against limits. You get warnings at 80% and 100%. Change plans and payment methods through the secure checkout and portal (AeroSight never stores card details). If a payment fails, you have 14 days before the organization becomes read-only. No data is deleted.

## 7. Audit Logs

**Settings → Audit Logs**: filter by person, action, item, project, date or IP. Open a row to see exactly what changed. Export to CSV/JSON. Audit entries can't be edited or deleted.

## 8. Data Export, Retention & Deletion

- **Export everything:** Danger Zone → **Export organization data** (re-authentication required). You get a download link valid for 7 days.
- **Retention (Phase 2):** Settings → Data & Retention. Shortening a period shows exactly what will be deleted and waits 7 days before the first deletion. **Legal hold** pauses all deletion for a project or the whole organization.
- **Delete organization (Owner):** type the organization slug and confirm. You have 30 days to cancel. After that, all data is permanently destroyed.

## 9. Troubleshooting for Admins

| Situation | What to do |
|---|---|
| Member can't see a project | Add them to the project (Project → Team) or give them an org-wide role |
| Member locked out | Wait 15 min or ask them to reset their password. If they lost their 2FA device, they can use a recovery code. Otherwise contact AeroSight support for identity-verified 2FA reset. |
| "Plan limit reached" | Archive inactive projects, remove unused seats, or upgrade |
| A file was quarantined | It failed the malware scan and can't be opened. Verify the source and re-upload a clean copy. |
| Live view shows `Connect provider` | No drone provider integration is connected (Phase 2) |

# Part 2 — Platform Administrators (AeroSight staff)

> Available only in the separate admin console (`admin.aerosight.ai`). Requires a staff account, a hardware security key and an approved network.

| Task | Where | Rules |
|---|---|---|
| Find an organization | Organizations | Search by name/slug. View plan, status, usage. |
| Suspend / reactivate | Organization → Actions | A reason is mandatory. Users see a suspension page. Data is kept. |
| Schedule / cancel deletion | Organization → Actions | Follow the contractual process. The Owner is notified. |
| Lock user / reset 2FA | Users | Requires a support ticket reference and completed identity verification |
| Adjust subscription (trial extension, credits, custom limits) | Subscriptions | All overrides are audited |
| Monitor health | System Health | Follow runbooks for alerts |
| Feature flags | Feature Flags | Roll out Beta features to pilot orgs first |
| Access tenant data | **Break-glass only** | Ticket + justification + approval. Max 4 h. Read-only. The customer Owner is notified. Every action appears in the customer's audit log. |

Staff never access customer content outside break-glass. Never request customer passwords. Never share customer data in tickets or chat.
