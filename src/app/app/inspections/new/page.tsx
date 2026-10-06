import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { PageHeader, Forbidden, Empty } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/permissions";
import { NewInspectionForm } from "./NewInspectionForm";

export default async function NewInspection() {
  const ctx = await requireContext();
  if (!can(ctx, "inspection:create") || !can(ctx, "inspection:assign")) return <Forbidden perm="inspection:assign" />;
  const sites = repo.listSites(ctx).filter((s) => can(ctx, "inspection:assign", s));
  if (!sites.length) return <Empty title="No sites where you can schedule inspections" />;
  const members = db().memberships.filter((m) => m.organizationId === ctx.orgId && m.status === "active").map((m) => ({ id: m.userId, label: `${repo.userName(m.userId)} · ${ROLE_LABELS[m.role]}`, role: m.role }));
  return (
    <>
      <PageHeader eyebrow="Inspections" title="Schedule an inspection" subtitle="The checklist is copied from the template's current version." />
      <NewInspectionForm
        sites={sites.map((s) => ({ id: s.id, name: s.name, assets: repo.listAssets(ctx, s.id).map((a) => ({ id: a.id, label: `${a.tag} · ${a.name}` })) }))}
        templates={repo.listTemplates(ctx).filter((t) => t.status === "published").map((t) => ({ id: t.id, label: `${t.name} (v${t.version}, ${t.items.length} items)` }))}
        assignees={members.filter((m) => ["inspector", "site_manager", "project_manager", "org_admin", "org_owner"].includes(m.role))}
        reviewers={members.filter((m) => ["engineer", "org_admin", "org_owner"].includes(m.role))} />
    </>
  );
}
