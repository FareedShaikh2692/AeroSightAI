import { requireContext } from "@/lib/auth";
import { can } from "@/lib/policy";
import { PageHeader, Badge, Forbidden } from "@/components/ui";

const CATALOG: [string, string, string, "Coming soon" | "Integration required" | "Available"][] = [
  ["Drone Simulator", "Drone", "Simulated telemetry for training and demos.", "Available"],
  ["DJI Cloud API / FlightHub 2", "Drone", "Live telemetry, live video, mission upload, media sync.", "Integration required"],
  ["MAVLink Edge Bridge", "Drone", "PX4 / ArduPilot fleets via an on-site bridge.", "Coming soon"],
  ["NodeODM / OpenDroneMap", "Processing", "Orthomosaics, DSM and 3D models from raw images.", "Integration required"],
  ["Pix4D · DroneDeploy", "Processing", "Hand off processing to your existing engine.", "Coming soon"],
  ["Slack · Microsoft Teams", "Collaboration", "Route alerts and findings to channels.", "Coming soon"],
  ["Procore · Autodesk Construction Cloud", "Construction", "Link projects, push reports and photos.", "Coming soon"],
  ["SSO (OIDC / SAML) · SCIM", "Identity", "Single sign-on and automated provisioning.", "Coming soon"],
  ["Webhooks & API keys", "Developer", "Signed event delivery and scoped API access.", "Coming soon"],
];

export default async function Integrations() {
  const ctx = await requireContext();
  if (!can(ctx, "integration:manage")) return <Forbidden perm="integration:manage" />;
  return (
    <>
      <PageHeader eyebrow="Organization" title="Integrations" subtitle="Connect drone providers, processing engines and business systems. Credentials are stored in a secrets manager and never shown again." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CATALOG.map(([name, cat, body, status]) => (
          <div key={name} className="card flex flex-col p-5">
            <div className="flex items-start justify-between gap-2"><div><div className="text-[11px] uppercase tracking-wider text-ink-3">{cat}</div><div className="mt-1 font-semibold">{name}</div></div>
              <Badge tone={status === "Available" ? "ok" : status === "Integration required" ? "accent" : "neutral"}>{status}</Badge></div>
            <p className="mt-2 flex-1 text-sm text-ink-2">{body}</p>
            <button className="btn btn-secondary mt-4 justify-center" disabled aria-disabled="true" title="Not available in the demo build">{status === "Available" ? "Enabled" : "Connect"}</button>
          </div>
        ))}
      </div>
    </>
  );
}
