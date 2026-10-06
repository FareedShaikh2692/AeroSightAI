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
  settings: { mfaRequired: boolean; externalSharing: boolean; missionApprovalRequired: boolean; aiEnabled: boolean; fourEyesProgress: boolean; droneCommandsEnabled?: boolean };
  aiCreditsUsed: number; aiCreditsLimit: number;
  createdAt: string;
}

export interface User {
  id: UUID; email: string; fullName: string; passwordHash: string;
  isPlatformStaff?: boolean; mfaEnabled: boolean; lastLoginAt?: string;
  mfaSecret?: string; mfaPendingSecret?: string; mfaLastStep?: number; recoveryCodeHashes?: string[];
}

export interface Membership {
  id: UUID; organizationId: UUID; userId: UUID; role: RoleKey; status: "active" | "deactivated"; joinedAt: string; scimExternalId?: string;
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
  /** Phase 3: adapter certified for flight commands (pause/resume/RTH) — docs Drone-Architecture §5.1. */
  missionControlVerified?: boolean;
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
  /** Phase 3: commanded state for adapters with verified missionControl. */
  control?: { pausedAt?: string; pausedTotalMs: number; rthAt?: string };
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
  /** Set when the finding first reaches "resolved" (MTTR / SLA analytics). */
  resolvedAt?: string;
}

export interface Report {
  id: UUID; organizationId: UUID; projectId: UUID; title: string; type: "progress" | "survey" | "mission" | "inspection";
  status: "ready" | "published"; version: number; periodStart: string; periodEnd: string;
  sections: string[]; generatedBy: UUID; generatedAt: string; aiAssisted: boolean;
  narrative?: { text: string; engine: "claude" | "heuristic"; model: string };
}

export interface Notification {
  id: UUID; organizationId: UUID; userId: UUID; eventKey: string; severity: "info" | "warning" | "critical";
  title: string; body: string; href?: string; readAt?: string; createdAt: string; projectId?: UUID;
  dedupeKey?: string; occurrences?: number; digest?: boolean;
}

export interface AuditLog {
  id: UUID; organizationId: UUID; occurredAt: string; actorType: "user" | "system" | "platform_staff";
  actorId?: UUID; actorLabel: string; action: string; entityType: string; entityId?: UUID;
  projectId?: UUID; changes?: Record<string, [unknown, unknown]>; ip?: string; hash: string; prevHash: string;
}

export interface AuthContext {
  userId: UUID; orgId: UUID; role: RoleKey; isPlatformStaff: boolean; sessionId: string;
  /** Set when the request is authenticated with an API key: the key's permission subset and optional project list. */
  apiKey?: { id: UUID; permissions: string[]; projectIds: UUID[] | null };
  /** Set during platform break-glass: read-only access to this org. */
  breakGlass?: { sessionId: UUID; endsAt: string };
}

// ---------------------------------------------------------------- Phase 2

export type NotificationCategory = "missions" | "telemetry" | "inspections" | "progress" | "reports" | "ai" | "fleet" | "security" | "billing";
export interface NotificationPreference { organizationId: UUID; userId: UUID; category: NotificationCategory; inApp: boolean; email: boolean; digest: boolean }

export interface NotificationRule {
  id: UUID; organizationId: UUID; name: string; channel: "slack" | "teams"; webhookUrlEnc: string; webhookUrlHint: string;
  categories: NotificationCategory[]; minSeverity: "info" | "warning" | "critical"; projectIds: UUID[]; active: boolean;
  lastStatus?: string; lastSentAt?: string; consecutiveFailures: number; createdAt: string;
}

export interface Webhook {
  id: UUID; organizationId: UUID; url: string; secretEnc: string; eventTypes: string[]; active: boolean;
  consecutiveFailures: number; disabledReason?: string; createdAt: string; createdBy: UUID;
}
export interface WebhookDelivery {
  id: UUID; organizationId: UUID; webhookId: UUID; eventId: UUID; eventType: string; attempt: number;
  statusCode?: number; durationMs?: number; error?: string; deliveredAt: string; payload: string;
}

export interface ApiKey {
  id: UUID; organizationId: UUID; name: string; prefix: string; keyHash: string; permissions: string[];
  projectIds: UUID[] | null; expiresAt: string; lastUsedAt?: string; revokedAt?: string; createdBy: UUID; createdAt: string;
}

export type AiAnalysisType = "progress" | "report_narrative" | "change_detection" | "defect_detection";
export interface AiAnalysis {
  id: UUID; organizationId: UUID; projectId: UUID; siteId?: UUID; type: AiAnalysisType;
  status: "queued" | "running" | "completed" | "failed"; requestedBy: UUID; engine: "claude" | "heuristic";
  modelId?: string; promptVersion: string; input: Record<string, unknown>; output?: Record<string, unknown>;
  confidence?: number; error?: string; creditsUsed: number; createdAt: string; completedAt?: string;
  reviewStatus: "pending" | "accepted" | "partially_accepted" | "rejected";
}
export interface AiSuggestion {
  id: UUID; organizationId: UUID; projectId: UUID; analysisId: UUID; kind: "progress";
  payload: { milestoneId: UUID; milestoneName: string; currentPercent: number; proposedPercent: number; rationale: string };
  confidence: number; decision: "pending" | "accepted" | "edited" | "rejected"; decidedBy?: UUID; decidedAt?: string;
  finalPercent?: number; reason?: string;
}
export interface AiMessage { role: "user" | "assistant"; content: string; citations?: { label: string; href: string }[]; at: string }
export interface AiConversation { id: UUID; organizationId: UUID; userId: UUID; title: string; messages: AiMessage[]; createdAt: string; updatedAt: string }

export interface InspectionTemplate {
  id: UUID; organizationId: UUID; groupId: UUID; name: string; description: string; version: number;
  status: "draft" | "published" | "retired"; items: { id: string; label: string; required: boolean }[];
  createdBy: UUID; createdAt: string;
}

export type DataClass = "raw_media" | "telemetry" | "audit_logs" | "notifications" | "ai_conversations" | "reports";
export interface RetentionPolicy { organizationId: UUID; dataClass: DataClass; retentionDays: number; updatedAt: string; updatedBy?: UUID }
export interface LegalHold { id: UUID; organizationId: UUID; projectId?: UUID; reason: string; placedBy: UUID; placedAt: string; releasedAt?: string; releasedBy?: UUID }

export interface Integration {
  id: UUID; organizationId: UUID; provider: "dji_cloud" | "nodeodm" | "procore" | "acc"; name: string; status: "connected" | "error" | "pending";
  config: Record<string, string>; secretEnc?: string; lastCheckedAt?: string; lastError?: string; createdAt: string;
  /** OAuth connectors (Procore, ACC): encrypted {access_token, refresh_token, expires_at}. */
  tokenEnc?: string;
}

export interface BreakGlassSession {
  id: UUID; staffUserId: UUID; organizationId: UUID; ticketRef: string; justification: string;
  startsAt: string; endsAt: string; endedEarlyAt?: string;
}

// ---------------------------------------------------------------- Phase 3

export interface Viewpoint {
  id: UUID; organizationId: UUID; siteId: UUID; projectId: UUID; name: string; createdBy: UUID; createdAt: string;
  visibility: "private" | "project"; camera: { lng: number; lat: number; height: number; heading: number; pitch: number; roll: number };
}

export interface SsoConfig {
  organizationId: UUID; protocol: "oidc" | "saml"; issuer: string; clientId: string; clientSecretEnc?: string;
  domains: { domain: string; token: string; verifiedAt?: string }[]; enforced: boolean; jitRole: RoleKey; enabled: boolean; updatedAt: string;
}

export interface ScimToken { id: UUID; organizationId: UUID; prefix: string; tokenHash: string; createdBy: UUID; createdAt: string; lastUsedAt?: string; revokedAt?: string }

export interface EdgeDevice {
  id: UUID; organizationId: UUID; droneId: UUID; name: string; tokenHash: string; prefix: string; createdBy: UUID; createdAt: string;
  lastSeenAt?: string; messagesAccepted: number; messagesRejected: number; revokedAt?: string;
}

export interface TelemetrySample {
  droneId: UUID; missionId?: UUID; seq: number; timestamp: string; receivedAt: string; latitude: number; longitude: number; altitude: number;
  relativeAltitude: number; speed: number; heading: number; battery: number; satellites: number; gpsSignal: string; signalStrength?: number;
  flightTime?: number; flightMode?: string; simulated: false; source: "edge_bridge";
}
