// Mission state machine and plan validation (MISSION-004, MISSION-010; Technical-Design §4.5).
import type { Mission, MissionStatus, Site, Waypoint } from "./types";
import { pointInPolygon, withinBuffer } from "./geo";

export type MissionAction =
  | "plan" | "submit" | "approve" | "reject" | "markReady" | "start" | "pause" | "resume" | "stop" | "abort" | "cancel" | "revise" | "rth";

export const TRANSITIONS: Partial<Record<MissionStatus, Partial<Record<MissionAction, MissionStatus>>>> = {
  draft: { plan: "planned", cancel: "cancelled" },
  planned: { submit: "pending_approval", markReady: "ready", cancel: "cancelled" },
  pending_approval: { approve: "approved", reject: "rejected" },
  approved: { markReady: "ready", cancel: "cancelled" },
  rejected: { revise: "draft" },
  ready: { start: "in_progress", cancel: "cancelled" },
  in_progress: { pause: "paused", rth: "in_progress", stop: "completed", abort: "aborted" },
  paused: { resume: "in_progress", rth: "in_progress", abort: "aborted" },
};

export function nextStatus(from: MissionStatus, action: MissionAction): MissionStatus | null {
  return TRANSITIONS[from]?.[action] ?? null;
}

export function availableActions(status: MissionStatus): MissionAction[] {
  return Object.keys(TRANSITIONS[status] ?? {}) as MissionAction[];
}

export interface PlanIssue { code: "OUTSIDE_GEOFENCE" | "IN_NO_FLY_ZONE" | "ALTITUDE_EXCEEDED" | "NO_WAYPOINTS" | "TOO_MANY_WAYPOINTS"; waypoints: number[]; message: string }

export function validatePlan(site: Site, wps: Waypoint[]): PlanIssue[] {
  const issues: PlanIssue[] = [];
  if (wps.length === 0) return [{ code: "NO_WAYPOINTS", waypoints: [], message: "The plan has no waypoints inside the area." }];
  if (wps.length > 2000) issues.push({ code: "TOO_MANY_WAYPOINTS", waypoints: [], message: "Plans are limited to 2,000 waypoints." });
  const outside = wps.filter((w) => !withinBuffer([w.lng, w.lat], site.boundary, site.geofenceBufferM)).map((w) => w.seq);
  if (outside.length) issues.push({ code: "OUTSIDE_GEOFENCE", waypoints: outside, message: `${outside.length} waypoint(s) are outside the site boundary plus ${site.geofenceBufferM} m buffer.` });
  const nfz = wps.filter((w) => site.noFlyZones.some((z) => pointInPolygon([w.lng, w.lat], z.geometry))).map((w) => w.seq);
  if (nfz.length) issues.push({ code: "IN_NO_FLY_ZONE", waypoints: nfz, message: `${nfz.length} waypoint(s) are inside a no-fly zone.` });
  const high = wps.filter((w) => w.altM > site.maxAltitudeM).map((w) => w.seq);
  if (high.length) issues.push({ code: "ALTITUDE_EXCEEDED", waypoints: high, message: `${high.length} waypoint(s) exceed the ${site.maxAltitudeM} m altitude limit.` });
  return issues;
}

export function overlaps(a: Pick<Mission, "scheduledStart" | "scheduledEnd">, b: Pick<Mission, "scheduledStart" | "scheduledEnd">) {
  return Date.parse(a.scheduledStart) < Date.parse(b.scheduledEnd) && Date.parse(b.scheduledStart) < Date.parse(a.scheduledEnd);
}

export const BOOKED: MissionStatus[] = ["approved", "ready", "in_progress", "paused", "pending_approval", "planned"];
