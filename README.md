# AeroSight AI

**Drone-Powered Construction Intelligence Platform** — *See Every Site. Track Every Progress. Build Smarter.*

This repository contains:

- **`docs/`** — the full product, architecture, security, QA and operations documentation package (45 documents). Start at [docs/README.md](docs/README.md).
- **`src/`** — the **Phase 1 demo build**: a Next.js application that implements the core of the MVP with real server-side rules (tenant isolation, RBAC, mission validation, progress calculation, audit hash chain) on a seeded in-memory dataset.

> **Demo build — read this first.** Data lives in memory, is seeded on start-up, and resets whenever the server restarts (on Vercel, when a function instance is recycled). Drone telemetry is **simulated**. There is no object storage, email, payment provider, AI service or real drone provider connected. Every simulated or integration-dependent capability is labelled in the UI. See [Implementation status](#implementation-status).

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000 and choose a demo account on the sign-in page. All demo accounts share the password shown there (defined in `src/lib/seed.ts`).

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm test` | Domain tests (geometry, mission validation, progress maths, RBAC matrix, tenant isolation, audit chain, password policy) |
| `npm run typecheck` | TypeScript strict check |

### Environment

| Variable | Required | Description |
|---|---|---|
| `AUTH_SECRET` | Yes in production | ≥ 32-character secret used to sign session cookies and encrypt stored secrets. If missing, an insecure built-in fallback is used. |
| `ANTHROPIC_API_KEY` | Optional | Enables Claude for AI analysis, report summaries and the assistant. Without it, AI runs in a labelled heuristic mode and the assistant is off. |
| `AI_MODEL` | Optional | Claude model (default `claude-opus-5-5`). |
| `CRON_SECRET` | For the daily job | Protects `/api/cron/daily` (overdue-finding reminders, retention). |

## Demo data

Two organizations with identical structure, so tenant isolation can be checked side by side:

| Organization | Region | Projects |
|---|---|---|
| Atlas Construction | Dubai (me-central-1) | Marina Tower B · Al Khail Interchange Upgrade · Jebel Ali Logistics Hub |
| Borealis Infra | Munich (eu-central-1) | Isar Bridge Rehabilitation · Garching Data Center · A8 Noise Barrier |

Each has one user per role (Owner, Admin, Project Manager, Site Manager, Drone Pilot, Surveyor, Inspector, Engineer, Viewer), plus a platform admin account for the admin console.

**Try this:**
1. Sign in as the Atlas **Project Manager** → Dashboard, Projects, Progress (S-curve, record and approve progress), Reports (generate, then print to PDF).
2. Sign in as the Atlas **Drone Pilot** → Missions → open a *ready* mission → complete the checklist → **Start mission** → watch simulated live telemetry.
3. Open **Live Operations** to see the active simulated flights.
4. Plan a mission (**Missions → New mission**) and watch the server reject waypoints in the crane no-fly zone or above the altitude limit.
5. Sign in as the Atlas **Inspector** → approve your own inspection (refused), then as the **Engineer** → approve it.
6. Sign in as the Atlas **Viewer** → only shared media and published reports are visible.
7. **Phase 2:** AI Insights → *Analyze progress* → accept/edit/reject proposals; Settings → set up 2FA; Integrations → API keys / webhooks / Slack; Maps → *3D terrain* → *Profile* / *Volume*; Inspections → *Templates* / *Schedule inspection*; Admin console → *Break-glass access*.

## Architecture of the demo build

```text
src/
├── app/
│   ├── (marketing)/     Landing, Features, Industries, Pricing, About, Contact
│   ├── (auth)/          Sign in, Sign up, server actions (scrypt hashing, lockout, signed session cookie)
│   ├── app/             Tenant application (dashboard, projects, sites, maps, 3D, live ops, missions,
│   │                    fleet, media, surveys, inspections, progress, reports, analytics, team, roles,
│   │                    integrations, billing, audit, settings, notifications)
│   ├── admin/           Platform admin console (tenant metadata only)
│   └── api/v1/          REST API (problem+json errors, pagination) + SSE telemetry stream
├── components/          Design-system primitives, MapLibre map, live telemetry HUD, S-curve chart
├── lib/
│   ├── permissions.ts   Permission catalog + role matrix (mirrors docs/07-Security/RBAC.md)
│   ├── policy.ts        PolicyEngine: tenant guard → RBAC → project membership → resource rules
│   ├── repo.ts          Tenant-scoped repository (every read and write goes through here)
│   ├── store.ts         In-memory store + per-organization SHA-256 audit hash chain
│   ├── seed.ts          Deterministic two-tenant dataset
│   ├── geo.ts           Geodesic maths, polygon validation, waypoint generation
│   ├── mission.ts       Mission state machine and plan validation
│   ├── progress.ts      ProgressCalculator (weighted milestones, planned/actual/SV, forecast)
│   └── simulator.ts     Drone Simulator adapter (deterministic telemetry + alerts)
└── middleware.ts        Gates /app and /admin
tests/                   node:test suites (run with tsx)
```

How it differs from the production architecture in `docs/04-Architecture`:

| Production design | Demo build |
|---|---|
| PostgreSQL + PostGIS with row-level security | In-memory store behind the same repository/policy boundary |
| WebSocket realtime gateway + Redis Streams | Server-Sent Events from a serverless route |
| argon2id password hashing | scrypt (Node built-in, no native addon) |
| Object storage + processing workers (media, video, COG) | Synthetic SVG previews of seeded media; uploads disabled |
| Email invitations, 2FA enrollment, SSO | Not implemented (specified in docs) |
| PDF rendering worker | Print-optimised report page (browser "Save as PDF") |

## Implementation status

The full register lives in [docs/13-Product/MVP.md §4](docs/13-Product/MVP.md#4-implementation-status-register).

| Capability | Status in this build |
|---|---|
| Multi-tenant isolation, RBAC (9 roles × 75 permissions), audit hash chain | Prototype (in-memory) |
| Projects, sites (draw boundary, geometry validation), assets | Prototype |
| Maps (2D / satellite / terrain, layers, distance and area measurement) | Prototype |
| Mission planning (grid/orbit, server validation), approval, checklist, lifecycle, KML/GeoJSON export | Prototype |
| Live telemetry & Live Operations | **Simulated** |
| Progress (weighted milestones, approvals, S-curve, forecast) | Prototype |
| Inspections (checklist, findings, no self-approval, finding lifecycle) | Prototype |
| Reports (generate, publish, print to PDF) | Prototype |
| 3D twin | Prototype (extruded assets over terrain) |
| **Phase 2:** TOTP 2FA (QR, recovery codes, org enforcement) | Prototype |
| **Phase 2:** Notification preferences, Slack/Teams routing, dedupe, digest, daily cron | Prototype |
| **Phase 2:** Signed webhooks + delivery log, scoped API keys, SSRF protection | Prototype |
| **Phase 2:** AI progress analysis + review queue, AI report summary, AI assistant | Prototype (Claude when `ANTHROPIC_API_KEY` is set, heuristic otherwise) |
| **Phase 2:** Inspection templates (versioned) and scheduling | Prototype |
| **Phase 2:** 3D terrain, elevation profiles, cut/fill volumes (public DEM) | Prototype |
| **Phase 2:** Retention policies, legal holds, personal & organization exports, break-glass | Prototype |
| **Phase 2:** DJI Cloud live telemetry & video, NodeODM processing | Integration Required (connectors + connection tests built; need your provider accounts) |
| AI change/defect detection from imagery, media upload, billing, SSO | Planned / Integration Required |

## Deployment

The app deploys to Vercel as a standard Next.js project (no extra configuration). Set `AUTH_SECRET` in the project's environment variables.

## License

Proprietary — all rights reserved.
