import Link from "next/link";
import type { Media } from "@/lib/types";

export function MediaThumb({ media, href }: { media: Media; href?: string }) {
  return (
    <Link href={href ?? `/app/media?view=${media.id}`} className="group relative block overflow-hidden rounded-lg border border-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/v1/media/${media.id}/render`} alt={`${media.filename}, captured ${media.capturedAt.slice(0, 10)}`} loading="lazy" className="aspect-[3/2] w-full object-cover transition group-hover:scale-105" />
      {media.type === "video" && <span className="absolute left-1.5 top-1.5 rounded bg-canvas/80 px-1.5 text-[10px]">VIDEO</span>}
      {media.sharedWithViewers && <span className="absolute right-1.5 top-1.5 rounded bg-ok/80 px-1.5 text-[10px] text-canvas">shared</span>}
    </Link>
  );
}
