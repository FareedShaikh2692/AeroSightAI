// Domain types. Field names mirror docs/05-Database/Database-Design.md (camelCase per API convention).

export type UUID = string;
export type LngLat = [number, number];
export type Polygon = LngLat[]; // closed ring, WGS 84

export type RoleKey =
  | "org_owner" | "org_admin" | "project_manager" | "site_manager"
  | "drone_pilot" | "surveyor" | "inspector" | "engineer" | "viewer";

export type OrgStatus = "active" | "read_only" | "suspended" | "pending_deletion";

export interface Organization {
  id: UUID; name: string; slug: string; status: OrgStatus; country: string;
  timezone: string; region: string; brandColor: string; plan: "starter" | "professional" | "enterprise";
  settings: { mfaRequired: boolean; externalSharing: boolean; missionApprovalRequired: boolean };
  createdAt: string;
}

export interface User {
  id: UUID; email: string; fullName: string; passwordHash: string;
  isPlatformStaff?: boolean; mfaEnabled: boolean; lastLoginAt?: string;
}

export interface Membership {
  id: UUID; organizationId: UUID; userId: UUID; role: RoleKey; status: "active" | "deactivated"; joinedAt: string;
}

export interface ProjectMember { organizationId: UUID; projectId: UUID; userId: UUID; role: RoleKey }

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
export interface Project {
  id: UUID; organizationId: UUID; code: string; name: string; type: string; clientName: string;
  status: ProjectStatus; startDate: string; endDate: string; location: LngLat; description: string;
  timezone: string; createdAt: string; createdBy?: UUID;
}

export interface Site {
  id: UUID; organizationId: UUID; projectId: UUID; code: string; name: string; address: string;
  timezone: string; boundary: Polygon; noFlyZones: { id: UUID; name: string; geometry: Polygon }[];
  centroid: LngLat; areaM2: number; geofenceBufferM: number; maxAltitudeM: number; status: "active" | "inactive";
  createdAt: string;
}

export interface Asset {
  id: UUID; organizationId: UUID; projectId: UUID; siteId: UUID; parentAssetId?: UUID;
  type: string; name: string; tag: string; location: LngLat; heightM: number; footprint?: Polygon;
  conditionRating: number; status: string;
}

export type DroneStatus = "available" | "in_mission" | "maintenance" | "offline" | "retired";
export interface Drone {
  id: UUID; organizationId: UUID; providerKey: "simulator" | "manual" | "dji_cloud"; name: string;
  manufacturer: string; model: string; serialNumber: string; registrationNumber: string;
  registrationExpiresAt: string; status: DroneStatus; maxFlightTimeMin: number; maxSpeedMps: number;
  totalFlightSeconds: number; totalFlights: number; homeSiteId?: UUID;
}

export interface Pilot {
  id: UUID; organizationId: UUID; userId: UUID; licenseNumber: string; licenseType: string;
  issuingAuthority: string; licenseExpiresAt: string;
}

export type MissionStatus =
  | "draft" | "planned" | "pending_approval" | "approved" | "rejected" | "ready"
  | "in_progress" | "paused" | "completed" | "aborted" | "failed" | "cancelled";

export interface Waypoint { seq: number; lng: number; lat: number; altM: number; action: "none" | "photo" }

export interface MissionParams {
  altitudeM: number; speedMps: number; frontOverlap: number; sideOverlap: number; gimbalPitch: number;
}

export interface Mission {
  id: UUID; organizationId: UUID; projectId: UUID; siteId: UUID; code: string; name: string;
  type: "survey" | "inspection" | "progress" | "video" | "custom"; template: "grid" | "orbit" | "waypoint";
  status: MissionStatus; droneId?: UUID; pilotId?: UUID; scheduledStart: string; scheduledEnd: string;
  actualStart?: string; actualEnd?: string; area?: Polygon; params: MissionParams; waypoints: Waypoint[];
  estimates: { durationS: number; distanceM: number; photoCount: number; gsdCm: number; batteries: number };
  checklist: { id: string; label: string; checked: boolean }[]; abortReason?: string;
  rejectionReason?: string; isSimulated: boolean; createdBy?: UUID; createdAt: string;
  summary?: { durationS: number; distanceM: number; maxAltM: number; minBattery: number };
}

export interface MissionEvent { id: UUID; organizationId: UUID; missionId: UUID; at: string; type: string; text: string; actorId?: UUID }

export interface Media {
  id: UUID; organizationId: UUID; projectId: UUID; siteId: UUID; missionId?: UUID; assetId?: UUID;
  type: "image" | "video" | "raster"; filename: string; sizeBytes: number; capturedAt: string;
  location: LngLat; status: "ready" | "processing" | "quarantined"; sharedWithViewers: boolean;
  tags: string[]; altitudeM: number; seed: number;
}

export interface Survey {
  id: UUID; organizationId: UUID; projectId: UUID; siteId: UUID; name: string; type: string;
  status: "planned" | "uploaded" | "processing" | "published"; captureDate: string; gsdCm: number;
  crs: string; qa?: { gcpCount: number; rmseXY: number; rmseZ: number };
}

export interface Milestone {
  id: UUID; organizationId: UUID; projectId: UUID; siteId?: UUID; name: string;
  plannedStart: string; plannedEnd: string; weight: number; sortOrder: number;
}

export interface ProgressRecord {
  id: UUID; organizationId: UUID; projectId: UUID; milestoneId: UUID; recordDate: string;
  percentComplete: number; source: "manual" | "ai" | "survey"; approvalStatus: "pending_approval" | "approved" | "rejected";
  notes: string; evidenceMediaIds: UUID[]; createdBy?: UUID; approvedBy?: UUID; createdAt: string;
}

export type InspectionStatus = "draft" | "scheduled" | "in_progress" | "submitted" | "in_review" | "approved" | "rejected" | "closed";
export interface Inspection {
  id: UUID; organizationId: UUID; projectId: UUID; siteId: UUID; assetId?: UUID; code: string;
  title: string; type: string; status: InspectionStatus; assigneeId?: UUID; reviewerId?: UUID;
  dueDate: string; checklist: { id: string; label: string; required: boolean; value?: "pass" | "fail" | "na" }[];
  approvedBy?: UUID; reviewComment?: string;
}

export type Severity = "low" | "medium" | "high" | "critical";
export interface Finding {
  id: UUID; organizationId: UUID; projectId: UUID; siteId: UUID; inspectionId: UUID; assetId?: UUID;
  code: string; title: string; description: string; category: string; severity: Severity;
  status: "open" | "in_progress" | "resolved" | "verified" | "closed" | "wont_fix";
  location: LngLat; assigneeId?: UUID; dueDate: string; aiGenerated: boolean; createdAt: string;
}

export interface Report {
  id: UUID; organizationId: UUID; projectId: UUID; title: string; type: "progress" | "survey" | "mission" | "inspection";
  status: "ready" | "published"; version: number; periodStart: string; periodEnd: string;
  sections: string[]; generatedBy: UUID; generatedAt: string; aiAssisted: boolean;
}

export interface Notification {
  id: UUID; organizationId: UUID; userId: UUID; eventKey: string; severity: "info" | "warning" | "critical";
  title: string; body: string; href?: string; readAt?: string; createdAt: string; projectId?: UUID;
}

export interface AuditLog {
  id: UUID; organizationId: UUID; occurredAt: string; actorType: "user" | "system" | "platform_staff";
  actorId?: UUID; actorLabel: string; action: string; entityType: string; entityId?: UUID;
  projectId?: UUID; changes?: Record<string, [unknown, unknown]>; ip?: string; hash: string; prevHash: string;
}

export interface AuthContext {
  userId: UUID; orgId: UUID; role: RoleKey; isPlatformStaff: boolean; sessionId: string;
}
