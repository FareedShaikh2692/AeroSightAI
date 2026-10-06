import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { PageHeader, StatusBadge, Empty, Card } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export default async function Surveys() {
  const ctx = await requireContext();
  const surveys = repo.listSurveys(ctx).sort((a, b) => b.captureDate.localeCompare(a.captureDate));
  const sites = new Map(repo.listSites(ctx).map((s) => [s.id, s]));
  return (
    <>
      <PageHeader eyebrow="Data" title="Surveys" subtitle="Survey campaigns and their geospatial outputs." />
      <Card className="mb-6">
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-accent">Integration required:</span> in-platform photogrammetry (raw images → orthomosaic/DSM) needs a processing engine such as NodeODM, Pix4D or DroneDeploy.
          GeoTIFF/COG upload needs object storage. Both are planned for Phase 2 — this demo shows survey records and QA metadata.
        </p>
      </Card>
      {surveys.length === 0 ? <Empty title="No surveys" /> : (
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>Survey</th><th>Site</th><th>Capture</th><th>GSD</th><th>CRS</th><th>QA (GCPs · RMSE XY/Z)</th><th>Status</th></tr></thead>
          <tbody>{surveys.map((s) => (
            <tr key={s.id}><td>{s.name}</td><td className="text-ink-2">{sites.get(s.siteId)?.name}</td><td>{fmtDate(s.captureDate)}</td><td className="font-mono text-xs">{s.gsdCm.toFixed(1)} cm/px</td>
              <td className="font-mono text-xs">{s.crs}</td><td className="font-mono text-xs">{s.qa ? `${s.qa.gcpCount} · ${(s.qa.rmseXY * 100).toFixed(1)}/${(s.qa.rmseZ * 100).toFixed(1)} cm` : "—"}</td><td><StatusBadge status={s.status} /></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
