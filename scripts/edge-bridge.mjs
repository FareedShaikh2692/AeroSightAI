#!/usr/bin/env node
// AeroSight edge bridge — reference implementation (docs/04-Architecture/Drone-Architecture.md §6).
//
// Runs next to the pilot's ground station and forwards telemetry to AeroSight:
//   AEROSIGHT_URL=https://aerosight-ai-five.vercel.app AEROSIGHT_DEVICE_TOKEN=asai_edge_… node scripts/edge-bridge.mjs --stdin
//
// Input modes:
//   --stdin            read one JSON object per line from stdin (e.g. piped from a MAVLink or DJI MSDK adapter)
//                      fields: latitude, longitude, altitude, relativeAltitude, speed, heading, battery, satellites
//   --replay LAT,LNG   generate a test orbit around a point (for wiring tests only — samples are real HTTP traffic,
//                      but the flight is synthetic; do not use for operations)
//
// Samples are buffered and posted in batches of up to 50 once per second, with retry and back-off.
import readline from "node:readline";

const url = (process.env.AEROSIGHT_URL ?? "http://localhost:3000").replace(/\/$/, "") + "/api/v1/ingest/telemetry";
const token = process.env.AEROSIGHT_DEVICE_TOKEN;
if (!token?.startsWith("asai_edge_")) { console.error("Set AEROSIGHT_DEVICE_TOKEN to a device token from Fleet → Edge devices."); process.exit(1); }

let seq = Date.now() % 1_000_000_000;
const queue = [];
const push = (s) => { queue.push({ seq: seq++, timestamp: new Date().toISOString(), satellites: 0, gpsSignal: "good", ...s }); if (queue.length > 500) queue.splice(0, queue.length - 500); };

async function flush() {
  if (!queue.length) return;
  const batch = queue.slice(0, 50);
  try {
    const r = await fetch(url, { method: "POST", headers: { authorization: `Device ${token}`, "content-type": "application/json" }, body: JSON.stringify({ samples: batch }) });
    const body = await r.json().catch(() => ({}));
    if (r.status === 401) { console.error("Device token rejected (revoked?). Stopping."); process.exit(2); }
    if (r.ok || r.status === 422) {
      queue.splice(0, batch.length); // accepted, or permanently invalid — don't retry
      console.log(`${new Date().toISOString()} sent ${batch.length} · accepted ${body.accepted ?? 0}${body.rejected?.length ? ` · rejected ${body.rejected.length}` : ""}${body.missionId ? ` · mission ${body.missionId}` : ""}`);
    } else console.warn(`HTTP ${r.status} — will retry`, body.detail ?? "");
  } catch (e) { console.warn("Network error — will retry:", e.message); }
}
setInterval(flush, 1000);

const args = process.argv.slice(2);
if (args[0] === "--stdin") {
  readline.createInterface({ input: process.stdin }).on("line", (line) => {
    try { const s = JSON.parse(line); if (typeof s.latitude === "number" && typeof s.longitude === "number") push(s); } catch { /* skip */ }
  });
} else if (args[0] === "--replay" && args[1]) {
  const [lat, lng] = args[1].split(",").map(Number);
  const t0 = Date.now();
  setInterval(() => {
    const t = (Date.now() - t0) / 1000, a = t / 30, r = 0.0012;
    push({ latitude: lat + r * Math.cos(a), longitude: lng + (r * Math.sin(a)) / Math.cos((lat * Math.PI) / 180), altitude: 65, relativeAltitude: 60,
      speed: 6, heading: ((a * 180) / Math.PI + 90) % 360, battery: Math.max(10, 100 - t / 20), satellites: 18, flightMode: "waypoint", flightTime: Math.round(t) });
  }, 500);
} else {
  console.error("Usage: node scripts/edge-bridge.mjs --stdin | --replay LAT,LNG");
  process.exit(1);
}
