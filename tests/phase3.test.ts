// Phase 3 tests: mission control commands, edge telemetry ingestion, SSO/SCIM rules, analytics v2, twin growth.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/store.ts";
import { telemetryAt } from "../src/lib/simulator.ts";
import { transitionMission, commandChannel } from "../src/lib/repo.ts";
import { createEdgeDevice, deviceForToken, ingest, latestSample, revokeEdgeDevice } from "../src/lib/edge.ts";
import { passwordLoginBlocked, pkce, provision, ssoForEmail } from "../src/lib/sso.ts";
import { createUser, patchUser, deleteUser, listUsers, createScimToken, scimOrg } from "../src/lib/scim.ts";
import { findingSla, toCsv, fleetUtilization, SLA_HOURS } from "../src/lib/analytics.ts";
import { assetFraction } from "../src/lib/twin.ts";
import { haversine } from "../src/lib/geo.ts";
import { createHash } from "node:crypto";
import type { AuthContext, Finding, Mission } from "../src/lib/types.ts";

function ctxFor(slug: string, role: string): AuthContext {
  const org = db().organizations.find((o) => o.slug === slug)!;
  const m = db().memberships.find((x) => x.organizationId === org.id && x.role === role)!;
  return { userId: m.userId, orgId: org.id, role: m.role, isPlatformStaff: false, sessionId: "t" };
}
function liveMission(slug: string): Mission {
  const org = db().organizations.find((o) => o.slug === slug)!;
  return db().missions.find((m) => m.organizationId === org.id && m.status === "in_progress" && db().drones.find((d) => d.id === m.droneId)?.missionControlVerified)!;
}
function pilotCtxFor(m: Mission): AuthContext {
  const pilot = db().pilots.find((p) => p.id === m.pilotId)!;
  const mem = db().memberships.find((x) => x.organizationId === m.organizationId && x.userId === pilot.userId)!;
  return { userId: pilot.userId, orgId: m.organizationId, role: mem.role, isPlatformStaff: false, sessionId: "t" };
}

test("@tc:TC-MISSION-020 pause freezes the simulated drone; resume continues from the same point", () => {
  const m = structuredClone(liveMission("atlas"));
  const site = db().sites.find((s) => s.id === m.siteId)!;
  const t0 = Date.parse(m.actualStart!) + 200_000;
  m.control = { pausedAt: new Date(t0).toISOString(), pausedTotalMs: 0 };
  const a = telemetryAt(m, site, t0).t, b = telemetryAt(m, site, t0 + 60_000).t;
  assert.equal(b.flightMode, "hover");
  assert.ok(haversine([a.longitude, a.latitude], [b.longitude, b.latitude]) < 1, "hover while paused");
  // Resumed after 60 s: the flight clock excludes the paused minute.
  m.control = { pausedTotalMs: 60_000 };
  const c = telemetryAt(m, site, t0 + 60_000).t;
  assert.ok(haversine([a.longitude, a.latitude], [c.longitude, c.latitude]) < 1, "resumes from the paused position");
});

test("@tc:TC-MISSION-021 return-to-home flies to the launch point and lands", () => {
  const m = structuredClone(liveMission("atlas"));
  const site = db().sites.find((s) => s.id === m.siteId)!;
  const tRth = Date.parse(m.actualStart!) + 300_000;
  m.control = { pausedTotalMs: 0, rthAt: new Date(tRth).toISOString() };
  const home: [number, number] = [m.waypoints[0].lng, m.waypoints[0].lat];
  const start = telemetryAt(m, site, tRth).t;
  const mid = telemetryAt(m, site, tRth + 5_000).t;
  assert.equal(mid.flightMode, "rth");
  assert.ok(haversine([mid.longitude, mid.latitude], home) <= haversine([start.longitude, start.latitude], home));
  const end = telemetryAt(m, site, tRth + 30 * 60_000).t;
  assert.equal(end.flightMode, "landing");
  assert.equal(end.relativeAltitude, 0);
  assert.ok(haversine([end.longitude, end.latitude], home) < 2);
});

test("@tc:TC-MISSION-022 flight commands need a verified adapter, the org setting, no kill switch and pilot confirmation", () => {
  const m = liveMission("atlas");
  const pilot = pilotCtxFor(m);
  assert.equal(commandChannel(pilot, m).mode, "provider");
  assert.throws(() => transitionMission(pilot, m.id, "pause"), /pilot in command/);
  const r = transitionMission(pilot, m.id, "pause", { confirmPilotInCommand: true });
  assert.equal(r.mission.status, "paused");
  assert.equal(r.execution?.providerCommandSent, true);
  assert.ok(m.control?.pausedAt);
  const ev = db().missionEvents.filter((e) => e.missionId === m.id).map((e) => e.type);
  assert.ok(ev.includes("command_sent") && ev.includes("command_ack"));
  transitionMission(pilot, m.id, "resume", { confirmPilotInCommand: true });
  assert.equal(m.control?.pausedAt, undefined);
  assert.ok((m.control?.pausedTotalMs ?? -1) >= 0);
  // Org setting off → record-only; RTH is refused.
  const org = db().organizations.find((o) => o.id === m.organizationId)!;
  org.settings.droneCommandsEnabled = false;
  assert.equal(commandChannel(pilot, m).mode, "logical");
  assert.throws(() => transitionMission(pilot, m.id, "rth", { confirmPilotInCommand: true }), /turned off/);
  org.settings.droneCommandsEnabled = true;
  // Platform kill switch.
  process.env.DRONE_COMMANDS_DISABLED = "1";
  assert.throws(() => transitionMission(pilot, m.id, "rth", { confirmPilotInCommand: true }), /disabled platform-wide/);
  delete process.env.DRONE_COMMANDS_DISABLED;
  transitionMission(pilot, m.id, "rth", { confirmPilotInCommand: true });
  assert.ok(m.control?.rthAt);
  assert.equal(m.status, "in_progress");
  assert.throws(() => transitionMission(pilot, m.id, "rth", { confirmPilotInCommand: true }), /already returning/);
  assert.throws(() => transitionMission(pilot, m.id, "pause", { confirmPilotInCommand: true }), /returning home/);
});

test("@tc:TC-MISSION-023 a pilot who is not assigned cannot send commands", () => {
  const m = db().missions.find((x) => x.status === "in_progress" && x.id !== liveMission("atlas").id && x.organizationId === liveMission("atlas").organizationId);
  if (!m) return;
  const other = ctxFor("atlas", "drone_pilot");
  if (db().pilots.find((p) => p.id === m.pilotId)?.userId === other.userId) return;
  assert.throws(() => transitionMission(other, m.id, "pause", { confirmPilotInCommand: true }), /assigned pilot/);
});

test("@tc:TC-DRONE-030 edge ingest: token bound to one drone, validation, ordering, clock skew, revocation", () => {
  const admin = ctxFor("atlas", "org_admin");
  const manual = db().drones.find((d) => d.organizationId === admin.orgId && d.providerKey === "manual")!;
  const sim = db().drones.find((d) => d.organizationId === admin.orgId && d.providerKey === "simulator")!;
  assert.throws(() => createEdgeDevice(admin, sim.id, "x"), /Simulated drones/);
  const viewer = ctxFor("atlas", "viewer");
  assert.throws(() => createEdgeDevice(viewer, manual.id, "x"));
  const borealisDrone = db().drones.find((d) => d.organizationId !== admin.orgId && d.providerKey === "manual")!;
  assert.throws(() => createEdgeDevice(admin, borealisDrone.id, "x"), /not found|access/i);

  const { device, token } = createEdgeDevice(admin, manual.id, "Field bridge");
  assert.match(token, /^asai_edge_/);
  assert.notEqual(device.tokenHash, token);
  assert.equal(deviceForToken(token)?.id, device.id);
  assert.equal(deviceForToken("asai_edge_nope"), null);
  const now = Date.now();
  const s = (seq: number, dt = 0) => ({ seq, timestamp: new Date(now + dt).toISOString(), latitude: 25.1, longitude: 55.2, altitude: 70, relativeAltitude: 60, speed: 5, heading: 90, battery: 80 });
  const r1 = ingest(device, { samples: [s(1), s(2), s(2), s(3, -10 * 60_000)] }, now);
  assert.equal(r1.accepted, 2);
  assert.deepEqual(r1.rejected.map((x) => x.reason).sort(), ["CLOCK_SKEW", "DUPLICATE_OR_OUT_OF_ORDER"]);
  assert.equal(latestSample(admin.orgId, manual.id)?.seq, 2);
  assert.equal(latestSample(admin.orgId, manual.id)?.simulated, false);
  assert.equal(latestSample(borealisDrone.organizationId, manual.id), undefined, "other org cannot read");
  assert.throws(() => ingest(device, { samples: [{ ...s(9), latitude: 123 }] }, now));
  assert.throws(() => ingest(device, { samples: [] }, now));
  revokeEdgeDevice(admin, device.id);
  assert.equal(deviceForToken(token), null);
});

test("@tc:TC-AUTH-030 PKCE challenge is the S256 of the verifier", () => {
  const { verifier, challenge } = pkce();
  assert.ok(verifier.length >= 43);
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
});

test("@tc:TC-AUTH-031 SSO: verified domains only, JIT role, enforcement spares owners, deactivated members refused", () => {
  const owner = ctxFor("borealis", "org_owner");
  db().ssoConfigs.push({ organizationId: owner.orgId, protocol: "oidc", issuer: "https://idp.example.com", clientId: "abc", jitRole: "viewer", enabled: true, enforced: true,
    domains: [{ domain: "borealis.example", token: "t", verifiedAt: new Date().toISOString() }, { domain: "unverified.example", token: "u" }], updatedAt: "" });
  const c = ssoForEmail("someone@borealis.example")!;
  assert.equal(c.organizationId, owner.orgId);
  assert.equal(ssoForEmail("someone@unverified.example"), undefined);
  const r = provision(c, { email: "new.hire@borealis.example", name: "New Hire", sub: "1" });
  assert.equal(r.created, true);
  const m = db().memberships.find((x) => x.userId === r.userId && x.organizationId === owner.orgId)!;
  assert.equal(m.role, "viewer");
  assert.equal(passwordLoginBlocked("new.hire@borealis.example", r.userId), true);
  assert.throws(() => provision(c, { email: "x@unverified.example", name: "X", sub: "2" }), /not verified/);
  m.status = "deactivated";
  assert.throws(() => provision(c, { email: "new.hire@borealis.example", name: "New Hire", sub: "1" }), /removed/);
  // Owners keep password sign-in as the recovery path.
  const ownerUser = db().users.find((u) => u.id === owner.userId)!;
  const ownerEmail = ownerUser.email;
  ownerUser.email = "boss@borealis.example";
  assert.equal(passwordLoginBlocked("boss@borealis.example", owner.userId), false);
  ownerUser.email = ownerEmail;
});

test("@tc:TC-AUTH-032 SCIM: token auth, verified-domain create, filter, patch active=false, delete deactivates, last owner protected", () => {
  const owner = ctxFor("borealis", "org_owner");
  const { token } = createScimToken(owner);
  assert.equal(scimOrg(new Request("https://x/", { headers: { authorization: `Bearer ${token}` } })), owner.orgId);
  assert.equal(scimOrg(new Request("https://x/", { headers: { authorization: "Bearer asai_scim_bad" } })), null);
  const base = "https://x/api/scim/v2";
  assert.throws(() => createUser(owner.orgId, { userName: "a@gmail.com" }, base), /verified domains/);
  const u = createUser(owner.orgId, { userName: "scim.user@borealis.example", name: { givenName: "Scim", familyName: "User" }, externalId: "ext-1" }, base);
  assert.equal(u.active, true);
  assert.throws(() => createUser(owner.orgId, { userName: "scim.user@borealis.example" }, base), /already exists/);
  const list = listUsers(owner.orgId, new URL(`${base}/Users?filter=${encodeURIComponent('userName eq "scim.user@borealis.example"')}`), base);
  assert.equal(list.totalResults, 1);
  const p = patchUser(owner.orgId, u.id, { schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"], Operations: [{ op: "replace", value: { active: false } }] }, base);
  assert.equal(p.active, false);
  deleteUser(owner.orgId, u.id);
  // Other org's members are invisible.
  const atlas = ctxFor("atlas", "org_owner");
  assert.throws(() => deleteUser(atlas.orgId, u.id), /not found/);
  const ownerMembership = db().memberships.find((m) => m.organizationId === owner.orgId && m.userId === owner.userId)!;
  assert.throws(() => deleteUser(owner.orgId, ownerMembership.id), /last active owner/);
});

test("@tc:TC-ANALYTICS-010 SLA compliance and MTTR", () => {
  const now = Date.parse("2026-10-01T00:00:00Z");
  const f = (sev: Finding["severity"], createdH: number, resolvedH?: number): Finding => ({ id: String(Math.random()), organizationId: "o", projectId: "p", siteId: "s", inspectionId: "i", code: "F", title: "t",
    description: "", category: "c", severity: sev, status: resolvedH === undefined ? "open" : "resolved", location: [0, 0], dueDate: "", aiGenerated: false,
    createdAt: new Date(now - createdH * 3_600_000).toISOString(), resolvedAt: resolvedH === undefined ? undefined : new Date(now - resolvedH * 3_600_000).toISOString() });
  const r = findingSla([f("critical", 100, 90), f("critical", 100, 50), f("high", 10), f("critical", 48)], now);
  // critical: 10 h (met), 50 h (missed); high open 10 h (inside window); critical open 48 h (breached)
  assert.equal(r.resolved, 2);
  assert.equal(r.mttrHours, 30);
  assert.equal(r.breachedOpen, 1);
  assert.equal(r.compliancePct, 33.3);
  assert.equal(SLA_HOURS.critical, 24);
});

test("@tc:TC-ANALYTICS-011 CSV export escapes quotes and neutralises formulas", () => {
  const csv = toCsv([{ a: '=HYPERLINK("x")', b: "plain, text", c: -12.5, d: "+cmd" }]);
  const line = csv.split("\r\n")[1];
  assert.equal(line, `"'=HYPERLINK(""x"")","plain, text",-12.5,'+cmd`);
});

test("@tc:TC-ANALYTICS-012 fleet utilization only counts flights in the period", () => {
  const owner = ctxFor("atlas", "org_owner");
  const drones = db().drones.filter((d) => d.organizationId === owner.orgId);
  const missions = db().missions.filter((m) => m.organizationId === owner.orgId);
  const u30 = fleetUtilization(drones, missions, 30), u365 = fleetUtilization(drones, missions, 365);
  for (const d of u30) {
    const y = u365.find((x) => x.droneId === d.droneId)!;
    assert.ok(y.flights >= d.flights);
    assert.ok(d.utilizationPct >= 0 && d.utilizationPct <= 100);
  }
});

test("@tc:TC-TWIN-010 asset models grow monotonically with progress and are complete at 100%", () => {
  for (let i = 0; i < 5; i++) {
    let prev = -1;
    for (let p = 0; p <= 100; p += 5) { const f = assetFraction(i, 5, p); assert.ok(f >= prev); prev = f; }
    assert.equal(assetFraction(i, 5, 100), 1);
    assert.equal(assetFraction(i, 5, 0), 0);
  }
});
