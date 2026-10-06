import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { PageHeader, Card, Badge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/permissions";
import { can } from "@/lib/policy";

export default async function Settings() {
  const ctx = await requireContext();
  const org = repo.currentOrg(ctx);
  const user = repo.currentUser(ctx);
  return (
    <>
      <PageHeader eyebrow="Organization" title="Settings" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Your profile"><dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-ink-3">Name</dt><dd>{user.fullName}</dd><dt className="text-ink-3">Email</dt><dd>{user.email}</dd>
          <dt className="text-ink-3">Role</dt><dd>{ROLE_LABELS[ctx.role]}</dd><dt className="text-ink-3">Two-factor</dt><dd>{user.mfaEnabled ? <Badge tone="ok">enabled</Badge> : <Badge>not enabled</Badge>}</dd>
        </dl><p className="mt-4 text-xs text-ink-3">TOTP enrollment, session management and password change are specified (AUTH-009, AUTH-013) and arrive with persistent storage.</p></Card>
        <Card title="Organization"><dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-ink-3">Name</dt><dd>{org.name}</dd><dt className="text-ink-3">Slug</dt><dd className="font-mono">{org.slug}</dd>
          <dt className="text-ink-3">Region</dt><dd className="font-mono">{org.region}</dd><dt className="text-ink-3">Timezone</dt><dd>{org.timezone}</dd>
          <dt className="text-ink-3">Brand color</dt><dd className="flex items-center gap-2"><span className="h-4 w-4 rounded" style={{ background: org.brandColor }} />{org.brandColor}</dd>
          <dt className="text-ink-3">Mission approval</dt><dd>{org.settings.missionApprovalRequired ? "required" : "not required"}</dd>
          <dt className="text-ink-3">Enforce 2FA</dt><dd>{org.settings.mfaRequired ? "yes" : "no"}</dd>
          <dt className="text-ink-3">External sharing</dt><dd>{org.settings.externalSharing ? "allowed" : "disabled"}</dd>
        </dl>{!can(ctx, "org:update") && <p className="mt-4 text-xs text-ink-3">Only Owners and Admins can change organization settings.</p>}</Card>
        <Card title="Data & privacy" className="xl:col-span-2"><p className="text-sm text-ink-2">Retention policies, legal holds, organization export and deletion are specified in docs/07-Security/Privacy.md. In this demo build all data is held in memory and resets when the server restarts.</p></Card>
      </div>
    </>
  );
}
