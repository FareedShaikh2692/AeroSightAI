import type { Metadata } from "next";
export const metadata: Metadata = { title: "Industries" };

const INDUSTRIES = [
  ["Commercial building", "Track structure, envelope and fit-out progress floor by floor with weekly captures and branded client reports."],
  ["Infrastructure", "Monitor corridors for roads, bridges and rail with corridor missions, asset inspections and schedule variance."],
  ["Energy & utilities", "Inspect towers, substations and solar farms with repeatable orbit missions and severity-based findings."],
  ["Mining & earthworks", "Measure stockpiles and cut/fill against plan with survey-grade orthomosaics and elevation models."],
  ["Developers & lenders", "Independent, evidence-based progress for draw requests — shared with viewers, never edited by them."],
];

export default function Industries() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Industries</h1>
      <p className="mt-3 text-ink-2">Built for construction and infrastructure organizations that run portfolios of sites.</p>
      <div className="mt-10 space-y-4">
        {INDUSTRIES.map(([t, b]) => (
          <div key={t} className="card flex flex-col gap-2 p-6 md:flex-row md:items-center md:gap-8">
            <h2 className="w-64 shrink-0 font-semibold">{t}</h2><p className="text-sm text-ink-2">{b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
