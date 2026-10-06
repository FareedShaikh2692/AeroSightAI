# Screen & User Flow Document

| | |
|---|---|
| **Document** | Screen & User Flow Document |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-13 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Design |
| **Reviewer** | _Pending — Design Lead, Product Owner_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Design | Initial 14 core flows |

---

Flows use Mermaid flowcharts. Screen IDs (P#, A#, X#) refer to the [UX Specification](UX-Specification.md).

## F-01 Signup & onboarding (Owner)

```mermaid
flowchart TD
  A["P1 Landing"] -->|Start free trial| B["P8 Signup form"]
  B -->|submit| C{"Valid?"}
  C -->|no| B
  C -->|yes| D["Verify email screen"]
  D -->|6-digit code| E{"Code ok?"}
  E -->|no, attempts < 5| D
  E -->|yes| F["Onboarding 1: Org profile"]
  F --> G["Onboarding 2: Invite team"]
  G --> H["Onboarding 3: First project"]
  H --> I["Onboarding 4: First drone"]
  I --> J["A1 Dashboard + Getting started checklist"]
  G -. skip .-> H
  H -. skip .-> I
  I -. skip .-> J
```

**Exit criteria:** org `active`, user is Owner, trial subscription created, audit `org.created`, `member.joined`.

## F-02 Login with 2FA & org selection

```mermaid
flowchart TD
  A["P7 Login"] --> B{"Credentials valid?"}
  B -->|no| A1["Generic error; lockout after 10"] --> A
  B -->|yes| C{"2FA enabled?"}
  C -->|yes| D["2FA code / recovery code"] --> E{"valid?"}
  E -->|no| D
  C -->|no| F{"Org enforces 2FA?"}
  E -->|yes| G{"Member of >1 org?"}
  F -->|yes| F1["Forced 2FA enrollment"] --> G
  F -->|no| G
  G -->|yes| H["Org picker (last used preselected)"] --> I["A1 Dashboard"]
  G -->|no| I
```

## F-03 Invite member & accept

```mermaid
flowchart LR
  A["A20 Team"] --> B["Invite modal: emails, org role, project roles"]
  B --> C{"Seat & domain checks"}
  C -->|fail| B
  C -->|ok| D["Email sent; pending invitation row"]
  D --> E["Invitee opens /invite/token"]
  E --> F{"Has account?"}
  F -->|no| G["Set name + password"] --> H["Joined → Dashboard"]
  F -->|yes| I["Login"] --> H
```

## F-04 Create project → site → assets (PM)

```mermaid
flowchart TD
  A["A2 Projects"] -->|New project| B["Project form: code, name, type, dates, location"]
  B --> C["A3 Project Detail - Overview"]
  C -->|Sites tab → New site| D["Site form + map"]
  D --> E{"Boundary method"}
  E -->|Draw| F["Polygon tool"] --> G
  E -->|Import| F2["Upload KML/GeoJSON/SHP → preview"] --> G
  G{"Geometry valid?"} -->|no: show reason + highlight| E
  G -->|yes| H["Optional: no-fly zones, max altitude"]
  H --> I["A5 Site Detail - map shows boundary"]
  I -->|Assets tab| J["Add asset / Import CSV"]
  C -->|Team tab| K["Add members with project roles"]
  C -->|Milestones tab| L["Create / import milestones"]
```

## F-05 Plan, approve and fly a mission (PM → Pilot)

```mermaid
flowchart TD
  A["A10 Missions → New"] --> B["Select site + type + template"]
  B --> C["Draw area/path on map"]
  C --> D["Set parameters"]
  D --> E["Server generates waypoints + estimates"]
  E --> F{"Validation passes?"}
  F -->|no: geofence/altitude issues| C
  F -->|yes| G["Schedule window + assign drone & pilot"]
  G --> H{"Conflicts? license/registration?"}
  H -->|yes| G
  H -->|no| I{"Approval required?"}
  I -->|yes| J["Submit → Approver notified"] --> K{"Approve?"}
  K -->|reject + comment| C
  K -->|approve| L["Ready"]
  I -->|no| L
  L --> M["Pilot: A12 Mission Detail → Pre-flight checklist"]
  M --> N["Confirm pilot-in-command → Start"]
  N --> O["In progress: live telemetry in A7"]
  O --> P{"Outcome"}
  P -->|Complete| Q["Completed + flight summary"]
  P -->|Abort + reason| R["Aborted + notifications"]
  Q --> S["Upload media → auto-link to mission"]
```

**Simulated variant:** for simulator drones, steps N–O stream simulated telemetry and all screens show the `Simulated` label.

## F-06 Upload media batch (Pilot)

```mermaid
flowchart TD
  A["Drop folder on A15 Media / Mission Detail"] --> B["Client reads EXIF in Web Worker"]
  B --> C["Suggest project/site/mission from GPS + time"]
  C --> D["Confirm target"] --> E["POST /media/uploads"]
  E --> F["Parallel multipart upload with progress"]
  F -->|network lost| F1["Pause; auto-resume when online"] --> F
  F --> G["Complete → scanning"]
  G --> H{"Clean?"}
  H -->|no| H1["Quarantined; uploader + admin notified"]
  H -->|yes| I["Processing thumbnails/previews/HLS"]
  I --> J{"Auto-link matched?"}
  J -->|yes| K["Ready, linked"]
  J -->|no| L["Ready, 'Needs review' queue"]
```

## F-07 Live operations monitoring (Site Manager)

```mermaid
flowchart LR
  A["Top bar 'Live' pill"] --> B["A7 Live Operations"]
  B --> C["Select active mission"]
  C --> D["HUD + trail + planned path"]
  D --> E{"Alert?"}
  E -->|battery/geofence/signal| F["Toast + alert feed + map highlight"]
  F --> G["Contact pilot / Abort (if permitted)"]
  D --> H{"Live video available?"}
  H -->|yes| I["Open video panel (WebRTC → LL-HLS fallback)"]
  H -->|no| J["Panel shows 'Connect provider' or 'Stream offline'"]
```

## F-08 Upload & publish a survey (Surveyor)

```mermaid
flowchart TD
  A["A13 Surveys → New"] --> B["Site, type, date, CRS, target GSD"]
  B --> C["Draw survey areas"]
  C --> D{"Have processed outputs?"}
  D -->|yes| E["Upload GeoTIFF/LAS/3D Tiles"] --> F["Server converts to COG/3D Tiles"]
  D -->|no| G{"Processing integration connected?"}
  G -->|no| G1["Integration Required empty state → Integrations"]
  G -->|yes| H["Process raw images → job status"] --> F
  F --> I["QA: GCP RMSE etc."]
  I --> J["Publish → layers visible in A14 Maps for project"]
```

## F-09 Compare progress between dates (PM)

```mermaid
flowchart LR
  A["A17 Progress or A5 Site"] --> B["Compare"]
  B --> C["Pick date A and date B from capture list"]
  C --> D{"Mode"}
  D -->|Swipe| E["Orthomosaic swipe"]
  D -->|Side by side| F["Synced maps / co-located photos"]
  E --> G["Add to report / Record progress / Request AI analysis"]
  F --> G
```

## F-10 AI progress analysis & review (PM, Phase 2)

```mermaid
flowchart TD
  A["Capture processed"] --> B["Analyze progress"]
  B --> C["Job queued → running (job tray)"]
  C --> D{"Completed?"}
  D -->|failed| D1["Error + retry; official progress unchanged"]
  D -->|yes| E["Review screen: proposals per milestone, overlays, confidence"]
  E --> F{"Per proposal"}
  F -->|Accept| G["Approved progress record source=ai"]
  F -->|Edit| H["Adjust % / notes"] --> G
  F -->|Reject + reason| I["Feedback stored"]
```

## F-11 Inspection lifecycle (Inspector → Engineer, Phase 2)

```mermaid
flowchart TD
  A["Scheduled inspection assigned"] --> B["Start"]
  B --> C["Checklist items"]
  C --> D{"Defect?"}
  D -->|yes| E["Add finding: severity, asset, annotated photo, assignee"] --> C
  D -->|no| C
  C --> F["Submit"]
  F --> G{"All required answered?"}
  G -->|no| C
  G -->|yes| H["Engineer review"]
  H -->|Reject + comment| C
  H -->|Approve| I["Approved, locked"]
  I --> J["Findings remediated → resolved → verified"]
  J --> K["Close inspection"]
```

## F-12 Generate and share a report (PM)

```mermaid
flowchart TD
  A["A18 Reports → Generate"] --> B["1 Type & template"]
  B --> C["2 Scope & period"]
  C --> D["3 Sections & options"]
  D --> E["4 Review → Generate"]
  E --> F["Queued → generating (job tray)"]
  F --> G{"Ready?"}
  G -->|failed| G1["Retry"]
  G -->|yes| H["Report detail: preview"]
  H --> I["Publish to Viewers"]
  H --> J["Create external link: expiry, passcode"]
  H --> K["Download"]
```

## F-13 Client viewer journey

```mermaid
flowchart LR
  A["Invitation as Viewer"] --> B["A1 Dashboard (shared projects)"]
  B --> C["A3 Project Overview (read-only)"]
  C --> D["Published reports"]
  C --> E["Shared media & published maps"]
  D --> F["Download (audited)"]
```

## F-14 Platform admin suspends an organization

```mermaid
flowchart LR
  A["X1 Organizations"] --> B["Org detail"]
  B --> C["Suspend → reason modal"]
  C --> D["Org status suspended; sessions revoked; owner emailed"]
  D --> E["Tenant users see suspension page"]
  B --> F["Reactivate → reason"] --> G["Access restored"]
```

## Error & edge flows (cross-cutting)

| Situation | Flow |
|---|---|
| Session expired during work | Silent refresh. If the refresh fails → modal "Session expired" → login → return to the same URL with form drafts restored (IndexedDB). |
| Permission revoked mid-session | Next API call returns 403/404 → toast "Your access changed" → the UI refetches `/me/permissions` and navigates to the nearest accessible page. |
| Org switched in another tab | BroadcastChannel event → other tabs show "Organization changed" with reload. |
| Offline | Banner "You're offline". Reads come from cache. Writes are queued only for checklist items and comments. Other actions are disabled. |
| Plan limit reached | Inline upsell card with the specific limit and "Contact owner" for non-billing users. |
