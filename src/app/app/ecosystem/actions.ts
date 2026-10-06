"use server";
import { revalidatePath } from "next/cache";
import { requireContext, audit } from "@/lib/auth";
import { assertCan } from "@/lib/policy";
import { db } from "@/lib/store";
import { adapter } from "@/lib/adapters";

export async function toggleAdapterAction(f: FormData) {
  const ctx = await requireContext();
  assertCan(ctx, "integration:manage");
  const a = adapter(String(f.get("key") ?? ""));
  if (!a || a.builtIn) return;
  const i = db().orgAdapters.findIndex((x) => x.organizationId === ctx.orgId && x.adapterKey === a.key);
  if (i >= 0) {
    if (db().drones.some((d) => d.organizationId === ctx.orgId && d.providerKey === a.key && d.status !== "retired")) return; // retire its drones first
    db().orgAdapters.splice(i, 1);
    await audit(ctx, "adapter.disabled", "adapter", a.key);
  } else {
    db().orgAdapters.push({ organizationId: ctx.orgId, adapterKey: a.key, enabledAt: new Date().toISOString(), enabledBy: ctx.userId });
    await audit(ctx, "adapter.enabled", "adapter", a.key);
  }
  revalidatePath("/app/ecosystem");
  revalidatePath("/app/fleet");
}
