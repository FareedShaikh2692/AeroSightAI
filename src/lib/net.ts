// Outbound HTTP for user-supplied URLs (webhooks, Slack/Teams, NodeODM) with SSRF protection (SEC-033):
// https only (http allowed for explicitly local-dev NodeODM is NOT permitted), DNS resolved and every address
// checked against private, loopback, link-local, CGNAT, multicast and cloud-metadata ranges; no redirects.
import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafeUrlError extends Error {}

function ipv4Blocked(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}
function ipv6Blocked(ip: string) {
  const x = ip.toLowerCase();
  if (x === "::1" || x === "::") return true;
  if (x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb") || x.startsWith("ff")) return true;
  const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? ipv4Blocked(mapped[1]) : false;
}

export async function assertSafeUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new UnsafeUrlError("Enter a valid URL."); }
  if (u.protocol !== "https:") throw new UnsafeUrlError("Only https:// URLs are allowed.");
  if (u.username || u.password) throw new UnsafeUrlError("URLs with embedded credentials are not allowed.");
  if (u.port && !["443", "8443"].includes(u.port)) throw new UnsafeUrlError("Only ports 443 and 8443 are allowed.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new UnsafeUrlError("Internal hostnames are not allowed.");
  const addrs = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true }).catch(() => { throw new UnsafeUrlError("The hostname could not be resolved."); });
  for (const a of addrs) {
    if ((a.family === 4 && ipv4Blocked(a.address)) || (a.family === 6 && ipv6Blocked(a.address))) throw new UnsafeUrlError("The URL resolves to a private or reserved network address.");
  }
  return u;
}

export async function safeFetch(raw: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const u = await assertSafeUrl(raw);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 8000);
  const started = Date.now();
  try {
    const res = await fetch(u, { ...init, redirect: "manual", signal: ctrl.signal, headers: { "user-agent": "AeroSight-Webhooks/1.0", ...(init.headers ?? {}) } });
    return { status: res.status, ok: res.status >= 200 && res.status < 300, durationMs: Date.now() - started, text: async () => (await res.text()).slice(0, 2000) };
  } finally {
    clearTimeout(t);
  }
}
