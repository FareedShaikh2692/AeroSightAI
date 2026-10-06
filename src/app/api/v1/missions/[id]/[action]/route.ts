import { api } from "@/lib/api";
import * as repo from "@/lib/repo";
import { HttpError } from "@/lib/policy";
import { audit } from "@/lib/auth";
import type { MissionAction } from "@/lib/mission";

const ACTIONS: Record<string, MissionAction> = { plan: "plan", submit: "submit", approve: "approve", reject: "reject", ready: "markReady", start: "start", pause: "pause", resume: "resume", stop: "stop", abort: "abort", cancel: "cancel", revise: "revise" };

// POST /api/v1/missions/:id/{start|stop|abort|...}
export const POST = api<{ id: string; action: string }>(async (ctx, req, { id, action }) => {
  const a = ACTIONS[action];
  if (!a) throw new HttpError(404, "NOT_FOUND", "Unknown action.");
  const raw = await req.text();
  const body = raw ? (JSON.parse(raw) as { reason?: string; confirmPilotInCommand?: boolean }) : {};
  const r = repo.transitionMission(ctx, id, a, { reason: body.reason, confirmPilotInCommand: body.confirmPilotInCommand === true });
  await audit(ctx, `mission.${a}`, "mission", id, { projectId: r.mission.projectId, changes: { status: [r.from, r.mission.status] } });
  return { id: r.mission.id, status: r.mission.status, actualStart: r.mission.actualStart, actualEnd: r.mission.actualEnd, execution: r.execution };
});
