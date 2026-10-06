import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Card, Progress, Forbidden } from "@/components/ui";
import { db } from "@/lib/store";

export default async function Billing() {
  const ctx = await requireContext();
  if (!can(ctx, "billing:manage")) return <Forbidden perm="billing:manage" />;
  const org = repo.currentOrg(ctx);
  const seats = db().memberships.filter((m) => m.organizationId === ctx.orgId && m.status === "active").length;
  const storageGb = db().media.filter((m) => m.organizationId === ctx.orgId).reduce((s, m) => s + m.sizeBytes, 0) / 1e9;
  const limits = org.plan === "enterprise" ? { seats: 100, storage: 10000, ai: 50000 } : org.plan === "professional" ? { seats: 25, storage: 2000, ai: 5000 } : { seats: 5, storage: 250, ai: 0 };
  const meters: [string, number, number, string][] = [["Seats", seats, limits.seats, ""], ["Storage", storageGb, limits.storage, " GB"], ["AI credits", 0, limits.ai, ""]];
  return (
    <>
      <PageHeader eyebrow="Organization" title="Billing & usage" subtitle="Payments are handled by a hosted checkout; AeroSight never stores card details." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Current plan"><div className="text-2xl font-semibold capitalize">{org.plan}</div><p className="mt-1 text-sm text-ink-2">Demo subscription · no charges</p>
          <button className="btn btn-secondary mt-4" disabled title="Payment provider not connected in demo">Change plan</button></Card>
        <Card title="Usage this period"><div className="space-y-4">{meters.map(([k, v, max, u]) => (
          <div key={k}><div className="mb-1 flex justify-between text-sm"><span>{k}</span><span className="font-mono text-xs text-ink-2">{v.toFixed(u ? 1 : 0)}{u} / {max ? `${max}${u}` : "not included"}</span></div>
            <Progress value={max ? (v / max) * 100 : 0} tone={max && v / max >= 1 ? "bad" : max && v / max >= 0.8 ? "warn" : "data"} /></div>
        ))}</div></Card>
      </div>
    </>
  );
}
