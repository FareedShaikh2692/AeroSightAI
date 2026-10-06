# User Manual

| | |
|---|---|
| **Document** | User Manual |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-45b |
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

> What you can see and do depends on your role. If a button is greyed out, hover over it to see which permission it needs, and ask your administrator.

## 1. Signing In

1. Go to `app.aerosight.ai` and sign in with your email and password.
2. If 2FA is on, enter the 6-digit code from your authenticator app (or a recovery code).
3. If you belong to more than one organization, pick one. You can switch later from the top-left organization menu.

**Set up 2FA:** Settings → Profile → Security → **Enable 2FA** → scan the QR code → enter a code → **save your recovery codes** somewhere safe.

## 2. Finding Your Way Around

- **Left menu:** Dashboard, Analytics, Projects, Sites, Maps, 3D Twin, Live Operations, Missions, Drone Fleet, Media, Surveys, Inspections, Progress, Reports, and organization pages.
- **Search (⌘K / Ctrl+K):** jump to any project, site, asset, mission, file or report.
- **Bell:** your notifications. **Job tray** (bottom right): uploads, reports and analyses in progress.
- **Labels you may see:** `Simulated` (practice/demo data, not a real flight), `Beta` (new feature — check results), `AI-assisted` (suggested by AI — a person must review it).

## 3. Projects & Sites

- **Projects** list your projects. Open one to see its overview: sites map, progress, recent captures and activity.
- **Create a project** (Project Managers): Projects → **New project** → fill in code, name, type, dates and location.
- **Create a site:** Project → Sites → **New site** → name and code → draw the boundary on the map (click points, double-click to finish) or **Import** a KML/GeoJSON/Shapefile. Add no-fly zones if needed.
- **Assets:** Site → Assets → **Add asset** (or import a CSV). Place it on the map and give it a unique tag.
- **Timeline:** the slider at the bottom of a site shows every capture date. Drag it to see the site at that time.

## 4. Maps

- Switch the background with the **basemap** button (bottom left): Streets, Satellite, Terrain, 3D.
- Turn layers on or off in the **layers** panel (left): boundaries, assets, flight paths, survey areas, findings, orthomosaics by date.
- **Tools** (top): measure distance or area, elevation profile, draw, annotate, and **Compare** (swipe between two dates).
- Share what you see: copy the browser URL — it keeps the position, layers and date.

## 5. Drones & Missions

### 5.1 For project and site managers — plan a mission
1. Missions → **New mission** → choose the site, mission type and template (grid survey, orbit, corridor, waypoints).
2. Draw the area or path on the map. Set altitude, speed, overlap and camera angle.
3. Check the **estimates** (time, distance, photos, image resolution, batteries) and fix any **validation** issues (shown in red on the map: outside the boundary, in a no-fly zone, too high).
4. Schedule it and assign a drone and a pilot. Submit for approval if your project requires it.
5. Optional: make it **recurring** (e.g. every Thursday) for consistent progress captures.

### 5.2 For pilots — fly a mission
1. **Missions → My missions** lists today's and upcoming flights. Subscribe to the calendar feed if you like.
2. Open the mission → complete the **pre-flight checklist** → confirm you are the pilot in command → **Start**.
3. Fly using your drone's own app or controller. AeroSight tracks the mission and, when connected, shows live telemetry. You can export the plan as KMZ/WPML for your flight app.
4. When done, press **Complete** (or **Abort** with a reason).
5. **Upload media:** drag the folder from your SD card onto the mission. Files are matched to the mission automatically using their time and GPS.

> AeroSight never flies your drone by itself. You stay in control and responsible for the flight.

### 5.3 Live Operations
Shows every active flight you're allowed to see: position, altitude, speed, battery, GPS and signal, the planned path and the flown trail. Alerts appear for low battery, leaving the site boundary or losing signal. Live video **(Phase 2)** opens in a panel when your drone provider supports it.

## 6. Media

- **Upload:** drag files anywhere on the Media page. Large uploads continue in the background and resume after a connection drop.
- **Views:** Grid, List, Map and Timeline. Filter by date, site, mission, type, tag or asset.
- **Open a file** to zoom, see its location and camera details, add tags, **Compare** with another file, or **Create finding** (Phase 2).
- **Share with clients:** select files → **Share with viewers**. Viewers only see files you share.
- **Delete:** files go to **Trash** for 30 days and can be restored.

## 7. Surveys

Surveyors: Surveys → **New survey** → choose the site, type, date and coordinate system → draw survey areas → **Upload outputs** (orthomosaic GeoTIFF, elevation models, point clouds, 3D models). AeroSight converts them for fast viewing. Enter accuracy data (GCPs, RMSE) and **Publish** to make layers visible to the project. Processing raw images inside AeroSight requires a connected processing integration **(Phase 2)**.

## 8. Progress

1. **Milestones** (Project Managers): Project → Milestones → add items with planned dates and a weight (importance), or import from a CSV export of your schedule.
2. **Record progress:** Progress → **Record progress** → choose the milestone → set % complete and date → attach photos as evidence.
3. Your record may need **approval** depending on your project's settings.
4. The **Progress** page shows actual vs. planned (S-curve), schedule variance (On track / At risk / Delayed) and the forecast completion date.
5. **Compare** two capture dates to see what changed.
6. **AI progress analysis (Phase 2, Beta):** request an analysis on a new capture. Review each proposal and accept, edit or reject it. Nothing changes until you accept.

## 9. Inspections **(Phase 2)**

1. **Inspections → My inspections** → open a scheduled inspection → **Start**.
2. Answer each checklist item. Items with a camera icon need a photo.
3. Found a problem? **Add finding** → severity, category, asset → mark the photo (box, arrow, text) → assign someone.
4. **Submit** when all required items are done. An engineer will approve it or send it back with comments.
5. People assigned to findings fix them, add after-photos and mark them **Resolved**. The inspector verifies and closes them.

## 10. Reports

1. Reports → **Generate** → choose the report type and template → scope and period → pick sections → **Generate**.
2. You'll be notified when it's ready (usually within 2 minutes).
3. Review the PDF, then **Publish** to share with project viewers, or create an **external link** (with expiry and optional passcode).
4. Regenerating creates a new version. Earlier versions are kept.

## 11. AI Assistant **(Phase 2, Beta)**

Press ⌘J (Ctrl+J) and ask questions like "Which sites have open critical findings?" or "Summarize progress on Tower B this month." The assistant only uses data you're allowed to see and links its sources. Always check important answers.

## 12. Notifications

The bell shows notifications about assignments, approvals, alerts, reports and mentions. Critical alerts stay on screen until dismissed. **Phase 2:** choose which notifications you get by email in Settings → Notifications.

## 13. For Client Viewers

You see the projects you've been invited to: dashboard, map, shared photos and videos, published maps and **published reports**. You can download reports. Everything else is managed by the project team.

## 14. Tips for Field Use (tablets)

- Use the **Sunlight** theme (Settings → Profile → Appearance) outdoors.
- Checklists and comments save as drafts automatically and sync when you're back online.
- Upload large media from the office when site connectivity is poor.

## 15. Getting Help

Help menu (?) → documentation, keyboard shortcuts, contact support. When you report a problem, include the **request ID** shown in the error message.
