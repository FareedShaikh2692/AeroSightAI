import { api } from "@/lib/api";
import { audit } from "@/lib/auth";
import { personalExport } from "@/lib/privacy";

// DSAR export of the caller's personal data (PRIV-004/005).
export const GET = api(async (ctx) => {
  await audit(ctx, "privacy.personal_export", "user", ctx.userId);
  return new Response(JSON.stringify(personalExport(ctx.orgId, ctx.userId), null, 2), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="aerosight-personal-data.json"', "cache-control": "no-store" },
  });
});
