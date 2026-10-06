import Link from "next/link";
import { Plane, Map, Activity, ClipboardCheck, LineChart, FileText, ShieldCheck, Boxes, ArrowRight } from "lucide-react";

const FEATURES = [
  { icon: Plane, title: "Drone operations", body: "Fleet, pilots, mission planning with geofence validation, approvals and pre-flight checklists — independent of drone manufacturer." },
  { icon: Activity, title: "Live operations", body: "Real-time telemetry, alerts for battery, geofence and signal, and live video where your provider supports it." },
  { icon: Map, title: "Mapping & GIS", body: "2D, satellite and terrain maps with site boundaries, assets, flight paths, orthomosaics and measurement tools." },
  { icon: Boxes, title: "3D digital twin", body: "Navigate your site in 3D with models, assets, inspection markers and history over time." },
  { icon: LineChart, title: "Progress tracking", body: "Weighted milestones, evidence-backed progress records, S-curves and schedule variance — computed the same everywhere." },
  { icon: ClipboardCheck, title: "Inspections", body: "Checklists, findings tied to assets and locations, engineer approval and tracked remediation." },
  { icon: FileText, title: "Reports", body: "Branded progress reports in minutes, published to clients or shared with expiring links." },
  { icon: ShieldCheck, title: "Enterprise trust", body: "Strict tenant isolation, role-based access, 2FA and a tamper-evident audit log." },
];

export default function Landing() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-60" aria-hidden="true" />
        <HeroArt />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 lg:pt-28">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs text-ink-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" /> Drone-powered construction intelligence
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              See Every Site.<br />Track Every Progress.<br /><span className="text-accent">Build Smarter.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-ink-2">
              AeroSight AI brings drone operations, GIS, 3D visualization, inspections and progress analytics into one secure
              platform — so every stakeholder sees the same, evidence-based picture of every site.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn btn-primary h-11 px-5 text-base">Explore the live demo <ArrowRight size={16} /></Link>
              <Link href="/features" className="btn btn-secondary h-11 px-5 text-base">See features</Link>
            </div>
            <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-6">
              {[["< 30 min", "monthly report, from days"], ["1 place", "for every flight & capture"], ["0", "cross-tenant data exposure — by design"]].map(([v, l]) => (
                <div key={l}><dt className="font-mono text-2xl text-ink">{v}</dt><dd className="mt-1 text-xs text-ink-3">{l}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Everything your sites produce, in one trusted record</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-ink-2">Replace scattered drone apps, spreadsheets and email threads with a single geolocated, time-stamped, auditable source of truth.</p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 transition hover:border-line-strong">
              <f.icon className="text-accent" size={22} />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-ink-2">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <div className="card grid gap-8 overflow-hidden p-8 md:grid-cols-2 md:p-12">
          <div>
            <h2 className="text-2xl font-semibold">Honest by design</h2>
            <p className="mt-3 text-ink-2">Simulated data is labelled <span className="sim-stripes rounded px-1 text-accent">Simulated</span>, beta features are labelled Beta, and AI suggestions are always reviewed by a person before they become official. Your pilots stay in command of every flight.</p>
            <Link href="/signup" className="btn btn-primary mt-6">Start free trial</Link>
          </div>
          <ul className="space-y-3 text-sm text-ink-2">
            {["Organization isolation enforced on every request", "Role-based access for 9 construction roles + custom roles", "Tamper-evident, hash-chained audit log", "Geofence and altitude validation on every mission plan", "Signed, short-lived media access"].map((x) => (
              <li key={x} className="flex gap-3"><ShieldCheck size={18} className="shrink-0 text-ok" />{x}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function HeroArt() {
  return (
    <svg className="pointer-events-none absolute -right-40 top-10 hidden h-[560px] w-[860px] opacity-80 lg:block" viewBox="0 0 860 560" aria-hidden="true">
      <defs>
        <linearGradient id="hb" x1="0" x2="1"><stop offset="0" stopColor="#22D3EE" stopOpacity=".0" /><stop offset="1" stopColor="#22D3EE" stopOpacity=".35" /></linearGradient>
      </defs>
      <g transform="translate(430 300) skewX(-30) scale(1 .58) rotate(45)">
        {Array.from({ length: 9 }).map((_, i) => <line key={`a${i}`} x1={-260} y1={-260 + i * 65} x2={260} y2={-260 + i * 65} stroke="#22D3EE" strokeOpacity=".12" />)}
        {Array.from({ length: 9 }).map((_, i) => <line key={`b${i}`} y1={-260} x1={-260 + i * 65} y2={260} x2={-260 + i * 65} stroke="#22D3EE" strokeOpacity=".12" />)}
        <rect x={-180} y={-150} width={300} height={240} fill="url(#hb)" stroke="#22D3EE" strokeWidth="2" />
        <rect x={-120} y={-90} width={110} height={110} fill="#16202A" stroke="#9AABBD" />
        <rect x={30} y={-60} width={60} height={120} fill="#16202A" stroke="#FFB020" />
        <path d="M-200 120 L-120 -170 L-40 120 L40 -170 L120 120" fill="none" stroke="#FFB020" strokeDasharray="6 6" strokeWidth="2" />
      </g>
      <g transform="translate(620 120)">
        <circle r="26" fill="rgba(34,211,238,.15)" stroke="#22D3EE" />
        <path d="M0 -14 L9 12 L0 6 L-9 12 Z" fill="#22D3EE" />
      </g>
    </svg>
  );
}
