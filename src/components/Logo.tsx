import Link from "next/link";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFB020" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <path d="M16 3 L29 26 H3 Z" fill="none" stroke="url(#lg)" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M16 11 L22 22 H10 Z" fill="url(#lg)" opacity="0.9" />
      <circle cx="16" cy="3.5" r="2" fill="#22D3EE" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight" aria-label="AeroSight AI home">
      <LogoMark />
      <span className="font-[family-name:var(--font-display)] text-[17px]">
        AeroSight <span className="text-accent">AI</span>
      </span>
    </Link>
  );
}
