import { requireContext } from "@/lib/auth";
import { can } from "@/lib/policy";
import { PageHeader, Forbidden } from "@/components/ui";
import { NewProjectForm } from "./NewProjectForm";

export default async function NewProject() {
  const ctx = await requireContext();
  if (!can(ctx, "project:create")) return <Forbidden perm="project:create" />;
  return (
    <>
      <PageHeader eyebrow="Projects" title="New project" subtitle="Projects group sites, team, milestones, missions and reports." />
      <NewProjectForm />
    </>
  );
}
