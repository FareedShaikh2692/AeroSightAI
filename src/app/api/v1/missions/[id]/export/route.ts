// MISSION-020: export the plan for manual loading into the provider's flight app (KML / GeoJSON).
import { api } from "@/lib/api";
import * as repo from "@/lib/repo";
import { notFound } from "@/lib/policy";

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const GET = api<{ id: string }>(async (ctx, req, { id }) => {
  const m = repo.getMission(ctx, id);
  if (!m) throw notFound();
  const format = new URL(req.url).searchParams.get("format") ?? "kml";
  if (format === "geojson") {
    return Response.json({ type: "FeatureCollection", features: [
      { type: "Feature", properties: { name: m.name, code: m.code, altitudeM: m.params.altitudeM }, geometry: { type: "LineString", coordinates: m.waypoints.map((w) => [w.lng, w.lat, w.altM]) } },
      ...m.waypoints.map((w) => ({ type: "Feature", properties: { seq: w.seq, action: w.action }, geometry: { type: "Point", coordinates: [w.lng, w.lat, w.altM] } })),
    ] }, { headers: { "content-disposition": `attachment; filename="${m.code}.geojson"` } });
  }
  const coords = m.waypoints.map((w) => `${w.lng},${w.lat},${w.altM}`).join(" ");
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(m.code)} — ${esc(m.name)}</name>
<Placemark><name>Flight path</name><LineString><altitudeMode>relativeToGround</altitudeMode><coordinates>${coords}</coordinates></LineString></Placemark>
${m.waypoints.map((w) => `<Placemark><name>WP${w.seq}</name><Point><altitudeMode>relativeToGround</altitudeMode><coordinates>${w.lng},${w.lat},${w.altM}</coordinates></Point></Placemark>`).join("\n")}
</Document></kml>`;
  return new Response(kml, { headers: { "content-type": "application/vnd.google-earth.kml+xml", "content-disposition": `attachment; filename="${m.code}.kml"` } });
});
