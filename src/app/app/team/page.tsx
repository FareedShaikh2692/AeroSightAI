import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, StatusBadge, Card, Badge } from "@/components/ui";
import { ROLES, ROLE_LABELS } from "@/lib/permissions";
import { memberUpdateAction } from "../actions";
import { InviteMember } from "./InviteMember";
import { relTime } from "@/lib/format";

export default async function Team() {
  const ctx = await requireContext();
  const members = repo.members(ctx);
  const manage = can(ctx, "user:manage");
  return (
    <>
      <PageHeader eyebrow="Organization" title="Team" subtitle={`${members.length} member(s). Owners and Admins can access every project; others see projects they're assigned to.`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>Member</th><th>Role</th><th>Projects</th><th>2FA</th><th>Last sign-in</th><th>Status</th>{manage && <th />}</tr></thead>
          <tbody>{members.map((m) => (
            <tr key={m.id}>
              <td>{m.fullName}<div className="text-xs text-ink-3">{manage ? m.email : ""}</div></td>
              <td>{manage && m.userId !== ctx.userId ? (
                <form action={memberUpdateAction} className="flex gap-1"><input type="hidden" name="id" value={m.id} />
                  <select name="role" defaultValue={m.role} className="input h-8 w-40 text-xs" aria-label={`Role for ${m.fullName}`}>{ROLES.filter((r) => r !== "org_owner" || ctx.role === "org_owner").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
                  <button className="btn btn-secondary h-8 px-2 text-xs">Save</button></form>
              ) : ROLE_LABELS[m.role]}</td>
              <td className="font-mono text-xs">{m.role === "org_owner" || m.role === "org_admin" ? "all" : m.projects}</td>
              <td>{m.mfaEnabled ? <Badge tone="ok">on</Badge> : <Badge>off</Badge>}</td>
              <td className="text-xs text-ink-2">{m.lastLoginAt ? relTime(m.lastLoginAt) : "—"}</td>
              <td><StatusBadge status={m.status} /></td>
              {manage && <td>{m.userId !== ctx.userId && (
                <form action={memberUpdateAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value={m.status === "active" ? "deactivated" : "active"} />
                  <button className="btn btn-ghost h-8 px-2 text-xs">{m.status === "active" ? "Deactivate" : "Reactivate"}</button></form>)}</td>}
            </tr>
          ))}</tbody>
        </table></div>
        {can(ctx, "user:invite") && <Card title="Add member"><InviteMember canGrantAdmin={ctx.role === "org_owner" || ctx.role === "org_admin"} /></Card>}
      </div>
      <p className="mt-3 text-xs text-ink-3">Deactivation takes effect on the member&apos;s next request. The last Owner can&apos;t be demoted or deactivated.</p>
    </>
  );
}
