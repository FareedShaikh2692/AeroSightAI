import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Card, Badge, Forbidden } from "@/components/ui";
import { TemplateForm } from "./TemplateForm";
import { fmtDate } from "@/lib/format";

export default async function Templates({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "inspection:read")) return <Forbidden perm="inspection:read" />;
  const { edit } = await searchParams;
  const all = repo.listTemplates(ctx);
  const groups = [...new Set(all.map((t) => t.groupId))].map((g) => all.filter((t) => t.groupId === g).sort((a, b) => b.version - a.version));
  const editing = edit ? all.find((t) => t.groupId === edit && t.status === "published") : undefined;
  const canManage = can(ctx, "inspection:template_manage");
  return (
    <>
      <PageHeader eyebrow="Inspections" title="Checklist templates" subtitle="Publishing a new version doesn't change inspections already created from an earlier version."
        actions={<Link href="/app/inspections" className="btn btn-secondary">Back to inspections</Link>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <div className="space-y-4">
          {groups.map((versions) => { const cur = versions.find((v) => v.status === "published") ?? versions[0]; return (
            <Card key={cur.groupId} title={<span className="flex items-center gap-2">{cur.name} <Badge tone="ok">v{cur.version}</Badge></span>}
              actions={canManage ? <Link href={`/app/inspections/templates?edit=${cur.groupId}`} className="text-xs text-accent">New version</Link> : undefined}>
              <p className="mb-3 text-sm text-ink-2">{cur.description}</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">{cur.items.map((i) => <li key={i.id}>{i.label}{i.required && <span className="ml-2 text-xs text-ink-3">required</span>}</li>)}</ol>
              <p className="mt-3 text-xs text-ink-3">{versions.length} version(s) · current published {fmtDate(cur.createdAt)} by {repo.userName(cur.createdBy)}</p>
            </Card>); })}
        </div>
        {canManage && <Card title={editing ? `New version of “${editing.name}”` : "New template"}>
          <TemplateForm key={editing?.groupId ?? "new"} groupId={editing?.groupId} name={editing?.name} description={editing?.description} items={editing?.items.map((i) => `${i.required ? "* " : ""}${i.label}`).join("\n")} />
        </Card>}
      </div>
    </>
  );
}
