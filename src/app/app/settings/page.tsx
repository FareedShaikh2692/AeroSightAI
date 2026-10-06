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
import { removeDomainAction, revokeScimTokenAction } from "./sso-actions";
import { SsoConfigForm, AddDomainForm, VerifyDomainButton, CreateScimToken } from "./SsoForms";
import { getSsoConfig, JIT_ROLES } from "@/lib/sso";
import { requestOrigin } from "@/lib/origin";
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
    ...(can(ctx, "user:manage") ? [{ key: "sso", label: "Single sign-on", href: "/app/settings?tab=sso" }] : []),
  ];
  const sso = getSsoConfig(ctx.orgId);
  const origin = await requestOrigin();
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

      {tab === "sso" && can(ctx, "user:manage") && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="OpenID Connect identity provider">
            <SsoConfigForm callbackUrl={`${origin}/api/auth/sso/callback`} hasVerifiedDomain={!!sso?.domains.some((d) => d.verifiedAt)}
              roles={JIT_ROLES.map((r) => ({ key: r, label: ROLE_LABELS[r] }))}
              c={sso && { issuer: sso.issuer, clientId: sso.clientId, hasSecret: !!sso.clientSecretEnc, jitRole: sso.jitRole, enabled: sso.enabled, enforced: sso.enforced }} />
            <p className="mt-4 text-xs text-ink-3">SAML 2.0: <Badge>Integration Required</Badge> — specified in docs/07-Security/Authentication.md §6.3; use OIDC with Okta, Entra ID or Google Workspace.</p>
          </Card>
          <div className="space-y-6">
            <Card title="Verified email domains">
              <p className="mb-3 text-xs text-ink-2">Only users with an email in a verified domain can sign in through SSO or be provisioned. Verification is by DNS TXT record.</p>
              <ul className="mb-4 space-y-2">
                {(sso?.domains ?? []).map((d) => (
                  <li key={d.domain} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                    <span className="font-mono">{d.domain} {d.verifiedAt ? <Badge tone="ok">verified</Badge> : <Badge tone="warn">pending</Badge>}
                      {!d.verifiedAt && <span className="mt-1 block break-all text-[11px] text-ink-3">TXT _aerosight-verification.{d.domain} = {d.token}</span>}</span>
                    <span className="flex gap-2">{!d.verifiedAt && <VerifyDomainButton domain={d.domain} />}
                      <form action={removeDomainAction}><input type="hidden" name="domain" value={d.domain} /><button className="btn btn-ghost h-7 text-xs">Remove</button></form></span>
                  </li>
                ))}
                {!sso?.domains.length && <li className="text-sm text-ink-3">No domains yet.</li>}
              </ul>
              {sso ? <AddDomainForm /> : <p className="text-xs text-ink-3">Save the identity-provider settings first.</p>}
            </Card>
            <Card title="SCIM 2.0 provisioning">
              <p className="mb-3 text-xs text-ink-2">Base URL <code className="break-all">{origin}/api/scim/v2</code> · Bearer token. Supports Users: list/filter, create, replace, patch (active), delete (deactivates).</p>
              <ul className="mb-3 space-y-1 text-sm">
                {db().scimTokens.filter((t) => t.organizationId === ctx.orgId).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2"><span className="font-mono text-xs">asai_scim_{t.prefix}_… <span className="text-ink-3">· {t.lastUsedAt ? `used ${fmtDate(t.lastUsedAt)}` : "never used"}</span></span>
                    {t.revokedAt ? <Badge tone="bad">revoked</Badge> : <form action={revokeScimTokenAction}><input type="hidden" name="id" value={t.id} /><button className="btn btn-ghost h-7 text-xs">Revoke</button></form>}</li>
                ))}
              </ul>
              <CreateScimToken />
            </Card>
          </div>
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
