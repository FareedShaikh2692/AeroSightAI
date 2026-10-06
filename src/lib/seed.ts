// Deterministic demo dataset: two tenants with the same structure ("Atlas Construction", "Borealis Infra"),
// one user per system role in each, plus one platform administrator. See docs/11-QA/Test-Strategy.md §5.
import type {
  Organization, User, Membership, ProjectMember, Project, Site, Asset, Drone, Pilot, Mission, MissionEvent,
  Media, Survey, Milestone, ProgressRecord, Inspection, Finding, Report, Notification, AuditLog, RoleKey, LngLat, MissionStatus,
  NotificationPreference, NotificationRule, Webhook, WebhookDelivery, ApiKey, AiAnalysis, AiSuggestion, AiConversation,
  InspectionTemplate, RetentionPolicy, LegalHold, Integration, BreakGlassSession, DataClass, Viewpoint, SsoConfig, ScimToken, EdgeDevice, TelemetrySample,
} from "./types";
import { sid, prng } from "./ids";
import { hashPassword } from "./password";
import { centroid, polygonArea, rect, generateGrid, estimate, generateOrbit } from "./geo";
import { ROLES } from "./permissions";

export const DEMO_PASSWORD = "AeroSight-Demo-2026!";

export interface DataSet {
  organizations: Organization[]; users: User[]; memberships: Membership[]; projectMembers: ProjectMember[];
  projects: Project[]; sites: Site[]; assets: Asset[]; drones: Drone[]; pilots: Pilot[]; missions: Mission[];
  missionEvents: MissionEvent[]; media: Media[]; surveys: Survey[]; milestones: Milestone[];
  progressRecords: ProgressRecord[]; inspections: Inspection[]; findings: Finding[]; reports: Report[];
  notifications: Notification[]; auditLogs: AuditLog[];
  // Phase 2
  notificationPreferences: NotificationPreference[]; notificationRules: NotificationRule[]; webhooks: Webhook[];
  webhookDeliveries: WebhookDelivery[]; apiKeys: ApiKey[]; aiAnalyses: AiAnalysis[]; aiSuggestions: AiSuggestion[];
  aiConversations: AiConversation[]; inspectionTemplates: InspectionTemplate[]; retentionPolicies: RetentionPolicy[];
  legalHolds: LegalHold[]; integrations: Integration[]; breakGlassSessions: BreakGlassSession[];
  // Phase 3
  viewpoints: Viewpoint[]; ssoConfigs: SsoConfig[]; scimTokens: ScimToken[]; edgeDevices: EdgeDevice[]; telemetry: TelemetrySample[];
}

export const DEFAULT_RETENTION: Record<DataClass, number> = {
  raw_media: 1825, telemetry: 365, audit_logs: 365, notifications: 180, ai_conversations: 90, reports: 2555,
};

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();
const date = (t: number) => iso(t).slice(0, 10);

const ROLE_EMAIL: Record<RoleKey, string> = {
  org_owner: "owner", org_admin: "admin", project_manager: "pm", site_manager: "site", drone_pilot: "pilot",
  surveyor: "surveyor", inspector: "inspector", engineer: "engineer", viewer: "client",
};

const FIRST = ["Olivia", "Adam", "Priya", "Sam", "Diego", "Mei", "Ivan", "Elena", "Chris", "Noah", "Lena", "Omar", "Sofia", "Karim", "Hana", "Jonas", "Aisha", "Mateo"];
const LAST = ["Hart", "Novak", "Shah", "Okafor", "Ruiz", "Lin", "Petrov", "Rossi", "Walker", "Becker", "Fischer", "Haddad", "Moreau", "Nasser", "Sato", "Weber", "Rahman", "Silva"];

interface OrgSpec {
  key: string; name: string; slug: string; country: string; timezone: string; region: string; color: string;
  plan: Organization["plan"]; domain: string;
  projects: { code: string; name: string; type: string; client: string; center: LngLat; months: [number, number];
    sites: { code: string; name: string; address: string; w: number; h: number; rot: number; offset: [number, number] }[] }[];
}

const SPECS: OrgSpec[] = [
  {
    key: "atlas", name: "Atlas Construction", slug: "atlas", country: "AE", timezone: "Asia/Dubai", region: "me-central-1",
    color: "#FFB020", plan: "professional", domain: "atlas-construction.demo",
    projects: [
      { code: "PRJ-DXB-01", name: "Marina Tower B", type: "building", client: "Emaar Properties", center: [55.1403, 25.0806], months: [-9, 14],
        sites: [{ code: "S1", name: "Plot 14 — Tower B", address: "Dubai Marina, Dubai", w: 180, h: 140, rot: 12, offset: [0, 0] },
                { code: "S2", name: "Podium & Parking", address: "Dubai Marina, Dubai", w: 140, h: 90, rot: 12, offset: [0.0024, -0.0012] }] },
      { code: "PRJ-DXB-02", name: "Al Khail Interchange Upgrade", type: "road", client: "RTA Dubai", center: [55.2862, 25.1604], months: [-4, 18],
        sites: [{ code: "N1", name: "North Ramp Corridor", address: "Al Khail Rd, Dubai", w: 520, h: 120, rot: 35, offset: [0, 0] }] },
      { code: "PRJ-JAF-03", name: "Jebel Ali Logistics Hub", type: "industrial", client: "DP World", center: [55.0627, 24.9886], months: [-14, 4],
        sites: [{ code: "W1", name: "Warehouse Cluster A", address: "Jebel Ali Free Zone", w: 420, h: 300, rot: 0, offset: [0, 0] }] },
    ],
  },
  {
    key: "borealis", name: "Borealis Infra", slug: "borealis", country: "DE", timezone: "Europe/Berlin", region: "eu-central-1",
    color: "#22D3EE", plan: "enterprise", domain: "borealis-infra.demo",
    projects: [
      { code: "PRJ-MUC-01", name: "Isar Bridge Rehabilitation", type: "bridge", client: "Stadt München", center: [11.5937, 48.1302], months: [-6, 10],
        sites: [{ code: "B1", name: "Bridge Deck & Piers", address: "Munich, Bavaria", w: 260, h: 70, rot: 80, offset: [0, 0] }] },
      { code: "PRJ-GAR-02", name: "Garching Data Center", type: "building", client: "Nordlicht Cloud GmbH", center: [11.6527, 48.2489], months: [-11, 7],
        sites: [{ code: "D1", name: "Data Hall Campus", address: "Garching bei München", w: 300, h: 220, rot: -8, offset: [0, 0] }] },
      { code: "PRJ-AUG-03", name: "A8 Noise Barrier Section", type: "road", client: "Autobahn GmbH", center: [10.9473, 48.4012], months: [-2, 12],
        sites: [{ code: "A1", name: "Km 52–54 Barrier", address: "near Augsburg", w: 600, h: 60, rot: 62, offset: [0, 0] }] },
    ],
  },
];

const MILESTONE_TEMPLATES: Record<string, { name: string; w: number; s: number; e: number }[]> = {
  building: [
    { name: "Site preparation & enabling works", w: 5, s: 0, e: 0.08 }, { name: "Excavation & shoring", w: 10, s: 0.05, e: 0.2 },
    { name: "Foundations & raft", w: 15, s: 0.15, e: 0.32 }, { name: "Superstructure frame", w: 30, s: 0.28, e: 0.7 },
    { name: "Building envelope / façade", w: 20, s: 0.55, e: 0.88 }, { name: "MEP & fit-out", w: 15, s: 0.65, e: 0.97 },
    { name: "Testing & handover", w: 5, s: 0.92, e: 1 },
  ],
  road: [
    { name: "Traffic management & diversions", w: 5, s: 0, e: 0.1 }, { name: "Earthworks & drainage", w: 25, s: 0.05, e: 0.4 },
    { name: "Structures (ramps, culverts)", w: 30, s: 0.2, e: 0.75 }, { name: "Pavement layers", w: 25, s: 0.6, e: 0.92 },
    { name: "Signage, lighting & barriers", w: 10, s: 0.85, e: 0.98 }, { name: "Commissioning", w: 5, s: 0.95, e: 1 },
  ],
  bridge: [
    { name: "Access & scaffolding", w: 10, s: 0, e: 0.12 }, { name: "Deck demolition (partial)", w: 15, s: 0.1, e: 0.3 },
    { name: "Pier strengthening", w: 25, s: 0.25, e: 0.6 }, { name: "New deck slab", w: 30, s: 0.5, e: 0.85 },
    { name: "Waterproofing & surfacing", w: 15, s: 0.8, e: 0.96 }, { name: "Load testing & reopening", w: 5, s: 0.95, e: 1 },
  ],
  industrial: [
    { name: "Ground improvement", w: 15, s: 0, e: 0.2 }, { name: "Steel frame erection", w: 35, s: 0.15, e: 0.6 },
    { name: "Roofing & cladding", w: 25, s: 0.5, e: 0.85 }, { name: "Slab & yard paving", w: 15, s: 0.7, e: 0.95 },
    { name: "Handover", w: 10, s: 0.92, e: 1 },
  ],
};

const CHECKLIST = [
  "Airspace and NOTAMs checked", "Weather within limits (wind < 10 m/s)", "Batteries charged and inspected",
  "Propellers and airframe inspected", "Return-to-home altitude set above obstacles", "Site team briefed / area secured",
];

const INSPECTION_ITEMS = [
  "Formwork and propping secure", "Rebar cover and spacing as per drawings", "Edge protection installed",
  "No visible cracking > 0.3 mm", "Housekeeping and access routes clear", "Drainage functioning",
];

export function buildSeed(now = Date.now()): DataSet {
  const ds: DataSet = {
    organizations: [], users: [], memberships: [], projectMembers: [], projects: [], sites: [], assets: [], drones: [],
    pilots: [], missions: [], missionEvents: [], media: [], surveys: [], milestones: [], progressRecords: [],
    inspections: [], findings: [], reports: [], notifications: [], auditLogs: [],
    notificationPreferences: [], notificationRules: [], webhooks: [], webhookDeliveries: [], apiKeys: [], aiAnalyses: [],
    aiSuggestions: [], aiConversations: [], inspectionTemplates: [], retentionPolicies: [], legalHolds: [], integrations: [], breakGlassSessions: [],
    viewpoints: [], ssoConfigs: [], scimTokens: [], edgeDevices: [], telemetry: [],
  };
  const pw = hashPassword(DEMO_PASSWORD, Buffer.alloc(16, 42));
  const rnd = prng(20261006);
  const today = Math.floor(now / DAY) * DAY;

  // Platform staff (admin realm)
  ds.users.push({ id: sid("staff:admin"), email: "platform-admin@aerosight.demo", fullName: "Platform Admin", passwordHash: pw, isPlatformStaff: true, mfaEnabled: true });

  let nameIdx = 0;
  SPECS.forEach((spec, orgIndex) => {
    const orgId = sid(`org:${spec.key}`);
    ds.organizations.push({
      id: orgId, name: spec.name, slug: spec.slug, status: "active", country: spec.country, timezone: spec.timezone,
      region: spec.region, brandColor: spec.color, plan: spec.plan, createdAt: iso(today - 400 * DAY),
      settings: { mfaRequired: false, externalSharing: true, missionApprovalRequired: spec.key === "atlas", aiEnabled: true, fourEyesProgress: false, droneCommandsEnabled: true },
      aiCreditsUsed: 0, aiCreditsLimit: spec.plan === "enterprise" ? 50000 : 5000,
    });
    for (const [dataClass, days] of Object.entries(DEFAULT_RETENTION)) ds.retentionPolicies.push({ organizationId: orgId, dataClass: dataClass as DataClass, retentionDays: days, updatedAt: iso(today - 400 * DAY) });

    const userByRole = {} as Record<RoleKey, string>;
    for (const role of ROLES) {
      const id = sid(`user:${spec.key}:${role}`);
      userByRole[role] = id;
      const fullName = `${FIRST[nameIdx % FIRST.length]} ${LAST[(nameIdx * 7 + orgIndex) % LAST.length]}`;
      nameIdx++;
      ds.users.push({ id, email: `${ROLE_EMAIL[role]}@${spec.domain}`, fullName, passwordHash: pw, mfaEnabled: false, lastLoginAt: iso(today - Math.floor(rnd() * 5) * DAY) });
      ds.memberships.push({ id: sid(`mem:${spec.key}:${role}`), organizationId: orgId, userId: id, role, status: "active", joinedAt: iso(today - 380 * DAY) });
    }

    // Inspection templates (INSPECTION-001)
    const tplItems = (labels: string[]) => labels.map((label, k) => ({ id: `t${k}`, label, required: k < 4 }));
    ([["Weekly structural walkdown", "Routine structural condition check.", INSPECTION_ITEMS],
      ["Pre-pour check", "Formwork, rebar and embedment check before concrete pour.", ["Formwork dimensions and alignment checked", "Rebar size, spacing and cover verified", "Embedments and sleeves positioned", "Shoring and props inspected", "Pour approval signed by engineer"]],
      ["Monthly safety audit", "General site safety audit.", ["Edge protection complete", "Scaffold tags current", "PPE compliance observed", "Fire extinguishers accessible", "Housekeeping acceptable", "Crane lift plans available"]],
    ] as [string, string, string[]][]).forEach(([name, description, items], k) => {
      ds.inspectionTemplates.push({ id: sid(`tpl:${spec.key}:${k}`), organizationId: orgId, groupId: sid(`tplg:${spec.key}:${k}`), name, description, version: 1,
        status: "published", items: tplItems(items), createdBy: sid(`user:${spec.key}:project_manager`), createdAt: iso(today - 200 * DAY) });
    });

    // Drones & pilots
    const pilotId = sid(`pilot:${spec.key}`);
    ds.pilots.push({ id: pilotId, organizationId: orgId, userId: userByRole.drone_pilot, licenseNumber: spec.key === "atlas" ? "GCAA-RP-20931" : "LBA-DE-A2-77412",
      licenseType: spec.key === "atlas" ? "GCAA Remote Pilot" : "EU A2 CofC", issuingAuthority: spec.key === "atlas" ? "GCAA" : "LBA", licenseExpiresAt: date(today + 240 * DAY) });
    const droneSpecs: [string, Drone["providerKey"], string, string, Drone["status"], number][] = [
      ["Falcon-01", "simulator", "AeroSight", "Simulator X1", "available", 32],
      ["Mavic-03", "manual", "DJI", "Mavic 3 Enterprise", "available", 42],
      ["Matrice-07", "manual", "DJI", "Matrice 350 RTK", "maintenance", 55],
      ["Falcon-02", "simulator", "AeroSight", "Simulator X1", "available", 32],
      ["Falcon-03", "simulator", "AeroSight", "Simulator X1", "available", 32],
    ];
    const droneIds = droneSpecs.map(([name, provider, mf, model, status, ft], i) => {
      const id = sid(`drone:${spec.key}:${i}`);
      ds.drones.push({ id, organizationId: orgId, providerKey: provider, name, manufacturer: mf, model,
        serialNumber: `${mf.slice(0, 3).toUpperCase()}${spec.key.slice(0, 2).toUpperCase()}${(100231 + i * 977).toString(36).toUpperCase()}`,
        registrationNumber: `${spec.country}-UAS-${String(1200 + i * 37).padStart(5, "0")}`,
        registrationExpiresAt: date(today + (i === 2 ? 20 : 300) * DAY), status, maxFlightTimeMin: ft, maxSpeedMps: 15,
        totalFlightSeconds: Math.round(rnd() * 200000), totalFlights: Math.round(40 + rnd() * 160), missionControlVerified: provider === "simulator" });
      return id;
    });

    spec.projects.forEach((ps, pIndex) => {
      const projectId = sid(`project:${spec.key}:${ps.code}`);
      const start = today + ps.months[0] * 30 * DAY;
      const end = today + ps.months[1] * 30 * DAY;
      ds.projects.push({ id: projectId, organizationId: orgId, code: ps.code, name: ps.name, type: ps.type, clientName: ps.client,
        status: "active", startDate: date(start), endDate: date(end), location: ps.center, timezone: spec.timezone,
        description: `${ps.name} for ${ps.client}.`, createdAt: iso(start - 20 * DAY), createdBy: userByRole.project_manager });

      // Project membership: everyone except Owner/Admin (implicit). Inspector & Viewer only on the first two projects.
      for (const role of ROLES) {
        if (role === "org_owner" || role === "org_admin") continue;
        if ((role === "viewer" || role === "inspector") && pIndex === 2) continue;
        ds.projectMembers.push({ organizationId: orgId, projectId, userId: userByRole[role], role });
      }

      // Milestones + progress
      const tpl = MILESTONE_TEMPLATES[ps.type] ?? MILESTONE_TEMPLATES.building;
      const elapsed = (today - start) / (end - start);
      tpl.forEach((m, mi) => {
        const mid = sid(`ms:${spec.key}:${ps.code}:${mi}`);
        const mStart = start + m.s * (end - start), mEnd = start + m.e * (end - start);
        ds.milestones.push({ id: mid, organizationId: orgId, projectId, name: m.name, plannedStart: date(mStart), plannedEnd: date(mEnd), weight: m.w, sortOrder: mi });
        const planned = elapsed <= m.s ? 0 : elapsed >= m.e ? 100 : ((elapsed - m.s) / (m.e - m.s)) * 100;
        const lag = pIndex === 1 ? 0.78 : pIndex === 0 ? 0.93 : 1.02; // second project behind schedule
        const actualNow = Math.min(100, Math.round(planned * lag));
        if (actualNow > 0) {
          [0.5, 1].forEach((frac, k) => {
            const pct = Math.round(actualNow * frac);
            if (pct <= 0) return;
            ds.progressRecords.push({ id: sid(`pr:${mid}:${k}`), organizationId: orgId, projectId, milestoneId: mid,
              recordDate: date(today - (k === 0 ? 35 : 4) * DAY), percentComplete: pct, source: "manual", approvalStatus: "approved",
              notes: k === 0 ? "Monthly survey measurement" : "Verified from latest aerial capture", evidenceMediaIds: [],
              createdBy: userByRole.site_manager, approvedBy: userByRole.project_manager, createdAt: iso(today - (k === 0 ? 35 : 4) * DAY) });
          });
        }
      });

      ps.sites.forEach((ss, sIndex) => {
        const siteId = sid(`site:${spec.key}:${ps.code}:${ss.code}`);
        const center: LngLat = [ps.center[0] + ss.offset[0], ps.center[1] + ss.offset[1]];
        const boundary = rect(center, ss.w, ss.h, ss.rot);
        const nfz = sIndex === 0 && pIndex === 0 ? [{ id: sid(`nfz:${siteId}`), name: "Crane exclusion zone", geometry: rect([center[0] + 0.0003, center[1] + 0.0002], 30, 30, ss.rot) }] : [];
        ds.sites.push({ id: siteId, organizationId: orgId, projectId, code: ss.code, name: ss.name, address: ss.address, timezone: spec.timezone,
          boundary, noFlyZones: nfz, centroid: centroid(boundary), areaM2: Math.round(polygonArea(boundary)), geofenceBufferM: 50,
          maxAltitudeM: 120, status: "active", createdAt: iso(start) });

        // Assets
        const assetDefs = ps.type === "building" || ps.type === "industrial"
          ? [["building", "Main structure", 0, 0, 0.45, 0.4, ps.type === "industrial" ? 18 : 96], ["crane", "Tower crane TC-1", 0.25, 0.3, 0.06, 0.06, 70],
             ["equipment", "Concrete batching plant", -0.3, -0.3, 0.12, 0.1, 12], ["stockpile", "Aggregate stockpile", 0.3, -0.25, 0.1, 0.12, 6]]
          : ps.type === "bridge"
          ? [["bridge", "Deck span 1", -0.25, 0, 0.45, 0.6, 9], ["bridge", "Deck span 2", 0.25, 0, 0.45, 0.6, 9],
             ["structure", "Pier P2", 0, 0, 0.05, 0.4, 14], ["equipment", "Mobile crane MC-3", 0.38, 0.35, 0.05, 0.08, 40]]
          : [["road_segment", "Ramp segment R1", -0.2, 0, 0.5, 0.5, 2], ["structure", "Retaining wall RW-2", 0.2, 0.2, 0.4, 0.1, 6],
             ["utility", "Drainage culvert C-4", 0.1, -0.2, 0.08, 0.3, 3], ["equipment", "Paver P-1", 0.35, 0, 0.03, 0.05, 4]];
        assetDefs.forEach(([type, name, fx, fy, fw, fh, height], ai) => {
          const loc: LngLat = [center[0] + (fx as number) * ss.w / 111320 / Math.cos(center[1] * Math.PI / 180) * 0.9, center[1] + (fy as number) * ss.h / 110540 * 0.9];
          ds.assets.push({ id: sid(`asset:${siteId}:${ai}`), organizationId: orgId, projectId, siteId, type: type as string, name: name as string,
            tag: `${ss.code}-${String(ai + 1).padStart(3, "0")}`, location: loc, heightM: height as number,
            footprint: rect(loc, ss.w * (fw as number), ss.h * (fh as number), ss.rot), conditionRating: 2 + Math.floor(rnd() * 3), status: "active" });
        });

        // Surveys
        [60, 30, 4].forEach((ago, k) => {
          ds.surveys.push({ id: sid(`survey:${siteId}:${k}`), organizationId: orgId, projectId, siteId, name: `${ss.name} — orthomosaic ${date(today - ago * DAY)}`,
            type: "orthomosaic", status: k === 2 ? "uploaded" : "published", captureDate: date(today - ago * DAY), gsdCm: 2.1 + k * 0.1, crs: spec.key === "atlas" ? "EPSG:32640" : "EPSG:25832",
            qa: k === 2 ? undefined : { gcpCount: 8, rmseXY: 0.031, rmseZ: 0.048 } });
        });

        // Missions in various states
        const params = { altitudeM: 80, speedMps: 8, frontOverlap: 0.8, sideOverlap: 0.7, gimbalPitch: -90 };
        const statuses: MissionStatus[] = sIndex === 0
          ? ["completed", "completed", "ready", pIndex < 2 ? "in_progress" : "approved", "planned", pIndex === 0 ? "pending_approval" : "draft"]
          : ["completed", "approved"];
        statuses.forEach((status, mi) => {
          const mid = sid(`mission:${siteId}:${mi}`);
          const area = rect(center, ss.w * 0.85, ss.h * 0.85, ss.rot);
          const orbit = mi === 1 && ps.type !== "road";
          const wps = orbit ? generateOrbit(center, Math.min(ss.w, ss.h) * 0.35, { ...params, altitudeM: 60 }) : generateGrid(area, params);
          const est = estimate(wps, params, 32);
          const offsetDays = { completed: -7 * (mi + 1), ready: 0, in_progress: 0, planned: 2, pending_approval: 4, draft: 6, approved: 3 }[status as string] ?? 1;
          const startT = status === "in_progress" ? now - 6 * 60_000 : today + offsetDays * DAY + 6 * 3600_000;
          // Live flights: Falcon-01 (project 1) and Falcon-02 (project 2). "Ready" missions use Falcon-03 so a
          // simulated flight can be started from the UI. Other missions use the manual Mavic.
          const droneId = status === "in_progress" ? droneIds[pIndex === 0 ? 0 : 3] : status === "ready" ? droneIds[4] : droneIds[1];
          ds.missions.push({
            id: mid, organizationId: orgId, projectId, siteId, code: `MSN-${String(100 + ds.missions.length).padStart(6, "0")}`,
            name: `${orbit ? "Orbit inspection" : "Progress capture"} — ${ss.name}`, type: orbit ? "inspection" : "progress", template: orbit ? "orbit" : "grid",
            status, droneId: status === "draft" ? undefined : droneId, pilotId: status === "draft" ? undefined : pilotId,
            scheduledStart: iso(startT), scheduledEnd: iso(startT + Math.max(est.durationS * 1000 + 20 * 60_000, 3600_000)),
            actualStart: status === "completed" || status === "in_progress" ? iso(startT) : undefined,
            actualEnd: status === "completed" ? iso(startT + est.durationS * 1000) : undefined,
            area: orbit ? undefined : area, params: orbit ? { ...params, altitudeM: 60 } : params, waypoints: wps, estimates: est,
            checklist: CHECKLIST.map((label, i) => ({ id: `c${i}`, label, checked: status === "completed" || status === "in_progress" })),
            isSimulated: ds.drones.find((d) => d.id === droneId)?.providerKey === "simulator",
            createdBy: userByRole.project_manager, createdAt: iso(today - 14 * DAY),
            summary: status === "completed" ? { durationS: est.durationS, distanceM: est.distanceM, maxAltM: params.altitudeM + 1.4, minBattery: 31 + Math.round(rnd() * 20) } : undefined,
          });
          if (status === "in_progress") ds.drones.find((d) => d.id === droneId)!.status = "in_mission";
          ds.missionEvents.push({ id: sid(`mev:${mid}:0`), organizationId: orgId, missionId: mid, at: iso(today - 14 * DAY), type: "state_changed", text: "Mission created", actorId: userByRole.project_manager });
          if (status === "completed") ds.missionEvents.push({ id: sid(`mev:${mid}:1`), organizationId: orgId, missionId: mid, at: iso(startT + est.durationS * 1000), type: "state_changed", text: "Mission completed", actorId: userByRole.drone_pilot });

          // Media for completed missions
          if (status === "completed") {
            const count = 12;
            for (let k = 0; k < count; k++) {
              const wp = wps[Math.floor((k / count) * wps.length)];
              ds.media.push({ id: sid(`media:${mid}:${k}`), organizationId: orgId, projectId, siteId, missionId: mid,
                type: k === count - 1 ? "video" : "image", filename: k === count - 1 ? `DJI_${String(400 + k).padStart(4, "0")}.MP4` : `DJI_${String(400 + k).padStart(4, "0")}.JPG`,
                sizeBytes: k === count - 1 ? 1_843_000_000 : 11_000_000 + Math.round(rnd() * 3_000_000), capturedAt: iso(startT + k * 40_000),
                location: [wp.lng, wp.lat], status: "ready", sharedWithViewers: k % 3 === 0, tags: [["concrete", "rebar", "crane", "formwork", "earthworks", "facade"][k % 6]],
                altitudeM: params.altitudeM, seed: Math.floor(rnd() * 1e9), assetId: undefined });
            }
          }
        });

        // Inspections & findings (first site of the first two projects)
        if (sIndex === 0 && pIndex < 2) {
          const siteAssets = ds.assets.filter((a) => a.siteId === siteId);
          const insStates: Inspection["status"][] = ["in_progress", "submitted", "approved"];
          insStates.forEach((st, ii) => {
            const inspId = sid(`insp:${siteId}:${ii}`);
            ds.inspections.push({ id: inspId, organizationId: orgId, projectId, siteId, assetId: siteAssets[ii]?.id,
              code: `INS-${String(40 + ds.inspections.length).padStart(6, "0")}`, title: ["Weekly structural walkdown", "Formwork pre-pour check", "Monthly safety audit"][ii],
              type: ["structural", "quality", "safety"][ii], status: st, assigneeId: userByRole.inspector, reviewerId: userByRole.engineer,
              dueDate: date(today + (ii - 1) * 3 * DAY), approvedBy: st === "approved" ? userByRole.engineer : undefined,
              checklist: INSPECTION_ITEMS.map((label, k) => ({ id: `i${k}`, label, required: k < 4, value: st === "in_progress" && k > 2 ? undefined : k === 3 ? "fail" : "pass" })) });
            const sevs: Finding["severity"][] = [["high", "medium"], ["critical", "low"], ["medium"]][ii] as Finding["severity"][];
            sevs.forEach((sev, fi) => {
              const a = siteAssets[(ii + fi) % siteAssets.length];
              ds.findings.push({ id: sid(`finding:${inspId}:${fi}`), organizationId: orgId, projectId, siteId, inspectionId: inspId, assetId: a?.id,
                code: `FND-${String(300 + ds.findings.length).padStart(6, "0")}`,
                title: ["Hairline cracking at column C3-12", "Missing edge protection, level 9", "Exposed rebar at pier cap", "Water pooling near access road", "Formwork prop misaligned"][(ii * 2 + fi + pIndex * 3) % 5],
                description: "Observed during inspection; see attached evidence.", category: ["structural", "safety", "quality"][(ii + fi) % 3], severity: sev,
                status: ii === 2 ? "resolved" : fi === 0 ? "open" : "in_progress", location: a?.location ?? center, assigneeId: userByRole.site_manager,
                dueDate: date(today + (sev === "critical" ? -1 : sev === "high" ? 5 : 20) * DAY), aiGenerated: false, createdAt: iso(today - (5 - ii) * DAY),
                ...(ii === 2 ? { resolvedAt: iso(today - (5 - ii) * DAY + (sev === "medium" ? 40 : 20 + fi * 30) * 3_600_000) } : {}) });
            });
          });
        }
      });

      // Reports
      ds.reports.push({ id: sid(`report:${projectId}:1`), organizationId: orgId, projectId, title: `${ps.name} — Monthly Progress Report`, type: "progress",
        status: "published", version: 1, periodStart: date(today - 60 * DAY), periodEnd: date(today - 31 * DAY),
        sections: ["cover", "executive_summary", "kpis", "s_curve", "milestones", "before_after", "findings_summary"], generatedBy: userByRole.project_manager,
        generatedAt: iso(today - 30 * DAY), aiAssisted: false });
      ds.reports.push({ id: sid(`report:${projectId}:2`), organizationId: orgId, projectId, title: `${ps.name} — Monthly Progress Report`, type: "progress",
        status: "ready", version: 1, periodStart: date(today - 30 * DAY), periodEnd: date(today - 1 * DAY),
        sections: ["cover", "executive_summary", "kpis", "s_curve", "milestones", "before_after", "findings_summary"], generatedBy: userByRole.project_manager,
        generatedAt: iso(today - 1 * DAY), aiAssisted: false });
    });

    // Notifications for every member
    for (const role of ROLES) {
      const uid = userByRole[role];
      const items: [Notification["severity"], string, string, string][] = [
        ["critical", "finding.created", "Critical finding raised", "Missing edge protection, level 9 — Marina Tower B"],
        ["info", "mission.assigned", "Mission scheduled", "Progress capture — weekly flight scheduled for Thursday"],
        ["warning", "drone.registration_expiring", "Drone registration expiring", "Matrice-07 registration expires in 20 days"],
        ["info", "report.ready", "Report ready", "Monthly progress report is ready to review"],
      ];
      items.forEach(([severity, eventKey, title, body], k) => {
        ds.notifications.push({ id: sid(`notif:${uid}:${k}`), organizationId: orgId, userId: uid, eventKey, severity, title, body,
          createdAt: iso(now - (k * 7 + 1) * 3600_000), readAt: k > 1 ? iso(now - 3600_000) : undefined,
          href: eventKey === "finding.created" ? "/app/inspections" : eventKey === "mission.assigned" ? "/app/missions" : eventKey === "report.ready" ? "/app/reports" : "/app/fleet" });
      });
    }
  });

  return ds;
}
