# Construction Progress Monitoring Specification

| | |
|---|---|
| **Document** | Construction Progress Monitoring Specification |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-20 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Product Team |
| **Reviewer** | _Pending — Product Owner, Tech Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Product Team | Initial draft |

---

## 1. Purpose

This document defines how AeroSight AI measures, records, visualizes and reports construction progress. Progress is anchored in evidence (aerial captures) and in the plan (weighted milestones). AI may propose progress estimates, but only an authorized human can make them official.

**Business requirement:** BR-10 · **Feature:** FEAT-PROGRESS · **Requirements:** PROGRESS-001 – PROGRESS-012 · **Status target:** Phase 1 Implemented (manual + milestone), Phase 2 Prototype (AI-assisted).

## 2. Concepts

| Concept | Definition |
|---|---|
| **Milestone** | A planned unit of work (e.g. "Level 3 slab poured") with planned start/end, a weight, and optional site and asset scope. |
| **Weight** | Relative contribution of a milestone to project completion. Weights are normalized so Σ = 100%. |
| **Progress Record** | A dated measurement of % complete for a milestone (or the whole site), with source (`manual`, `ai`, `survey`), evidence and approval state. |
| **Official progress** | The latest **approved** progress record per milestone on or before a given date. |
| **Planned progress** | The % expected by a date. It is calculated by linear interpolation between planned start and end (or an S-curve profile if provided). |
| **Schedule variance (SV%)** | Actual % − Planned % at the same date. |
| **Capture** | A dated set of media/survey outputs for a site (from a mission or upload). |
| **Baseline** | The capture used as the reference for change detection. |

## 3. Calculations

```text
Milestone planned % at date d:
    if d < planned_start → 0
    if d ≥ planned_end   → 100
    else linear: (d − planned_start) / (planned_end − planned_start) × 100
    (or S-curve: cumulative of a configured beta distribution, α=β=2 default)

Project actual %   = Σ_i ( w_i × official_pct_i(d) ) / Σ_i w_i
Project planned %  = Σ_i ( w_i × planned_pct_i(d) ) / Σ_i w_i
Schedule variance  = actual % − planned %
Status:
    SV ≥ −2%        → On track   (green)
    −10% ≤ SV < −2% → At risk    (amber)
    SV < −10%       → Delayed    (red)
Forecast completion = today + remaining% / (avg progress rate over last 4 records, %/day)
```

All percentages are stored as `numeric(5,2)` and computed server-side in one service (`ProgressCalculator`) so the dashboard, reports and API return identical numbers.

## 4. Functional Requirements

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| PROGRESS-001 | Users with `milestone:manage` can create, edit, reorder and delete milestones per project, optionally scoped to a site and/or assets. | Must | 1 |
| PROGRESS-002 | Weights are positive numbers. The UI and API show normalized weights (sum 100%). | Must | 1 |
| PROGRESS-003 | Milestones can be imported from CSV with columns `name, planned_start, planned_end, weight, site_code, parent` (compatible with MS Project / P6 exports). The response gives a row-level error report. | Should | 1 |
| PROGRESS-004 | Users with `progress:update` can create a progress record (milestone, date, %, notes, evidence media IDs). Records from users without `progress:approve` are created as `pending_approval`. | Must | 1 |
| PROGRESS-005 | Users with `progress:approve` can approve or reject pending records. Only approved records count as official. | Must | 1 |
| PROGRESS-006 | The system computes project and site actual %, planned %, SV and status at any date using §3. | Must | 1 |
| PROGRESS-007 | Progress dashboard: S-curve (planned vs actual), milestone Gantt with actual bars, KPI cards (actual %, SV, forecast completion, milestones delayed). | Must | 1 |
| PROGRESS-008 | Before/after comparison of any two captures (swipe for orthomosaics; side-by-side for co-located photos) from the progress screen. | Must | 1 |
| PROGRESS-009 | AI progress analysis (AI-001) can be requested on a capture. Its output creates a `source=ai` progress record in `pending_approval` with a link to the `ai_analyses` row. | Should | 2 |
| PROGRESS-010 | Survey-derived metrics (e.g. earthwork volume moved vs. planned) can feed a milestone's % via a configured formula (`metric / target × 100`). | Could | 2 |
| PROGRESS-011 | Notifications: milestone becomes At risk or Delayed; AI analysis ready; progress record awaiting approval. | Should | 2 |
| PROGRESS-012 | All progress records are immutable once approved. Corrections create a new record that references the superseded one. | Must | 1 |

## 5. User Flows

### 5.1 Manual progress update (Phase 1)
1. PM opens **Project → Progress**.
2. Clicks **Record progress** → selects milestone → sets % (slider + numeric) and date (defaults to today) → attaches evidence (choose from site media, filtered to ±7 days of the date) → notes.
3. Save → the record is `approved` (if the PM has `progress:approve`) or `pending_approval`.
4. The dashboard recalculates. An audit event `progress.recorded` is written.

### 5.2 AI-assisted progress (Phase 2, Prototype)
1. New capture arrives (mission completed + media processed, or survey published).
2. PM clicks **Analyze progress** (or auto-trigger if enabled per project).
3. AI service runs (see [AI-001](../../09-AI/AI-Requirements.md#41-ai-001--progress-analysis)). Status `queued → running → completed`.
4. Review screen: proposed % per milestone, detected changes overlaid on imagery, potential issues, recommendations, confidence per item.
5. PM accepts, edits or rejects each proposal. Accepted proposals become approved progress records with `source=ai`, `reviewed_by`.

## 6. UI Requirements

- **Progress tab** layout: KPI strip (Actual %, Planned %, SV with color, Forecast date, Delayed milestones) → S-curve chart → Milestone table (name, weight, planned dates, actual %, status, last evidence thumbnail) → Pending approvals panel.
- **Compare view:** two date pickers bound to the capture list, a mode toggle (swipe / side-by-side / opacity), sync pan/zoom, "Add to report".
- Every AI-sourced number shows an `AI` chip with a tooltip of model version and confidence.

## 7. API

| Method & Path | Permission | Purpose |
|---|---|---|
| `GET /projects/:id/milestones` | `progress:read` | List milestones with computed status |
| `POST /projects/:id/milestones` | `milestone:manage` | Create |
| `PATCH /milestones/:id` / `DELETE /milestones/:id` | `milestone:manage` | Edit / soft delete |
| `POST /projects/:id/milestones/import` | `milestone:manage` | CSV import |
| `GET /projects/:id/progress?asOf=YYYY-MM-DD` | `progress:read` | Computed summary (actual, planned, SV, forecast) |
| `GET /projects/:id/progress/series?from&to&interval=week` | `progress:read` | S-curve series |
| `POST /progress-records` | `progress:update` | Create record |
| `POST /progress-records/:id/approve` / `/reject` | `progress:approve` | Approval |
| `POST /ai/analyze` (type `progress`) | `ai:analyze` | Request AI analysis |

Schemas are in [API Specification §6.14](../../06-API/API-Specification.md#614-progress--milestones).

## 8. Data

Tables: `milestones`, `progress_records`, `ai_analyses` (see [Database Design](../../05-Database/Database-Design.md)). Materialized view `mv_project_kpis` is refreshed on progress approval events and every 15 minutes.

## 9. Error States

| Condition | Behavior |
|---|---|
| No milestones defined | Empty state: "Define milestones to track progress", with Import and Create buttons. |
| Weights all zero | Validation error `MILESTONE_WEIGHTS_INVALID`. |
| % outside 0–100 | `422 VALIDATION_ERROR`. |
| Record date in the future | `422` unless the org setting allows it. |
| AI analysis failed | Status `failed` with a retry button. Official progress is unchanged. |
| Approving own record when four-eyes policy is enabled | `403 FOUR_EYES_REQUIRED`. |

## 10. Acceptance Criteria

See [AC-PROGRESS-01 – AC-PROGRESS-05](../../11-QA/Acceptance-Criteria.md#progress).
