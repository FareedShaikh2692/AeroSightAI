"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, audit } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { newId } from "@/lib/ids";

const Cam = z.object({ lng: z.number().min(-180).max(180), lat: z.number().min(-90).max(90), height: z.number().min(1).max(50_000),
  heading: z.number().finite(), pitch: z.number().finite(), roll: z.number().finite() });

export async function saveViewpointAction(siteId: string, name: string, camera: unknown, shared: boolean): Promise<{ error?: string }> {
  const ctx = await requireContext();
  const site = repo.getSite(ctx, siteId);
  if (!site || !can(ctx, "twin:read", site)) return { error: "Not found or you don't have access." };
  const cam = Cam.safeParse(camera);
  const n = z.string().trim().min(1).max(60).safeParse(name);
  if (!cam.success || !n.success) return { error: "Invalid viewpoint." };
  if (db().viewpoints.filter((v) => v.organizationId === ctx.orgId && v.createdBy === ctx.userId).length >= 50) return { error: "You can keep up to 50 viewpoints." };
  const v = { id: newId(), organizationId: ctx.orgId, siteId, projectId: site.projectId, name: n.data, createdBy: ctx.userId, createdAt: new Date().toISOString(),
    visibility: shared && can(ctx, "map:annotate", site) ? "project" as const : "private" as const, camera: cam.data };
  db().viewpoints.push(v);
  await audit(ctx, "viewpoint.created", "viewpoint", v.id, { projectId: site.projectId });
  revalidatePath("/app/twin");
  return {};
}

export async function deleteViewpointAction(f: FormData) {
  const ctx = await requireContext();
  const v = db().viewpoints.find((x) => x.id === f.get("id") && x.organizationId === ctx.orgId && x.createdBy === ctx.userId);
  if (!v) return;
  db().viewpoints = db().viewpoints.filter((x) => x !== v);
  revalidatePath("/app/twin");
}
