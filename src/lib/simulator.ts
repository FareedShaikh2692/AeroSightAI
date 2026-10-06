// Drone Simulator adapter (docs/04-Architecture/Drone-Architecture.md §5). Telemetry is a pure function of
// (mission, time), so any serverless instance produces the same stream. Every record carries simulated: true.
import type { Mission, Site } from "./types";
import { haversine, withinBuffer, pointInPolygon } from "./geo";

export interface Telemetry {
  droneId: string; missionId: string; seq: number; timestamp: string; latitude: number; longitude: number;
  altitude: number; relativeAltitude: number; speed: number; verticalSpeed: number; heading: number; battery: number;
  gpsSignal: "none" | "weak" | "fair" | "good"; satellites: number; signalStrength: number; flightTime: number;
  flightMode: "waypoint" | "rth" | "landing" | "hover"; simulated: true;
}

export interface Alert { type: "battery_low" | "battery_critical" | "geofence_breach" | "altitude_exceeded" | "signal_lost" | "gps_degraded"; severity: "warning" | "critical"; message: string }

function bearing(from: { lng: number; lat: number }, to: { lng: number; lat: number }) {
  const h = (Math.atan2((to.lng - from.lng) * Math.cos((from.lat * Math.PI) / 180), to.lat - from.lat) * 180) / Math.PI;
  return (h + 360) % 360;
}

function noise(seed: number, t: number) {
  return Math.sin(t * 0.37 + seed) * 0.6 + Math.sin(t * 1.13 + seed * 2.1) * 0.3 + Math.sin(t * 2.71 + seed * 0.7) * 0.1;
}

/** Telemetry at `nowMs` for an in-progress mission. Loops the flight path so the demo always has a live drone. */
export function telemetryAt(m: Mission, site: Site, nowMs: number, siteElevation = 5): { t: Telemetry; alerts: Alert[] } {
  const wps = m.waypoints.length ? m.waypoints : [{ seq: 0, lng: site.centroid[0], lat: site.centroid[1], altM: 60, action: "none" as const }];
  const speed = m.params.speedMps;
  const legs: number[] = [];
  let total = 0;
  for (let i = 1; i < wps.length; i++) {
    const d = haversine([wps[i - 1].lng, wps[i - 1].lat], [wps[i].lng, wps[i].lat]);
    legs.push(d);
    total += d;
  }
  // One "sortie" lasts ~12 min: climb, fly the path back and forth, then return home. Then the loop restarts
  // (battery swap), so the demo always has a live drone. Battery drains across the sortie (alerts near the end).
  const climb = 30, rthS = 40;
  const cycleS = Math.max(720, total / speed + climb + rthS);
  const start = Date.parse(m.actualStart ?? m.scheduledStart);
  // Mission control (pause / return-to-home): paused time does not advance the flight clock.
  const ctl = m.control;
  const flightClock = (atMs: number) => {
    let pausedMs = ctl?.pausedTotalMs ?? 0;
    if (ctl?.pausedAt) pausedMs += Math.max(0, atMs - Date.parse(ctl.pausedAt));
    return Math.max(0, (atMs - start - pausedMs) / 1000);
  };
  const stateAt = (elapsedS: number) => {
    const tc = elapsedS % cycleS;
    let pos: [number, number] = [wps[0].lng, wps[0].lat], heading = 0, alt = 0, mode: Telemetry["flightMode"] = "waypoint", vs = 0;
    if (tc < climb) {
      alt = (tc / climb) * wps[0].altM; vs = wps[0].altM / climb; mode = "hover";
    } else if (tc > cycleS - rthS) {
      const f = (tc - (cycleS - rthS)) / rthS;
      alt = Math.max(0, wps[0].altM * (1 - f)); vs = -wps[0].altM / rthS; mode = f > 0.6 ? "landing" : "rth";
    } else {
      alt = wps[0].altM;
      const span = Math.max(1, total);
      const travelled = (tc - climb) * speed;
      const lap = Math.floor(travelled / span);
      let dist = travelled % span;
      const forward = lap % 2 === 0;
      if (!forward) dist = span - dist;
      let i = 0;
      while (i < legs.length - 1 && dist > legs[i]) { dist -= legs[i]; i++; }
      if (legs.length === 0) {
        mode = "hover";
      } else {
        const a = wps[i], b = wps[i + 1], f = legs[i] ? Math.min(1, dist / legs[i]) : 0;
        pos = [a.lng + (b.lng - a.lng) * f, a.lat + (b.lat - a.lat) * f];
        const [from, to] = forward ? [a, b] : [b, a];
        heading = bearing(from, to);
      }
    }
    return { tc, pos, heading, alt, mode, vs };
  };
  let elapsed = flightClock(nowMs);
  let { tc, pos, heading, alt, mode, vs } = stateAt(elapsed);
  let commanded = false;
  if (ctl?.rthAt) {
    // Fly straight home at mission speed, then descend and land.
    const rthMs = Date.parse(ctl.rthAt);
    const s0 = stateAt(flightClock(rthMs));
    const home = wps[0];
    const d = haversine(s0.pos, [home.lng, home.lat]);
    const flyS = d / Math.max(1, speed), descendS = 25;
    const dt = Math.max(0, (nowMs - rthMs) / 1000);
    commanded = true;
    elapsed = flightClock(rthMs) + dt;
    tc = Math.min(cycleS, s0.tc + dt);
    heading = bearing({ lng: s0.pos[0], lat: s0.pos[1] }, home);
    const cruiseAlt = Math.max(s0.alt, 20);
    if (dt < flyS) {
      const f = dt / flyS;
      pos = [s0.pos[0] + (home.lng - s0.pos[0]) * f, s0.pos[1] + (home.lat - s0.pos[1]) * f];
      alt = cruiseAlt; vs = 0; mode = "rth";
    } else {
      const f = Math.min(1, (dt - flyS) / descendS);
      pos = [home.lng, home.lat]; alt = cruiseAlt * (1 - f); vs = f < 1 ? -cruiseAlt / descendS : 0; mode = "landing";
    }
  } else if (ctl?.pausedAt) {
    commanded = true; mode = "hover"; vs = 0;
  }
  const seed = parseInt(m.id.slice(0, 6), 16) % 1000;
  const jitter = 0.000006 * noise(seed, elapsed);
  const lat = pos[1] + jitter, lng = pos[0] - jitter;
  const battery = Math.max(8, Math.round((100 - (tc / cycleS) * 78 - 1.5 * Math.abs(noise(seed + 1, elapsed / 50))) * 10) / 10);
  const sats = Math.round(17 + 3 * noise(seed + 2, elapsed / 20));
  const t: Telemetry = {
    droneId: m.droneId ?? "", missionId: m.id, seq: Math.floor(elapsed * 2), timestamp: new Date(nowMs).toISOString(),
    latitude: +lat.toFixed(7), longitude: +lng.toFixed(7), altitude: +(alt + siteElevation).toFixed(1), relativeAltitude: +alt.toFixed(1),
    speed: commanded ? (mode === "rth" ? speed : 0.1) : mode === "waypoint" ? +(speed + 0.6 * noise(seed + 3, elapsed)).toFixed(1) : 0.2, verticalSpeed: +vs.toFixed(1),
    heading: +heading.toFixed(1), battery, gpsSignal: sats < 6 ? "weak" : "good", satellites: sats,
    signalStrength: Math.round(86 + 10 * noise(seed + 4, elapsed / 10)), flightTime: Math.round(tc), flightMode: mode, simulated: true,
  };
  const alerts: Alert[] = [];
  if (battery <= 20) alerts.push({ type: "battery_critical", severity: "critical", message: `Battery critical (${battery}%) — return to home.` });
  else if (battery <= 30) alerts.push({ type: "battery_low", severity: "warning", message: `Battery low (${battery}%).` });
  if (!withinBuffer([lng, lat], site.boundary, site.geofenceBufferM) || site.noFlyZones.some((z) => pointInPolygon([lng, lat], z.geometry)))
    alerts.push({ type: "geofence_breach", severity: "critical", message: "Drone is outside the permitted flight area." });
  if (alt > site.maxAltitudeM) alerts.push({ type: "altitude_exceeded", severity: "warning", message: "Altitude limit exceeded." });
  if (sats < 6) alerts.push({ type: "gps_degraded", severity: "warning", message: "GPS degraded." });
  return { t, alerts };
}
