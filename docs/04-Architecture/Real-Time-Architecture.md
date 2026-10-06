# Real-Time Telemetry Architecture

| | |
|---|---|
| **Document** | Real-Time Telemetry Architecture |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-15 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Architecture |
| **Reviewer** | _Pending — Tech Lead, SRE Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Architecture | Initial draft |

---

## 1. Scope

This document covers live drone telemetry, plus the shared realtime channel used for notifications, job progress and presence. Requirements: TELEM-001 – TELEM-012, TENANT-006, NFR-PERF-004.

## 2. Pipeline

```text
Provider / Simulator / Edge bridge
        │ raw messages (1–10 Hz per drone)
        ▼
Drone Integration Service
  ├─ adapter.normalizeTelemetry(raw)      → CanonicalTelemetry
  ├─ TelemetryValidator                   → reject + metric on failure
  ├─ enrich: organizationId, missionId (from active mission binding), seq (per drone, monotonic)
  └─ XADD tlm:{shard} MAXLEN ~ 100000 *  (shard = hash(droneId) % 16)
        │
        ├──► Consumer group "fanout"   → throttle to client rate (default 2 Hz) →
        │        PUBLISH rt:{orgId}:mission:{missionId}:telemetry  and  rt:{orgId}:liveops
        │        SET  last:{orgId}:{droneId}  (latest state, TTL 60 s, used for initial snapshot)
        ├──► Consumer group "persist"  → batch (500 rows or 1 s) → COPY into telemetry hypertable
        └──► Consumer group "alerts"   → AlertEvaluator (stateful per drone) → domain_events
                                                                     → notifications + WS alert messages
Realtime Gateway (N replicas)
  ├─ PSUBSCRIBE rt:*  (filtered locally by active subscriptions)
  └─ push to sockets subscribed to the channel
```

Each consumer group acknowledges messages (`XACK`) after processing. Pending messages older than 30 s are re-claimed (`XAUTOCLAIM`) by healthy consumers.

## 3. Canonical Telemetry Schema

| Field | Type | Unit / range | Required | Notes |
|---|---|---|---|---|
| `droneId` | uuid | — | ✓ | AeroSight drone ID |
| `missionId` | uuid \| null | — | | Null when flying outside a mission |
| `organizationId` | uuid | — | ✓ | Server-enriched. Never trusted from the provider. |
| `seq` | int64 | monotonic per drone | ✓ | Server-assigned |
| `timestamp` | ISO-8601 UTC | — | ✓ | Device time if trustworthy, else receive time. `receivedAt` is also kept. |
| `latitude` | float64 | −90…90 ° | ✓ | WGS 84 |
| `longitude` | float64 | −180…180 ° | ✓ | WGS 84 |
| `altitude` | float32 | m, AMSL (ellipsoidal if provider gives it) | ✓ | |
| `relativeAltitude` | float32 | m above takeoff | | Used for AGL display when no DTM |
| `speed` | float32 | m/s, 0…60 | ✓ | Horizontal ground speed |
| `verticalSpeed` | float32 | m/s, −30…30 | | |
| `heading` | float32 | 0…360 ° (true north) | ✓ | |
| `battery` | float32 | 0…100 % | ✓ | Primary battery |
| `batteryVoltage` | float32 | V | | |
| `gpsSignal` | enum | `none, weak, fair, good, rtk_float, rtk_fixed` | ✓ | |
| `satellites` | int | 0…64 | ✓ | |
| `signalStrength` | float32 | 0…100 % (link quality) | | |
| `flightTime` | int | seconds since takeoff | ✓ | |
| `flightMode` | string | provider mode mapped to `manual, gps, waypoint, rth, landing, hover, unknown` | | |
| `gimbal` | object | `{pitch, yaw, roll}` ° | | |
| `simulated` | boolean | — | ✓ | `true` for the Simulator adapter |

Example message delivered to clients:

```json
{
  "type": "telemetry",
  "channel": "org:0192…:mission:0192…:telemetry",
  "seq": 18234,
  "data": {
    "droneId": "0192a1c4-…", "missionId": "0192a1d0-…",
    "timestamp": "2026-10-06T07:12:31.400Z",
    "latitude": 25.204849, "longitude": 55.270783,
    "altitude": 92.4, "relativeAltitude": 80.1,
    "speed": 8.2, "verticalSpeed": 0.1, "heading": 274.5,
    "battery": 63, "gpsSignal": "good", "satellites": 19,
    "signalStrength": 88, "flightTime": 612, "flightMode": "waypoint",
    "simulated": true
  }
}
```

### 3.1 Validation rules (TELEM-002)

| Rule | Action on failure |
|---|---|
| Schema (zod) and numeric ranges above | Reject, `telemetry_invalid_total{reason}` |
| `timestamp` not older than 5 min and not > 5 s in the future (vs. server clock) | Reject (stale) or clamp to `receivedAt` (future skew) |
| Duplicate / out-of-order (`timestamp ≤ last timestamp` for the drone) | Drop for fan-out. Persist only if within a 2 s reorder window. |
| Implied speed between consecutive points > 100 m/s | Flag `suspect=true`, exclude from the alert geofence check, keep for forensics |
| Drone belongs to the integration connection's org | Reject + security alert on mismatch |
| Mission binding: the drone's active mission must be `in_progress` | `missionId=null` if no active mission |

## 4. WebSocket Protocol

### 4.1 Connection lifecycle

```text
1. Client  → POST /api/v1/realtime/ticket            (Bearer access token)
   Server  ← { ticket, expiresAt (30 s), url }
2. Client  → WSS  wss://rt.aerosight.ai/v1?ticket=…   (subprotocol "aerosight.v1")
3. Server validates ticket (single-use, Redis GETDEL), binds {userId, orgId, sessionId}
   Server  ← { "type":"welcome", "connectionId":"…", "heartbeatSec":15, "serverTime":"…" }
4. Client  → { "type":"subscribe", "id":"c1", "channel":"org:{orgId}:mission:{id}:telemetry", "resumeFrom": 18200 }
   Server  ← { "type":"subscribed", "id":"c1", "snapshot": {…latest…}, "replayed": 34 }   (or "error")
5. Server  ← { "type":"telemetry", … }  /  { "type":"alert", … }  /  { "type":"notification", … }
6. Heartbeat: server sends {"type":"ping","t":…} every 15 s; client replies {"type":"pong","t":…}
   No pong in 45 s → server closes 4408. No server message in 45 s → client reconnects.
7. Client  → { "type":"unsubscribe", "channel": … }
8. Close codes: 1000 normal, 4401 auth failed/expired, 4403 forbidden channel, 4408 heartbeat timeout,
   4429 rate limited, 4500 server error, 4001 session revoked.
```

### 4.2 Channels

| Channel | Payload types | Authorization |
|---|---|---|
| `org:{orgId}:mission:{missionId}:telemetry` | telemetry, alert, mission_state | `telemetry:read` on the mission's project |
| `org:{orgId}:liveops` | compact position updates (1 Hz) of all active missions **the user can access** (filtered server-side per socket) | `telemetry:read` on ≥ 1 project |
| `org:{orgId}:drone:{droneId}:status` | status | `drone:read` |
| `user:{userId}:notifications` | notification, unread_count | Self only |
| `org:{orgId}:jobs:{jobId}` | job_progress (uploads, reports, AI) | Requester or `*:read` on the entity |

### 4.3 Authentication and authorization
- Tickets avoid long-lived tokens in URLs and logs. Tickets are single-use and expire in 30 s.
- On access token expiry the connection stays valid until the **session** is revoked. Session revocation (`session.revoked`) and permission changes (`permissions.changed`) are broadcast. The gateway then closes (4001) or re-authorizes subscriptions.
- Per-connection limits: 50 subscriptions, 20 client messages/s (excess → 4429).

### 4.4 Reconnection
- Client backoff: `min(30 s, 0.5 s × 2^attempt) ± 30% jitter`. Reset after 60 s stable.
- On reconnect: new ticket → resubscribe with `resumeFrom = lastSeq`. The gateway replays from the Redis Stream (up to 60 s or 600 messages), otherwise it sends a snapshot plus `gap: true`. The UI fills the trail gap from `GET /missions/:id/telemetry`.
- The UI connection indicator shows **Live** (green), **Reconnecting** (amber, with countdown), **Offline** (red, after 3 failed attempts or `navigator.onLine === false`).

### 4.5 Error handling

| Situation | Behavior |
|---|---|
| Invalid client message | `{"type":"error","code":"BAD_MESSAGE"}`; connection kept |
| Forbidden subscribe | `{"type":"error","id":…,"code":"FORBIDDEN"}`; repeated (≥ 5) → close 4403 |
| Gateway overload | Shed lowest-priority channels (liveops) first; send `{"type":"degraded"}` |
| Stream lag > 5 s | Fan-out downsampling to 1 Hz; UI shows a "Delayed" chip |
| Provider disconnected | `alert: signal_lost` after 10 s; drone marker turns grey; last-known position kept |

## 5. Alert Evaluation (TELEM-006)

| Alert | Condition | Severity | Hysteresis |
|---|---|---|---|
| `battery_low` | battery ≤ 30% | warning | Clears at ≥ 33% |
| `battery_critical` | battery ≤ 20% | critical | — |
| `geofence_breach` | Position outside site boundary + buffer, or inside a no-fly zone (PostGIS prepared geometry cached in memory per mission) | critical | Requires 2 consecutive points outside |
| `altitude_exceeded` | relativeAltitude > max altitude | warning | 2 consecutive points |
| `signal_lost` | No message for 10 s while the mission is in progress | warning | Clears on the next message |
| `gps_degraded` | satellites < 6 or gpsSignal ∈ {none, weak} | warning | 5 s |

Alerts are written to `mission_events`, emitted as domain events (→ notifications) and pushed on the mission channel.

## 6. Storage

- `telemetry` hypertable (chunk = 1 day, compressed after 7 days, segment by `drone_id`). Continuous aggregates `telemetry_1s`, `telemetry_1m`.
- Retention: full-rate 30 days, 1 s aggregate 365 days (default, configurable — TELEM-012).
- Replay API: `GET /missions/:id/telemetry?from&to&resolution=raw|1s|5s|1m` (max 10,000 points per response, cursor pagination).

## 7. Capacity Plan

| Metric | Per realtime pod (2 vCPU, 4 GB) | Per ingest pod |
|---|---|---|
| WS connections | 5,000 | — |
| Outbound messages | 20,000 msg/s | — |
| Ingest | — | 2,000 msg/s |

Autoscale on `ws_connections` (target 3,500/pod) and stream lag (target < 1 s).

## 8. Observability

Metrics: `telemetry_ingest_total{provider}`, `telemetry_invalid_total{reason}`, `telemetry_e2e_latency_seconds` (histogram; client echoes the server timestamp on a 1% sample), `stream_lag_seconds{group}`, `ws_connections`, `ws_messages_out_total`, `ws_close_total{code}`. Synthetic probe: a simulator drone in a dedicated `__synthetic` org runs continuously in each environment and alerts if p95 latency > 1 s for 5 min.
