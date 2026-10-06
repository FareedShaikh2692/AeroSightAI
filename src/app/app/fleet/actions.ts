"use server";
import { revalidatePath } from "next/cache";
import { requireContext, audit } from "@/lib/auth";
import { HttpError } from "@/lib/policy";
import { createEdgeDevice, revokeEdgeDevice } from "@/lib/edge";

export type EdgeState = { error?: string | null; ok?: string | null; secret?: string };

export async function createEdgeDeviceAction(_: EdgeState, f: FormData): Promise<EdgeState> {
  const ctx = await requireContext();
  let token: string;
  try {
    const r = createEdgeDevice(ctx, String(f.get("droneId") ?? ""), String(f.get("name") ?? ""));
    token = r.token;
    await audit(ctx, "edge_device.created", "edge_device", r.device.id, { changes: { droneId: [null, r.device.droneId] } });
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    throw e;
  }
  revalidatePath("/app/fleet");
  return { ok: "Device token created. Copy it now — it won't be shown again.", secret: token };
}

export async function revokeEdgeDeviceAction(f: FormData) {
  const ctx = await requireContext();
  try {
    const d = revokeEdgeDevice(ctx, String(f.get("id") ?? ""));
    await audit(ctx, "edge_device.revoked", "edge_device", d.id);
  } catch (e) { if (!(e instanceof HttpError)) throw e; }
  revalidatePath("/app/fleet");
}
