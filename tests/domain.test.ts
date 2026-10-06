// Domain tests. Tags map to docs/11-QA/Test-Cases.md (@tc) and requirement IDs (@req).
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRing, polygonArea, haversine, rect, generateGrid, estimate, withinBuffer } from "../src/lib/geo.ts";
import { computeProgress, plannedPct } from "../src/lib/progress.ts";
import { nextStatus, validatePlan } from "../src/lib/mission.ts";
import { ROLE_PERMISSIONS, PERMISSIONS } from "../src/lib/permissions.ts";
import { can, accessibleProjectIds } from "../src/lib/policy.ts";
import { db, verifyAuditChain, store } from "../src/lib/store.ts";
import { hashPassword, verifyPassword, passwordIssues } from "../src/lib/password.ts";
import type { AuthContext, Milestone, ProgressRecord, Site } from "../src/lib/types.ts";

test("@tc:TC-SITE-002 @req:SITE-002 invalid geometries are rejected with a reason", () => {
  const bowtie: [number, number][] = [[0, 0], [0.001, 0.001], [0.001, 0], [0, 0.001], [0, 0]];
  assert.equal(validateRing(bowtie)?.code, "SELF_INTERSECTION");
  assert.equal(validateRing([[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]])?.code, "NOT_CLOSED");
  assert.equal(validateRing([[0, 95], [1, 95], [1, 96], [0, 95]])?.code, "OUT_OF_RANGE");
  assert.equal(validateRing(rect([55, 25], 5, 5))?.code, "AREA_TOO_SMALL");
  assert.equal(validateRing(rect([55, 25], 200, 100)), null);
});

test("@tc:TC-MAP-003 geodesic measurements are accurate", () => {
  const d = haversine([55, 25], [55, 25.0089932]); // ≈ 1 km north
  assert.ok(Math.abs(d - 1000) < 1, `distance ${d}`);
  const a = polygonArea(rect([55.14, 25.08], 200, 100));
  assert.ok(Math.abs(a - 20000) / 20000 < 0.005, `area ${a}`);
});

test("@tc:TC-MISSION-002 @req:MISSION-003 waypoint generation is deterministic and inside the area", () => {
  const area = rect([55.14, 25.08], 180, 140, 12);
  const p = { altitudeM: 80, speedMps: 8, frontOverlap: 0.8, sideOverlap: 0.7, gimbalPitch: -90 };
  const a = generateGrid(area, p), b = generateGrid(area, p);
  assert.deepEqual(a, b);
  assert.ok(a.length > 10);
  const e = estimate(a, p);
  assert.ok(e.durationS > 0 && e.photoCount === a.length && e.gsdCm > 2 && e.gsdCm < 2.5);
});

test("@tc:TC-MISSION-003 @tc:TC-MISSION-004 @req:MISSION-004 geofence, no-fly and altitude validation", () => {
  const boundary = rect([55.14, 25.08], 200, 200);
  const site = { boundary, geofenceBufferM: 50, maxAltitudeM: 120, noFlyZones: [{ id: "z", name: "crane", geometry: rect([55.14, 25.08], 20, 20) }] } as unknown as Site;
  const issues = validatePlan(site, [
    { seq: 0, lng: 55.14, lat: 25.08, altM: 80, action: "photo" },        // in no-fly zone
    { seq: 1, lng: 55.1405, lat: 25.0805, altM: 150, action: "photo" },   // too high
    { seq: 2, lng: 55.15, lat: 25.08, altM: 80, action: "photo" },        // ~1 km away → outside geofence
  ]);
  assert.deepEqual(issues.map((i) => i.code).sort(), ["ALTITUDE_EXCEEDED", "IN_NO_FLY_ZONE", "OUTSIDE_GEOFENCE"]);
  assert.ok(withinBuffer([55.1412, 25.08], boundary, 50)); // just outside edge (≈ 20 m) but inside buffer
});

test("@tc:TC-MISSION-006 @req:MISSION-010 invalid state transitions are rejected", () => {
  assert.equal(nextStatus("draft", "start"), null);
  assert.equal(nextStatus("completed", "pause"), null);
  assert.equal(nextStatus("ready", "start"), "in_progress");
  assert.equal(nextStatus("in_progress", "stop"), "completed");
  assert.equal(nextStatus("pending_approval", "approve"), "approved");
});

test("@tc:TC-PROGRESS-001 @tc:TC-PROGRESS-002 @tc:TC-PROGRESS-004 @req:PROGRESS-006 progress calculation", () => {
  const ms = (id: string, w: number): Milestone => ({ id, organizationId: "o", projectId: "p", name: id, plannedStart: "2026-01-01", plannedEnd: "2026-12-31", weight: w, sortOrder: 0 });
  const rec = (milestoneId: string, pct: number, status: ProgressRecord["approvalStatus"] = "approved"): ProgressRecord => ({ id: milestoneId + pct, organizationId: "o", projectId: "p", milestoneId,
    recordDate: "2026-06-01", percentComplete: pct, source: "manual", approvalStatus: status, notes: "", evidenceMediaIds: [], createdAt: "2026-06-01T00:00:00Z" });
  const m = [ms("a", 2), ms("b", 3), ms("c", 5)];
  const r = computeProgress(m, [rec("a", 100), rec("b", 50), rec("c", 90, "pending_approval")], "2026-07-01");
  assert.deepEqual(r.milestones.map((x) => x.normalizedWeightPct), [20, 30, 50]);
  assert.equal(r.actualPct, 35); // 0.2*100 + 0.3*50 + 0.5*0 — pending record ignored
  assert.ok(Math.abs(plannedPct(m[0], "2026-07-02") - 50) < 1);
});

test("@tc:TC-RBAC-001 matrix sanity: owner has all, viewer is read-only", () => {
  assert.equal(ROLE_PERMISSIONS.org_owner.size, PERMISSIONS.length);
  assert.ok(!ROLE_PERMISSIONS.org_admin.has("org:delete"));
  for (const p of ROLE_PERMISSIONS.viewer) assert.match(p, /:(read|download)$/, `viewer should only read (or download shared media), got ${p}`);
  assert.ok(ROLE_PERMISSIONS.drone_pilot.has("mission:start"));
  assert.ok(!ROLE_PERMISSIONS.project_manager.has("mission:start"));
  assert.ok(!ROLE_PERMISSIONS.inspector.has("inspection:approve"));
  assert.ok(ROLE_PERMISSIONS.engineer.has("inspection:approve"));
});

function ctxFor(orgSlug: string, role: string): AuthContext {
  const org = db().organizations.find((o) => o.slug === orgSlug)!;
  const m = db().memberships.find((x) => x.organizationId === org.id && x.role === role)!;
  return { userId: m.userId, orgId: org.id, role: m.role, isPlatformStaff: false, sessionId: "test" };
}

test("@tc:TC-TENANT-004 @req:TENANT-004 users cannot act on another organization's resources", () => {
  const atlasOwner = ctxFor("atlas", "org_owner");
  const borealisProject = db().projects.find((p) => p.organizationId !== atlasOwner.orgId)!;
  for (const perm of PERMISSIONS) {
    assert.equal(can(atlasOwner, perm, { organizationId: borealisProject.organizationId, projectId: borealisProject.id }), false, perm);
  }
  assert.ok(![...accessibleProjectIds(atlasOwner)].includes(borealisProject.id));
});

test("@tc:TC-RBAC-008 @req:RBAC-010 non-members cannot read a project", () => {
  const inspector = ctxFor("atlas", "inspector");
  const projects = db().projects.filter((p) => p.organizationId === inspector.orgId);
  const accessible = accessibleProjectIds(inspector);
  assert.equal(accessible.size, 2); // seeded: inspector is not on the third project
  const hidden = projects.find((p) => !accessible.has(p.id))!;
  assert.equal(can(inspector, "project:read", { organizationId: hidden.organizationId, projectId: hidden.id }), false);
});

test("@tc:TC-ADMIN-003 platform staff have no tenant permissions", () => {
  const staff: AuthContext = { userId: "x", orgId: db().organizations[0].id, role: "org_owner", isPlatformStaff: true, sessionId: "s" };
  assert.equal(can(staff, "project:read", { organizationId: staff.orgId }), false);
});

test("@tc:TC-AUDIT-003 @req:AUDIT-004 audit hash chain detects tampering", () => {
  const org = db().organizations[0];
  assert.equal(verifyAuditChain(org.id).ok, true);
  const rows = store().data.auditLogs;
  const idx = rows.findIndex((r) => r.organizationId === org.id);
  const original = rows[idx];
  rows[idx] = { ...original, action: "tampered" };
  assert.equal(verifyAuditChain(org.id).ok, false);
  rows[idx] = original;
  assert.equal(verifyAuditChain(org.id).ok, true);
});

test("@tc:TC-AUTH-003 @tc:TC-AUTH-008 password hashing and policy", () => {
  const h = hashPassword("Correct-Horse-9!");
  assert.ok(verifyPassword("Correct-Horse-9!", h));
  assert.ok(!verifyPassword("wrong", h));
  assert.ok(passwordIssues("short", "a@b.com"));
  assert.ok(passwordIssues("password12345", "a@b.com"));
  assert.equal(passwordIssues("Correct-Horse-9!", "priya@x.com"), null);
});
