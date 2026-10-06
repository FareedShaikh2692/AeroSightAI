import type { Metadata } from "next";
export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">About AeroSight AI</h1>
      <div className="mt-6 space-y-4 text-ink-2">
        <p>Construction monitoring still relies on manual site visits, scattered photos, spreadsheets and separate drone apps. Decisions are made late and disputes are hard to settle.</p>
        <p>AeroSight AI gives every flight, image, survey, inspection finding and progress measurement one home — tied to a project, a site and a location, comparable over time, and protected by strict organization isolation.</p>
        <h2 className="pt-4 text-xl font-semibold text-ink">Principles</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Location first, time as a dimension.</li>
          <li>Evidence over opinion.</li>
          <li>Humans decide — AI proposes.</li>
          <li>Tenant isolation is non-negotiable.</li>
          <li>Honest capability labelling.</li>
        </ul>
      </div>
    </div>
  );
}
