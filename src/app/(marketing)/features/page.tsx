import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";

export const metadata: Metadata = { title: "Features" };

const MODULES: { name: string; status: "Available" | "Simulated" | "Beta" | "Coming soon"; points: string[] }[] = [
  { name: "Drone operations", status: "Available", points: ["Fleet registry with registration and maintenance tracking", "Pilot license tracking with expiry blocks", "Grid and orbit mission templates with automatic waypoint generation", "Geofence, no-fly zone and altitude validation", "Approval workflow, pre-flight checklist, KMZ export for your flight app"] },
  { name: "Live telemetry", status: "Simulated", points: ["Position, altitude, speed, heading, battery, GPS and signal", "Battery, geofence, altitude and GPS alerts", "Provider integrations (e.g. DJI Cloud API) require connection — coming in Phase 2"] },
  { name: "Mapping & GIS", status: "Available", points: ["2D, satellite and terrain basemaps", "Site boundaries, no-fly zones, assets, flight paths, findings", "Capture timeline and comparisons"] },
  { name: "3D digital twin", status: "Beta", points: ["3D site view with extruded assets and terrain tilt", "Full photogrammetry/BIM streaming is on the roadmap (Phase 3)"] },
  { name: "Progress monitoring", status: "Available", points: ["Weighted milestones and S-curve", "Evidence-backed progress records with approval", "Schedule variance, status and forecast completion"] },
  { name: "Inspections", status: "Available", points: ["Checklists, findings with severity and SLA", "Engineer approval with no self-approval", "Finding lifecycle to verified closure"] },
  { name: "Reports", status: "Available", points: ["Branded progress reports", "Publish to client viewers", "Print-ready PDF via your browser"] },
  { name: "AI analysis", status: "Coming soon", points: ["Progress estimation and change detection", "Defect detection assistance", "Assistant that respects your permissions"] },
];

const TONE = { Available: "ok", Simulated: "accent", Beta: "info", "Coming soon": "neutral" } as const;

export default function Features() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Features</h1>
      <p className="mt-3 max-w-2xl text-ink-2">Every capability is labelled with its real status in this release — no surprises.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {MODULES.map((m) => (
          <div key={m.name} className="card p-6">
            <div className="flex items-center justify-between"><h2 className="font-semibold">{m.name}</h2><Badge tone={TONE[m.status]}>{m.status}</Badge></div>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-ink-2">{m.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        ))}
      </div>
      <Link href="/login" className="btn btn-primary mt-10">Try the demo</Link>
    </div>
  );
}
