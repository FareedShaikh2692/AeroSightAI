# UI Design System — "AeroSight Command"

| | |
|---|---|
| **Document** | UI Design System |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-12a |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Design |
| **Reviewer** | _Pending — Design Lead, Frontend Lead, Accessibility reviewer_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Design | Baseline tokens and components. The original "UI prompt" referenced in the brief was not provided, so this baseline needs reconciling with it when it is available (see A-12 in Assumptions). |

---

## 1. Visual Language

**Premium 3D enterprise construction intelligence:** the precision of an aviation command center combined with the material honesty of construction.

| Attribute | Expression |
|---|---|
| Depth | Layered surfaces with soft elevation. Translucent "glass" panels floating over maps and 3D scenes. Subtle parallax only on marketing pages. |
| Precision | Thin 1 px hairlines, tabular numerals, coordinate-grade typography, crosshair cursors in measure modes. |
| Construction DNA | **Safety Amber** as the signature accent (hi-vis), concrete-grey neutrals, blueprint-cyan data overlays. |
| Calm | Dark operational theme to reduce glare in control rooms. Light theme for documents. Restrained motion. |
| Trust | Clear status semantics, visible provenance (AI, simulated), no decorative noise in data views. |

Themes: **Night Ops** (dark, default for Live Ops, Maps, Twin), **Daylight** (light, default for the rest; user-selectable), **Sunlight** (high-contrast light for outdoor tablets).

## 2. Color

### 2.1 Core tokens

| Token | Night Ops (dark) | Daylight (light) | Use |
|---|---|---|---|
| `--bg-canvas` | `#0A0F14` | `#F6F7F9` | App background |
| `--bg-surface` | `#111820` | `#FFFFFF` | Cards, panels |
| `--bg-surface-raised` | `#16202A` | `#FFFFFF` (+ shadow) | Popovers, drawers |
| `--bg-glass` | `rgba(17,24,32,0.72)` + `backdrop-filter: blur(16px) saturate(140%)` | `rgba(255,255,255,0.78)` + blur | Map/3D overlays |
| `--border-subtle` | `#223040` | `#E3E7EC` | Hairlines |
| `--border-strong` | `#33465A` | `#C9D0D8` | Inputs |
| `--text-primary` | `#E8EEF4` | `#0E1620` | Body |
| `--text-secondary` | `#9AABBD` | `#4A5868` | Labels |
| `--text-muted` | `#6B7C8F` | `#738192` | Hints (large text only for contrast) |
| `--accent` (Safety Amber) | `#FFB020` | `#C77700` (text) / `#FFB020` (fills) | Primary actions, focus, brand |
| `--accent-contrast` | `#1A1200` | `#1A1200` | Text on amber |
| `--data` (Blueprint Cyan) | `#22D3EE` | `#0891B2` | Data overlays, flight paths, selection |
| `--info` | `#60A5FA` | `#2563EB` | Info |
| `--success` | `#34D399` | `#059669` | Success, on track |
| `--warning` | `#FBBF24` | `#B45309` | Warning, at risk |
| `--danger` | `#F87171` | `#DC2626` | Errors, critical, delayed |
| `--simulated` | stripes `#FFB020`/`#1A1200` at 45° | same | Simulated banners |

All text/background pairs used for body text meet WCAG AA (≥ 4.5:1). Large text and UI components meet ≥ 3:1. Contrast is validated in CI with a token contrast script.

### 2.2 Semantic: severity & status

| Semantic | Color token | Icon | Label |
|---|---|---|---|
| Critical | `--danger` | octagon-alert | "Critical" |
| High | `#FB923C` / `#C2410C` | triangle-alert | "High" |
| Medium | `--warning` | circle-alert | "Medium" |
| Low | `--info` | info | "Low" |
| On track | `--success` | trending-up | "On track" |
| At risk | `--warning` | alert | "At risk" |
| Delayed | `--danger` | clock-alert | "Delayed" |

### 2.3 Data visualization palette
Categorical (color-blind safe, 8): `#22D3EE, #FFB020, #A78BFA, #34D399, #F472B6, #60A5FA, #FB923C, #94A3B8`. Sequential (elevation/DSM): Viridis. Diverging (cut/fill, change detection): `#2563EB → #F1F5F9 → #DC2626`.

## 3. Typography

| Role | Font | Size / line height | Weight |
|---|---|---|---|
| Display (marketing) | **Space Grotesk** | 56/64, 40/48 | 600 |
| H1 | Inter | 28/36 | 600 |
| H2 | Inter | 22/30 | 600 |
| H3 | Inter | 18/26 | 600 |
| Body | Inter | 14/22 (app), 16/26 (docs/marketing) | 400 |
| Small | Inter | 12/18 | 500 |
| Numeric / HUD / coordinates | **JetBrains Mono** | 13/18 (tables), 24–40 (HUD values) | 500, tabular-nums |
| Overline | Inter | 11/16, letter-spacing 0.08em, uppercase | 600 |

Fonts are self-hosted (WOFF2, subsetting). Fallback: `system-ui`. Arabic: IBM Plex Sans Arabic (planned).

## 4. Spacing, Radius & Grid

- Spacing scale (px): `2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`. Tokens `--space-1…12`.
- Radius: `--radius-sm 6px` (inputs, chips), `--radius-md 10px` (cards, buttons), `--radius-lg 16px` (modals, glass panels), `--radius-full`.
- Layout grid: 12 columns, 24 px gutters (desktop), 16 px (tablet), 4 columns / 16 px (mobile). Max content width 1440 px (except full-bleed maps).
- Density modes: **Comfortable** (default) and **Compact** (tables −25% vertical padding).

## 5. Elevation, Depth & Materials

| Level | Use | Dark | Light |
|---|---|---|---|
| 0 | Canvas | none | none |
| 1 | Cards | `0 0 0 1px var(--border-subtle)` | `0 1px 2px rgba(14,22,32,.06), 0 0 0 1px var(--border-subtle)` |
| 2 | Popovers, dropdowns | `0 8px 24px rgba(0,0,0,.45)` | `0 8px 24px rgba(14,22,32,.12)` |
| 3 | Modals, drawers | `0 24px 64px rgba(0,0,0,.55)` | `0 24px 64px rgba(14,22,32,.18)` |
| Glass | Map/3D overlays | `--bg-glass` + 1 px inner highlight `rgba(255,255,255,.06)` | `--bg-glass` + border |

3D accents: KPI cards on the dashboard may use a subtle isometric illustration or a live mini-3D thumbnail (static render). Avoid skeuomorphism in data views.

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120 ms | Hover, press |
| `--dur-base` | 200 ms | Popovers, tabs |
| `--dur-slow` | 320 ms | Drawers, modals |
| `--ease-standard` | `cubic-bezier(.2,.0,.0,1)` | Most |
| Camera fly-to | 1.2–2.0 s, ease-in-out | Map/3D navigation |

`prefers-reduced-motion`: disable fly-to (jump cut), parallax and shimmer. Use opacity fades ≤ 120 ms.

## 7. Buttons

| Variant | Use | Style |
|---|---|---|
| Primary | One per view section | Amber fill, `--accent-contrast` text |
| Secondary | Alternatives | Surface fill, strong border |
| Ghost | Toolbars, tertiary | Transparent, hover tint |
| Destructive | Delete/abort | Danger fill (confirm modals) or danger text (menus) |
| Icon | Toolbars, map controls | 36 px square (44 px touch), tooltip required |
| Split | e.g. "Generate report ▾" | Primary + menu |

Sizes: S 28 px, M 36 px (default), L 44 px (touch/field). States: default, hover, active, focus-visible (2 px amber ring + 2 px offset), disabled (40% opacity + `aria-disabled` + tooltip reason), loading (spinner replaces icon; width fixed).

## 8. Inputs & Forms

- Text, number (with unit suffix, e.g. `m`, `m/s`, `%`), select, combobox (async search), multi-select chips, date/datetime (site timezone shown), date-range, toggle, checkbox, radio, slider (with numeric input), file dropzone, coordinate input (decimal/DMS toggle, paste detection), color, tags input, rich-text (comments: Markdown subset).
- Labels always visible (no placeholder-only). Helper text below. Errors inline with an icon. Error summary at the top for long forms, with links to fields.
- Validation timing: on blur, then on change after the first error. Server errors map to fields via `errors[].path`.
- Field widths reflect expected content (codes short, descriptions full).

## 9. Tables

- Sticky header. Resizable and reorderable columns (persisted per user). Column visibility menu.
- Row height 44 px (comfortable) / 32 px (compact). Zebra off. Hover tint. Selected row has an amber left border.
- Numeric columns right-aligned, tabular figures. Status columns use badges.
- Row actions: kebab menu on hover/focus. Bulk selection with a sticky action bar.
- Pagination: infinite scroll with a virtualized body for > 100 rows. "Showing N of ~M".
- Empty, loading (skeleton rows) and error states inside the table frame.

## 10. Cards, Modals, Drawers & Alerts

| Component | Specification |
|---|---|
| **KPI card** | Overline label, large mono value, delta chip (▲▼ with semantic color), sparkline (optional), "as of" timestamp tooltip |
| **Entity card** | Media/cover image 16:9, title, meta row, status badge, footer actions |
| **Drone card** | Isometric render or photo, name, model, status badge, battery bar, provider badge (`Simulated` if applicable) |
| **Modal** | Widths 480 / 640 / 880. Title, body, footer (secondary left of primary). Esc closes unless destructive-in-progress. Focus trapped. Return focus on close. |
| **Drawer** | Right side, 480 px (detail) or 720 px (editors). Used for entity quick views from lists/maps. Deep-linkable (`?drawer=finding:id`). |
| **Alert (inline)** | Info/success/warning/danger with icon, title, body, optional action |
| **Banner (page)** | Org-level states (read-only, suspended, trial ending, simulated mode) |
| **Toast** | Bottom-right (top-center on mobile). Info 5 s, warning 8 s, critical persistent. Max 3 stacked. |

## 11. Map Controls

| Control | Position | Behavior |
|---|---|---|
| Basemap switcher | Bottom-left | Thumbnails: **2D Streets**, **Satellite**, **Terrain**, **3D** (opens twin or tilts MapLibre terrain), **Digital Twin** (when models exist) |
| Layer manager | Left glass panel (collapsible) | Groups: Site, Operations, Captures (by date), Inspections, Annotations. Each row: visibility toggle, opacity slider, date selector (rasters), legend, ⋯ menu (zoom to, style, remove). Drag to reorder. |
| Zoom / compass / pitch | Bottom-right stack | +/−, compass (click resets north), tilt toggle |
| Locate / fit | Bottom-right | Fit to site boundary. Fit to selection. |
| Tools | Top-center floating toolbar | Select, Measure distance, Measure area, Elevation profile, Draw (point/line/polygon), Annotate, Compare (swipe). The active tool is highlighted. Esc exits. |
| Capture timeline | Bottom-center | See [UX §4.2](UX-Specification.md#42-capture-timeline) |
| Coordinates readout | Bottom bar | Cursor lat/lon (6 dp), elevation (if DSM), scale bar, CRS selector |
| Search | Top-left | Geocoder + entity search within the site |
| Legend | Collapsible inside the layer manager | Auto-generated from layer styles |

**Map symbology:**

| Feature | Style |
|---|---|
| Site boundary | 2 px `--data` line, 8% fill, dashed when inactive |
| No-fly zone | `--danger` hatched fill 20%, 2 px border |
| Geofence buffer | 1 px dashed `--warning` |
| Planned flight path | 2 px `--data` with chevrons for direction. Waypoints as numbered circles. |
| Flown track | 3 px gradient by altitude (Viridis) |
| Live drone | Heading-rotated aircraft icon with an accuracy halo. Pulsing ring when selected. Grey when stale. |
| Assets | Type icons in rounded squares, border colored by condition rating |
| Findings | Severity-colored pins with a severity icon. Clustered with a severity breakdown donut. |
| Survey areas | `--accent` 1.5 px outline, 6% fill |

## 12. 3D Controls (Digital Twin)

| Control | Behavior |
|---|---|
| Navigation | Left-drag orbit, right-drag pan, wheel/pinch zoom, Shift+drag tilt. Keyboard: arrows pan, `Q/E` rotate, `+/-` zoom. "Navigation help" overlay on first visit. |
| View cube / compass | Top-right. Click faces for Top/Front/Side. Click north to reset. |
| Home | Fly to the site extent |
| Model panel | Left glass panel: models grouped by capture date (mesh, BIM, point cloud, terrain), visibility, opacity, clipping (box/plane), point size for clouds |
| History slider | Bottom: capture dates. Play button animates through history. Split-compare toggle (left/right models). |
| Measure 3D | Distance (slope, horizontal, vertical components), height, area on surface |
| Identify | Click → highlight + side panel (asset/finding/BIM properties) |
| Quality | Auto / High / Balanced / Performance (sets max screen-space error, resolution scale, shadows). Shows FPS in debug mode. |
| Viewpoints | Save and share camera positions. Use in reports. |
| Fallback | If WebGL2 is unavailable or the device tier is low → banner "3D not supported on this device — showing 2D map" with a link to the 2D map |

## 13. Status Badges

Pill, 20 px high, 12/16 medium text, leading dot or icon. Variants: neutral, info, success, warning, danger, accent, simulated (striped), ai (gradient cyan→violet outline with a sparkle icon), beta.

| Domain | Status → variant |
|---|---|
| Mission | draft (neutral), planned (info), pending_approval (warning), approved/ready (accent), in_progress (success + pulsing dot), paused (warning), completed (success), aborted/failed (danger), cancelled (neutral) |
| Drone | available (success), in_mission (accent pulsing), maintenance (warning), offline (neutral), retired (neutral strikethrough) |
| Media | processing/scanning (info + spinner), ready (none), quarantined (danger), needs review (warning) |
| Inspection | draft, scheduled, in_progress, submitted, in_review, approved (success), rejected (danger), closed |
| Finding | open (danger outline), in_progress (warning), resolved (info), verified/closed (success), wont_fix (neutral) |
| Report | queued/generating (info), ready (accent), published (success), failed (danger) |
| Integration | connected (success), error (danger), disabled (neutral), integration required (accent outline) |

## 14. Charts

- Library: visx/Recharts with the shared theme. Thin gridlines (`--border-subtle`), mono tick labels, no 3D charts.
- Types: line/area (S-curves: planned dashed, actual solid amber), bar (findings by severity, stacked), donut (only ≤ 5 categories), heatmap (flights by weekday/hour), gauge (battery in HUD only).
- Every chart has a title, unit, accessible description (`aria-describedby`), a data table toggle and CSV export.
- Tooltips show exact values with units and dates.

## 15. Loading, Empty & Error States

| State | Pattern |
|---|---|
| **Initial loading** | Skeletons matching the final layout (cards, table rows, map placeholder with a subtle grid). No full-page spinners. |
| **Background refresh** | 2 px progress bar under the page header. Content stays interactive. |
| **Long jobs** | Job tray item with progress %, ETA, cancel. A toast on completion. |
| **Map loading** | Tiles fade in. "Loading imagery…" chip when > 1.5 s. |
| **3D loading** | Progress ring with tiles loaded / total. Low-res first (progressive LOD). |
| **Empty (first use)** | Illustration (isometric line art), one-sentence explanation, primary action, secondary "Learn more" |
| **Empty (filtered)** | "No results for these filters", "Clear filters" |
| **Empty (integration required)** | Provider logos, "Connect a provider to enable live video", Connect button (if permitted) or "Ask your admin" |
| **Error (recoverable)** | Inline alert: what happened, retry button, request ID (copy) |
| **Error (page)** | 404 "Not found or you don't have access" (deliberately ambiguous), 500 "Something went wrong" with request ID, status page link |
| **Offline** | Top banner. Disabled write actions with a tooltip. |
| **Stale live data** | HUD values dim + "Last update 12 s ago" |

## 16. Iconography & Imagery

- Icons: Lucide (outline, 1.5 px stroke) + a custom construction/drone set (drone quad, waypoint, orbit, corridor, crane, tower, stockpile, geofence) drawn on the same 24 px grid.
- Illustrations: isometric line art with amber/cyan accents. No stock photos inside the app.
- Marketing: real aerial imagery and 3D renders, with consent and rights cleared.

## 17. Accessibility Checklist (per component)

Keyboard operable. Visible focus. Roles and labels (Radix primitives). Color plus icon/text for status. Minimum 44×44 touch targets on touch devices. Reduced motion respected. Live regions for toasts and alerts. Tested with axe-core and screen readers.

## 18. Implementation

- Tokens defined once in `packages/ui/tokens/*.json` (Style Dictionary) → CSS variables + Tailwind preset + MapLibre/Cesium style constants.
- Components in `packages/ui` built on Radix primitives. Storybook with visual regression (Chromatic/Playwright snapshots) for all themes.
- Figma library mirrors token names 1:1. Design tokens are versioned with the package.
