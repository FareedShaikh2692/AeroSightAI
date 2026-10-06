// Multi-provider drone ecosystem (Roadmap Phase 4). Every drone talks to AeroSight through an adapter that
// declares its capabilities (docs/04-Architecture/Drone-Architecture.md §5). Capabilities are only claimed as
// "verified" after certification; everything else is honest about what it needs.
import type { Drone } from "./types";

export type Cap = "telemetry" | "liveVideo" | "missionUpload" | "missionControl" | "dock" | "mediaSync";
export type AdapterStatus = "verified" | "prototype" | "integration_required";

export interface AdapterInfo {
  key: Drone["providerKey"]; name: string; vendor: string; protocol: string; status: AdapterStatus; builtIn?: boolean;
  capabilities: Partial<Record<Cap, AdapterStatus>>; requirements: string; docs: string; models: string[];
}

export const ADAPTERS: AdapterInfo[] = [
  { key: "simulator", name: "AeroSight Simulator", vendor: "AeroSight", protocol: "Internal", status: "verified", builtIn: true, models: ["Simulator X1"],
    capabilities: { telemetry: "verified", missionControl: "verified", missionUpload: "verified" }, requirements: "None — for demos, training and testing.", docs: "docs/04-Architecture/Drone-Architecture.md" },
  { key: "manual", name: "Manual / upload", vendor: "Any", protocol: "File upload", status: "verified", builtIn: true, models: ["Any aircraft"],
    capabilities: { mediaSync: "verified" }, requirements: "Fly with the vendor app; upload media and logs afterwards.", docs: "docs/04-Architecture/Drone-Architecture.md" },
  { key: "mavlink", name: "MAVLink (ArduPilot / PX4)", vendor: "Open standard", protocol: "MAVLink 2 via edge bridge", status: "prototype", models: ["ArduPilot", "PX4", "Freefly Astro", "Inspired Flight IF800"],
    capabilities: { telemetry: "prototype", missionUpload: "integration_required", missionControl: "integration_required" },
    requirements: "Edge bridge next to the ground station (scripts/edge-bridge.mjs fed by pymavlink / mavlink2rest). Telemetry works today; mission upload and commands need certification per autopilot.", docs: "https://mavlink.io/en/" },
  { key: "dji_cloud", name: "DJI Cloud API", vendor: "DJI", protocol: "MQTT + HTTPS (DJI Pilot 2 / Dock 2/3)", status: "integration_required", models: ["Matrice 350 RTK", "Matrice 30T", "Mavic 3 Enterprise", "Dock 2", "Dock 3"],
    capabilities: { telemetry: "integration_required", liveVideo: "integration_required", missionUpload: "integration_required", missionControl: "integration_required", dock: "integration_required", mediaSync: "integration_required" },
    requirements: "DJI developer account, App ID/Key and licence; devices bound to the organization.", docs: "https://developer.dji.com/doc/cloud-api-tutorial/en/" },
  { key: "skydio", name: "Skydio Cloud", vendor: "Skydio", protocol: "Skydio Cloud API (REST + webhooks)", status: "integration_required", models: ["Skydio X10", "Skydio Dock for X10"],
    capabilities: { telemetry: "integration_required", liveVideo: "integration_required", missionUpload: "integration_required", dock: "integration_required", mediaSync: "integration_required" },
    requirements: "Skydio Cloud enterprise tenant and API token.", docs: "https://apidocs.skydio.com/" },
  { key: "parrot", name: "Parrot ANAFI", vendor: "Parrot", protocol: "GroundSDK / Olympe via edge bridge", status: "integration_required", models: ["ANAFI Ai", "ANAFI USA"],
    capabilities: { telemetry: "integration_required", missionUpload: "integration_required", mediaSync: "integration_required" },
    requirements: "Edge bridge running Parrot Olympe; ANAFI Ai 4G link optional.", docs: "https://developer.parrot.com/" },
  { key: "autel", name: "Autel Enterprise", vendor: "Autel Robotics", protocol: "Autel SDK via edge bridge", status: "integration_required", models: ["EVO II Pro V3", "EVO Max 4T", "Autel Dock"],
    capabilities: { telemetry: "integration_required", missionUpload: "integration_required", dock: "integration_required" },
    requirements: "Autel developer SDK licence and edge bridge.", docs: "https://www.autelrobotics.com/" },
];

export const adapter = (key: string) => ADAPTERS.find((a) => a.key === key);
export const CAP_LABELS: Record<Cap, string> = { telemetry: "Live telemetry", liveVideo: "Live video", missionUpload: "Mission upload", missionControl: "Flight commands", dock: "Dock automation", mediaSync: "Media sync" };
