// Provider connectors (docs/04-Architecture/Drone-Architecture.md §5, GIS spec §5).
// Status: Integration Required — these call the real provider endpoints when configured; nothing is simulated here.
import "server-only";
import { decrypt } from "./crypto";
import { safeFetch } from "./net";
import type { Integration } from "./types";

export interface ProviderTest { ok: boolean; message: string; details?: Record<string, unknown> }

/** NodeODM (OpenDroneMap) REST API: GET /info returns version and queue state. Token passed as ?token= when set. */
async function testNodeOdm(i: Integration): Promise<ProviderTest> {
  const token = i.secretEnc ? decrypt(i.secretEnc) : "";
  const url = new URL("/info", i.config.baseUrl);
  if (token) url.searchParams.set("token", token);
  const res = await safeFetch(url.toString(), { method: "GET" });
  if (!res.ok) return { ok: false, message: `NodeODM responded with HTTP ${res.status}.` };
  try {
    const info = JSON.parse(await res.text()) as { version?: string; taskQueueCount?: number; engine?: string };
    if (!info.version) return { ok: false, message: "The endpoint did not return NodeODM /info data." };
    return { ok: true, message: `NodeODM ${info.version} (${info.engine ?? "odm"}), ${info.taskQueueCount ?? 0} task(s) queued.`, details: info };
  } catch {
    return { ok: false, message: "The endpoint did not return JSON." };
  }
}

/**
 * DJI Cloud API: AeroSight acts as a third-party cloud that DJI Pilot 2 / Dock connect to (MQTT + HTTPS).
 * Verifying credentials requires the customer's DJI developer App ID/Key/License and a reachable device binding
 * endpoint; here we verify that the configured gateway is reachable over HTTPS.
 */
async function testDjiCloud(i: Integration): Promise<ProviderTest> {
  const res = await safeFetch(i.config.baseUrl, { method: "GET" });
  if (res.status >= 500) return { ok: false, message: `Gateway responded with HTTP ${res.status}.` };
  return { ok: false, message: "Gateway reachable. Device binding and MQTT telemetry require a DJI developer licence and paired devices (Integration Required)." };
}

export async function testProvider(i: Integration): Promise<ProviderTest> {
  try {
    return i.provider === "nodeodm" ? await testNodeOdm(i) : await testDjiCloud(i);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
