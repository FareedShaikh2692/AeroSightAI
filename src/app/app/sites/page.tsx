import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { PageHeader, StatusBadge, Empty, Card } from "@/components/ui";
import { MapClient } from "@/components/MapClient";
import { fmtArea } from "@/lib/format";

export default async function Sites() {
  const ctx = await requireContext();
  const sites = repo.listSites(ctx);
  const projects = new Map(repo.listProjects(ctx).map((p) => [p.id, p]));
  return (
    <>
      <PageHeader eyebrow="Work" title="Sites" subtitle="Geo-bounded locations where work and flights happen. Add sites from a project." />
      {sites.length === 0 ? <Empty title="No sites" body="Open a project and choose “Add site”." /> : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          <div className="card overflow-x-auto">
            <table className="table"><thead><tr><th>Site</th><th>Project</th><th>Area</th><th>Status</th></tr></thead><tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/app/sites/${s.id}`} className="hover:text-accent">{s.name}</Link><div className="font-mono text-[11px] text-ink-3">{s.code}</div></td>
                  <td className="text-ink-2">{projects.get(s.projectId)?.name}</td>
                  <td className="font-mono text-xs">{fmtArea(s.areaM2)}</td>
                  <td><StatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody></table>
          </div>
          <Card pad={false}><MapClient height={520} fitTo={sites.flatMap((s) => s.boundary)} data={{ sites: sites.map((s) => ({ id: s.id, name: s.name, boundary: s.boundary })),
            pins: sites.map((s) => ({ id: s.id, label: s.name, location: s.centroid, href: `/app/sites/${s.id}`, color: "#22D3EE" })) }} /></Card>
        </div>
      )}
    </>
  );
}
