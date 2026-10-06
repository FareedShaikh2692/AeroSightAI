// Tenant-scoped repository. Every read filters by ctx.orgId and accessible projects; every mutation checks
// permissions and writes an audit event. Cross-tenant lookups return null (→ 404) per TENANT-004.
import "server-only";
import type { AuthContext, Mission, Project, Site, UUID, Polygon, MissionParams, ProgressRecord, Inspection, Finding, Report, Media, LngLat } from "./types";
import { db } from "./store";
import { accessibleProjectIds, assertCan, can, forbidden, HttpError, isOrgWide, notFound, restriction } from "./policy";
import { audit } from "./auth";
import { newId } from "./ids";
import { centroid, estimate, generateGrid, generateOrbit, polygonArea, validateRing } from "./geo";
import { BOOKED, nextStatus, overlaps, validatePlan, type MissionAction } from "./mission";
import { computeProgress } from "./progress";
import type { Permission } from "./permissions";

type Row = { organizationId: UUID; projectId?: UUID };

/** Filter a collection to the caller's org, accessible projects and permission. */
function scoped<T extends Row>(ctx: AuthContext, rows: T[], perm: Permission): T[] {
  const projects = accessibleProjectIds(ctx);
  return rows.filter((r) => r.organizationId === ctx.orgId && (!r.projectId || projects.has(r.projectId)) && can(ctx, perm, r));
}

const today = () => new Date().toISOString().slice(0, 10);

// ---------- Organization & people ----------
export function currentOrg(ctx: AuthContext) {
  return db().organizations.find((o) => o.id === ctx.orgId)!;
}
export function currentUser(ctx: AuthContext) {
  return db().users.find((u) => u.id === ctx.userId)!;
}
export function userName(id?: UUID) {
  return id ? db().users.find((u) => u.id === id)?.fullName ?? "Unknown" : "—";
}
export function members(ctx: AuthContext) {
  assertCan(ctx, "org:read");
  return db().memberships.filter((m) => m.organizationId === ctx.orgId).map((m) => {
    const u = db().users.find((x) => x.id === m.userId)!;
    return { ...m, fullName: u.fullName, email: u.email, mfaEnabled: u.mfaEnabled, lastLoginAt: u.lastLoginAt,
      projects: db().projectMembers.filter((pm) => pm.userId === m.userId && pm.organizationId === ctx.orgId).length };
  });
}

// ---------- Projects ----------
export function listProjects(ctx: AuthContext) {
  return scoped(ctx, db().projects.map((p) => ({ ...p, projectId: p.id })), "project:read");
}
export function getProject(ctx: AuthContext, id: UUID): (Project & { projectId: UUID }) | null {
  return listProjects(ctx).find((p) => p.id === id) ?? null;
}
export function projectProgress(ctx: AuthContext, projectId: UUID, asOf = today()) {
  const ms = db().milestones.filter((m) => m.projectId === projectId && m.organizationId === ctx.orgId).sort((a, b) => a.sortOrder - b.sortOrder);
  const rs = db().progressRecords.filter((r) => r.projectId === projectId && r.organizationId === ctx.orgId);
  return { ...computeProgress(ms, rs, asOf), milestonesList: ms, records: rs };
}
export function createProject(ctx: AuthContext, input: { code: string; name: string; type: string; clientName: string; startDate: string; endDate: string; location: LngLat; description: string }) {
  assertCan(ctx, "project:create");
  if (!/^[A-Z0-9-]{2,20}$/.test(input.code)) throw new HttpError(422, "VALIDATION_ERROR", "Code must be 2–20 characters: A–Z, 0–9 or '-'.");
  if (input.endDate < input.startDate) throw new HttpError(422, "VALIDATION_ERROR", "End date must be on or after the start date.");
  if (db().projects.some((p) => p.organizationId === ctx.orgId && p.code === input.code)) throw new HttpError(409, "CONFLICT", `Project code ${input.code} already exists.`);
  const org = currentOrg(ctx);
  const p: Project = { id: newId(), organizationId: ctx.orgId, status: "planning", timezone: org.timezone, createdAt: new Date().toISOString(), createdBy: ctx.userId, ...input };
  db().projects.push(p);
  if (!isOrgWide(ctx)) db().projectMembers.push({ organizationId: ctx.orgId, projectId: p.id, userId: ctx.userId, role: "project_manager" });
  return p;
}

// ---------- Sites & assets ----------
export function listSites(ctx: AuthContext, projectId?: UUID) {
  return scoped(ctx, db().sites, "site:read").filter((s) => !projectId || s.projectId === projectId);
}
export function getSite(ctx: AuthContext, id: UUID): Site | null {
  return listSites(ctx).find((s) => s.id === id) ?? null;
}
export function createSite(ctx: AuthContext, input: { projectId: UUID; code: string; name: string; address: string; boundary: Polygon }) {
  const project = getProject(ctx, input.projectId);
  if (!project) throw notFound();
  assertCan(ctx, "site:create", { organizationId: ctx.orgId, projectId: project.id });
  if (project.status === "archived") throw new HttpError(409, "PROJECT_ARCHIVED", "Archived projects are read-only.");
  const issue = validateRing(input.boundary);
  if (issue) throw new HttpError(422, "GEOMETRY_INVALID", issue.message, { reason: issue.code });
  if (!input.name.trim() || !/^[A-Z0-9-]{1,20}$/.test(input.code)) throw new HttpError(422, "VALIDATION_ERROR", "Name and a code (A–Z, 0–9, '-') are required.");
  if (db().sites.some((s) => s.projectId === project.id && s.code === input.code)) throw new HttpError(409, "CONFLICT", `Site code ${input.code} already exists in this project.`);
  const s: Site = { id: newId(), organizationId: ctx.orgId, projectId: project.id, code: input.code, name: input.name, address: input.address,
    timezone: project.timezone, boundary: input.boundary, noFlyZones: [], centroid: centroid(input.boundary), areaM2: Math.round(polygonArea(input.boundary)),
    geofenceBufferM: 50, maxAltitudeM: 120, status: "active", createdAt: new Date().toISOString() };
  db().sites.push(s);
  return s;
}
export function listAssets(ctx: AuthContext, siteId?: UUID) {
  return scoped(ctx, db().assets, "asset:read").filter((a) => !siteId || a.siteId === siteId);
}

// ---------- Fleet ----------
export function listDrones(ctx: AuthContext) {
  assertCan(ctx, "drone:read");
  return db().drones.filter((d) => d.organizationId === ctx.orgId);
}
export function listPilots(ctx: AuthContext) {
  assertCan(ctx, "drone:read");
  return db().pilots.filter((p) => p.organizationId === ctx.orgId).map((p) => ({ ...p, fullName: userName(p.userId) }));
}
export function registerDrone(ctx: AuthContext, input: { name: string; manufacturer: string; model: string; serialNumber: string; registrationNumber: string; registrationExpiresAt: string; providerKey: "simulator" | "manual" }) {
  assertCan(ctx, "drone:register");
  if (!input.name || !input.serialNumber) throw new HttpError(422, "VALIDATION_ERROR", "Name and serial number are required.");
  if (db().drones.some((d) => d.organizationId === ctx.orgId && d.serialNumber === input.serialNumber)) throw new HttpError(409, "CONFLICT", "A drone with this serial number is already registered.");
  const d = { id: newId(), organizationId: ctx.orgId, status: "available" as const, maxFlightTimeMin: 40, maxSpeedMps: 15, totalFlightSeconds: 0, totalFlights: 0, ...input };
  db().drones.push(d);
  return d;
}

// ---------- Missions ----------
export function listMissions(ctx: AuthContext, filter: { siteId?: UUID; mine?: boolean } = {}) {
  const pilot = db().pilots.find((p) => p.organizationId === ctx.orgId && p.userId === ctx.userId);
  return scoped(ctx, db().missions, "mission:read")
    .filter((m) => (!filter.siteId || m.siteId === filter.siteId) && (!filter.mine || (!!pilot && m.pilotId === pilot.id)))
    .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
}
export function getMission(ctx: AuthContext, id: UUID): Mission | null {
  return listMissions(ctx).find((m) => m.id === id) ?? null;
}
export function missionEvents(ctx: AuthContext, missionId: UUID) {
  return db().missionEvents.filter((e) => e.organizationId === ctx.orgId && e.missionId === missionId).sort((a, b) => b.at.localeCompare(a.at));
}

export function planMission(ctx: AuthContext, input: { siteId: UUID; template: "grid" | "orbit"; area: Polygon; params: MissionParams }) {
  const site = getSite(ctx, input.siteId);
  if (!site) throw notFound();
  const issue = validateRing(input.area, 50);
  if (issue) throw new HttpError(422, "GEOMETRY_INVALID", issue.message);
  const wps = input.template === "orbit"
    ? generateOrbit(centroid(input.area), Math.sqrt(polygonArea(input.area) / Math.PI) * 0.8, input.params)
    : generateGrid(input.area, input.params);
  return { waypoints: wps, estimates: estimate(wps, input.params), issues: validatePlan(site, wps) };
}

export function createMission(ctx: AuthContext, input: { siteId: UUID; name: string; type: Mission["type"]; template: "grid" | "orbit"; area: Polygon; params: MissionParams; scheduledStart: string; droneId?: UUID; pilotId?: UUID }) {
  const site = getSite(ctx, input.siteId);
  if (!site) throw notFound();
  assertCan(ctx, "mission:create", { organizationId: ctx.orgId, projectId: site.projectId });
  if (input.params.altitudeM < 10 || input.params.altitudeM > 500 || input.params.speedMps <= 0 || input.params.speedMps > 20) throw new HttpError(422, "VALIDATION_ERROR", "Altitude 10–500 m and speed 0–20 m/s.");
  const plan = planMission(ctx, input);
  if (plan.issues.length) throw new HttpError(422, plan.issues[0].code === "OUTSIDE_GEOFENCE" ? "MISSION_GEOFENCE_VIOLATION" : `MISSION_${plan.issues[0].code}`, plan.issues.map((i) => i.message).join(" "), { issues: plan.issues });
  const start = Date.parse(input.scheduledStart);
  if (!Number.isFinite(start)) throw new HttpError(422, "VALIDATION_ERROR", "A valid scheduled start is required.");
  const m: Mission = {
    id: newId(), organizationId: ctx.orgId, projectId: site.projectId, siteId: site.id,
    code: `MSN-${String(100 + db().missions.filter((x) => x.organizationId === ctx.orgId).length).padStart(6, "0")}`,
    name: input.name || `Mission — ${site.name}`, type: input.type, template: input.template, status: "draft",
    scheduledStart: new Date(start).toISOString(), scheduledEnd: new Date(start + Math.max(3600_000, plan.estimates.durationS * 1000 + 20 * 60_000)).toISOString(),
    area: input.area, params: input.params, waypoints: plan.waypoints, estimates: plan.estimates,
    checklist: ["Airspace and NOTAMs checked", "Weather within limits (wind < 10 m/s)", "Batteries charged and inspected", "Propellers and airframe inspected", "Return-to-home altitude set above obstacles", "Site team briefed / area secured"].map((label, i) => ({ id: `c${i}`, label, checked: false })),
    isSimulated: false, createdBy: ctx.userId, createdAt: new Date().toISOString(),
  };
  if (input.droneId || input.pilotId) assign(ctx, m, input.droneId, input.pilotId);
  if (m.droneId && m.pilotId) m.status = "planned";
  db().missions.push(m);
  event(ctx, m, "state_changed", `Mission created (${m.status})`);
  return m;
}

function assign(ctx: AuthContext, m: Mission, droneId?: UUID, pilotId?: UUID) {
  const now = today();
  if (droneId) {
    const d = db().drones.find((x) => x.id === droneId && x.organizationId === ctx.orgId);
    if (!d) throw notFound();
    if (d.status === "maintenance" || d.status === "retired") throw new HttpError(422, "DRONE_UNAVAILABLE", `${d.name} is ${d.status}.`);
    if (d.registrationExpiresAt < now) throw new HttpError(422, "DRONE_REGISTRATION_EXPIRED", `${d.name} registration has expired.`);
    const clash = db().missions.find((x) => x.id !== m.id && x.droneId === d.id && BOOKED.includes(x.status) && overlaps(x, m));
    if (clash) throw new HttpError(409, "DRONE_DOUBLE_BOOKED", `${d.name} is already booked for ${clash.code}.`);
    m.droneId = d.id;
    m.isSimulated = d.providerKey === "simulator";
  }
  if (pilotId) {
    const p = db().pilots.find((x) => x.id === pilotId && x.organizationId === ctx.orgId);
    if (!p) throw notFound();
    if (p.licenseExpiresAt < now) throw new HttpError(422, "PILOT_LICENSE_EXPIRED", "The pilot's license has expired.");
    m.pilotId = p.id;
  }
}

function event(ctx: AuthContext, m: Mission, type: string, text: string) {
  db().missionEvents.push({ id: newId(), organizationId: ctx.orgId, missionId: m.id, at: new Date().toISOString(), type, text, actorId: ctx.userId });
}

const ACTION_PERM: Record<MissionAction, Permission> = {
  plan: "mission:update", submit: "mission:update", revise: "mission:update", markReady: "mission:update", cancel: "mission:update",
  approve: "mission:approve", reject: "mission:approve", start: "mission:start", pause: "mission:start", resume: "mission:start", stop: "mission:start", abort: "mission:abort",
};

export function transitionMission(ctx: AuthContext, id: UUID, action: MissionAction, opts: { reason?: string; confirmPilotInCommand?: boolean } = {}) {
  const m = getMission(ctx, id);
  if (!m) throw notFound();
  const perm = ACTION_PERM[action];
  assertCan(ctx, perm, m);
  // RR-01/RR-02: pilots may only operate missions assigned to them.
  if (restriction(ctx, perm, m.projectId) === "A") {
    const pilot = db().pilots.find((p) => p.id === m.pilotId);
    if (pilot?.userId !== ctx.userId) throw forbidden(`${perm} (assigned pilot only)`);
  }
  const to = nextStatus(m.status, action);
  if (!to) throw new HttpError(409, "INVALID_STATE_TRANSITION", `Cannot ${action} a mission that is ${m.status.replace("_", " ")}.`);
  const org = currentOrg(ctx);
  if (action === "markReady" && m.status === "planned" && org.settings.missionApprovalRequired) throw new HttpError(409, "APPROVAL_REQUIRED", "This organization requires mission approval before it can be marked ready.");
  if (action === "plan" && (!m.droneId || !m.pilotId)) throw new HttpError(422, "VALIDATION_ERROR", "Assign a drone and a pilot first.");
  if (action === "reject" || action === "abort") {
    if (!opts.reason?.trim()) throw new HttpError(422, "VALIDATION_ERROR", "A reason is required.");
  }
  if (action === "start") {
    if (m.checklist.some((c) => !c.checked)) throw new HttpError(422, "CHECKLIST_INCOMPLETE", "Complete the pre-flight checklist before starting.");
    if (!opts.confirmPilotInCommand) throw new HttpError(422, "VALIDATION_ERROR", "Confirm that you are the pilot in command.");
    const d = db().drones.find((x) => x.id === m.droneId);
    if (!d || d.status !== "available") throw new HttpError(422, "DRONE_UNAVAILABLE", "The assigned drone is not available.");
    const p = db().pilots.find((x) => x.id === m.pilotId);
    if (!p || p.licenseExpiresAt < today()) throw new HttpError(422, "PILOT_LICENSE_EXPIRED", "The pilot's license is missing or expired.");
    d.status = "in_mission";
    m.actualStart = new Date().toISOString();
  }
  if (action === "stop" || action === "abort") {
    const d = db().drones.find((x) => x.id === m.droneId);
    if (d) { d.status = "available"; d.totalFlights++; }
    m.actualEnd = new Date().toISOString();
    if (action === "stop") {
      const dur = Math.round((Date.parse(m.actualEnd) - Date.parse(m.actualStart ?? m.actualEnd)) / 1000);
      m.summary = { durationS: dur, distanceM: Math.round(Math.min(1, dur / Math.max(1, m.estimates.durationS)) * m.estimates.distanceM), maxAltM: m.params.altitudeM, minBattery: Math.max(20, 100 - Math.round(dur / 30)) };
      if (d) d.totalFlightSeconds += dur;
    } else m.abortReason = opts.reason;
  }
  if (action === "reject") m.rejectionReason = opts.reason;
  const from = m.status;
  m.status = to;
  event(ctx, m, "state_changed", `${from.replace("_", " ")} → ${to.replace("_", " ")}${opts.reason ? ` — ${opts.reason}` : ""}`);
  return { mission: m, from, execution: action === "start" ? { mode: "logical" as const, providerCommandSent: false } : undefined };
}

export function updateChecklist(ctx: AuthContext, id: UUID, itemId: string, checked: boolean) {
  const m = getMission(ctx, id);
  if (!m) throw notFound();
  assertCan(ctx, "mission:start", m);
  if (!["ready", "approved", "planned"].includes(m.status)) throw new HttpError(409, "INVALID_STATE_TRANSITION", "The checklist can only be edited before the flight.");
  const item = m.checklist.find((c) => c.id === itemId);
  if (!item) throw notFound();
  item.checked = checked;
  return m;
}

// ---------- Media & surveys ----------
export function listMedia(ctx: AuthContext, filter: { siteId?: UUID; missionId?: UUID; type?: string } = {}) {
  const rows = scoped(ctx, db().media, "media:read").filter((m) =>
    (!filter.siteId || m.siteId === filter.siteId) && (!filter.missionId || m.missionId === filter.missionId) && (!filter.type || m.type === filter.type));
  return rows.filter((m) => restriction(ctx, "media:read", m.projectId) !== "S" || m.sharedWithViewers)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}
export function getMedia(ctx: AuthContext, id: UUID): Media | null {
  return listMedia(ctx).find((m) => m.id === id) ?? null;
}
export function setMediaShared(ctx: AuthContext, id: UUID, shared: boolean) {
  const m = getMedia(ctx, id);
  if (!m) throw notFound();
  assertCan(ctx, "media:share", m);
  m.sharedWithViewers = shared;
  return m;
}
export function listSurveys(ctx: AuthContext, siteId?: UUID) {
  return scoped(ctx, db().surveys, "map:read").filter((s) => (!siteId || s.siteId === siteId) && (restriction(ctx, "map:read", s.projectId) !== "S" || s.status === "published"));
}

// ---------- Progress ----------
export function recordProgress(ctx: AuthContext, input: { projectId: UUID; milestoneId: UUID; percentComplete: number; recordDate: string; notes: string }) {
  const project = getProject(ctx, input.projectId);
  if (!project) throw notFound();
  assertCan(ctx, "progress:update", { organizationId: ctx.orgId, projectId: project.id });
  const ms = db().milestones.find((m) => m.id === input.milestoneId && m.projectId === project.id);
  if (!ms) throw notFound();
  if (!(input.percentComplete >= 0 && input.percentComplete <= 100)) throw new HttpError(422, "PERCENT_OUT_OF_RANGE", "Percent complete must be between 0 and 100.");
  if (input.recordDate > today()) throw new HttpError(422, "FUTURE_DATE_NOT_ALLOWED", "Progress cannot be recorded for a future date.");
  const autoApprove = can(ctx, "progress:approve", { organizationId: ctx.orgId, projectId: project.id });
  const r: ProgressRecord = { id: newId(), organizationId: ctx.orgId, projectId: project.id, milestoneId: ms.id, recordDate: input.recordDate,
    percentComplete: Math.round(input.percentComplete * 100) / 100, source: "manual", approvalStatus: autoApprove ? "approved" : "pending_approval",
    notes: input.notes, evidenceMediaIds: [], createdBy: ctx.userId, approvedBy: autoApprove ? ctx.userId : undefined, createdAt: new Date().toISOString() };
  db().progressRecords.push(r);
  return r;
}
export function decideProgress(ctx: AuthContext, id: UUID, approve: boolean) {
  const r = db().progressRecords.find((x) => x.id === id && x.organizationId === ctx.orgId);
  if (!r || !accessibleProjectIds(ctx).has(r.projectId)) throw notFound();
  assertCan(ctx, "progress:approve", r);
  if (r.approvalStatus !== "pending_approval") throw new HttpError(409, "INVALID_STATE_TRANSITION", "Only pending records can be decided (approved records are immutable).");
  r.approvalStatus = approve ? "approved" : "rejected";
  r.approvedBy = ctx.userId;
  return r;
}

// ---------- Inspections ----------
export function listInspections(ctx: AuthContext) {
  return scoped(ctx, db().inspections, "inspection:read").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
export function getInspection(ctx: AuthContext, id: UUID): Inspection | null {
  return listInspections(ctx).find((i) => i.id === id) ?? null;
}
export function listFindings(ctx: AuthContext, filter: { inspectionId?: UUID; siteId?: UUID } = {}) {
  return scoped(ctx, db().findings, "inspection:read").filter((f) => (!filter.inspectionId || f.inspectionId === filter.inspectionId) && (!filter.siteId || f.siteId === filter.siteId));
}
export function setChecklistValue(ctx: AuthContext, id: UUID, itemId: string, value: "pass" | "fail" | "na") {
  const i = getInspection(ctx, id);
  if (!i) throw notFound();
  assertCan(ctx, "inspection:update", i);
  if (i.status !== "in_progress") throw new HttpError(409, "INVALID_STATE_TRANSITION", "Checklist can only be edited while in progress.");
  if (i.assigneeId !== ctx.userId && !isOrgWide(ctx)) throw forbidden("inspection:update (assignee only)");
  const item = i.checklist.find((c) => c.id === itemId);
  if (!item) throw notFound();
  item.value = value;
  return i;
}
export function transitionInspection(ctx: AuthContext, id: UUID, action: "start" | "submit" | "approve" | "reject" | "close", comment?: string) {
  const i = getInspection(ctx, id);
  if (!i) throw notFound();
  const map = { start: ["scheduled", "in_progress"], submit: ["in_progress", "submitted"], approve: ["submitted", "approved"], reject: ["submitted", "in_progress"], close: ["approved", "closed"] } as const;
  const [from, to] = map[action];
  if (i.status !== from) throw new HttpError(409, "INVALID_STATE_TRANSITION", `Cannot ${action} an inspection that is ${i.status.replace("_", " ")}.`);
  if (action === "approve" || action === "reject" || action === "close") {
    assertCan(ctx, "inspection:approve", i);
    if (i.assigneeId === ctx.userId) throw new HttpError(403, "SELF_APPROVAL_FORBIDDEN", "You cannot approve your own inspection.");
    if (action === "reject" && !comment?.trim()) throw new HttpError(422, "VALIDATION_ERROR", "A comment is required when rejecting.");
    if (action === "close" && listFindings(ctx, { inspectionId: i.id }).some((f) => !["resolved", "verified", "closed", "wont_fix"].includes(f.status))) throw new HttpError(409, "FINDINGS_OPEN", "All findings must be resolved before closing.");
  } else {
    assertCan(ctx, "inspection:update", i);
  }
  if (action === "submit") {
    const missing = i.checklist.filter((c) => c.required && !c.value);
    if (missing.length) throw new HttpError(422, "INSPECTION_INCOMPLETE", `Answer all required items: ${missing.map((m) => m.label).join("; ")}.`);
  }
  i.status = to;
  if (action === "approve") i.approvedBy = ctx.userId;
  if (comment) i.reviewComment = comment;
  return i;
}
export function createFinding(ctx: AuthContext, inspectionId: UUID, input: { title: string; description: string; category: string; severity: Finding["severity"]; assetId?: UUID }) {
  const i = getInspection(ctx, inspectionId);
  if (!i) throw notFound();
  assertCan(ctx, "finding:create", i);
  if (!input.title.trim()) throw new HttpError(422, "VALIDATION_ERROR", "Title is required.");
  if (["approved", "closed"].includes(i.status)) throw new HttpError(409, "INSPECTION_LOCKED", "Approved inspections are immutable.");
  const asset = input.assetId ? listAssets(ctx, i.siteId).find((a) => a.id === input.assetId) : undefined;
  const site = getSite(ctx, i.siteId)!;
  const sla = { critical: 1, high: 7, medium: 30, low: 90 }[input.severity];
  const f: Finding = { id: newId(), organizationId: ctx.orgId, projectId: i.projectId, siteId: i.siteId, inspectionId: i.id, assetId: asset?.id,
    code: `FND-${String(300 + db().findings.filter((x) => x.organizationId === ctx.orgId).length).padStart(6, "0")}`, title: input.title, description: input.description,
    category: input.category, severity: input.severity, status: "open", location: asset?.location ?? site.centroid, assigneeId: undefined,
    dueDate: new Date(Date.now() + sla * 86_400_000).toISOString().slice(0, 10), aiGenerated: false, createdAt: new Date().toISOString() };
  db().findings.push(f);
  return f;
}
export function transitionFinding(ctx: AuthContext, id: UUID, to: Finding["status"]) {
  const f = listFindings(ctx).find((x) => x.id === id);
  if (!f) throw notFound();
  const allowed: Record<string, Finding["status"][]> = { open: ["in_progress", "wont_fix"], in_progress: ["resolved"], resolved: ["verified", "open"], verified: ["closed"] };
  if (!allowed[f.status]?.includes(to)) throw new HttpError(409, "INVALID_STATE_TRANSITION", `Cannot move a finding from ${f.status} to ${to}.`);
  assertCan(ctx, to === "wont_fix" ? "inspection:approve" : "finding:resolve", f);
  if (restriction(ctx, "finding:resolve", f.projectId) === "A" && f.assigneeId !== ctx.userId) throw forbidden("finding:resolve (assigned only)");
  f.status = to;
  return f;
}

// ---------- Reports ----------
export function listReports(ctx: AuthContext) {
  return scoped(ctx, db().reports, "report:read")
    .filter((r) => restriction(ctx, "report:read", r.projectId) !== "S" || r.status === "published")
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}
export function getReport(ctx: AuthContext, id: UUID): Report | null {
  return listReports(ctx).find((r) => r.id === id) ?? null;
}
export function generateReport(ctx: AuthContext, input: { projectId: UUID; periodStart: string; periodEnd: string; sections: string[] }) {
  const p = getProject(ctx, input.projectId);
  if (!p) throw notFound();
  assertCan(ctx, "report:generate", { organizationId: ctx.orgId, projectId: p.id });
  if (input.periodEnd < input.periodStart) throw new HttpError(422, "VALIDATION_ERROR", "Period end must be after start.");
  const prev = db().reports.filter((r) => r.projectId === p.id && r.periodEnd === input.periodEnd);
  const r: Report = { id: newId(), organizationId: ctx.orgId, projectId: p.id, title: `${p.name} — Progress Report`, type: "progress", status: "ready",
    version: prev.length + 1, periodStart: input.periodStart, periodEnd: input.periodEnd, sections: input.sections.length ? input.sections : ["cover", "kpis", "milestones"],
    generatedBy: ctx.userId, generatedAt: new Date().toISOString(), aiAssisted: false };
  db().reports.push(r);
  return r;
}
export function publishReport(ctx: AuthContext, id: UUID) {
  const r = getReport(ctx, id);
  if (!r) throw notFound();
  assertCan(ctx, "report:share", r);
  r.status = "published";
  return r;
}

// ---------- Notifications & audit ----------
export function listNotifications(ctx: AuthContext) {
  return db().notifications.filter((n) => n.organizationId === ctx.orgId && n.userId === ctx.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function markAllRead(ctx: AuthContext) {
  for (const n of listNotifications(ctx)) n.readAt ??= new Date().toISOString();
}
export function listAudit(ctx: AuthContext) {
  assertCan(ctx, "audit:read");
  return db().auditLogs.filter((a) => a.organizationId === ctx.orgId).slice().reverse();
}

export { audit };

// ---------- Inspections v2: templates & scheduling (INSPECTION-001…004) ----------
export function listTemplates(ctx: AuthContext) {
  assertCan(ctx, "inspection:read");
  return db().inspectionTemplates.filter((t) => t.organizationId === ctx.orgId);
}

/** Creates a template, or a new version of an existing template group; earlier versions are retired, inspections keep their snapshot. */
export function saveTemplate(ctx: AuthContext, input: { groupId?: UUID; name: string; description: string; items: { label: string; required: boolean }[] }) {
  assertCan(ctx, "inspection:template_manage");
  const items = input.items.map((i) => ({ label: i.label.trim(), required: i.required })).filter((i) => i.label);
  if (!input.name.trim()) throw new HttpError(422, "VALIDATION_ERROR", "Template name is required.");
  if (items.length < 1 || items.length > 60) throw new HttpError(422, "VALIDATION_ERROR", "Add between 1 and 60 checklist items.");
  const prev = input.groupId ? db().inspectionTemplates.filter((t) => t.organizationId === ctx.orgId && t.groupId === input.groupId) : [];
  if (input.groupId && !prev.length) throw notFound();
  prev.forEach((t) => { if (t.status === "published") t.status = "retired"; });
  const t = { id: newId(), organizationId: ctx.orgId, groupId: input.groupId ?? newId(), name: input.name.trim(), description: input.description.trim(),
    version: prev.length ? Math.max(...prev.map((p) => p.version)) + 1 : 1, status: "published" as const,
    items: items.map((i, k) => ({ id: `t${k}`, ...i })), createdBy: ctx.userId, createdAt: new Date().toISOString() };
  db().inspectionTemplates.push(t);
  return t;
}

export function createInspection(ctx: AuthContext, input: { siteId: UUID; templateId: UUID; title: string; type: string; assetId?: UUID; assigneeId: UUID; reviewerId: UUID; dueDate: string }) {
  const site = getSite(ctx, input.siteId);
  if (!site) throw notFound();
  assertCan(ctx, "inspection:create", site);
  assertCan(ctx, "inspection:assign", site);
  const tpl = db().inspectionTemplates.find((t) => t.id === input.templateId && t.organizationId === ctx.orgId && t.status === "published");
  if (!tpl) throw new HttpError(422, "VALIDATION_ERROR", "Choose a published template.");
  if (input.assigneeId === input.reviewerId) throw new HttpError(422, "VALIDATION_ERROR", "The reviewer must be a different person from the assignee (no self-approval).");
  const member = (uid: UUID) => db().memberships.some((m) => m.organizationId === ctx.orgId && m.userId === uid && m.status === "active");
  if (!member(input.assigneeId) || !member(input.reviewerId)) throw new HttpError(422, "VALIDATION_ERROR", "Assignee and reviewer must be active members.");
  const reviewerCtx = { userId: input.reviewerId, orgId: ctx.orgId, role: db().memberships.find((m) => m.organizationId === ctx.orgId && m.userId === input.reviewerId)!.role, isPlatformStaff: false, sessionId: "check" };
  if (!can(reviewerCtx, "inspection:approve", site)) throw new HttpError(422, "VALIDATION_ERROR", "The reviewer needs permission to approve inspections on this project.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new HttpError(422, "VALIDATION_ERROR", "Choose a due date.");
  const asset = input.assetId ? listAssets(ctx, site.id).find((a) => a.id === input.assetId) : undefined;
  const i: Inspection = { id: newId(), organizationId: ctx.orgId, projectId: site.projectId, siteId: site.id, assetId: asset?.id,
    code: `INS-${String(40 + db().inspections.filter((x) => x.organizationId === ctx.orgId).length).padStart(6, "0")}`,
    title: input.title.trim() || tpl.name, type: input.type, status: "scheduled", assigneeId: input.assigneeId, reviewerId: input.reviewerId, dueDate: input.dueDate,
    checklist: tpl.items.map((it) => ({ id: it.id, label: it.label, required: it.required })) }; // snapshot (INSPECTION-002)
  db().inspections.push(i);
  return i;
}
