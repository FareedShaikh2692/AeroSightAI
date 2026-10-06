import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Forbidden } from "@/components/ui";
import { NewSiteForm } from "./NewSiteForm";

export default async function NewSite({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  const p = repo.getProject(ctx, id);
  if (!p) notFound();
  if (!can(ctx, "site:create", p)) return <Forbidden perm="site:create" />;
  return (
    <>
      <PageHeader eyebrow={p.name} title="New site" subtitle="Draw the site boundary on the map. It anchors flights, media, assets and inspections." />
      <NewSiteForm projectId={p.id} center={p.location} />
    </>
  );
}
