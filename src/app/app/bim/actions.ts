"use server";
import { revalidatePath } from "next/cache";
import { requireContext, audit } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { HttpError } from "@/lib/policy";
import { db } from "@/lib/store";
import { emit } from "@/lib/events";

/** Raise a quality finding for an out-of-tolerance as-built element, on the site's open inspection (or a new one). */
export async function raiseDeviationAction(f: FormData) {
  const ctx = await requireContext();
  const m = db().asBuilt.find((x) => x.id === f.get("id") && x.organizationId === ctx.orgId);
  const el = m && db().bimElements.find((e) => e.id === m.elementId);
  if (!m || !el || m.findingId) return;
  try {
    let insp = repo.listInspections(ctx).find((i) => i.siteId === el.siteId && ["draft", "scheduled", "in_progress"].includes(i.status));
    if (!insp) {
      const tpl = db().inspectionTemplates.find((t) => t.organizationId === ctx.orgId && t.status === "published");
      const pm = (role: string) => db().projectMembers.find((x) => x.organizationId === ctx.orgId && x.projectId === el.projectId && x.role === role)?.userId;
      if (!tpl) throw new HttpError(422, "VALIDATION_ERROR", "No published inspection template.");
      insp = repo.createInspection(ctx, { siteId: el.siteId, templateId: tpl.id, title: "BIM as-built deviation review", type: "Quality", assigneeId: pm("inspector") ?? pm("site_manager") ?? ctx.userId,
        reviewerId: pm("engineer") ?? ctx.userId, dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10) });
    }
    const dev = Math.round((m.measuredTopZ - el.topZ) * 1000);
    const fd = repo.createFinding(ctx, insp.id, { title: `As-built deviation ${dev > 0 ? "+" : ""}${dev} mm — ${el.name}`, category: "quality", severity: Math.abs(dev) > 60 ? "high" : "medium", assetId: el.assetId,
      description: `${el.ifcClass} ${el.name} (GUID ${el.guid}): design top ${el.topZ.toFixed(3)} m, measured ${m.measuredTopZ.toFixed(3)} m (${m.method}${m.synthetic ? ", synthetic demo data" : ""}). Tolerance ±25 mm.` });
    m.findingId = fd.id;
    await audit(ctx, "finding.created", "finding", fd.id, { projectId: fd.projectId, changes: { source: [null, "bim_deviation"] } });
    emit({ key: "finding.created", orgId: ctx.orgId, projectId: fd.projectId, entityType: "finding", entityId: fd.id, href: `/app/inspections/${insp.id}`, severity: fd.severity === "high" ? "warning" : "info",
      title: "BIM deviation finding", body: fd.title, recipients: [] });
  } catch (e) { if (!(e instanceof HttpError)) throw e; }
  revalidatePath("/app/bim");
}
