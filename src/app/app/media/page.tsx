import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { PageHeader, Empty, Forbidden, Card, Badge } from "@/components/ui";
import { MediaThumb } from "@/components/MediaThumb";
import { MapClient } from "@/components/MapClient";
import { shareMediaAction } from "../actions";
import { fmtBytes, fmtDateTime } from "@/lib/format";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ site?: string; type?: string; view?: string; mode?: string; compare?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "media:read")) return <Forbidden perm="media:read" />;
  const sp = await searchParams;
  const sites = repo.listSites(ctx);
  const media = repo.listMedia(ctx, { siteId: sp.site || undefined, type: sp.type || undefined });
  const viewing = sp.view ? repo.getMedia(ctx, sp.view) : null;
  const compareWith = sp.compare ? repo.getMedia(ctx, sp.compare) : null;
  const qs = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ site: sp.site, type: sp.type, mode: sp.mode, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader eyebrow="Data" title="Media" subtitle={`${media.length} item(s). Viewers only see items shared with them.`}
        actions={<div className="flex gap-1 rounded-lg border border-line p-1 text-xs">
          <Link href={qs({ mode: undefined })} className={`rounded px-2 py-1 ${sp.mode !== "map" ? "bg-raised" : "text-ink-2"}`}>Grid</Link>
          <Link href={qs({ mode: "map" })} className={`rounded px-2 py-1 ${sp.mode === "map" ? "bg-raised" : "text-ink-2"}`}>Map</Link>
        </div>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="site" defaultValue={sp.site ?? ""} className="input w-64" aria-label="Site"><option value="">All sites</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select name="type" defaultValue={sp.type ?? ""} className="input w-40" aria-label="Type"><option value="">All types</option><option value="image">Images</option><option value="video">Videos</option></select>
        {sp.mode && <input type="hidden" name="mode" value={sp.mode} />}
        <button className="btn btn-secondary">Filter</button>
        <span className="ml-auto self-center text-xs text-ink-3">Uploads are disabled in this demo build (no object storage connected).</span>
      </form>

      {viewing && (
        <Card className="mb-6" title={viewing.filename} actions={<Link href={qs({ view: undefined, compare: undefined })} className="text-xs text-ink-2 hover:text-ink">Close</Link>}>
          <div className={`grid gap-4 ${compareWith ? "lg:grid-cols-2" : "lg:grid-cols-[1fr_320px]"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/v1/media/${viewing.id}/render`} alt={viewing.filename} className="w-full rounded-lg border border-line" />
            {compareWith ? (
              <div>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/v1/media/${compareWith.id}/render`} alt={compareWith.filename} className="w-full rounded-lg border border-line" />
                <p className="mt-2 text-xs text-ink-2">{compareWith.filename} · {fmtDateTime(compareWith.capturedAt)}</p></div>
            ) : (
              <dl className="grid grid-cols-2 content-start gap-y-2 text-sm">
                <dt className="text-ink-3">Captured</dt><dd>{fmtDateTime(viewing.capturedAt)}</dd>
                <dt className="text-ink-3">Location</dt><dd className="font-mono text-xs">{viewing.location[1].toFixed(6)}, {viewing.location[0].toFixed(6)}</dd>
                <dt className="text-ink-3">Altitude</dt><dd className="font-mono">{viewing.altitudeM} m AGL</dd>
                <dt className="text-ink-3">Size</dt><dd className="font-mono">{fmtBytes(viewing.sizeBytes)}</dd>
                <dt className="text-ink-3">Site</dt><dd>{sites.find((s) => s.id === viewing.siteId)?.name}</dd>
                <dt className="text-ink-3">Mission</dt><dd>{viewing.missionId ? <Link className="text-accent" href={`/app/missions/${viewing.missionId}`}>Open</Link> : "—"}</dd>
                <dt className="text-ink-3">Tags</dt><dd className="flex flex-wrap gap-1">{viewing.tags.map((t) => <Badge key={t}>{t}</Badge>)}</dd>
                <dt className="text-ink-3">Viewers</dt><dd>{viewing.sharedWithViewers ? "Shared" : "Not shared"}</dd>
                <dd className="col-span-2 mt-3 flex flex-wrap gap-2">
                  {can(ctx, "media:share", viewing) && (
                    <form action={shareMediaAction}><input type="hidden" name="id" value={viewing.id} /><input type="hidden" name="shared" value={String(!viewing.sharedWithViewers)} />
                      <button className="btn btn-secondary">{viewing.sharedWithViewers ? "Unshare from viewers" : "Share with viewers"}</button></form>
                  )}
                  {media.filter((x) => x.id !== viewing.id && x.siteId === viewing.siteId).slice(0, 1).map((x) => <Link key={x.id} href={qs({ view: viewing.id, compare: x.id })} className="btn btn-secondary">Compare side by side</Link>)}
                </dd>
              </dl>
            )}
          </div>
        </Card>
      )}

      {media.length === 0 ? <Empty title="No media" body="Media captured on missions appears here." /> : sp.mode === "map" ? (
        <MapClient height={560} fitTo={media.map((m) => m.location)} initialBasemap="satellite" data={{ media: media.map((m) => ({ id: m.id, filename: m.filename, location: m.location })),
          sites: sites.map((s) => ({ id: s.id, name: s.name, boundary: s.boundary })) }} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {media.slice(0, 120).map((m) => (
            <div key={m.id}>
              <MediaThumb media={m} href={qs({ view: m.id })} />
              <div className="mt-1 truncate text-[11px] text-ink-2">{m.filename}</div>
              <div className="text-[10px] text-ink-3">{fmtDateTime(m.capturedAt)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
