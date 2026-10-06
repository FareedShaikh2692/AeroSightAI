import { api, page } from "@/lib/api";
import * as repo from "@/lib/repo";
import { audit } from "@/lib/auth";

export const GET = api(async (ctx, req) => {
  const u = new URL(req.url);
  const since = u.searchParams.get("since");
  const rows = since ? repo.listAudit(ctx).filter((r) => r.occurredAt > since) : repo.listAudit(ctx);
  if (u.searchParams.get("format") === "jsonl") {
    // SIEM pull export (Splunk, Microsoft Sentinel, Elastic): one JSON event per line, oldest first, with the
    // hash-chain fields so the receiver can verify integrity. Poll with ?since=<last occurredAt>.
    await audit(ctx, "audit.exported", "audit_log", undefined, { changes: { rows: [null, rows.length], format: [null, "jsonl"] } });
    const body = [...rows].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).map((r) => JSON.stringify({
      "@timestamp": r.occurredAt, event: { action: r.action, category: r.action.split(".")[0], id: r.id }, organization: { id: r.organizationId },
      actor: { type: r.actorType, id: r.actorId, label: r.actorLabel }, entity: { type: r.entityType, id: r.entityId }, project: r.projectId ? { id: r.projectId } : undefined,
      source: r.ip ? { ip: r.ip } : undefined, changes: r.changes, integrity: { hash: r.hash, prevHash: r.prevHash, alg: "sha256-chain" },
    })).join("\n");
    return new Response(body ? `${body}\n` : "", { headers: { "content-type": "application/x-ndjson; charset=utf-8", "content-disposition": 'attachment; filename="audit-log.jsonl"', "cache-control": "no-store" } });
  }
  if (u.searchParams.get("format") === "csv") {
    await audit(ctx, "audit.exported", "audit_log", undefined, { changes: { rows: [null, rows.length] } });
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["occurredAt,actorType,actor,action,entityType,entityId,ip,changes,hash", ...rows.map((r) =>
      [r.occurredAt, r.actorType, r.actorLabel, r.action, r.entityType, r.entityId, r.ip, JSON.stringify(r.changes ?? {}), r.hash].map(q).join(","))].join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="audit-log.csv"' } });
  }
  return page(rows, req.url);
});
