import { api } from "@/lib/api";
import { audit } from "@/lib/auth";
import { assertCan } from "@/lib/policy";
import { organizationExport } from "@/lib/privacy";

// ORG-010: full organization export (Owner).
export const GET = api(async (ctx) => {
  assertCan(ctx, "org:delete");
  await audit(ctx, "org.export_requested", "organization", ctx.orgId);
  return new Response(JSON.stringify(organizationExport(ctx.orgId), null, 2), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="aerosight-organization-export.json"', "cache-control": "no-store" },
  });
});
