// Renders a deterministic synthetic "aerial" preview for seeded demo media (no real imagery is stored in the demo).
import { getContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { prng } from "@/lib/ids";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx || ctx.isPlatformStaff) return new Response("Unauthorized", { status: 401 });
  const m = repo.getMedia(ctx, id); // tenant, project and viewer-sharing rules applied
  if (!m) return new Response("Not found", { status: 404 });
  const r = prng(m.seed);
  const W = 640, H = 427;
  const ground = ["#6b5d48", "#7a6a50", "#5d6b4f", "#8a7a62"][Math.floor(r() * 4)];
  const shapes: string[] = [];
  for (let i = 0; i < 14; i++) {
    const x = r() * W, y = r() * H, w = 30 + r() * 140, h = 20 + r() * 110, rot = (r() - 0.5) * 30;
    const fill = ["#9aa3ab", "#b8bec4", "#6f7780", "#c9a227", "#4a5560", "#d6d0c4"][Math.floor(r() * 6)];
    shapes.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${fill}" opacity="${(0.55 + r() * 0.4).toFixed(2)}" transform="rotate(${rot.toFixed(1)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`);
  }
  for (let i = 0; i < 4; i++) shapes.push(`<path d="M${(r() * W).toFixed(0)} 0 Q ${(r() * W).toFixed(0)} ${H / 2} ${(r() * W).toFixed(0)} ${H}" stroke="#3a3a3a" stroke-width="${(8 + r() * 10).toFixed(0)}" fill="none" opacity=".7"/>`);
  for (let i = 0; i < 8; i++) shapes.push(`<line x1="${(r() * W).toFixed(0)}" y1="${(r() * H).toFixed(0)}" x2="${(r() * W).toFixed(0)}" y2="${(r() * H).toFixed(0)}" stroke="#d9d4c7" stroke-width="1" opacity=".5"/>`);
  const isVideo = m.type === "video";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${(0.6 + r() * 0.5).toFixed(2)}" numOctaves="2" seed="${m.seed % 1000}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .35 0"/></filter></defs>
<rect width="100%" height="100%" fill="${ground}"/>${shapes.join("")}<rect width="100%" height="100%" filter="url(#n)"/>
${isVideo ? `<circle cx="${W / 2}" cy="${H / 2}" r="34" fill="rgba(10,15,20,.65)"/><path d="M${W / 2 - 10} ${H / 2 - 16} L${W / 2 + 18} ${H / 2} L${W / 2 - 10} ${H / 2 + 16} Z" fill="#fff"/>` : ""}
<rect x="0" y="${H - 26}" width="${W}" height="26" fill="rgba(10,15,20,.6)"/><text x="10" y="${H - 9}" font-family="monospace" font-size="12" fill="#e8eef4">${m.filename} · ${m.altitudeM} m AGL · ${m.location[1].toFixed(5)}, ${m.location[0].toFixed(5)}</text>
<text x="${W - 10}" y="${H - 9}" text-anchor="end" font-family="monospace" font-size="11" fill="#ffb020">DEMO RENDER</text></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "private, max-age=3600", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
}
