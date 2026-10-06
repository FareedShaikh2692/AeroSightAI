import { requireContext } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { PERMISSIONS, ROLES, ROLE_LABELS, ROLE_PERMISSIONS, RESTRICTED, ORG_SCOPED } from "@/lib/permissions";

export default async function Roles() {
  const ctx = await requireContext();
  const modules = [...new Set(PERMISSIONS.map((p) => p.split(":")[0]))];
  return (
    <>
      <PageHeader eyebrow="Organization" title="Roles & permissions" subtitle={`Your role: ${ROLE_LABELS[ctx.role]}. System roles are read-only; custom roles are available on Professional and Enterprise plans.`} />
      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="table text-xs">
            <thead><tr><th className="sticky left-0 bg-surface">Permission</th><th>Scope</th>{ROLES.map((r) => <th key={r} className={`text-center ${r === ctx.role ? "text-accent" : ""}`}>{ROLE_LABELS[r]}</th>)}</tr></thead>
            <tbody>
              {modules.map((mod) => [
                <tr key={mod}><td colSpan={ROLES.length + 2} className="bg-raised text-[11px] font-semibold uppercase tracking-wider text-ink-2">{mod}</td></tr>,
                ...PERMISSIONS.filter((p) => p.startsWith(mod + ":")).map((p) => (
                  <tr key={p}>
                    <td className="sticky left-0 bg-surface font-mono">{p}</td><td className="text-ink-3">{ORG_SCOPED.has(p) ? "org" : "project"}</td>
                    {ROLES.map((r) => { const has = ROLE_PERMISSIONS[r].has(p); const rs = RESTRICTED[r]?.[p];
                      return <td key={r} className="text-center">{has ? <span className={rs ? "text-warn" : "text-ok"} title={rs === "S" ? "Shared/published content only" : rs === "A" ? "Assigned items only" : undefined}>{rs ?? "✓"}</span> : <span className="text-ink-3">·</span>}</td>; })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-ink-3">✓ granted · S shared/published content only · A assigned items only. Every check is enforced on the server; the interface only hides what you can&apos;t use.</p>
    </>
  );
}
