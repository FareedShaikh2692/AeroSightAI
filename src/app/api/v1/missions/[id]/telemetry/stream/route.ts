// Server-Sent Events telemetry stream (simulator adapter). Realtime spec: docs/04-Architecture/Real-Time-Architecture.md.
// The production design uses a WebSocket gateway; SSE is used here because it runs on serverless functions.
import { getContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { problem } from "@/lib/api";
import { telemetryAt } from "@/lib/simulator";
import { latestSample } from "@/lib/edge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx || ctx.isPlatformStaff) return problem(401, "UNAUTHENTICATED", "Sign in first.", crypto.randomUUID());
  const mission = repo.getMission(ctx, id); // tenant + project scoped → null for other orgs (404)
  if (!mission) return problem(404, "NOT_FOUND", "Not found or you don't have access.", crypto.randomUUID());
  if (!can(ctx, "telemetry:read", mission)) return problem(403, "FORBIDDEN", "Requires permission telemetry:read.", crypto.randomUUID());
  const site = repo.getSite(ctx, mission.siteId)!;
  const hz = 2;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let n = 0, lastSeq = -1;
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("welcome", { missionId: mission.id, heartbeatSec: 15, hz, simulated: mission.isSimulated, status: mission.status });
      const timer = setInterval(() => {
        const m = repo.getMission(ctx, id);
        if (!m || (m.status !== "in_progress" && m.status !== "paused")) {
          send("mission_state", { status: m?.status ?? "unknown" });
          clearInterval(timer); controller.close(); return;
        }
        if (!m.isSimulated) {
          // Real aircraft: relay the newest edge-bridge sample (docs/04-Architecture/Drone-Architecture.md §6).
          const s = m.droneId ? latestSample(m.organizationId, m.droneId, 10_000) : undefined;
          if (s && s.seq !== lastSeq) { lastSeq = s.seq; send("telemetry", s); }
          if (n++ % (hz * 15) === 0) send("ping", { t: Date.now(), ...(s ? {} : { note: "Waiting for telemetry from the edge bridge — connect one under Fleet → Edge devices." }) });
          if (n > hz * 55) { clearInterval(timer); controller.close(); }
          return;
        }
        const { t, alerts } = telemetryAt(m, site, Date.now());
        send("telemetry", t);
        if (alerts.length && n % (hz * 5) === 0) send("alert", alerts);
        if (n++ % (hz * 15) === 0) send("ping", { t: Date.now() });
        if (n > hz * 55) { clearInterval(timer); controller.close(); } // client reconnects (EventSource auto-retry)
      }, 1000 / hz);
      req.signal.addEventListener("abort", () => { clearInterval(timer); try { controller.close(); } catch {} });
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}
