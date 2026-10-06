import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { PageHeader, Card, Badge, Tabs } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/permissions";
import { MANDATORY, prefFor } from "@/lib/events";
import { RETENTION_BOUNDS, activeHolds } from "@/lib/privacy";
import { MfaSetup, PreferencesForm, OrgSettingsForm, RetentionForm, LegalHoldForm } from "./SettingsForms";
import { releaseHoldAction } from "./actions";
import { fmtDate } from "@/lib/format";
import type { DataClass, NotificationCategory } from "@/lib/types";

const CATS: NotificationCategory[] = ["missions", "telemetry", "inspections", "progress", "reports", "ai", "fleet", "security", "billing"];

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireContext();
  const { tab = "security" } = await searchParams;
  const org = repo.currentOrg(ctx);
  const user = repo.currentUser(ctx);
  const tabs = [
    { key: "security", label: "Profile & security", href: "/app/settings" },
    { key: "notifications", label: "Notifications", href: "/app/settings?tab=notifications" },
    { key: "organization", label: "Organization", href: "/app/settings?tab=organization" },
    { key: "data", label: "Data & privacy", href: "/app/settings?tab=data" },
  ];
  return (
    <>
      <PageHeader eyebrow="Organization" title="Settings" />
      <Tabs items={tabs} active={tab} />

      {tab === "security" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Your profile"><dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-3">Name</dt><dd>{user.fullName}</dd><dt className="text-ink-3">Email</dt><dd>{user.email}</dd>
            <dt className="text-ink-3">Role</dt><dd>{ROLE_LABELS[ctx.role]}</dd>
            <dt className="text-ink-3">Two-factor</dt><dd>{user.mfaSecret ? <Badge tone="ok">enabled</Badge> : <Badge>not enabled</Badge>}</dd>
          </dl></Card>
          <Card title="Two-factor authentication"><MfaSetup enabled={!!user.mfaSecret} enforced={org.settings.mfaRequired} remainingCodes={user.recoveryCodeHashes?.length ?? 0} /></Card>
        </div>
      )}

      {tab === "notifications" && (
        <Card title="Notification preferences" pad={false}>
          <PreferencesForm prefs={CATS.map((c) => ({ ...prefFor(ctx.orgId, ctx.userId, c), mandatory: MANDATORY.includes(c) }))} />
        </Card>
      )}

      {tab === "organization" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Policies"><OrgSettingsForm s={org.settings} brandColor={org.brandColor} disabled={!can(ctx, "org:update")} />
            {!can(ctx, "org:update") && <p className="mt-3 text-xs text-ink-3">Only Owners and Admins can change organization settings.</p>}</Card>
          <Card title="Organization"><dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-3">Name</dt><dd>{org.name}</dd><dt className="text-ink-3">Slug</dt><dd className="font-mono">{org.slug}</dd>
            <dt className="text-ink-3">Region</dt><dd className="font-mono">{org.region}</dd><dt className="text-ink-3">Timezone</dt><dd>{org.timezone}</dd>
            <dt className="text-ink-3">Plan</dt><dd className="capitalize">{org.plan}</dd>
            <dt className="text-ink-3">AI credits</dt><dd className="font-mono">{org.aiCreditsUsed} / {org.aiCreditsLimit}</dd>
          </dl></Card>
        </div>
      )}

      {tab === "data" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Retention policy">
            <RetentionForm disabled={!can(ctx, "retention:manage")} rows={(Object.entries(RETENTION_BOUNDS) as [DataClass, (typeof RETENTION_BOUNDS)[DataClass]][]).map(([cls, b]) => ({
              cls, label: b.label, min: b.min, max: b.max, days: db().retentionPolicies.find((p) => p.organizationId === ctx.orgId && p.dataClass === cls)?.retentionDays ?? b.max }))} />
          </Card>
          <div className="space-y-6">
            <Card title="Legal holds">
              {activeHolds(ctx.orgId).length === 0 ? <p className="mb-4 text-sm text-ink-2">No active legal holds.</p> : (
                <ul className="mb-4 space-y-2">{activeHolds(ctx.orgId).map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                    <span>{h.projectId ? db().projects.find((p) => p.id === h.projectId)?.name : "Whole organization"} — {h.reason}<span className="block text-xs text-ink-3">placed {fmtDate(h.placedAt)} by {repo.userName(h.placedBy)}</span></span>
                    {can(ctx, "retention:manage") && <form action={releaseHoldAction}><input type="hidden" name="id" value={h.id} /><button className="btn btn-ghost h-8 text-xs">Release</button></form>}
                  </li>))}</ul>
              )}
              {can(ctx, "retention:manage") && <LegalHoldForm projects={repo.listProjects(ctx).map((p) => ({ id: p.id, name: p.name }))} />}
            </Card>
            <Card title="Exports">
              <div className="flex flex-wrap gap-2">
                <a href="/api/v1/me/export" className="btn btn-secondary">Download my personal data (JSON)</a>
                {can(ctx, "org:delete") && <a href="/api/v1/organizations/current/export" className="btn btn-secondary">Export organization (JSON)</a>}
              </div>
              <p className="mt-2 text-xs text-ink-3">Exports are audited. Secrets, password hashes and key material are excluded.</p>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
