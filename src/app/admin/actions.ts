"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff, clientIp } from "@/lib/auth";
import { db, store, appendAudit } from "@/lib/store";
import { newId } from "@/lib/ids";
import { emit } from "@/lib/events";

export type AdminState = { error?: string | null };

const Schema = z.object({
  organizationId: z.string().min(8),
  ticketRef: z.string().trim().regex(/^[A-Z]{2,10}-\d{1,8}$/, "Ticket reference must look like SUP-1234."),
  justification: z.string().trim().min(20, "Justification must be at least 20 characters."),
  minutes: z.coerce.number().int().min(5).max(240),
});

/** ADMIN-009: start read-only, time-boxed access to one tenant. Owner is notified; both logs record it. */
export async function startBreakGlassAction(_: AdminState, f: FormData): Promise<AdminState> {
  const staff = await requireStaff();
  const p = Schema.safeParse(Object.fromEntries(f));
  if (!p.success) return { error: p.error.issues[0].message };
  const org = db().organizations.find((o) => o.id === p.data.organizationId);
  if (!org) return { error: "Organization not found." };
  if (db().breakGlassSessions.some((b) => b.staffUserId === staff.userId && !b.endedEarlyAt && Date.parse(b.endsAt) > Date.now())) return { error: "End your current access session first." };
  const now = Date.now();
  const s = { id: newId(), staffUserId: staff.userId, organizationId: org.id, ticketRef: p.data.ticketRef, justification: p.data.justification,
    startsAt: new Date(now).toISOString(), endsAt: new Date(now + p.data.minutes * 60_000).toISOString() };
  db().breakGlassSessions.push(s);
  const user = db().users.find((u) => u.id === staff.userId)!;
  appendAudit(store(), { id: newId(), organizationId: org.id, occurredAt: s.startsAt, actorType: "platform_staff", actorId: user.id, actorLabel: user.email,
    action: "staff.break_glass_started", entityType: "organization", entityId: org.id, ip: await clientIp(),
    changes: { ticket: [null, s.ticketRef], until: [null, s.endsAt] } });
  const owners = db().memberships.filter((m) => m.organizationId === org.id && m.role === "org_owner" && m.status === "active").map((m) => m.userId);
  emit({ key: "security.break_glass", orgId: org.id, entityType: "organization", entityId: org.id, severity: "critical", title: "AeroSight support accessed your organization",
    body: `Read-only access for ticket ${s.ticketRef} until ${s.endsAt.slice(11, 16)} UTC. Reason: ${s.justification}`, href: "/app/audit", recipients: owners });
  redirect("/app/dashboard");
}

export async function endBreakGlassAction() {
  const staff = await requireStaff();
  const s = db().breakGlassSessions.find((b) => b.staffUserId === staff.userId && !b.endedEarlyAt && Date.parse(b.endsAt) > Date.now());
  if (s) {
    s.endedEarlyAt = new Date().toISOString();
    const user = db().users.find((u) => u.id === staff.userId)!;
    appendAudit(store(), { id: newId(), organizationId: s.organizationId, occurredAt: s.endedEarlyAt, actorType: "platform_staff", actorId: user.id, actorLabel: user.email,
      action: "staff.break_glass_ended", entityType: "organization", entityId: s.organizationId, changes: { ticket: [null, s.ticketRef] } });
  }
  revalidatePath("/admin");
  redirect("/admin");
}
