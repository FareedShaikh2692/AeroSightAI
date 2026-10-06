# AI Feature Specification

| | |
|---|---|
| **Document** | AI Feature Specification |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-17 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI — AI/ML Team |
| **Reviewer** | _Pending — AI Lead, Security Engineer, Product Owner_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | AI/ML | Initial specification of 7 AI capabilities |

---

## 1. Principles (mandatory)

1. **AI respects the same permissions as the user.** Every AI read goes through the same authorization as the API, executed as the requesting user (AI-010).
2. **Humans decide.** AI outputs are proposals. They never change official records (progress, findings, reports) without explicit human acceptance (AI-004).
3. **No certified engineering conclusions.** All AI outputs carry the label *"AI-assisted — not an engineering certification"* (AI-015).
4. **Provenance.** Every output records the model, version, prompt version, inputs, parameters and reviewer (AI-003, AI-007).
5. **Tenant isolation.** No cross-tenant context, embeddings, caches or fine-tuning without explicit opt-in.
6. **Honest capability.** Phase 2 AI features ship as **Prototype** (`Beta`) until accuracy targets (§6) are met on customer-representative evaluation sets.

## 2. Architecture

```text
Core API (ai module)                         AI Service (Python, FastAPI)
  POST /ai/analyze ──► ai_analyses(queued) ──► queue ai.dispatch ──► Orchestrator
     │ authz: ai:analyze + read on inputs                              │
     │                                                                 ├─ Vision pipeline (GPU pool)
     │                                                                 │    · tiling, co-registration
     │                                                                 │    · segmentation / detection models
     │                                                                 ├─ LLM client (provider abstraction)
     │                                                                 │    · default: Anthropic Claude
     │                                                                 │    · structured outputs (JSON schema)
     │                                                                 ├─ Tool executor (assistant)
     │                                                                 │    · calls Core API *as the user*
     │                                                                 └─ Output validator → result
  ◄── callback (signed) ── results ─────────────────────────────────────┘
  ai_analyses(completed, output) → ai_suggestions → notification → review UI
```

- Inputs are passed **by reference** (media/map IDs). The AI service fetches pixels through short-lived signed URLs issued by the Core API for that specific job (scoped to the requesting user's permissions at request time).
- The AI service has **no direct database credentials** for tenant tables except its own job state.
- Model IDs live in configuration (`AI_MODEL_*` env vars). They can be swapped without code changes (ADR-010).

## 3. Model Routing

| Task | Default model | Rationale |
|---|---|---|
| Report narrative, inspection summary, progress explanation | `claude-sonnet-5-5` | Strong structured writing at moderate cost |
| Assistant (tool use, multi-step reasoning) | `claude-sonnet-5-5`; escalate to `claude-opus-5-5` for complex multi-project analysis (org setting) | Tool reliability |
| Auto-tagging, classification, short extraction | `claude-haiku-4-5-20251001` | Volume and latency |
| Multimodal reasoning over a few images (progress qualitative notes) | `claude-sonnet-5-5` (vision) | Image understanding |
| Pixel-level change detection, segmentation, defect detection | Self-hosted vision models (e.g. Siamese U-Net for change, YOLO-family / Mask R-CNN fine-tuned for defects) | Accuracy, cost at scale, geo-precision |
| Embeddings (assistant retrieval) | Configurable embedding model (1024-d) | — |

Prompt caching is used for stable system prompts and tool definitions. Batch processing is used for non-urgent tagging.

## 4. AI Capabilities

Each capability is documented separately: purpose, inputs, outputs, method, permissions, review, failure handling, metrics.

### 4.1 AI-001 — Progress Analysis

| Field | Specification |
|---|---|
| Purpose | Estimate construction progress for a site from a new aerial capture relative to a baseline and the milestone plan. |
| Status target | Phase 2 **Prototype** |
| Inputs | `mapId` (orthomosaic, required) and/or `mediaIds` (oblique images). `baselineMapId` (optional; else the previous published capture). `milestoneIds` with optional asset/area scope. Optional DSM for volumetric cues. |
| Preconditions | The orthomosaics overlap ≥ 60% with the survey area. GSD ≤ 5 cm/px. Both are co-registerable (feature matching residual < 1 m). |
| Method | 1) Co-register capture to baseline (feature matching + affine/homography, fallback to georeference). 2) Change detection (AI-002) to get changed regions. 3) Per-milestone scope polygon → classify construction state (e.g. excavation, foundation, structure, envelope, finishing) with a segmentation model + LLM multimodal reasoning on crops. 4) Map state → milestone % using a configurable stage-to-percent table. 5) LLM composes the explanation and recommendations from structured findings only. |
| Output | See schema below |
| Permission | `ai:analyze` + `progress:read` + `map:read`/`media:read` on all inputs. Review: `ai:review` or `progress:approve`. |
| Review | Each milestone proposal becomes an `ai_suggestions` row (`kind=progress`). Accept/edit → approved `progress_records` (`source=ai`). |
| Failure handling | Input invalid → `failed` with `AI_INPUT_INVALID` (specific reason: no overlap, GSD too coarse, co-registration failed). Model error → retry ×2 → `failed`. Partial results allowed (`status=completed`, `output.partial=true`). |
| Metrics | MAE of milestone % vs. surveyor ground truth (target ≤ 8 points). Acceptance rate (≥ 70%). Latency p95 ≤ 10 min for 1 km². |

Output schema (`progress_analysis.v1`):
```json
{
  "schemaVersion": "progress_analysis.v1",
  "progress": 68,
  "progressConfidence": 0.74,
  "asOf": "2026-10-06",
  "baseline": { "mapId": "…", "capturedAt": "2026-09-22" },
  "milestones": [
    { "milestoneId": "…", "name": "Level 3 slab", "proposedPercent": 85, "previousPercent": 40,
      "confidence": 0.81, "evidence": [ { "mapId": "…", "bbox": [55.1398, 25.0803, 55.1402, 25.0806] } ],
      "rationale": "Formwork removed over ~85% of the L3 footprint; rebar visible on remaining bay." }
  ],
  "changes": [
    { "id": "chg_1", "class": "new_structure", "areaM2": 412.5, "confidence": 0.88,
      "geometry": { "type": "Polygon", "coordinates": [ … ] } }
  ],
  "potentialIssues": [
    { "type": "material_stockpile_in_access_route", "severity": "medium", "confidence": 0.62,
      "location": { "type": "Point", "coordinates": [55.1404, 25.0809] },
      "description": "Stockpile appears to obstruct the north access road." }
  ],
  "recommendations": [
    "Schedule an oblique capture of the east façade to confirm envelope progress (low confidence 0.55)."
  ],
  "limitations": [ "Interior works not observable from aerial imagery." ],
  "disclaimer": "AI-assisted — not an engineering certification.",
  "model": { "vision": "change-seg-v0.3", "llm": "claude-sonnet-5-5", "promptVersion": "progress-explain@4" }
}
```

### 4.2 AI-002 — Change Detection

| Field | Specification |
|---|---|
| Purpose | Identify what changed between two captures of the same site. |
| Inputs | Two orthomosaics (and optionally DSMs) of the same site. |
| Output | `change_detection.v1`: list of polygons with `class` (`new_structure, removed_structure, earthwork_cut, earthwork_fill, vegetation_change, vehicle_equipment, material_stockpile, other`), area, mean height change (if DSM), confidence. Plus a raster change mask (COG) as a map layer. |
| Method | Co-registration → Siamese segmentation model → polygonize → filter (min area 4 m², confidence ≥ 0.5) → DSM differencing for height. |
| Permission | `ai:analyze` + `map:read`. |
| Review | Changes are informational overlays. They can be converted to findings (via review) or used in reports. |
| Metrics | IoU ≥ 0.6 on the labelled eval set. Precision ≥ 0.8 at default threshold. |

### 4.3 AI-005 — Defect Detection (Inspection Assist)

| Field | Specification |
|---|---|
| Purpose | Suggest potential defects in inspection imagery. |
| Classes | crack, spalling, exposed_rebar, corrosion, water_ingress/staining, missing_component, deformation, vegetation_on_structure, safety: missing_ppe, unprotected_edge |
| Inputs | Media IDs (images or video frames), optional asset context. |
| Output | `defect_detection.v1`: per image a list of `{class, bbox (normalized), mask?, confidence, proposedSeverity, explanation}`. |
| Review | Suggestions appear in the inspection's AI review queue (INSPECTION-015). Accept → finding with `ai_generated=true`. The engineer must confirm severity. |
| Guardrails | Proposed severity is capped at `high`. `critical` can only be set by a human. Low-confidence (< 0.4) results are hidden by default. People in images: only PPE classification, no identity recognition. |
| Metrics | Recall ≥ 0.85 for cracks > 2 mm at GSD ≤ 2 mm/px (close-range). Precision ≥ 0.6 (review-assist tolerance). |

### 4.4 AI-008 — Report Generation (Narrative)

| Field | Specification |
|---|---|
| Purpose | Draft executive summary and section narratives for reports. |
| Input | **Structured data only:** project KPIs, milestone table, approved progress, findings summary (counts, top items titles/severity), period, previous report summary. No raw images in Phase 2 (optional captions from AI-013). |
| Output | `report_narrative.v1`: `{executiveSummary, highlights[], risks[], nextSteps[], sectionNotes{sectionKey: text}}` with each claim referencing source data keys (`[ref:milestone:…]`) so the renderer can verify facts. |
| Method | LLM with a strict JSON schema. Post-validation: every number in the text must exist in the input data (regex extract + match). Otherwise regenerate once, then fall back to the template-only report. |
| Permission | `report:generate` + `ai:analyze`. Data assembled with the requester's permissions. |
| Review | The narrative is editable in the report wizard before generation and before publishing. Report flagged `ai_assisted=true` with the disclaimer in the footer. |

### 4.5 AI-009 – AI-012 — AI Assistant

| Field | Specification |
|---|---|
| Purpose | Natural-language Q&A over the user's authorized organization data ("Which sites have critical findings older than 7 days?", "Summarize Tower B progress since August"). |
| Status target | Phase 2 **Prototype** |
| Architecture | LLM with **tools**. Tools are thin wrappers over Core API endpoints called with the user's `AuthContext` (signed, short-lived). Retrieval over `ai_embeddings` (RLS + project filter) for unstructured text (findings descriptions, comments, report text). |
| Tools (allow-list) | `search_entities`, `get_project_summary`, `list_missions`, `list_findings`, `get_progress`, `get_milestones`, `list_media` (metadata only), `get_inspection`, `get_report_summary`, `get_site_timeline`, `compute_stats` (aggregations via the analytics endpoints). **No** write tools in Phase 2. **No** tools that send data externally. |
| Authorization | Tools inherit the user's permissions. Results the user can't see are never fetched. When nothing is found, the assistant says so without implying the existence of hidden data. |
| Citations | Every factual statement links to entity chips (`[Finding FND-000310]`) (AI-011). |
| Prompt-injection defense | Tenant text in tool results is wrapped in `<data>` blocks, and the system prompt instructs the model to treat it as untrusted. Tool calls are validated (schema, allow-list, max 8 calls per turn, max 50 rows per call). Output is filtered for signed URLs/secrets. Red-team test set in CI (TC-AI-007). |
| Privacy | Conversations are private to the user (RR-08), retained 90 days (configurable), excluded from training. |
| Limits | 30 messages per user per hour. 100k input tokens per turn. Org monthly credit pool (AI-014). |
| UX | Streaming answers (SSE), "Thinking…" status, stop button, copy, feedback thumbs (stored with consent), scope selector (All accessible projects / a project). |

### 4.6 AI-013 — Media Auto-Tagging

Tags images with scene/object labels (`crane, excavator, concrete_pour, rebar, scaffolding, roof, facade, road, stockpile, water_pooling, people`) using a vision classifier and/or `claude-haiku-4-5-20251001` on thumbnails. Tags are stored with `source=ai` and a confidence. They are searchable and editable. Opt-in per org. Phase 2 Prototype.

### 4.7 Inspection Summary (part of AI-008)

Summarizes an inspection's checklist results and findings into a paragraph for the inspection report. Same guardrails as AI-008.

## 5. Data Handling

| Concern | Rule |
|---|---|
| Data sent to LLM provider | Minimum necessary: structured data, cropped/resized images (≤ 1568 px long edge), no signed URLs, no credentials, names replaced by role labels unless needed. |
| Retention at provider | Zero-retention / no-training agreements where offered. The provider is listed as a sub-processor. |
| Region | AI processing region follows the org setting (AI-016). Unavailable region → feature disabled with an explanation. |
| Feedback dataset | Reviewer decisions are stored per org. Used for model improvement **only** with org opt-in. Exported anonymized and de-identified. |
| Logging | Prompts/responses are not written to application logs. Stored only in `ai_analyses`/`ai_messages` with tenant RLS. |

## 6. Quality, Evaluation & Release Gates

| Capability | Evaluation set | Gate to move Prototype → Implemented |
|---|---|---|
| Progress (AI-001) | ≥ 50 site-capture pairs across 5 project types with surveyor-labelled milestone % | MAE ≤ 8 pts; acceptance ≥ 70% in a pilot with ≥ 3 customers |
| Change detection (AI-002) | ≥ 200 labelled tile pairs | IoU ≥ 0.6; precision ≥ 0.8 |
| Defects (AI-005) | ≥ 5,000 labelled defect instances | Recall ≥ 0.85 (cracks); engineer-rated usefulness ≥ 4/5 |
| Narrative (AI-008) | 100 report datasets | 0 unsupported numbers (automated check); human rating ≥ 4/5 |
| Assistant (AI-009) | 300 Q&A pairs incl. authorization traps | Answer accuracy ≥ 85%; **0** authorization leaks; injection suite pass |

Evaluations run in CI (nightly) on model/prompt changes. Prompt versions are semver'd (`progress-explain@4`). Regressions block release.

## 7. Cost Controls

- AI credits: 1 credit ≈ US$0.01 of underlying compute/tokens (internal rate card). Estimates are shown before running heavy jobs.
- Per-org concurrency caps (default 5 jobs). Per-user rate limits.
- Image downscaling and tiling to minimize tokens and GPU time. Cache results by `(inputs hash, model, prompt version)`.
- Monthly AI cost per org tracked (NFR-COST-003).

## 8. UI Requirements

- `AI-assisted` badge + disclaimer on every AI block. Confidence shown as High (≥ 0.8) / Medium (0.5–0.8) / Low (< 0.5) with the numeric value on hover.
- Overlays (changes, defect boxes) are toggleable on the map/lightbox.
- Review queues: keyboard-driven (A accept, E edit, R reject, J/K next/previous).
- Org AI settings: enable per capability, region, feedback opt-in, auto-analysis per project.

## 9. Failure Modes

| Failure | Behavior |
|---|---|
| Provider outage | Circuit breaker. Jobs stay queued (up to 24 h) then fail with `UPSTREAM_UNAVAILABLE`. UI notice. |
| Invalid model output (schema) | One automatic retry with a repair prompt. Then `failed` with `AI_OUTPUT_INVALID`. |
| Hallucinated reference (assistant) | Citation validator removes or flags unknown entity IDs. Answer marked "unverified" if any are removed. |
| Credits exhausted | `AI_CREDITS_EXHAUSTED`. Owner notified. Existing results remain. |
| Authorization changed mid-job | Results are written but visible only per current permissions. Assistant tool calls re-check per call. |
