"use server";
// Server actions for the tenant app. Each action: resolve context → repository call (authz + validation)
// → audit → revalidate. Errors come back as { error } for inline display.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireContext, audit } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { HttpError, assertCan, notFound } from "@/lib/policy";
import { db } from "@/lib/store";
import { newId } from "@/lib/ids";
import { hashPassword } from "@/lib/password";
import { DEMO_PASSWORD } from "@/lib/seed";
import type { MissionAction } from "@/lib/mission";
import type { LngLat, RoleKey } from "@/lib/types";
import { ROLES } from "@/lib/permissions";
import { emit, membersWithRoles, missionEvent } from "@/lib/events";
import { reportNarrative } from "@/lib/ai/features";
import { AiUnavailableError } from "@/lib/ai/llm";

export type ActionState = { error?: string | null; ok?: string | null; data?: unknown };

function fail(e: unknown): ActionState {
  if (e instanceof HttpError) return { error: e.message };
  if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Invalid input." };
  throw e;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------- Projects & sites ----------
export async function createProjectAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  let id: string;
  try {
    const lng = Number(str(f, "lng")), lat = Number(str(f, "lat"));
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new HttpError(422, "VALIDATION_ERROR", "Enter a valid location (longitude, latitude).");
    if (!str(f, "name")) throw new HttpError(422, "VALIDATION_ERROR", "Project name is required.");
    const p = repo.createProject(ctx, { code: str(f, "code").toUpperCase(), name: str(f, "name"), type: str(f, "type") || "building", clientName: str(f, "clientName"),
      startDate: str(f, "startDate"), endDate: str(f, "endDate"), location: [lng, lat], description: str(f, "description") });
    await audit(ctx, "project.created", "project", p.id, { projectId: p.id, changes: { name: [null, p.name], code: [null, p.code] } });
    id = p.id;
  } catch (e) { return fail(e); }
  revalidatePath("/app/projects");
  redirect(`/app/projects/${id}`);
}

export async function createSiteAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  let id: string;
  try {
    const ring = JSON.parse(str(f, "boundary") || "[]") as LngLat[];
    const closed = ring.length >= 3 ? [...ring, ring[0]] : ring;
    const s = repo.createSite(ctx, { projectId: str(f, "projectId"), code: str(f, "code").toUpperCase(), name: str(f, "name"), address: str(f, "address"), boundary: closed });
    await audit(ctx, "site.created", "site", s.id, { projectId: s.projectId, changes: { name: [null, s.name], areaM2: [null, s.areaM2] } });
    id = s.id;
  } catch (e) { return fail(e); }
  revalidatePath("/app/sites");
  redirect(`/app/sites/${id}`);
}

// ---------- Missions ----------
const MissionInput = z.object({
  siteId: z.string().uuid(), name: z.string().max(160), type: z.enum(["survey", "inspection", "progress", "video", "custom"]),
  template: z.enum(["grid", "orbit"]), area: z.array(z.tuple([z.number(), z.number()])).min(3).max(500),
  params: z.object({ altitudeM: z.number(), speedMps: z.number(), frontOverlap: z.number().min(0.5).max(0.95), sideOverlap: z.number().min(0.4).max(0.95), gimbalPitch: z.number().min(-90).max(0) }),
  scheduledStart: z.string(), droneId: z.string().optional(), pilotId: z.string().optional(),
});

export async function previewMissionAction(raw: string): Promise<ActionState> {
  const ctx = await requireContext();
  try {
    const input = MissionInput.parse(JSON.parse(raw));
    const area = [...input.area, input.area[0]];
    return { data: repo.planMission(ctx, { ...input, area }) };
  } catch (e) { return fail(e); }
}

export async function createMissionAction(raw: string): Promise<ActionState> {
  const ctx = await requireContext();
  let id: string;
  try {
    const input = MissionInput.parse(JSON.parse(raw));
    const m = repo.createMission(ctx, { ...input, area: [...input.area, input.area[0]], droneId: input.droneId || undefined, pilotId: input.pilotId || undefined });
    await audit(ctx, "mission.created", "mission", m.id, { projectId: m.projectId, changes: { status: [null, m.status] } });
    const pilotUser = db().pilots.find((p) => p.id === m.pilotId)?.userId;
    if (pilotUser) emit({ key: "mission.assigned", orgId: ctx.orgId, projectId: m.projectId, entityType: "mission", entityId: m.id, title: "Mission assigned to you",
      body: `${m.name} — ${new Date(m.scheduledStart).toUTCString().slice(0, 22)} UTC`, href: `/app/missions/${m.id}`, recipients: [pilotUser] });
    id = m.id;
  } catch (e) { return fail(e); }
  revalidatePath("/app/missions");
  redirect(`/app/missions/${id}`);
}

export async function missionTransitionAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const id = str(f, "id");
  try {
    const action = str(f, "action") as MissionAction;
    const r = repo.transitionMission(ctx, id, action, { reason: str(f, "reason"), confirmPilotInCommand: f.get("confirm") === "on" });
    await audit(ctx, `mission.${action}`, "mission", id, { projectId: r.mission.projectId, changes: { status: [r.from, r.mission.status] } });
    missionEvent(ctx.orgId, r.mission, action, str(f, "reason"));
  } catch (e) { return fail(e); }
  revalidatePath(`/app/missions/${id}`);
  revalidatePath("/app/live");
  return { ok: "Updated." };
}

export async function checklistAction(f: FormData) {
  const ctx = await requireContext();
  const id = str(f, "id");
  try { repo.updateChecklist(ctx, id, str(f, "item"), f.get("checked") === "true"); } catch (e) { if (!(e instanceof HttpError)) throw e; }
  revalidatePath(`/app/missions/${id}`);
}

// ---------- Fleet ----------
export async function registerDroneAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  try {
    const d = repo.registerDrone(ctx, { name: str(f, "name"), manufacturer: str(f, "manufacturer"), model: str(f, "model"), serialNumber: str(f, "serialNumber"),
      registrationNumber: str(f, "registrationNumber"), registrationExpiresAt: str(f, "registrationExpiresAt"), providerKey: str(f, "providerKey") === "simulator" ? "simulator" : "manual" });
    await audit(ctx, "drone.registered", "drone", d.id, { changes: { serialNumber: [null, d.serialNumber] } });
  } catch (e) { return fail(e); }
  revalidatePath("/app/fleet");
  return { ok: "Drone registered." };
}

export async function droneStatusAction(f: FormData) {
  const ctx = await requireContext();
  assertCan(ctx, "drone:update");
  const d = db().drones.find((x) => x.id === str(f, "id") && x.organizationId === ctx.orgId);
  if (!d) throw notFound();
  const to = str(f, "status");
  if (d.status === "in_mission" || !["available", "maintenance"].includes(to)) return;
  const from = d.status;
  d.status = to as "available" | "maintenance";
  await audit(ctx, "drone.status_changed", "drone", d.id, { changes: { status: [from, d.status] } });
  revalidatePath("/app/fleet");
}

// ---------- Progress ----------
export async function recordProgressAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  try {
    const r = repo.recordProgress(ctx, { projectId: str(f, "projectId"), milestoneId: str(f, "milestoneId"), percentComplete: Number(str(f, "percent")), recordDate: str(f, "recordDate"), notes: str(f, "notes") });
    await audit(ctx, "progress.recorded", "progress_record", r.id, { projectId: r.projectId, changes: { percentComplete: [null, r.percentComplete], approvalStatus: [null, r.approvalStatus] } });
    if (r.approvalStatus === "pending_approval") emit({ key: "progress.approval_requested", orgId: ctx.orgId, projectId: r.projectId, entityType: "progress_record", entityId: r.id,
      title: "Progress awaiting approval", body: `${r.percentComplete}% recorded by ${repo.userName(ctx.userId)}`, href: `/app/progress?project=${r.projectId}`,
      recipients: membersWithRoles(ctx.orgId, r.projectId, ["project_manager"], true).filter((u) => u !== ctx.userId) });
    revalidatePath("/app/progress");
    revalidatePath(`/app/projects/${r.projectId}`);
    return { ok: r.approvalStatus === "approved" ? "Progress recorded and approved." : "Progress recorded — awaiting approval." };
  } catch (e) { return fail(e); }
}

export async function decideProgressAction(f: FormData) {
  const ctx = await requireContext();
  const r = repo.decideProgress(ctx, str(f, "id"), str(f, "decision") === "approve");
  await audit(ctx, `progress.${r.approvalStatus}`, "progress_record", r.id, { projectId: r.projectId, changes: { approvalStatus: ["pending_approval", r.approvalStatus] } });
  revalidatePath("/app/progress");
}

// ---------- Inspections ----------
export async function inspectionChecklistAction(f: FormData) {
  const ctx = await requireContext();
  const id = str(f, "id");
  try { repo.setChecklistValue(ctx, id, str(f, "item"), str(f, "value") as "pass" | "fail" | "na"); } catch (e) { if (!(e instanceof HttpError)) throw e; }
  revalidatePath(`/app/inspections/${id}`);
}

export async function inspectionTransitionAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const id = str(f, "id");
  try {
    const action = str(f, "action") as "start" | "submit" | "approve" | "reject" | "close";
    const i = repo.transitionInspection(ctx, id, action, str(f, "comment"));
    await audit(ctx, `inspection.${action}`, "inspection", id, { projectId: i.projectId, changes: { status: [null, i.status] } });
    const ib = { orgId: ctx.orgId, projectId: i.projectId, entityType: "inspection", entityId: i.id, href: `/app/inspections/${i.id}` };
    if (action === "submit" && i.reviewerId) emit({ ...ib, key: "inspection.submitted", title: "Inspection awaiting your review", body: i.title, recipients: [i.reviewerId] });
    if (action === "approve" && i.assigneeId) emit({ ...ib, key: "inspection.approved", title: "Inspection approved", body: i.title, recipients: [i.assigneeId] });
    if (action === "reject" && i.assigneeId) emit({ ...ib, key: "inspection.rejected", severity: "warning", title: "Inspection returned", body: `${i.title} — ${str(f, "comment")}`, recipients: [i.assigneeId] });
  } catch (e) { return fail(e); }
  revalidatePath(`/app/inspections/${id}`);
  return { ok: "Updated." };
}

export async function createFindingAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const id = str(f, "inspectionId");
  try {
    const sev = z.enum(["low", "medium", "high", "critical"]).parse(str(f, "severity"));
    const fd = repo.createFinding(ctx, id, { title: str(f, "title"), description: str(f, "description"), category: str(f, "category") || "quality", severity: sev, assetId: str(f, "assetId") || undefined });
    await audit(ctx, "finding.created", "finding", fd.id, { projectId: fd.projectId, changes: { severity: [null, fd.severity] } });
    emit({ key: "finding.created", orgId: ctx.orgId, projectId: fd.projectId, entityType: "finding", entityId: fd.id, href: `/app/inspections/${id}`,
      severity: sev === "critical" ? "critical" : sev === "high" ? "warning" : "info", title: `${sev[0].toUpperCase()}${sev.slice(1)} finding raised`, body: fd.title,
      recipients: sev === "critical" || sev === "high" ? membersWithRoles(ctx.orgId, fd.projectId, ["site_manager", "project_manager", "engineer"]) : [] });
  } catch (e) { return fail(e); }
  revalidatePath(`/app/inspections/${id}`);
  return { ok: "Finding created." };
}

export async function findingTransitionAction(f: FormData) {
  const ctx = await requireContext();
  try {
    const fd = repo.transitionFinding(ctx, str(f, "id"), str(f, "to") as never);
    await audit(ctx, `finding.${fd.status}`, "finding", fd.id, { projectId: fd.projectId });
  } catch (e) { if (!(e instanceof HttpError)) throw e; }
  revalidatePath(`/app/inspections/${str(f, "inspectionId")}`);
}

// ---------- Reports & media ----------
export async function generateReportAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  let id: string;
  try {
    const r = repo.generateReport(ctx, { projectId: str(f, "projectId"), periodStart: str(f, "periodStart"), periodEnd: str(f, "periodEnd"), sections: f.getAll("sections").map(String) });
    if (f.get("aiNarrative") === "on") {
      try {
        const n = await reportNarrative(ctx, r.projectId, r.periodStart, r.periodEnd); // AI-008
        r.narrative = { text: n.text, engine: n.engine, model: n.model };
        r.aiAssisted = n.engine === "claude";
      } catch (e) {
        if (!(e instanceof AiUnavailableError || e instanceof HttpError)) throw e; // report still generates without the narrative
      }
    }
    await audit(ctx, "report.generated", "report", r.id, { projectId: r.projectId });
    id = r.id;
  } catch (e) { return fail(e); }
  revalidatePath("/app/reports");
  redirect(`/app/reports/${id}`);
}

export async function publishReportAction(f: FormData) {
  const ctx = await requireContext();
  const r = repo.publishReport(ctx, str(f, "id"));
  await audit(ctx, "report.published", "report", r.id, { projectId: r.projectId, changes: { status: ["ready", "published"] } });
  emit({ key: "report.published", orgId: ctx.orgId, projectId: r.projectId, entityType: "report", entityId: r.id, href: `/app/reports/${r.id}`, title: "New report published", body: r.title,
    recipients: membersWithRoles(ctx.orgId, r.projectId, ["viewer", "project_manager", "site_manager"]) });
  revalidatePath(`/app/reports/${r.id}`);
}

export async function shareMediaAction(f: FormData) {
  const ctx = await requireContext();
  const m = repo.setMediaShared(ctx, str(f, "id"), str(f, "shared") === "true");
  await audit(ctx, m.sharedWithViewers ? "media.shared" : "media.unshared", "media", m.id, { projectId: m.projectId });
  revalidatePath("/app/media");
}

export async function markAllReadAction() {
  const ctx = await requireContext();
  repo.markAllRead(ctx);
  revalidatePath("/app", "layout");
}

// ---------- Team ----------
export async function inviteMemberAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  try {
    assertCan(ctx, "user:invite");
    const email = z.string().trim().toLowerCase().email("Enter a valid email.").parse(str(f, "email"));
    const role = z.enum(ROLES as [RoleKey, ...RoleKey[]]).parse(str(f, "role"));
    if ((role === "org_owner" || role === "org_admin") && ctx.role !== "org_owner" && ctx.role !== "org_admin") throw new HttpError(403, "PRIVILEGE_ESCALATION", "You can't grant a role with more permissions than your own.");
    let user = db().users.find((u) => u.email === email);
    if (user && db().memberships.some((m) => m.userId === user!.id && m.organizationId === ctx.orgId)) throw new HttpError(409, "CONFLICT", "This person is already a member.");
    if (!user) {
      user = { id: newId(), email, fullName: str(f, "fullName") || email.split("@")[0], passwordHash: hashPassword(DEMO_PASSWORD), mfaEnabled: false };
      db().users.push(user);
    }
    db().memberships.push({ id: newId(), organizationId: ctx.orgId, userId: user.id, role, status: "active", joinedAt: new Date().toISOString() });
    await audit(ctx, "member.invited", "user", user.id, { changes: { role: [null, role] } });
  } catch (e) { return fail(e); }
  revalidatePath("/app/team");
  return { ok: `Member added. In this demo, the new account signs in with the demo password.` };
}

export async function memberUpdateAction(f: FormData) {
  const ctx = await requireContext();
  assertCan(ctx, "user:manage");
  const m = db().memberships.find((x) => x.id === str(f, "id") && x.organizationId === ctx.orgId);
  if (!m) throw notFound();
  const owners = db().memberships.filter((x) => x.organizationId === ctx.orgId && x.role === "org_owner" && x.status === "active");
  const role = str(f, "role") as RoleKey;
  const status = str(f, "status") as "active" | "deactivated";
  if (m.role === "org_owner" && owners.length === 1 && ((role && role !== "org_owner") || status === "deactivated")) return; // RR-11 last owner
  if (role === "org_owner" && ctx.role !== "org_owner") return; // RR-10
  const before = { role: m.role, status: m.status };
  if (role && ROLES.includes(role)) m.role = role;
  if (status === "active" || status === "deactivated") m.status = status;
  await audit(ctx, before.status !== m.status ? `member.${m.status}` : "member.role_changed", "user", m.userId, { changes: { role: [before.role, m.role], status: [before.status, m.status] } });
  revalidatePath("/app/team");
}

// ---------- Inspections v2 ----------
export async function saveTemplateAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  try {
    const labels = str(f, "items").split("\n");
    const items = labels.map((l) => ({ label: l.replace(/^\*\s*/, ""), required: l.trim().startsWith("*") }));
    const t = repo.saveTemplate(ctx, { groupId: str(f, "groupId") || undefined, name: str(f, "name"), description: str(f, "description"), items });
    await audit(ctx, t.version > 1 ? "inspection_template.versioned" : "inspection_template.created", "inspection_template", t.id, { changes: { version: [t.version - 1 || null, t.version] } });
  } catch (e) { return fail(e); }
  revalidatePath("/app/inspections");
  return { ok: "Template published." };
}

export async function createInspectionAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  let id: string;
  try {
    const i = repo.createInspection(ctx, { siteId: str(f, "siteId"), templateId: str(f, "templateId"), title: str(f, "title"), type: str(f, "type") || "routine",
      assetId: str(f, "assetId") || undefined, assigneeId: str(f, "assigneeId"), reviewerId: str(f, "reviewerId"), dueDate: str(f, "dueDate") });
    await audit(ctx, "inspection.scheduled", "inspection", i.id, { projectId: i.projectId, changes: { assignee: [null, repo.userName(i.assigneeId)] } });
    emit({ key: "inspection.assigned", orgId: ctx.orgId, projectId: i.projectId, entityType: "inspection", entityId: i.id, href: `/app/inspections/${i.id}`,
      title: "Inspection assigned to you", body: `${i.title} — due ${i.dueDate}`, recipients: [i.assigneeId!] });
    id = i.id;
  } catch (e) { return fail(e); }
  revalidatePath("/app/inspections");
  redirect(`/app/inspections/${id}`);
}
