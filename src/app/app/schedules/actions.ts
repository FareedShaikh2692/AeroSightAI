"use server";
import { revalidatePath } from "next/cache";
import { requireContext, audit } from "@/lib/auth";
import { assertCan, HttpError } from "@/lib/policy";
import { db } from "@/lib/store";
import { saveSchedule, runSchedule } from "@/lib/schedules";
import { emit } from "@/lib/events";
import type { CaptureSchedule } from "@/lib/types";

export type SchedState = { error?: string | null; ok?: string | null };

export async function saveScheduleAction(_: SchedState, f: FormData): Promise<SchedState> {
  const ctx = await requireContext();
  try {
    const s = saveSchedule(ctx, { templateMissionId: String(f.get("templateMissionId") ?? ""), name: String(f.get("name") ?? ""),
      cadence: String(f.get("cadence") ?? "weekly") as CaptureSchedule["cadence"], weekday: Number(f.get("weekday") ?? 1), timeLocal: String(f.get("timeLocal") ?? "10:00"),
      droneId: String(f.get("droneId") ?? "") || undefined, pilotId: String(f.get("pilotId") ?? "") || undefined,
      autoAnalyze: f.get("autoAnalyze") === "on", weatherGate: f.get("weatherGate") === "on", enabled: true });
    await audit(ctx, "schedule.saved", "capture_schedule", s.id, { projectId: s.projectId, changes: { cadence: [null, s.cadence], nextRunAt: [null, s.nextRunAt] } });
  } catch (e) { if (e instanceof HttpError) return { error: e.message }; throw e; }
  revalidatePath("/app/schedules");
  return { ok: "Schedule saved." };
}

export async function runNowAction(_: SchedState, f: FormData): Promise<SchedState> {
  const ctx = await requireContext();
  const s = db().captureSchedules.find((x) => x.id === f.get("id") && x.organizationId === ctx.orgId);
  if (!s) return { error: "Schedule not found." };
  try {
    assertCan(ctx, "mission:create", { organizationId: ctx.orgId, projectId: s.projectId });
    const r = await runSchedule(ctx, s);
    await audit(ctx, "schedule.run", "capture_schedule", s.id, { projectId: s.projectId, changes: { mission: [null, r.mission.code] } });
    const pilotUser = db().pilots.find((p) => p.id === r.mission.pilotId)?.userId;
    emit({ key: "schedule.capture_created", orgId: ctx.orgId, projectId: s.projectId, entityType: "mission", entityId: r.mission.id, href: `/app/missions/${r.mission.id}`,
      severity: r.mission.weather?.verdict === "no_go" ? "warning" : "info", title: "Scheduled capture created", body: `${r.mission.name}. ${r.note}`, recipients: pilotUser ? [pilotUser] : [] });
    revalidatePath("/app/schedules");
    return { ok: `Created ${r.mission.code}. ${r.note}` };
  } catch (e) { if (e instanceof HttpError) return { error: e.message }; throw e; }
}

export async function toggleScheduleAction(f: FormData) {
  const ctx = await requireContext();
  const s = db().captureSchedules.find((x) => x.id === f.get("id") && x.organizationId === ctx.orgId);
  if (!s) return;
  assertCan(ctx, "mission:create", { organizationId: ctx.orgId, projectId: s.projectId });
  s.enabled = !s.enabled;
  await audit(ctx, "schedule.toggled", "capture_schedule", s.id, { changes: { enabled: [!s.enabled, s.enabled] } });
  revalidatePath("/app/schedules");
}
