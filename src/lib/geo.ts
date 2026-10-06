// Geodesic helpers (WGS 84). Server-side equivalents of the PostGIS functions in docs/10-GIS-3D/GIS-Specification.md §7.
import type { LngLat, Polygon, Waypoint, MissionParams } from "./types";

const R = 6371008.8; // mean Earth radius, m
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversine(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Geodesic polygon area (m²) using the spherical excess formula. */
export function polygonArea(ring: Polygon): number {
  if (ring.length < 4) return 0;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    total += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)));
  }
  return Math.abs((total * R * R) / 2);
}

export function centroid(ring: Polygon): LngLat {
  const pts = ring.slice(0, -1);
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [round6(lng), round6(lat)];
}

export const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function pointInPolygon(p: LngLat, ring: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Local equirectangular projection around a reference point (accurate to < 0.1% at site scale). */
function toXY(p: LngLat, ref: LngLat): [number, number] {
  return [rad(p[0] - ref[0]) * R * Math.cos(rad(ref[1])), rad(p[1] - ref[1]) * R];
}
function fromXY(xy: [number, number], ref: LngLat): LngLat {
  return [round6(ref[0] + deg(xy[0] / (R * Math.cos(rad(ref[1]))))), round6(ref[1] + deg(xy[1] / R))];
}

/** Minimum distance (m) from a point to a polygon edge. */
export function distanceToPolygonEdge(p: LngLat, ring: Polygon): number {
  const P = toXY(p, p);
  let min = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const A = toXY(ring[i], p);
    const B = toXY(ring[i + 1], p);
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / len));
    const cx = A[0] + t * dx, cy = A[1] + t * dy;
    min = Math.min(min, Math.hypot(P[0] - cx, P[1] - cy));
  }
  return min;
}

/** Inside the polygon, or outside but within `bufferM` of its edge (≈ ST_Covers(ST_Buffer(boundary, buffer), p)). */
export function withinBuffer(p: LngLat, ring: Polygon, bufferM: number): boolean {
  return pointInPolygon(p, ring) || distanceToPolygonEdge(p, ring) <= bufferM;
}

function segmentsIntersect(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  const o = (p: LngLat, q: LngLat, r: LngLat) => Math.sign((q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

export type GeometryIssue = { code: string; message: string };

/** Validation per SITE-002. Returns null when valid. */
export function validateRing(ring: Polygon, minAreaM2 = 100): GeometryIssue | null {
  if (!Array.isArray(ring) || ring.length < 4) return { code: "TOO_FEW_VERTICES", message: "A boundary needs at least 3 distinct vertices." };
  for (const [lng, lat] of ring) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90)
      return { code: "OUT_OF_RANGE", message: `Coordinate [${lng}, ${lat}] is outside WGS 84 range.` };
  }
  const [f, l] = [ring[0], ring[ring.length - 1]];
  if (f[0] !== l[0] || f[1] !== l[1]) return { code: "NOT_CLOSED", message: "The ring must be closed (first vertex = last vertex)." };
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1]))
        return { code: "SELF_INTERSECTION", message: `Edges ${i + 1} and ${j + 1} cross each other near [${ring[j][0].toFixed(5)}, ${ring[j][1].toFixed(5)}].` };
    }
  }
  if (polygonArea(ring) < minAreaM2) return { code: "AREA_TOO_SMALL", message: `Area must be at least ${minAreaM2} m².` };
  return null;
}

/** Closed rectangle polygon around a centre, sized in metres. */
export function rect(center: LngLat, widthM: number, heightM: number, rotationDeg = 0): Polygon {
  const hw = widthM / 2, hh = heightM / 2;
  const c = Math.cos(rad(rotationDeg)), s = Math.sin(rad(rotationDeg));
  const pts: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [x * c - y * s, x * s + y * c]);
  const ring = pts.map((xy) => fromXY(xy, center));
  return [...ring, ring[0]];
}

// ---- Mission planning (MISSION-003) ---------------------------------------------------------

/** Reference camera: 1" sensor, 13.2 mm wide, 8.8 mm focal, 5472 px (typical mapping drone). */
const SENSOR = { widthMm: 13.2, heightMm: 8.8, focalMm: 8.8, widthPx: 5472 };

export function gsdCm(altitudeM: number): number {
  return round2(((SENSOR.widthMm * altitudeM * 100) / (SENSOR.focalMm * SENSOR.widthPx)));
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Deterministic lawnmower grid inside the polygon bounding box, clipped to the polygon. */
export function generateGrid(area: Polygon, p: MissionParams): Waypoint[] {
  const ref = centroid(area);
  const xy = area.map((pt) => toXY(pt, ref));
  const xs = xy.map((q) => q[0]), ys = xy.map((q) => q[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const footprintW = (SENSOR.widthMm * p.altitudeM) / SENSOR.focalMm;
  const footprintH = (SENSOR.heightMm * p.altitudeM) / SENSOR.focalMm;
  const lineSpacing = Math.max(5, footprintW * (1 - p.sideOverlap));
  const photoSpacing = Math.max(3, footprintH * (1 - p.frontOverlap));
  const wps: Waypoint[] = [];
  let seq = 0, row = 0;
  for (let y = minY + lineSpacing / 2; y <= maxY; y += lineSpacing, row++) {
    const line: LngLat[] = [];
    for (let x = minX; x <= maxX; x += photoSpacing) {
      const ll = fromXY([x, y], ref);
      if (pointInPolygon(ll, area)) line.push(ll);
    }
    if (row % 2 === 1) line.reverse();
    for (const ll of line) wps.push({ seq: seq++, lng: ll[0], lat: ll[1], altM: p.altitudeM, action: "photo" });
  }
  return wps;
}

export function generateOrbit(center: LngLat, radiusM: number, p: MissionParams, points = 24): Waypoint[] {
  return Array.from({ length: points }, (_, i) => {
    const a = (2 * Math.PI * i) / points;
    const ll = fromXY([radiusM * Math.cos(a), radiusM * Math.sin(a)], center);
    return { seq: i, lng: ll[0], lat: ll[1], altM: p.altitudeM, action: "photo" as const };
  });
}

export function estimate(wps: Waypoint[], p: MissionParams, maxFlightMin = 30) {
  let dist = 0;
  for (let i = 1; i < wps.length; i++) dist += haversine([wps[i - 1].lng, wps[i - 1].lat], [wps[i].lng, wps[i].lat]);
  const climb = p.altitudeM * 2;
  const durationS = Math.round(dist / p.speedMps + climb / 3 + wps.length * 0.5 + 60);
  return {
    durationS, distanceM: Math.round(dist), photoCount: wps.filter((w) => w.action === "photo").length,
    gsdCm: gsdCm(p.altitudeM), batteries: Math.max(1, Math.ceil(durationS / (maxFlightMin * 60 * 0.8))),
  };
}
