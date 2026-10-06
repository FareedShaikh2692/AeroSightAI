# RBAC / Permission Matrix

| | |
|---|---|
| **Document** | RBAC & Permission Matrix |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-11 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Security & Product |
| **Reviewer** | _Pending — Security Engineer, Product Owner_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Security & Product | Initial catalog (75 permissions, 9 system roles) |

---

## 1. Model

```text
User ──(organization_members)──► Organization
  │
  ├── org role (user_roles, exactly one)   ──► role_permissions ──► permissions (org- and project-scoped)
  └── project roles (project_members, 0..n) ──► role_permissions ──► permissions (project-scoped only)

Effective permissions for an action on resource R:
  if R.organizationId ≠ ctx.orgId                     → DENY (404)
  if org role ∈ {org_owner, org_admin}                → org role permissions (all projects)
  else if permission.scope = organization             → org role permissions
  else (project-scoped)                               → (org role ∩ project-scoped perms) ∪ project role perms,
                                                         ONLY if user is a member of R.projectId
  then apply resource rules (§5)
```

- **System roles** are seeded and immutable. **Custom roles** are per organization (Professional: 5, Enterprise: unlimited).
- A member's **org role** sets their baseline. A **project role** can grant more within a project (e.g. a Site Manager org role who is PM on one project).
- The **single source of truth** is `packages/permissions/catalog.ts`. DB seeds, API docs and this matrix are generated or checked against it in CI.

## 2. System Roles

| Key | Name | Default scope | Description |
|---|---|---|---|
| `org_owner` | Organization Owner | Org-wide | All permissions. Billing, deletion, ownership transfer. At least one is required. |
| `org_admin` | Organization Administrator | Org-wide | All permissions except `org:delete` and ownership transfer. |
| `project_manager` | Project Manager | Project | Runs projects end-to-end. Can create projects. |
| `site_manager` | Site Manager | Project | Site operations, assets, coordination, inspections. |
| `drone_pilot` | Drone Pilot | Project | Fleet, assigned missions, uploads. |
| `surveyor` | Surveyor | Project | Surveys, maps, layers, measurements. |
| `inspector` | Inspector | Project | Inspections and findings. |
| `engineer` | Engineer | Project | Reviews and approves inspections and AI outputs. |
| `viewer` | Client / Viewer | Project | Read-only access to shared/published content. |

## 3. Permission Catalog

Scope: **O** = organization, **P** = project.

| Module | Permission | Scope | Description | Sensitive |
|---|---|---|---|---|
| Organization | `org:read` | O | View org profile and usage | |
| | `org:update` | O | Edit org profile, branding, settings | ✓ |
| | `org:delete` | O | Export/delete organization | ✓ |
| | `retention:manage` | O | Retention policies, legal holds | ✓ |
| Team | `user:invite` | O | Invite members | |
| | `user:manage` | O | Change roles, deactivate, remove | ✓ |
| | `role:manage` | O | Create/edit custom roles | ✓ |
| | `pilot:manage` | O | Manage pilot records and status | |
| Billing | `billing:manage` | O | Plans, payment, invoices | ✓ |
| Audit | `audit:read` | O | View/export audit logs | ✓ |
| Integrations | `integration:manage` | O | Integrations, webhooks | ✓ |
| | `apikey:manage` | O | API keys | ✓ |
| | `notification:manage_rules` | O | Org notification routing | |
| Analytics | `analytics:read` | O* | Analytics (*results limited to accessible projects) | |
| Projects | `project:create` | O | Create projects | |
| | `project:read` | P | View project | |
| | `project:update` | P | Edit project | |
| | `project:archive` | P | Archive/restore/delete | |
| | `project:member_manage` | P | Manage project members | |
| Sites | `site:create` / `site:read` / `site:update` / `site:delete` | P | Site CRUD | |
| Assets | `asset:create` / `asset:read` / `asset:update` / `asset:delete` | P | Asset CRUD | |
| Drones | `drone:register` | O | Register drones | |
| | `drone:read` | O | View fleet | |
| | `drone:update` | O | Edit drones, maintenance | |
| | `drone:retire` | O | Retire drones | |
| Missions | `mission:create` / `mission:read` / `mission:update` | P | Mission CRUD and planning | |
| | `mission:approve` | P | Approve/reject missions | |
| | `mission:start` | P | Start/pause/resume/complete (assigned pilot rule) | |
| | `mission:abort` | P | Abort an active mission | |
| Live | `telemetry:read` | P | Live and historical telemetry | |
| | `livevideo:view` | P | Watch live video | |
| Media | `media:upload` / `media:read` / `media:download` / `media:delete` / `media:share` | P | Media library | |
| Surveys | `survey:create` / `survey:read` / `survey:upload` / `survey:process` / `survey:publish` | P | Surveys | |
| Maps | `map:read` / `map:annotate` / `map:layer_manage` | P | Maps and layers | |
| Twin | `twin:read` / `twin:model_upload` | P | Digital twin | |
| Inspections | `inspection:create` / `inspection:read` / `inspection:update` / `inspection:assign` / `inspection:approve` / `inspection:template_manage` | P | Inspections | |
| Findings | `finding:create` / `finding:update` / `finding:resolve` | P | Findings | |
| Progress | `progress:read` / `progress:update` / `progress:approve` / `milestone:manage` | P | Progress | |
| Reports | `report:generate` / `report:read` / `report:share` / `report:template_manage` | P | Reports | |
| AI | `ai:analyze` / `ai:review` / `ai:assistant` | P | AI features | |
| Collaboration | `comment:create` | P | Comment and mention | |

Total: 75 permission keys.

## 4. Permission Matrix (system roles)

✓ = granted · **S** = shared/published content only · **A** = assigned items only (resource rule) · blank = not granted

### 4.1 Organization-level

| Permission | Owner | Admin | PM | Site Mgr | Pilot | Surveyor | Inspector | Engineer | Viewer |
|---|---|---|---|---|---|---|---|---|---|
| org:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| org:update | ✓ | ✓ | | | | | | | |
| org:delete | ✓ | | | | | | | | |
| retention:manage | ✓ | ✓ | | | | | | | |
| **Manage users** (user:invite, user:manage) | ✓ | ✓ | | | | | | | |
| role:manage | ✓ | ✓ | | | | | | | |
| pilot:manage | ✓ | ✓ | | | | | | | |
| **Manage billing** (billing:manage) | ✓ | ✓ | | | | | | | |
| audit:read | ✓ | ✓ | | | | | | | |
| integration:manage, apikey:manage | ✓ | ✓ | | | | | | | |
| notification:manage_rules | ✓ | ✓ | | | | | | | |
| analytics:read | ✓ | ✓ | ✓ | ✓ | | | | ✓ | S |
| **Create project** (project:create) | ✓ | ✓ | ✓ | | | | | | |
| drone:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| **Manage drone** (drone:register, drone:update) | ✓ | ✓ | | | ✓ | | | | |
| drone:retire | ✓ | ✓ | | | | | | | |

### 4.2 Project-level (applies within projects where the user is a member; Owner/Admin: all projects)

| Permission | Owner | Admin | PM | Site Mgr | Pilot | Surveyor | Inspector | Engineer | Viewer |
|---|---|---|---|---|---|---|---|---|---|
| project:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| project:update, project:archive | ✓ | ✓ | ✓ | | | | | | |
| project:member_manage | ✓ | ✓ | ✓ | | | | | | |
| site:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Manage site** (site:create, site:update) | ✓ | ✓ | ✓ | ✓ | | | | | |
| site:delete | ✓ | ✓ | ✓ | | | | | | |
| asset:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| asset:create, asset:update | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | | |
| asset:delete | ✓ | ✓ | ✓ | ✓ | | | | | |
| mission:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| mission:create | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| mission:update | ✓ | ✓ | ✓ | ✓ | ✓ | | | | |
| mission:approve | ✓ | ✓ | ✓ | | | | | | |
| **Start mission** (mission:start) | ✓ | ✓ | | | A | | | | |
| mission:abort | ✓ | ✓ | ✓ | ✓ | A | | | | |
| telemetry:read, livevideo:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| media:read, media:download | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | S |
| media:upload | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| media:delete, media:share | ✓ | ✓ | ✓ | ✓ | | | | | |
| survey:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| survey:create | ✓ | ✓ | ✓ | ✓ | | ✓ | | | |
| **Upload survey** (survey:upload) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| survey:process, survey:publish | ✓ | ✓ | ✓ | | | ✓ | | | |
| map:read, twin:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | S |
| map:annotate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| map:layer_manage | ✓ | ✓ | ✓ | ✓ | | ✓ | | | |
| twin:model_upload | ✓ | ✓ | ✓ | | | ✓ | | | |
| inspection:read | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | |
| **Create inspection** (inspection:create, inspection:update) | ✓ | ✓ | ✓ | ✓ | | | ✓ | | |
| inspection:assign | ✓ | ✓ | ✓ | ✓ | | | | | |
| inspection:approve | ✓ | ✓ | | | | | | ✓ | |
| inspection:template_manage | ✓ | ✓ | ✓ | | | | | | |
| finding:create, finding:update | ✓ | ✓ | ✓ | ✓ | | | ✓ | ✓ | |
| finding:resolve | ✓ | ✓ | ✓ | ✓ | A | A | ✓ | ✓ | |
| progress:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| progress:update | ✓ | ✓ | ✓ | ✓ | | ✓ | | | |
| progress:approve, milestone:manage | ✓ | ✓ | ✓ | | | | | | |
| **Generate report** (report:generate) | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ | |
| **View reports** (report:read) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | S |
| report:share, report:template_manage | ✓ | ✓ | ✓ | | | | | | |
| ai:analyze | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ | |
| ai:review | ✓ | ✓ | ✓ | | | | ✓ | ✓ | |
| ai:assistant | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| comment:create | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

## 5. Resource Rules (applied after the permission check)

| Rule ID | Rule |
|---|---|
| RR-01 | `mission:start` for non-org-wide roles: only the mission's assigned pilot. |
| RR-02 | `mission:abort` for the Pilot role: only on missions assigned to them. |
| RR-03 | `inspection:approve`: approver ≠ inspection assignee (no self-approval). |
| RR-04 | `progress:approve` with project setting `fourEyesProgress`: approver ≠ record creator. |
| RR-05 | Viewer (**S**): `media:read/download` only where `shared_with_viewers = true`. `report:read` only `published`. `map:read` only published survey layers. `analytics:read` only for projects they are a member of. |
| RR-06 | `finding:resolve` (**A**) for Pilot/Surveyor: only findings assigned to them. |
| RR-07 | Inspection checklist editing: only the assignee while `in_progress`. |
| RR-08 | AI conversations: private to the creating user (even Owners cannot read others' conversations through the app; DSAR/export is separate). |
| RR-09 | Site membership override (SITE-011): if a site has explicit members, other project members (non org-wide) cannot access it. |
| RR-10 | No privilege escalation: a user cannot create, edit or assign a role, or create an API key, containing permissions they do not hold. |
| RR-11 | The last `org_owner` cannot be removed, deactivated or demoted. |
| RR-12 | Archived projects: all write permissions are denied (except `project:archive` to restore). |
| RR-13 | Organization in `read_only`: all writes are denied except billing. In `suspended`: everything is denied. |

## 6. Custom Roles

- Created by cloning a system role or from blank. Any subset of the catalog subject to RR-10.
- `scope`: `organization` (assignable as org role) and/or `assignable_to_project`.
- Sensitive permissions (marked ✓ in §3) show a warning in the editor and require re-authentication to grant.
- Changes take effect within 5 minutes (cache TTL) and immediately for revocations (cache invalidation + token `ver` bump).
- Example templates offered: *QA Lead* (Inspector + inspection:approve + report:share), *External Surveyor* (Surveyor without media:download), *Executive Viewer* (Viewer + analytics:read on all projects they are a member of).

## 7. API Keys & Service Actors

API keys hold an explicit permission subset (≤ creator's permissions) and optional project restriction. They act as an `api_key` actor in audit logs. They can never hold: `org:delete`, `billing:manage`, `role:manage`, `user:manage`, `apikey:manage`.

## 8. Platform Roles (separate realm)

| Role | Capabilities |
|---|---|
| `platform_admin` | Tenant lifecycle, subscriptions, feature flags, health, break-glass approval |
| `support` | Read tenant **metadata** (org, users, plan, usage, errors). Request break-glass. |
| `sre` | Health, infrastructure, logs. No tenant content. |

Platform roles hold **no** tenant permissions. Tenant access only via break-glass (read-only, ≤ 4 h, audited, Owner notified).

## 9. Testing Requirements

- Table-driven tests generate one case per (role × permission × resource rule) from this matrix (`packages/permissions/matrix.test.ts`) — see TC-RBAC-001.
- A CI check fails if the seed differs from `catalog.ts` or this document's §4 tables (parsed).
