# Reporting Specification

| | |
|---|---|
| **Document** | Reporting Specification |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-22 |
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

Reports are the primary deliverable customers send to clients, lenders and regulators. AeroSight AI generates branded, reproducible, evidence-linked reports asynchronously.

**BR:** BR-12 · **Feature:** FEAT-REPORT · **Requirements:** REPORT-001 – REPORT-012 · **Phase:** 1 (PDF, templates), 2 (AI narrative, DOCX/XLSX, scheduling).

## 2. Report Types

| Type | Scope | Default sections | Phase |
|---|---|---|---|
| **Progress Report** | Project or site, period | Cover, Executive summary, KPIs, S-curve, Milestone table, Before/after imagery, Map snapshot, Open findings summary, Upcoming milestones, Appendix (media index) | 1 |
| **Inspection Report** | One inspection | Cover, Asset details, Checklist results, Findings (annotated images), Map excerpt, Sign-off | 2 |
| **Survey Report** | One survey | Cover, Survey parameters, Coverage map, Accuracy (GCP RMSE), Outputs list, Measurements/volumes | 1 |
| **Mission / Flight Report** | One mission | Mission plan, pilot & drone, checklist, flight path vs. actual, telemetry summary, media captured, incidents | 1 |
| **Executive Portfolio Report** | Organization (accessible projects) | Portfolio KPIs, projects by status, top risks, findings trends | 2 |
| **Custom** | Any | User-selected sections | 2 |

## 3. Generation Pipeline

```text
User → POST /reports/generate
      → reports row (status=queued) + audit
      → Queue: report.generate (BullMQ)
Worker:
  1. Re-check permissions of the requesting user (snapshot of effective permissions at request time)
  2. Collect data via domain services (same authorization filters as the API)
  3. (Optional) AI narrative: AI-008 generates executive summary from structured data → flagged "AI-assisted"
  4. Render HTML from template (Handlebars + print CSS) → headless Chromium (Playwright) → PDF/A-2b
     DOCX via docx templating; XLSX via exceljs for tabular sections
  5. Upload to object storage: org/{orgId}/reports/{reportId}/{version}.pdf (SSE-KMS)
  6. Compute SHA-256, store, status=ready
  7. Notify requester (in-app + email)
```

- **Reproducibility:** the report stores `parameters`, `data_snapshot_at` and the template version. Regenerating creates a new version and keeps the old ones.
- **Integrity:** the PDF footer shows the report ID, version, generated-at time and a SHA-256 short hash. `GET /reports/:id/verify?hash=` confirms authenticity.
- **Performance target:** ≤ 120 s for a report with ≤ 200 images (p95). Images are downscaled to ≤ 2000 px long edge at 85% JPEG quality for the PDF.

## 4. Functional Requirements

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| REPORT-001 | Users with `report:generate` can generate a report choosing type, template, scope (project/site/inspection/survey/mission), period and sections. | Must | 1 |
| REPORT-002 | Generation is asynchronous with statuses `queued`, `generating`, `ready`, `failed`. The UI shows progress and notifies on completion. | Must | 1 |
| REPORT-003 | Output formats: PDF (Phase 1); DOCX, XLSX, HTML (Phase 2). | Must/Should | 1/2 |
| REPORT-004 | Templates (`report_templates`): system defaults plus org templates with branding (logo, colors, header/footer text, cover image), section order and section toggles. | Must | 1 |
| REPORT-005 | Report content respects the requester's permissions. Data the requester cannot read is never included. | Must | 1 |
| REPORT-006 | Reports include evidence: thumbnails link back (deep links) to media in AeroSight for authorized users. | Should | 1 |
| REPORT-007 | Download through a signed URL (TTL 5 min). Each download is audited. | Must | 1 |
| REPORT-008 | Publish to project Viewers. Only `published` reports are visible to Viewer role. | Must | 1 |
| REPORT-009 | External share link: random 32-byte token (stored hashed), expiry ≤ 30 days, optional passcode, revocable, access logged. Requires `report:share`. Admin can disable external sharing org-wide. | Should | 1 |
| REPORT-010 | Scheduled reports (weekly/monthly) with recipients (members only) and auto-publish option. | Should | 2 |
| REPORT-011 | AI-assisted narrative (executive summary, highlights) clearly labelled. The author can edit it before publishing. | Should | 2 |
| REPORT-012 | Versioning: regenerate creates version n+1. Previous versions are retained according to the retention policy. | Should | 1 |

## 5. Report States

```text
queued → generating → ready (draft) → published → (archived)
                    ↘ failed (error_code, retry allowed)
```

## 6. UI

- **Reports list:** filters (type, project, status, author, date), columns (title, type, scope, period, version, status, generated by, generated at).
- **Generate wizard:** 1) Type & template, 2) Scope & period, 3) Sections (drag to reorder, toggle), 4) Review → Generate.
- **Report detail:** inline PDF viewer (pdf.js), version list, actions (Download, Publish, Share link, Regenerate, Archive).
- **Template editor (Admin/PM):** branding, section defaults, live preview with sample data.

## 7. API

`POST /reports/generate`, `GET /reports`, `GET /reports/:id`, `GET /reports/:id/download`, `POST /reports/:id/publish`, `POST /reports/:id/share-links`, `DELETE /report-share-links/:id`, `GET /public/reports/:token` (no auth; token + passcode), `GET /reports/:id/verify`, `GET/POST /report-templates`, `PATCH /report-templates/:id`, `GET/POST /report-schedules`. Full schemas in [API Specification §6.16](../../06-API/API-Specification.md#616-reports).

## 8. Data

`reports`, `report_templates`, `report_share_links`, `report_schedules`.

## 9. Error States

| Code | Cause | UX |
|---|---|---|
| `REPORT_SCOPE_FORBIDDEN` | Requester lacks access to the scope | 403 toast |
| `REPORT_NO_DATA` | Period has no data | Warning before generation; can proceed |
| `REPORT_RENDER_FAILED` | Rendering error | Status `failed` with a retry button. Ops alert if > 3 failures in 10 min. |
| `REPORT_TOO_LARGE` | > 1,000 images selected | Ask to narrow the period or sections |
| `SHARE_DISABLED` | Org disabled external sharing | Share button hidden |

## 10. Acceptance Criteria

See [AC-REPORT-01 – AC-REPORT-05](../../11-QA/Acceptance-Criteria.md#reports).
