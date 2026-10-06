// Automated site intelligence (Roadmap Phase 4): recurring capture schedules generate missions ahead of time,
// gated by a weather go/no-go, and completed scheduled flights trigger AI progress analysis automatically.
// Autonomous take-off from docks needs a dock provider integration (Integration Required): a pilot still starts
// each generated mission after the pre-flight checklist.
import "server-only";
import { db } from "./store";
import { newId } from "./ids";
import { assertCan, HttpError } from "./policy";
import { createMission } from "./repo";
import { flightWeather } from "./weather";
import type { AuthContext, CaptureSchedule, Mission, UUID } from "./types";

const DAY = 86_400_000;

/** Offset (ms) of `tz` from UTC at instant `t`. */
function tzOffset(tz: string, t: number) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(t)).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(t / 1000) * 1000;
}

/** UTC instant of a local wall-clock time in `tz` on the given local date (yyyy, mm, dd). */
export function zonedTime(y: number, m: number, d: number, hhmm: string, tz: string) {
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const t = guess - tzOffset(tz, guess);
  return t - (tzOffset(tz, t) - tzOffset(tz, guess)); // DST edge correction
}

/** Next occurrence strictly after `afterMs`, in the site's timezone. */
export function nextOccurrence(s: Pick<CaptureSchedule, "cadence" | "weekday" | "timeLocal">, tz: string, afterMs: number): number {
  const local = new Date(afterMs + tzOffset(tz, afterMs));
  for (let i = 0; i <= 62; i++) {
    const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + i));
    const t = zonedTime(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), s.timeLocal, tz);
    if (t <= afterMs) continue;
    if (s.cadence === "daily") return t;
    if (s.cadence === "monthly" ? day.getUTCDate() === Math.min(28, s.weekday || 1) : day.getUTCDay() === s.weekday) return t;
  }
  throw new HttpError(422, "VALIDATION_ERROR", "Could not compute the next run.");
}

function advance(s: CaptureSchedule, tz: string, fromMs: number) {
  let n = nextOccurrence(s, tz, fromMs);
  if (s.cadence === "biweekly") n = nextOccurrence(s, tz, n + 6 * DAY);
  return n;
}

export function listSchedules(ctx: AuthContext) {
  assertCan(ctx, "mission:read");
  return db().captureSchedules.filter((s) => s.organizationId === ctx.orgId);
}

export function saveSchedule(ctx: AuthContext, input: { id?: string; templateMissionId: UUID; name: string; cadence: CaptureSchedule["cadence"]; weekday: number; timeLocal: string; droneId?: UUID; pilotId?: UUID; autoAnalyze: boolean; weatherGate: boolean; enabled: boolean }) {
  const tpl = db().missions.find((m) => m.id === input.templateMissionId && m.organizationId === ctx.orgId);
  if (!tpl) throw new HttpError(404, "NOT_FOUND", "Template mission not found.");
  assertCan(ctx, "mission:create", { organizationId: ctx.orgId, projectId: tpl.projectId });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.timeLocal)) throw new HttpError(422, "VALIDATION_ERROR", "Time must be HH:MM.");
  if (!["daily", "weekly", "biweekly", "monthly"].includes(input.cadence)) throw new HttpError(422, "VALIDATION_ERROR", "Invalid cadence.");
  const site = db().sites.find((x) => x.id === tpl.siteId)!;
  const now = Date.now();
  let s = input.id ? db().captureSchedules.find((x) => x.id === input.id && x.organizationId === ctx.orgId) : undefined;
  if (input.id && !s) throw new HttpError(404, "NOT_FOUND", "Schedule not found.");
  if (!s) {
    s = { id: newId(), organizationId: ctx.orgId, projectId: tpl.projectId, siteId: tpl.siteId, name: "", templateMissionId: tpl.id, cadence: "weekly", weekday: 1, timeLocal: "10:00",
      autoAnalyze: true, weatherGate: true, enabled: true, nextRunAt: "", createdBy: ctx.userId, createdAt: new Date(now).toISOString() };
    db().captureSchedules.push(s);
  }
  Object.assign(s, { name: input.name.trim().slice(0, 100) || `${input.cadence} capture — ${site.name}`, templateMissionId: tpl.id, cadence: input.cadence,
    weekday: Math.max(0, Math.min(28, Math.round(input.weekday))), timeLocal: input.timeLocal, droneId: input.droneId || tpl.droneId, pilotId: input.pilotId || tpl.pilotId,
    autoAnalyze: input.autoAnalyze, weatherGate: input.weatherGate, enabled: input.enabled, createdBy: ctx.userId });
  s.nextRunAt = new Date(advance(s, site.timezone, now)).toISOString();
  return s;
}

/** Generate the next mission for a schedule. Returns the mission and the weather verdict. */
export async function runSchedule(ctx: AuthContext, s: CaptureSchedule, nowMs = Date.now()): Promise<{ mission: Mission; note: string }> {
  const tpl = db().missions.find((m) => m.id === s.templateMissionId && m.organizationId === s.organizationId);
  if (!tpl?.area) throw new HttpError(422, "VALIDATION_ERROR", "The template mission no longer exists or has no area.");
  const site = db().sites.find((x) => x.id === s.siteId)!;
  const at = Date.parse(s.nextRunAt) > nowMs ? s.nextRunAt : new Date(advance(s, site.timezone, nowMs)).toISOString();
  const m = createMission(ctx, { siteId: s.siteId, name: `${s.name} — ${at.slice(0, 10)}`, type: tpl.type, template: tpl.template === "orbit" ? "orbit" : "grid",
    area: tpl.area, params: { ...tpl.params }, scheduledStart: at, droneId: s.droneId, pilotId: s.pilotId });
  m.scheduleId = s.id;
  m.isSimulated = db().drones.find((d) => d.id === m.droneId)?.providerKey === "simulator";
  const w = await flightWeather(site.centroid[0], site.centroid[1], at, m.params.altitudeM);
  if (w) m.weather = w;
  let note = w ? `Weather ${w.verdict.replace("_", "-")}: ${w.reasons.join("; ")}` : "Weather forecast not available yet";
  if (s.weatherGate && w?.verdict === "no_go") note += " — flight flagged for rescheduling";
  db().missionEvents.push({ id: newId(), organizationId: m.organizationId, missionId: m.id, at: new Date(nowMs).toISOString(), type: "schedule", text: `Generated by schedule “${s.name}”. ${note}`, actorId: ctx.userId });
  s.lastRunAt = new Date(nowMs).toISOString();
  s.lastResult = `${m.code} for ${at.slice(0, 16).replace("T", " ")} UTC. ${note}`;
  s.nextRunAt = new Date(advance(s, site.timezone, Date.parse(at))).toISOString();
  return { mission: m, note };
}

export function scheduleCreatorCtx(s: CaptureSchedule): AuthContext | null {
  const m = db().memberships.find((x) => x.organizationId === s.organizationId && x.userId === s.createdBy && x.status === "active");
  return m ? { userId: s.createdBy, orgId: s.organizationId, role: m.role, isPlatformStaff: false, sessionId: `schedule:${s.id}` } : null;
}

/** Cron: generate missions for every enabled schedule whose next run falls within the look-ahead window. */
export async function runDueSchedules(nowMs = Date.now(), lookAheadMs = 36 * 3_600_000) {
  const out: { scheduleId: string; result: string }[] = [];
  for (const s of db().captureSchedules.filter((x) => x.enabled && Date.parse(x.nextRunAt) <= nowMs + lookAheadMs)) {
    const ctx = scheduleCreatorCtx(s);
    if (!ctx) { s.enabled = false; s.lastResult = "Disabled: the schedule owner is no longer an active member."; out.push({ scheduleId: s.id, result: s.lastResult }); continue; }
    try { const r = await runSchedule(ctx, s, nowMs); out.push({ scheduleId: s.id, result: `${r.mission.code}: ${r.note}` }); }
    catch (e) { s.lastResult = `Failed: ${(e as Error).message}`; out.push({ scheduleId: s.id, result: s.lastResult }); }
  }
  return out;
}
