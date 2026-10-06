import { api } from "@/lib/api";
import { assertCan } from "@/lib/policy";
import { verifyAuditChain } from "@/lib/store";
export const GET = api(async (ctx) => { assertCan(ctx, "audit:read"); return verifyAuditChain(ctx.orgId); });
