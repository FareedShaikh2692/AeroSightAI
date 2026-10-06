import { api } from "@/lib/api";
import * as repo from "@/lib/repo";
export const GET = api(async (ctx) => {
  const u = repo.currentUser(ctx), o = repo.currentOrg(ctx);
  return { id: u.id, email: u.email, fullName: u.fullName, mfaEnabled: u.mfaEnabled, role: ctx.role, organization: { id: o.id, name: o.name, slug: o.slug, plan: o.plan } };
});
