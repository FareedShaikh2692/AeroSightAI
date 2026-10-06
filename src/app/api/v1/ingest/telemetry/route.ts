// POST /api/v1/ingest/telemetry — edge-bridge telemetry ingestion (docs/06-API/API-Specification.md §5.9).
// Auth: `Authorization: Device asai_edge_<prefix>_<secret>` — a per-drone token from Fleet → Edge devices.
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { problem } from "@/lib/api";
import { deviceForToken, ingest } from "@/lib/edge";
import { HttpError } from "@/lib/policy";
import { newId } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? newId();
  const h = req.headers.get("authorization") ?? "";
  const device = deviceForToken(h.startsWith("Device ") ? h.slice(7).trim() : null);
  if (!device) return problem(401, "UNAUTHENTICATED", "Missing, unknown or revoked device token.", requestId);
  const raw = await req.text();
  if (raw.length > 64_000) return problem(413, "PAYLOAD_TOO_LARGE", "Send at most 50 samples per request.", requestId);
  try {
    const r = ingest(device, JSON.parse(raw));
    return NextResponse.json(r, { status: r.accepted ? 202 : 422, headers: { "x-request-id": requestId, "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof SyntaxError) return problem(400, "BAD_REQUEST", "Malformed JSON body.", requestId);
    if (e instanceof ZodError) { device.messagesRejected++; return problem(422, "VALIDATION_ERROR", e.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), requestId); }
    if (e instanceof HttpError) return problem(e.status, e.code, e.message, requestId);
    console.error(`[ingest] ${requestId}`, e);
    return problem(500, "INTERNAL_ERROR", "Something went wrong.", requestId);
  }
}
