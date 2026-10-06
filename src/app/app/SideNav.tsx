"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard, BarChart3, FolderKanban, MapPin, Layers, Box, Radio, CalendarClock, Drone, Images, Mountain,
  ClipboardList, TrendingUp, FileText, Users, KeyRound, Plug, CreditCard, ScrollText, Settings, Sparkles, MessageSquare, Gauge, Building2, Repeat, Blocks, Workflow, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, BarChart3, FolderKanban, MapPin, Layers, Box, Radio, CalendarClock, Drone, Images, Mountain,
  ClipboardList, TrendingUp, FileText, Users, KeyRound, Plug, CreditCard, ScrollText, Settings, Sparkles, MessageSquare, Gauge, Building2, Repeat, Blocks, Workflow,
};

export function SideNav({ nav }: { nav: { group: string; items: { href: string; label: string; icon: string }[] }[] }) {
  const path = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Application">
      {nav.map((g) => (
        <div key={g.group} className="mb-4">
          <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">{g.group}</div>
          {g.items.map((i) => {
            const Icon = ICONS[i.icon] ?? LayoutDashboard;
            const active = path === i.href || path.startsWith(i.href + "/");
            return (
              <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                className={clsx("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm", active ? "bg-accent/10 text-accent" : "text-ink-2 hover:bg-raised hover:text-ink")}>
                <Icon size={16} />{i.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
