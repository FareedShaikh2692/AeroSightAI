// Data retention, legal holds and exports (PRIV-002/003/004, docs/07-Security/Privacy.md §4).
import "server-only";
import { db, store } from "./store";
import type { DataClass, UUID } from "./types";

export const RETENTION_BOUNDS: Record<DataClass, { min: number; max: number; label: string }> = {
  raw_media: { min: 90, max: 3650, label: "Media (originals)" },
  telemetry: { min: 7, max: 2555, label: "Telemetry" },
  audit_logs: { min: 365, max: 2555, label: "Audit logs" },
  notifications: { min: 30, max: 365, label: "Notifications" },
  ai_conversations: { min: 0, max: 365, label: "AI assistant conversations" },
  reports: { min: 365, max: 3650, label: "Reports" },
};

export function activeHolds(orgId: UUID) {
  return db().legalHolds.filter((h) => h.organizationId === orgId && !h.releasedAt);
}
function held(orgId: UUID, projectId?: UUID) {
  return activeHolds(orgId).some((h) => !h.projectId || h.projectId === projectId);
}

/** Preview or apply retention for one organization. Legal holds always win. */
export function enforceRetention(orgId: UUID, apply: boolean, now = Date.now()) {
  const d = db();
  const days = (c: DataClass) => d.retentionPolicies.find((p) => p.organizationId === orgId && p.dataClass === c)?.retentionDays ?? Infinity;
  const older = (iso: string, c: DataClass) => now - Date.parse(iso) > days(c) * 86_400_000;
  const orgHold = held(orgId);
  const victims = {
    raw_media: d.media.filter((m) => m.organizationId === orgId && older(m.capturedAt, "raw_media") && !held(orgId, m.projectId)),
    notifications: d.notifications.filter((n) => n.organizationId === orgId && older(n.createdAt, "notifications") && !orgHold),
    ai_conversations: d.aiConversations.filter((c) => c.organizationId === orgId && older(c.updatedAt, "ai_conversations") && !orgHold),
    reports: d.reports.filter((r) => r.organizationId === orgId && older(r.generatedAt, "reports") && !held(orgId, r.projectId)),
    audit_logs: orgHold ? [] : d.auditLogs.filter((a) => a.organizationId === orgId && older(a.occurredAt, "audit_logs")),
  };
  const counts = Object.fromEntries(Object.entries(victims).map(([k, v]) => [k, v.length])) as Record<string, number>;
  if (apply) {
    const drop = <T,>(arr: T[], gone: T[]) => { const set = new Set(gone); for (let i = arr.length - 1; i >= 0; i--) if (set.has(arr[i])) arr.splice(i, 1); };
    drop(d.media, victims.raw_media);
    drop(d.notifications, victims.notifications);
    drop(d.aiConversations, victims.ai_conversations);
    drop(d.reports, victims.reports);
    if (victims.audit_logs.length) {
      // Audit purge removes the oldest rows; the chain is re-anchored at the first remaining entry (AUDIT-007).
      drop(d.auditLogs, victims.audit_logs);
      const first = d.auditLogs.find((a) => a.organizationId === orgId);
      if (first) store().chainAnchors.set(orgId, first.prevHash);
    }
  }
  return counts;
}

/** DSAR export for the current user (PRIV-004/005): personal data only. */
export function personalExport(orgId: UUID, userId: UUID) {
  const d = db();
  const u = d.users.find((x) => x.id === userId)!;
  return {
    exportedAt: new Date().toISOString(), format: "aerosight.personal-export.v1",
    profile: { id: u.id, email: u.email, fullName: u.fullName, mfaEnabled: !!u.mfaSecret, lastLoginAt: u.lastLoginAt },
    memberships: d.memberships.filter((m) => m.userId === userId).map((m) => ({ organization: d.organizations.find((o) => o.id === m.organizationId)?.name, role: m.role, status: m.status, joinedAt: m.joinedAt })),
    projectRoles: d.projectMembers.filter((m) => m.userId === userId && m.organizationId === orgId).map((m) => ({ project: d.projects.find((p) => p.id === m.projectId)?.name, role: m.role })),
    pilotProfile: d.pilots.find((p) => p.userId === userId && p.organizationId === orgId) ?? null,
    notifications: d.notifications.filter((n) => n.userId === userId && n.organizationId === orgId),
    notificationPreferences: d.notificationPreferences.filter((p) => p.userId === userId && p.organizationId === orgId),
    aiConversations: d.aiConversations.filter((c) => c.userId === userId && c.organizationId === orgId),
    auditActivity: d.auditLogs.filter((a) => a.actorId === userId && a.organizationId === orgId).map(({ hash: _h, prevHash: _p, ...a }) => a),
  };
}

/** Full organization export (ORG-010): every tenant collection filtered to the org; secrets and hashes removed. */
export function organizationExport(orgId: UUID) {
  const d = db();
  const own = <T extends { organizationId: string }>(arr: T[]) => arr.filter((x) => x.organizationId === orgId);
  const memberIds = new Set(own(d.memberships).map((m) => m.userId));
  return {
    exportedAt: new Date().toISOString(), format: "aerosight.org-export.v1",
    organization: d.organizations.find((o) => o.id === orgId),
    users: d.users.filter((u) => memberIds.has(u.id)).map((u) => ({ id: u.id, email: u.email, fullName: u.fullName })),
    memberships: own(d.memberships), projectMembers: own(d.projectMembers), projects: own(d.projects), sites: own(d.sites), assets: own(d.assets),
    drones: own(d.drones), pilots: own(d.pilots), missions: own(d.missions), missionEvents: own(d.missionEvents), media: own(d.media),
    surveys: own(d.surveys), milestones: own(d.milestones), progressRecords: own(d.progressRecords), inspectionTemplates: own(d.inspectionTemplates),
    inspections: own(d.inspections), findings: own(d.findings), reports: own(d.reports), aiAnalyses: own(d.aiAnalyses), aiSuggestions: own(d.aiSuggestions),
    retentionPolicies: own(d.retentionPolicies), legalHolds: own(d.legalHolds),
    webhooks: own(d.webhooks).map(({ secretEnc: _s, ...w }) => w), apiKeys: own(d.apiKeys).map(({ keyHash: _k, ...k }) => k),
    notificationRules: own(d.notificationRules).map(({ webhookUrlEnc: _u, ...r }) => r), integrations: own(d.integrations).map(({ secretEnc: _s, tokenEnc: _t, ...i }) => i),
    viewpoints: own(d.viewpoints), edgeDevices: own(d.edgeDevices).map(({ tokenHash: _h, ...e }) => e),
    ssoConfig: d.ssoConfigs.filter((c) => c.organizationId === orgId).map(({ clientSecretEnc: _c, ...c }) => c),
    scimTokens: own(d.scimTokens).map(({ tokenHash: _h, ...t }) => t),
    auditLogs: own(d.auditLogs),
  };
}
