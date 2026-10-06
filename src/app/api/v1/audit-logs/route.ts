import { api, page } from "@/lib/api";
import * as repo from "@/lib/repo";
import { audit } from "@/lib/auth";

export const GET = api(async (ctx, req) => {
  const rows = repo.listAudit(ctx);
  if (new URL(req.url).searchParams.get("format") === "csv") {
    await audit(ctx, "audit.exported", "audit_log", undefined, { changes: { rows: [null, rows.length] } });
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["occurredAt,actorType,actor,action,entityType,entityId,ip,changes,hash", ...rows.map((r) =>
      [r.occurredAt, r.actorType, r.actorLabel, r.action, r.entityType, r.entityId, r.ip, JSON.stringify(r.changes ?? {}), r.hash].map(q).join(","))].join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="audit-log.csv"' } });
  }
  return page(rows, req.url);
});
