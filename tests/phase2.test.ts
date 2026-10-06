// Phase 2 tests. Run with the react-server condition so server-only modules can be imported.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hotp, verifyTotp, base32Encode } from "../src/lib/totp.ts";
import { volumeAnalysis, elevationProfile, rect } from "../src/lib/geo.ts";
import { can } from "../src/lib/policy.ts";
import { db } from "../src/lib/store.ts";
import { assertSafeUrl } from "../src/lib/net.ts";
import { encrypt, decrypt } from "../src/lib/crypto.ts";
import { decideSuggestion } from "../src/lib/ai/features.ts";
import { enforceRetention } from "../src/lib/privacy.ts";
import type { AuthContext } from "../src/lib/types.ts";

const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

test("@tc:TC-AUTH-009 TOTP matches RFC 6238 / RFC 4226 test vectors", () => {
  // RFC 4226 Appendix D HOTP values for counters 0..2
  assert.equal(hotp(RFC_SECRET, 0), "755224");
  assert.equal(hotp(RFC_SECRET, 1), "287082");
  assert.equal(hotp(RFC_SECRET, 2), "359152");
  // RFC 6238 T=59s → counter 1 → 8-digit 94287082, 6-digit 287082
  assert.equal(verifyTotp(RFC_SECRET, "287082", -1, 59_000), 1);
});

test("@tc:TC-AUTH-010 TOTP replay is rejected", () => {
  const now = 1_800_000_000_000;
  const step = Math.floor(now / 30_000);
  const code = hotp(RFC_SECRET, step);
  assert.equal(verifyTotp(RFC_SECRET, code, -1, now), step);
  assert.equal(verifyTotp(RFC_SECRET, code, step, now), null); // same step again
  assert.equal(verifyTotp(RFC_SECRET, "abc123", -1, now), null);
});

test("@tc:TC-INTEG-003 SSRF guard blocks private, loopback, metadata and non-https URLs", async () => {
  for (const bad of ["http://example.com/hook", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://169.254.169.254/latest", "https://[::1]/x",
    "https://192.168.1.10/x", "https://localhost/x", "https://user:pass@example.com/x", "https://100.64.0.1/x", "https://example.com:22/x"]) {
    await assert.rejects(assertSafeUrl(bad), Error, bad);
  }
  await assert.doesNotReject(assertSafeUrl("https://93.184.216.34/hook"));
});

test("@tc:TC-INTEG-001 secrets round-trip through AES-GCM and tampering is detected", () => {
  const c = encrypt("https://hooks.slack.com/services/T000/B000/XXXX");
  assert.notEqual(c, "https://hooks.slack.com/services/T000/B000/XXXX");
  assert.equal(decrypt(c), "https://hooks.slack.com/services/T000/B000/XXXX");
  const parts = c.split(".");
  parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "B" : "A") + parts[3].slice(-1);
  assert.throws(() => decrypt(parts.join(".")));
});

function ctxFor(slug: string, role: string): AuthContext {
  const org = db().organizations.find((o) => o.slug === slug)!;
  const m = db().memberships.find((x) => x.organizationId === org.id && x.role === role)!;
  return { userId: m.userId, orgId: org.id, role: m.role, isPlatformStaff: false, sessionId: "t" };
}

test("@tc:TC-INTEG-007 API keys are limited to their permission subset and projects", () => {
  const owner = ctxFor("atlas", "org_owner");
  const [p1, p2] = db().projects.filter((p) => p.organizationId === owner.orgId);
  const keyCtx: AuthContext = { ...owner, apiKey: { id: "k", permissions: ["project:read", "mission:read"], projectIds: [p1.id] } };
  assert.equal(can(keyCtx, "project:read", { organizationId: owner.orgId, projectId: p1.id }), true);
  assert.equal(can(keyCtx, "project:read", { organizationId: owner.orgId, projectId: p2.id }), false);
  assert.equal(can(keyCtx, "project:update", { organizationId: owner.orgId, projectId: p1.id }), false);
});

test("@tc:TC-ADMIN-004 break-glass is read-only and expires", () => {
  const org = db().organizations[0];
  const p = db().projects.find((x) => x.organizationId === org.id)!;
  const bg = (endsAt: string): AuthContext => ({ userId: "staff", orgId: org.id, role: "org_admin", isPlatformStaff: true, sessionId: "s", breakGlass: { sessionId: "b", endsAt } });
  const live = bg(new Date(Date.now() + 60_000).toISOString());
  assert.equal(can(live, "project:read", { organizationId: org.id, projectId: p.id }), true);
  assert.equal(can(live, "project:update", { organizationId: org.id, projectId: p.id }), false);
  assert.equal(can(live, "mission:start", { organizationId: org.id, projectId: p.id }), false);
  assert.equal(can(bg(new Date(Date.now() - 1000).toISOString()), "project:read", { organizationId: org.id, projectId: p.id }), false);
});

test("@tc:TC-SURVEY-005 volume analysis on a synthetic mound", () => {
  // 100 m × 100 m square with a 10 m-high cone (base radius 40 m) on flat ground at 5 m: cone volume = π r² h / 3 ≈ 16,755 m³
  const ring = rect([55.14, 25.08], 100, 100);
  const c = [55.14, 25.08];
  const sample = ([lng, lat]: [number, number]) => {
    const dx = (lng - c[0]) * 111320 * Math.cos((25.08 * Math.PI) / 180), dy = (lat - c[1]) * 110574;
    const r = Math.hypot(dx, dy);
    return 5 + Math.max(0, 10 * (1 - r / 40));
  };
  const v = volumeAnalysis(ring, sample)!;
  assert.ok(Math.abs(v.baseElevationM - 5) < 0.01);
  assert.ok(Math.abs(v.cutM3 - (Math.PI * 40 * 40 * 10) / 3) / 16755 < 0.05, `cut ${v.cutM3}`);
  assert.ok(v.fillM3 < 1);
  const prof = elevationProfile([[55.1395, 25.08], [55.1405, 25.08]], sample)!;
  assert.ok(Math.abs(prof.max - 15) < 0.5 && Math.abs(prof.min - 5) < 0.01);
});

test("@tc:TC-AI-003 @tc:TC-AI-004 AI suggestions change progress only when accepted by an authorized reviewer", () => {
  const pm = ctxFor("atlas", "project_manager");
  const inspector = ctxFor("atlas", "inspector");
  const p = db().projects.find((x) => x.organizationId === pm.orgId)!;
  const ms = db().milestones.find((m) => m.projectId === p.id)!;
  const before = db().progressRecords.length;
  const s = { id: "sugg-1", organizationId: pm.orgId, projectId: p.id, analysisId: "a1", kind: "progress" as const, confidence: 0.6, decision: "pending" as const,
    payload: { milestoneId: ms.id, milestoneName: ms.name, currentPercent: 10, proposedPercent: 20, rationale: "test" } };
  db().aiSuggestions.push(s);
  assert.equal(db().progressRecords.length, before); // pending → nothing official
  assert.throws(() => decideSuggestion(inspector, s.id, "accepted", {}), /permission|Forbidden|Requires/i);
  assert.throws(() => decideSuggestion(pm, s.id, "rejected", {}), /reason/i);
  const r = decideSuggestion(pm, s.id, "edited", { percent: 18 });
  assert.equal(db().progressRecords.length, before + 1);
  const rec = db().progressRecords.find((x) => x.id === r.recordId)!;
  assert.equal(rec.source, "ai"); assert.equal(rec.percentComplete, 18); assert.equal(rec.approvalStatus, "approved");
  assert.throws(() => decideSuggestion(pm, s.id, "accepted", {}), /already decided/);
});

test("@tc:TC-PRIV-003 legal hold blocks retention deletion", () => {
  const org = db().organizations.find((o) => o.slug === "borealis")!;
  const pol = db().retentionPolicies.find((p) => p.organizationId === org.id && p.dataClass === "notifications")!;
  const old = pol.retentionDays;
  db().notifications.push({ id: "old-n", organizationId: org.id, userId: "u", eventKey: "x", severity: "info", title: "old", body: "", createdAt: "2020-01-01T00:00:00Z" });
  pol.retentionDays = 30;
  db().legalHolds.push({ id: "h1", organizationId: org.id, reason: "dispute", placedBy: "u", placedAt: new Date().toISOString() });
  assert.equal(enforceRetention(org.id, true).notifications, 0);
  assert.ok(db().notifications.some((n) => n.id === "old-n"));
  db().legalHolds.find((h) => h.id === "h1")!.releasedAt = new Date().toISOString();
  assert.ok(enforceRetention(org.id, true).notifications >= 1);
  assert.ok(!db().notifications.some((n) => n.id === "old-n"));
  pol.retentionDays = old;
});
