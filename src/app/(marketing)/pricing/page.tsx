import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Pricing" };

const PLANS = [
  { name: "Starter", price: "$490", note: "per month", items: ["5 seats", "3 active projects", "250 GB storage", "Maps, missions, media, reports"], cta: "Start trial" },
  { name: "Professional", price: "$1,890", note: "per month", items: ["25 seats", "Unlimited projects", "2 TB storage", "Inspections, integrations", "Custom roles (5)", "AI credits pool"], cta: "Start trial", featured: true },
  { name: "Enterprise", price: "Custom", note: "annual", items: ["Custom seats", "SSO / SAML, SCIM", "Unlimited custom roles", "Data residency & retention", "7-year audit retention", "99.9% SLA"], cta: "Contact sales" },
];

export default function Pricing() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-center text-4xl font-semibold tracking-tight">Pricing</h1>
      <p className="mt-3 text-center text-ink-2">Indicative pricing. Storage, AI credits and video minutes are metered above plan limits.</p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={`card flex flex-col p-6 ${p.featured ? "border-accent" : ""}`}>
            <h2 className="font-semibold">{p.name}</h2>
            <div className="mt-4"><span className="font-mono text-3xl">{p.price}</span> <span className="text-sm text-ink-3">{p.note}</span></div>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-ink-2">{p.items.map((i) => <li key={i}>✓ {i}</li>)}</ul>
            <Link href={p.name === "Enterprise" ? "/contact" : "/signup"} className={`btn mt-8 justify-center ${p.featured ? "btn-primary" : "btn-secondary"}`}>{p.cta}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
