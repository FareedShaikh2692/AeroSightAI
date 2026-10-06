# Asset Inspection Specification

| | |
|---|---|
| **Document** | Asset Inspection Specification |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-21 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product Team |
| **Reviewer** | _Pending — Product Owner, QA Lead, Domain SME (Inspection)_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product Team | Initial draft |

---

## 1. Purpose

This document defines the structured inspection workflow: templates → inspections → findings → remediation → verification, with evidence and approval.

**BR:** BR-09 · **Feature:** FEAT-INSPECTION · **Requirements:** INSPECTION-001 – INSPECTION-016 · **Phase:** 2 · **Status target:** Implemented.

## 2. Domain Model

```text
InspectionTemplate 1─* TemplateSection 1─* TemplateItem
        │
        ▼ (instantiated as checklist JSON snapshot)
Inspection ─* InspectionFinding ─* InspectionAttachment ─ Media
    │  └─ asset (optional)          │ └─ asset (optional), location (PointZ)
    └─ mission (optional)            └─ assignee, due date, severity
```

The template is **snapshotted** into `inspections.checklist` when the inspection is created, so later template edits don't change historical inspections.

### 2.1 Inspection states

```text
draft ──► scheduled ──► in_progress ──► submitted ──► in_review ──► approved ──► closed
                               ▲                         │
                               └──────── rejected ◄──────┘
(cancelled from draft/scheduled/in_progress)
```

| Transition | Who | Rules |
|---|---|---|
| draft → scheduled | `inspection:assign` | Assignee + due date required |
| scheduled → in_progress | Assignee | Sets `started_at` |
| in_progress → submitted | Assignee | All required items answered. All findings have a severity. |
| submitted → in_review | Reviewer (auto when the reviewer opens it) | |
| in_review → approved | `inspection:approve`, **not** the assignee | Records reviewer, time, optional professional reference |
| in_review → rejected → in_progress | `inspection:approve` | Comment required |
| approved → closed | `inspection:approve` | All findings `resolved/verified/closed/wont_fix` |

### 2.2 Finding states

```text
open ──► in_progress ──► resolved ──► verified ──► closed
  └──────────────► wont_fix (reason required, needs inspection:approve)
resolved ──► open (reopened on failed verification)
```

### 2.3 Severity scale

| Severity | Definition | Default SLA to resolve | Notification |
|---|---|---|---|
| **Critical** | Immediate risk to life, structural stability or major environmental harm | 24 h | Immediate: in-app + email + chat. Site Manager + PM + Engineer |
| **High** | Significant defect that may escalate. Contractual non-conformance. | 7 days | In-app + email |
| **Medium** | Defect requiring planned remediation | 30 days | In-app |
| **Low** | Cosmetic or observation | 90 days | Digest |

SLAs are configurable per organization.

## 3. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| INSPECTION-001 | Admin/PM can create inspection templates with sections and items. Item types: `pass_fail_na`, `rating_1_5`, `number` (with unit, min/max), `text`, `photo_required`, `select`. | Must |
| INSPECTION-002 | Templates are versioned. Publishing a new version doesn't affect existing inspections. | Must |
| INSPECTION-003 | Users with `inspection:create` can create an inspection for a project/site, optionally linked to an asset and/or mission, from a template or blank. | Must |
| INSPECTION-004 | Inspections can be scheduled with assignee, reviewer and due date. They can recur (weekly/monthly) per asset. | Should |
| INSPECTION-005 | Users with `finding:create` can add findings with title, description, category (structural, safety, quality, environmental, progress, other), severity, location (map pick or from media geotag), asset, assignee and due date (defaulted from the severity SLA). | Must |
| INSPECTION-006 | Findings support attachments (existing media or new upload) with annotations stored as vector JSON (rect, ellipse, arrow, polyline, text) over normalized image coordinates. | Must |
| INSPECTION-007 | A finding can be created from a media item or video frame. Location and capture time are prefilled. | Should |
| INSPECTION-008 | Findings appear as severity-colored markers on the map and in the digital twin and can be filtered by status/severity. | Must |
| INSPECTION-009 | Comments with @mentions on inspections and findings. | Should |
| INSPECTION-010 | Submit for review enforces completion rules (§2.1). | Must |
| INSPECTION-011 | Approve/reject by a reviewer with `inspection:approve`. Self-approval is prohibited. | Must |
| INSPECTION-012 | Approved inspections are immutable. Amendments create a linked follow-up inspection. | Must |
| INSPECTION-013 | Finding workflow per §2.2. Resolution requires notes and (configurable) evidence media. | Must |
| INSPECTION-014 | Overdue findings (past due, not resolved) trigger notifications daily and are highlighted. | Should |
| INSPECTION-015 | AI-suggested findings (AI-005) appear in a review queue and become findings only on acceptance (`ai_generated=true`, `ai_confidence`, `reviewed_by`). | Should |
| INSPECTION-016 | Inspection report (PDF) per inspection: checklist results, findings with annotated images, map excerpt, sign-off block. | Must |

## 4. User Flow — Field inspection

1. Inspector opens **Inspections → My inspections** → selects a scheduled inspection → **Start**.
2. Works through the checklist. Items marked `photo_required` open the camera/upload.
3. On a defect: **Add finding** → severity, category, asset (auto-suggested if near an asset marker) → annotate photo → assign to the site manager.
4. **Submit** → Engineer notified.
5. Engineer reviews checklist, findings and evidence → **Approve** (optionally with a professional reference) or **Reject** with comments.
6. Assignees resolve findings → upload after-photos → **Resolve** → Inspector **verifies** → finding **closed**.
7. Once all findings are closed, the Engineer **closes** the inspection.

Offline tolerance (responsive web): the checklist draft autosaves to IndexedDB every 5 s and syncs when online. Conflicts use last-writer-wins per item, with a conflict notice. (Full offline mode is Future Scope.)

## 5. UI Requirements

- **Inspections list:** tabs (My, All, Awaiting review, Overdue); columns: title, asset, site, assignee, due, status, findings count by severity.
- **Inspection detail:** left checklist, right evidence panel/map, sticky status bar with the primary action for the current state.
- **Finding drawer:** severity chip, status stepper, annotation canvas, history.
- **Annotation canvas:** works on touch. Pinch zoom. Annotations scale with the image.

## 6. API

| Method & Path | Permission |
|---|---|
| `GET/POST /inspection-templates`, `PATCH /inspection-templates/:id`, `POST /inspection-templates/:id/publish` | `inspection:template_manage` |
| `GET /inspections`, `POST /inspections` | `inspection:read`, `inspection:create` |
| `GET/PATCH /inspections/:id` | `inspection:read`, `inspection:update` |
| `POST /inspections/:id/{schedule,start,submit,approve,reject,close,cancel}` | per §2.1 |
| `PUT /inspections/:id/checklist/items/:itemId` | `inspection:update` (assignee) |
| `GET/POST /inspections/:id/findings` | `inspection:read`, `finding:create` |
| `PATCH /findings/:id`, `POST /findings/:id/{start,resolve,verify,reopen,close,wont-fix}` | `finding:update`, `finding:resolve`, `inspection:approve` |
| `POST /findings/:id/attachments` | `finding:update` |
| `GET /inspections/:id/report` | `report:read` |

## 7. Data

`inspection_templates`, `inspections`, `inspection_findings`, `inspection_attachments`, `comments`. See [Database Design](../../05-Database/Database-Design.md).

## 8. Error States

`INSPECTION_INCOMPLETE` (submit with missing required items), `SELF_APPROVAL_FORBIDDEN`, `INVALID_STATE_TRANSITION` (409), `FINDING_EVIDENCE_REQUIRED`, `ASSET_SITE_MISMATCH`.

## 9. Acceptance Criteria

See [AC-INSPECTION-01 – AC-INSPECTION-06](../../11-QA/Acceptance-Criteria.md#inspections).
