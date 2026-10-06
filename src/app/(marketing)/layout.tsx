import Link from "next/link";
import { Logo } from "@/components/Logo";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/industries", label: "Industries" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-ink-2 md:flex" aria-label="Main">
            {NAV.map((n) => <Link key={n.href} href={n.href} className="hover:text-ink">{n.label}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost">Sign in</Link>
            <Link href="/signup" className="btn btn-primary">Start free trial</Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-24 border-t border-line">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 text-sm text-ink-2 sm:px-6 md:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p>See Every Site. Track Every Progress. Build Smarter.</p>
          </div>
          <div className="space-y-2"><div className="font-semibold text-ink">Product</div>{NAV.slice(0, 3).map((n) => <Link key={n.href} href={n.href} className="block hover:text-ink">{n.label}</Link>)}</div>
          <div className="space-y-2"><div className="font-semibold text-ink">Company</div>{NAV.slice(3).map((n) => <Link key={n.href} href={n.href} className="block hover:text-ink">{n.label}</Link>)}</div>
          <div className="space-y-2 text-xs">
            <div className="font-semibold text-ink">Demo environment</div>
            <p>This deployment runs on seeded demo data that resets periodically. Telemetry is simulated. AI outputs are not engineering certifications.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
