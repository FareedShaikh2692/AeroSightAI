# Drone Integration Architecture

| | |
|---|---|
| **Document** | Drone Integration Architecture |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-14 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Architecture |
| **Reviewer** | _Pending — Tech Lead, Security Engineer, Flight Ops SME_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Architecture | Initial draft |

---

## 1. Goals and Non-Goals

**Goals**
- Keep AeroSight **independent of any single drone manufacturer** (BR-05, ADR-004).
- Add a new provider by writing one adapter, with no changes to the core domain.
- Normalize telemetry, mission plans, status and media into canonical models.
- Contain provider failures (circuit breakers, bulkheads).
- Be safe by default: no flight control unless it is explicitly verified.

**Non-goals (MVP)**
- Autonomous flight control from the cloud.
- Real-time collision avoidance or detect-and-avoid (DAA). That belongs to the aircraft and pilot.
- Regulatory filing (LAANC, UTM/U-space) — Future Scope.

## 2. Layered Architecture

```text
┌────────────────────────────── AeroSight AI ──────────────────────────────┐
│ Core API: FleetService · MissionService · MediaService                    │
│        │ (commands via internal API / events)          ▲ (normalized events)
│        ▼                                                │
│ ┌──────────────────── Drone Integration Layer (service) ──────────────────┐ │
│ │ AdapterRegistry · CapabilityResolver · CredentialBroker                 │ │
│ │ CommandDispatcher (idempotent, audited) · TelemetryIngestor             │ │
│ │ MissionTranslator (canonical ⇄ provider: WPML/KMZ, MAVLink mission)     │ │
│ │ MediaSyncer · HealthMonitor · CircuitBreakers (per provider/connection) │ │
│ │ ┌──────────────┬────────────────┬──────────────┬──────────────────────┐ │ │
│ │ │ Simulator    │ Manual/Upload  │ DJI Cloud API│ MAVLink Edge Bridge  │ │ │
│ │ │ Adapter      │ Adapter        │ Adapter      │ Adapter (MAVSDK)     │ │ │
│ │ │ (Simulated)  │ (Implemented)  │ (Integration │ (Integration         │ │ │
│ │ │              │                │  Required)   │  Required)           │ │ │
│ │ └──────────────┴────────────────┴──────┬───────┴──────────┬───────────┘ │ │
│ └────────────────────────────────────────┼──────────────────┼─────────────┘ │
└──────────────────────────────────────────┼──────────────────┼───────────────┘
                                           ▼                  ▼
                              Provider cloud / fleet API   Customer edge device
                              (HTTPS, MQTT, WebSocket)     (companion computer / GCS)
                                           ▼                  ▼
                                         Drone              Drone (PX4/ArduPilot)
```

## 3. Adapter Contract

Defined in `packages/drone-sdk`.

```ts
export type Capability =
  | 'fleetDiscovery'   // list aircraft on the provider account
  | 'telemetry'        // live telemetry stream
  | 'liveVideo'        // live video stream to the streaming gateway
  | 'missionUpload'    // push a waypoint mission to the aircraft/app
  | 'missionControl'   // start/pause/resume/RTH commands (VERIFIED adapters only)
  | 'mediaSync'        // pull captured media after flight
  | 'flightLogs'       // retrieve flight logs
  | 'healthStatus';    // battery/firmware/maintenance data

export interface DroneProviderAdapter {
  readonly key: string;                       // 'simulator' | 'manual' | 'dji_cloud' | 'mavlink_bridge' | ...
  readonly displayName: string;
  readonly version: string;
  capabilities(conn: ProviderConnection): Promise<Set<Capability>>;

  // connection
  testConnection(conn: ProviderConnection): Promise<HealthResult>;

  // fleet
  listAircraft?(conn: ProviderConnection): Promise<ProviderAircraft[]>;
  getStatus?(conn: ProviderConnection, providerDroneId: string): Promise<CanonicalDroneStatus>;

  // missions
  uploadMission?(conn: ProviderConnection, plan: CanonicalMissionPlan): Promise<{ providerMissionId: string }>;
  sendCommand?(conn: ProviderConnection, cmd: MissionCommand): Promise<CommandAck>; // start|pause|resume|rth|abort

  // telemetry & video
  subscribeTelemetry?(conn: ProviderConnection, providerDroneId: string,
                      sink: (raw: unknown) => void): Promise<Unsubscribe>;
  normalizeTelemetry(raw: unknown, ctx: NormalizeContext): CanonicalTelemetry | ValidationFailure;
  startLiveStream?(conn: ProviderConnection, providerDroneId: string,
                   ingest: StreamIngestTarget): Promise<LiveStreamHandle>;

  // media & logs
  listMediaSince?(conn: ProviderConnection, since: Date): AsyncIterable<ProviderMediaRef>;
  fetchMedia?(conn: ProviderConnection, ref: ProviderMediaRef): Promise<ReadableStream>;
  fetchFlightLog?(conn: ProviderConnection, providerMissionId: string): Promise<CanonicalFlightLog>;
}
```

**Rules**
1. Optional methods are present only if the capability is declared. The `CapabilityResolver` combines adapter capabilities with org entitlements and per-drone model support.
2. Adapters are **stateless**. Connection state (tokens, MQTT sessions) is held by the service's `ConnectionManager`.
3. Adapters never touch the AeroSight database. They return canonical objects.
4. Every outbound command is idempotent (`commandId`), has a timeout (default 10 s) and is recorded in `mission_events` with provider response.
5. Credentials are fetched from the `CredentialBroker` (secrets manager reference on `integrations.credentials_secret_ref`) at use time and never logged.

## 4. Canonical Models

### 4.1 Mission plan
```ts
interface CanonicalMissionPlan {
  missionId: string; organizationId: string;
  aircraftModel: string; payload?: string;
  altitudeReference: 'AGL' | 'AMSL' | 'TAKEOFF';
  defaultSpeedMps: number;
  finishAction: 'RTH' | 'HOVER' | 'LAND';
  lostLinkAction: 'RTH' | 'CONTINUE' | 'LAND';
  geofence: GeoJSON.Polygon;              // site boundary + buffer minus no-fly zones
  maxAltitudeM: number;
  waypoints: Array<{
    seq: number; lat: number; lon: number; altM: number;
    speedMps?: number; headingDeg?: number; gimbalPitchDeg?: number;
    actions: Array<{ type: 'PHOTO'|'VIDEO_START'|'VIDEO_STOP'|'HOVER'|'GIMBAL'; params?: Record<string, number> }>;
  }>;
}
```
Translators: **DJI WPML/KMZ** (for DJI Pilot 2 / FlightHub 2), **MAVLink mission items** (`MAV_CMD_NAV_WAYPOINT`, `MAV_CMD_IMAGE_START_CAPTURE`, …), **GeoJSON/KML export** (manual).

### 4.2 Telemetry
See [Real-Time Architecture §3](Real-Time-Architecture.md#3-canonical-telemetry-schema).

### 4.3 Drone status
`{ providerDroneId, online, batteryPct?, firmware?, location?, flightMode?, lastSeenAt }`.

## 5. Adapters

| Adapter | Status target | Phase | Capabilities | Notes |
|---|---|---|---|---|
| **Simulator** | **Simulated** | 1 | fleetDiscovery, telemetry, missionUpload, missionControl (simulated only), flightLogs | Generates telemetry along waypoints at 5 Hz with a wind model (Perlin noise ±2 m/s), battery model (linear + load factor, 25-min endurance), GPS jitter (σ 0.8 m), configurable failures (signal loss, low battery, geofence drift) for demos and tests. Every record carries `simulated: true`. |
| **Manual / Upload** | **Implemented** | 1 | — (media via upload) | For drones without a cloud API. Mission exported as KMZ/KML. Media is uploaded after the flight and auto-linked. |
| **DJI Cloud API** (FlightHub 2 / DJI Dock / Pilot 2 cloud) | **Integration Required** | 2 | fleetDiscovery, telemetry (MQTT OSD topics), liveVideo (RTMP/WebRTC/Agora per DJI options), missionUpload (WPML), mediaSync, flightLogs, healthStatus. `missionControl` only for Dock workflows after verification. | Requires a DJI developer account, app license, and customer device binding. MQTT broker credentials per org. |
| **MAVLink Edge Bridge** | **Integration Required** | 3 | telemetry, missionUpload, missionControl (verified), liveVideo (RTSP from the companion) | Customer runs the AeroSight Edge Bridge (container) on a GCS or companion computer. MAVSDK ↔ outbound WSS to AeroSight (mTLS, device certificate). Supports PX4/ArduPilot. |
| **Skydio Cloud** | **Integration Required** | 4 | fleetDiscovery, telemetry, mediaSync, liveVideo | Subject to partner API access. |

### 5.1 Adapter certification checklist (before a status moves past "Integration Required")
1. Contract test suite (`packages/drone-sdk/conformance`) passes against a recorded provider sandbox.
2. Telemetry normalization verified for every field (units, frames, null handling).
3. Failure injection: provider timeout, 401/403, rate limit, malformed payload, disconnect.
4. Security review of credential handling and inbound endpoints (webhook signature or mTLS).
5. For `missionControl`: field test with a licensed pilot, documented safety case, pilot-confirmation UX, rollback plan. Approved by the Product Owner + Flight Ops SME.

## 6. Safety Model

| Control | Description |
|---|---|
| Pilot in command | The UI states that the licensed pilot retains control and legal responsibility. |
| Logical start by default | `POST /missions/:id/start` changes state and starts telemetry tracking. It does **not** command the aircraft unless `missionControl` is declared and enabled for the org. |
| Two-step command confirmation | If enabled, commands require an in-app confirmation from the assigned pilot (or Admin) plus provider-side confirmation where the provider supports it. |
| No remote takeoff in MVP | Takeoff commands are never exposed in Phases 1–2. |
| Geofence pre-validation | Mission plans are validated (MISSION-004) before upload or export. |
| Command audit | Every command is recorded with actor, payload hash, provider ack and latency. |
| Kill-switch flag | Platform feature flag `drone.commands.enabled` (global and per org) disables all outbound commands instantly. |

## 7. Ingestion Paths

| Path | Protocol | Auth | Notes |
|---|---|---|---|
| Provider push (webhook) | HTTPS POST to `/ingest/{provider}/{connectionId}` | HMAC signature per connection + IP allow-list where possible | Separate ingress host `ingest.` with its own rate limits |
| Provider stream (pull) | MQTT over TLS / WebSocket from the Drone Integration Service | Provider credentials | Connection pool per org connection, partitioned across replicas (consistent hashing on connection ID) |
| Edge bridge | WSS (outbound from customer) | mTLS device cert issued per bridge + bridge token | Bridges register through Integrations; certs are revocable |

## 8. Resilience

- **Circuit breaker** per provider connection (open after 5 consecutive failures or > 50% errors in 30 s; half-open after 30 s).
- **Bulkheads:** separate worker pools per provider so one slow provider does not exhaust resources.
- **Backpressure:** if the telemetry stream lag exceeds 5 s, downsample to 1 Hz for fan-out (persisted at the full rate later if buffered).
- **Health monitor:** a periodic `testConnection`. The status is shown on the Integrations page and in platform System Health.

## 9. Data Mapping to AeroSight

| Provider concept | AeroSight entity |
|---|---|
| Aircraft / device SN | `drones.provider_drone_id`, `drones.serial_number` |
| Workspace / org | `integrations` row (one per provider account per org) |
| Wayline / mission | `drone_missions.provider_mission_id` |
| Flight record | `mission_events` + `telemetry` |
| Media file | `media` (`source='provider_sync'`, `provider_media_id`) |

## 10. Adding a New Provider (developer procedure)

1. Create `apps/drone-integration/src/adapters/<provider>/` implementing `DroneProviderAdapter`.
2. Add a mapping and normalization unit tests with recorded fixtures.
3. Run the conformance suite (`pnpm --filter drone-integration test:conformance --adapter=<key>`).
4. Register the adapter in `AdapterRegistry` behind feature flag `drone.adapter.<key>`.
5. Add the integration catalog entry and credential form schema.
6. Update this document §5, the [MVP status register](../13-Product/MVP.md#4-implementation-status-register) and the [Risk Register](../13-Product/Risks.md).
