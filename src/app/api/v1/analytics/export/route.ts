// GET /api/v1/analytics/export?dataset=benchmark|findings|fleet&days=90 — CSV export (ANALYTICS-011).
import { api } from "@/lib/api";
import { assertCan, HttpError } from "@/lib/policy";
import { audit } from "@/lib/auth";
import { analyticsData } from "@/lib/analytics-data";
import { toCsv, SLA_HOURS } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export const GET = api(async (ctx, req) => {
  assertCan(ctx, "analytics:read");
  const u = new URL(req.url);
  const dataset = u.searchParams.get("dataset") ?? "benchmark";
  const days = [30, 90, 365].includes(Number(u.searchParams.get("days"))) ? Number(u.searchParams.get("days")) : 90;
  const d = analyticsData(ctx, days);
  let csv: string;
  if (dataset === "benchmark") csv = toCsv(d.bench.map(({ projectId: _id, ...r }) => r));
  else if (dataset === "fleet") csv = toCsv(d.fleet.map(({ droneId: _id, ...r }) => ({ ...r, periodDays: days })));
  else if (dataset === "findings") {
    const now = Date.now();
    csv = toCsv(d.findings.map((f) => ({ code: f.code, title: f.title, project: d.projects.find((p) => p.id === f.projectId)?.code ?? "", severity: f.severity, status: f.status, category: f.category,
      createdAt: f.createdAt, resolvedAt: f.resolvedAt ?? "", hoursToResolve: f.resolvedAt ? ((Date.parse(f.resolvedAt) - Date.parse(f.createdAt)) / 3_600_000).toFixed(1) : "",
      slaTargetHours: SLA_HOURS[f.severity], slaMet: f.resolvedAt ? String((Date.parse(f.resolvedAt) - Date.parse(f.createdAt)) / 3_600_000 <= SLA_HOURS[f.severity])
        : (now - Date.parse(f.createdAt)) / 3_600_000 > SLA_HOURS[f.severity] ? "false (open, breached)" : "pending" })));
  } else throw new HttpError(422, "VALIDATION_ERROR", "dataset must be benchmark, findings or fleet.");
  await audit(ctx, "analytics.exported", "analytics", dataset, { changes: { dataset: [null, dataset], days: [null, days] } });
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="aerosight-${dataset}-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
});
