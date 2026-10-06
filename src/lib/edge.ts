// Edge-bridge telemetry ingestion (docs/04-Architecture/Drone-Architecture.md §6). A small bridge process next to
// the pilot's controller (DJI MSDK/PSDK, MAVLink, …) posts telemetry with a per-drone device token. The token is
// bound to one drone, so a leaked token can only write that drone's telemetry and nothing else.
import "server-only";
import { z } from "zod";
import { db } from "./store";
import { assertCan, HttpError, notFound } from "./policy";
import { newId } from "./ids";
import { randomToken, sha256 } from "./crypto";
import type { AuthContext, EdgeDevice, TelemetrySample, UUID } from "./types";

const MAX_SAMPLES_PER_DRONE = 1200; // ~10 min at 2 Hz; production keeps history in TimescaleDB
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

export function listEdgeDevices(ctx: AuthContext) {
  assertCan(ctx, "drone:read");
  return db().edgeDevices.filter((d) => d.organizationId === ctx.orgId);
}

export function createEdgeDevice(ctx: AuthContext, droneId: UUID, name: string): { device: EdgeDevice; token: string } {
  assertCan(ctx, "drone:update");
  const drone = db().drones.find((d) => d.id === droneId && d.organizationId === ctx.orgId);
  if (!drone) throw notFound();
  if (drone.providerKey === "simulator") throw new HttpError(422, "VALIDATION_ERROR", "Simulated drones produce their own telemetry; edge devices are for real aircraft.");
  const prefix = randomToken(6).replace(/[^a-zA-Z0-9]/g, "x").slice(0, 8);
  const token = `asai_edge_${prefix}_${randomToken(32)}`;
  const device: EdgeDevice = { id: newId(), organizationId: ctx.orgId, droneId, name: name.trim() || `${drone.name} bridge`, tokenHash: sha256(token), prefix,
    createdBy: ctx.userId, createdAt: new Date().toISOString(), messagesAccepted: 0, messagesRejected: 0 };
  db().edgeDevices.push(device);
  return { device, token };
}

export function revokeEdgeDevice(ctx: AuthContext, id: UUID) {
  assertCan(ctx, "drone:update");
  const d = db().edgeDevices.find((x) => x.id === id && x.organizationId === ctx.orgId && !x.revokedAt);
  if (!d) throw notFound();
  d.revokedAt = new Date().toISOString();
  return d;
}

export const SampleSchema = z.object({
  seq: z.number().int().nonnegative(),
  timestamp: z.string().datetime({ offset: true }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().min(-500).max(10_000),
  relativeAltitude: z.number().min(-100).max(1_000),
  speed: z.number().min(0).max(100),
  heading: z.number().min(0).max(360),
  battery: z.number().min(0).max(100),
  satellites: z.number().int().min(0).max(80).default(0),
  gpsSignal: z.enum(["none", "weak", "fair", "good"]).default("good"),
  signalStrength: z.number().min(0).max(100).optional(),
  flightTime: z.number().min(0).optional(),
  flightMode: z.string().max(32).optional(),
});
export const IngestSchema = z.object({ samples: z.array(SampleSchema).min(1).max(50) });

export interface IngestResult { accepted: number; rejected: { seq?: number; reason: string }[]; missionId?: UUID }

/** Authenticate a device token. Returns null for unknown/revoked tokens (→ 401). */
export function deviceForToken(raw: string | null | undefined): EdgeDevice | null {
  if (!raw?.startsWith("asai_edge_")) return null;
  const d = db().edgeDevices.find((x) => x.tokenHash === sha256(raw));
  return d && !d.revokedAt ? d : null;
}

export function ingest(device: EdgeDevice, body: unknown, nowMs = Date.now()): IngestResult {
  const { samples } = IngestSchema.parse(body);
  const drone = db().drones.find((d) => d.id === device.droneId && d.organizationId === device.organizationId);
  if (!drone) throw new HttpError(410, "GONE", "The drone this device was bound to no longer exists.");
  const active = db().missions.find((m) => m.organizationId === device.organizationId && m.droneId === drone.id && (m.status === "in_progress" || m.status === "paused"));
  const store = db().telemetry;
  let last = latestSample(device.organizationId, drone.id)?.seq ?? -1;
  const res: IngestResult = { accepted: 0, rejected: [], missionId: active?.id };
  for (const s of [...samples].sort((a, b) => a.seq - b.seq)) {
    const ts = Date.parse(s.timestamp);
    if (Math.abs(ts - nowMs) > MAX_CLOCK_SKEW_MS) { res.rejected.push({ seq: s.seq, reason: "CLOCK_SKEW" }); continue; }
    if (s.seq <= last) { res.rejected.push({ seq: s.seq, reason: "DUPLICATE_OR_OUT_OF_ORDER" }); continue; }
    last = s.seq;
    store.push({ ...s, droneId: drone.id, missionId: active?.id, receivedAt: new Date(nowMs).toISOString(), simulated: false, source: "edge_bridge" });
    res.accepted++;
  }
  // Bounded ring per drone.
  const mine = store.filter((x) => x.droneId === drone.id);
  if (mine.length > MAX_SAMPLES_PER_DRONE) {
    const drop = new Set(mine.slice(0, mine.length - MAX_SAMPLES_PER_DRONE));
    db().telemetry = store.filter((x) => !drop.has(x));
  }
  device.lastSeenAt = new Date(nowMs).toISOString();
  device.messagesAccepted += res.accepted;
  device.messagesRejected += res.rejected.length;
  return res;
}

/** Newest sample for a drone, optionally only if received within `maxAgeMs`. */
export function latestSample(orgId: UUID, droneId: UUID, maxAgeMs?: number): TelemetrySample | undefined {
  const t = db().telemetry;
  for (let i = t.length - 1; i >= 0; i--) {
    const s = t[i];
    if (s.droneId !== droneId) continue;
    const drone = db().drones.find((d) => d.id === droneId);
    if (drone?.organizationId !== orgId) return undefined;
    if (maxAgeMs !== undefined && Date.now() - Date.parse(s.receivedAt) > maxAgeMs) return undefined;
    return s;
  }
  return undefined;
}
