// In-memory data store for the demo build. The production design uses PostgreSQL + PostGIS with RLS
// (docs/05-Database). Every access goes through repo.ts, which enforces tenant scope and permissions,
// so swapping this module for a database driver does not change callers.
import { buildSeed, type DataSet } from "./seed";
import { createHash } from "node:crypto";
import type { AuditLog } from "./types";
import { sid } from "./ids";

interface StoreState { data: DataSet; bootedAt: string; chainHeads: Map<string, string>; chainAnchors: Map<string, string> }

const g = globalThis as unknown as { __aerosight?: StoreState };

function boot(): StoreState {
  const data = buildSeed();
  const state: StoreState = { data, bootedAt: new Date().toISOString(), chainHeads: new Map(), chainAnchors: new Map() };
  // Seed a short, valid audit history per org so the hash chain verifies from the start.
  for (const org of data.organizations) {
    const owner = data.memberships.find((m) => m.organizationId === org.id && m.role === "org_owner");
    const user = data.users.find((u) => u.id === owner?.userId);
    const projects = data.projects.filter((p) => p.organizationId === org.id);
    const events: Omit<AuditLog, "hash" | "prevHash">[] = [
      { id: sid(`audit:${org.id}:0`), organizationId: org.id, occurredAt: org.createdAt, actorType: "user", actorId: user?.id, actorLabel: user?.email ?? "owner", action: "org.created", entityType: "organization", entityId: org.id },
      ...projects.map((p, i) => ({ id: sid(`audit:${org.id}:p${i}`), organizationId: org.id, occurredAt: p.createdAt, actorType: "user" as const, actorId: p.createdBy,
        actorLabel: data.users.find((u) => u.id === p.createdBy)?.email ?? "system", action: "project.created", entityType: "project", entityId: p.id, projectId: p.id,
        changes: { name: [null, p.name] as [unknown, unknown], code: [null, p.code] as [unknown, unknown] } })),
    ];
    for (const e of events) appendAudit(state, e);
  }
  return state;
}

export function store(): StoreState {
  if (!g.__aerosight) g.__aerosight = boot();
  return g.__aerosight;
}

export function db(): DataSet {
  return store().data;
}

export function canonical(e: Omit<AuditLog, "hash" | "prevHash">): string {
  const keys = Object.keys(e).sort() as (keyof typeof e)[];
  return JSON.stringify(keys.map((k) => [k, e[k] ?? null]));
}

/** Append-only audit with a per-organization SHA-256 hash chain (AUDIT-004). */
export function appendAudit(state: StoreState, e: Omit<AuditLog, "hash" | "prevHash">): AuditLog {
  const prevHash = state.chainHeads.get(e.organizationId) ?? "0".repeat(64);
  const hash = createHash("sha256").update(prevHash + canonical(e)).digest("hex");
  const row: AuditLog = Object.freeze({ ...e, prevHash, hash }) as AuditLog;
  state.data.auditLogs.push(row);
  state.chainHeads.set(e.organizationId, hash);
  return row;
}

/** Recomputes the chain for an org; returns the first broken entry id, or null if intact (AUDIT-010). */
export function verifyAuditChain(orgId: string): { ok: boolean; checked: number; brokenAt?: string } {
  let prev = store().chainAnchors.get(orgId) ?? "0".repeat(64);
  const rows = db().auditLogs.filter((r) => r.organizationId === orgId);
  for (const r of rows) {
    const { hash, prevHash, ...rest } = r;
    const expected = createHash("sha256").update(prev + canonical(rest)).digest("hex");
    if (prevHash !== prev || hash !== expected) return { ok: false, checked: rows.length, brokenAt: r.id };
    prev = hash;
  }
  return { ok: true, checked: rows.length };
}
