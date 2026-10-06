import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { currentOrg, currentUser, listNotifications, listMissions } from "@/lib/repo";
import { ROLE_LABELS, roleHas, type Permission } from "@/lib/permissions";
import { LogoMark } from "@/components/Logo";
import { logoutAction } from "../(auth)/actions";
import { SideNav } from "./SideNav";
import { Bell, LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

const NAV: { group: string; items: { href: string; label: string; icon: string; perm?: Permission }[] }[] = [
  { group: "Overview", items: [{ href: "/app/dashboard", label: "Dashboard", icon: "LayoutDashboard" }, { href: "/app/analytics", label: "Analytics", icon: "BarChart3", perm: "analytics:read" }] },
  { group: "Work", items: [
    { href: "/app/projects", label: "Projects", icon: "FolderKanban" }, { href: "/app/sites", label: "Sites", icon: "MapPin" },
    { href: "/app/maps", label: "Maps", icon: "Layers", perm: "map:read" }, { href: "/app/twin", label: "3D Twin", icon: "Box", perm: "twin:read" }] },
  { group: "Operations", items: [
    { href: "/app/live", label: "Live Operations", icon: "Radio", perm: "telemetry:read" }, { href: "/app/missions", label: "Missions", icon: "CalendarClock", perm: "mission:read" },
    { href: "/app/fleet", label: "Drone Fleet", icon: "Drone", perm: "drone:read" }] },
  { group: "Data", items: [
    { href: "/app/media", label: "Media", icon: "Images", perm: "media:read" }, { href: "/app/surveys", label: "Surveys", icon: "Mountain", perm: "map:read" },
    { href: "/app/inspections", label: "Inspections", icon: "ClipboardList", perm: "inspection:read" }, { href: "/app/progress", label: "Progress", icon: "TrendingUp", perm: "progress:read" },
    { href: "/app/reports", label: "Reports", icon: "FileText", perm: "report:read" }] },
  { group: "Organization", items: [
    { href: "/app/team", label: "Team", icon: "Users", perm: "org:read" }, { href: "/app/roles", label: "Roles", icon: "KeyRound", perm: "org:read" },
    { href: "/app/integrations", label: "Integrations", icon: "Plug", perm: "integration:manage" }, { href: "/app/billing", label: "Billing", icon: "CreditCard", perm: "billing:manage" },
    { href: "/app/audit", label: "Audit Logs", icon: "ScrollText", perm: "audit:read" }, { href: "/app/settings", label: "Settings", icon: "Settings" }] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const org = currentOrg(ctx);
  const user = currentUser(ctx);
  const unread = listNotifications(ctx).filter((n) => !n.readAt).length;
  const live = roleHas(ctx.role, "mission:read") ? listMissions(ctx).filter((m) => m.status === "in_progress").length : 0;
  const nav = NAV.map((g) => ({ group: g.group, items: g.items.filter((i) => !i.perm || roleHas(ctx.role, i.perm)) })).filter((g) => g.items.length);

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface/50 md:flex">
        <Link href="/app/dashboard" className="flex h-14 items-center gap-2 border-b border-line px-4">
          <LogoMark size={24} /><span className="font-[family-name:var(--font-display)] font-semibold">AeroSight <span className="text-accent">AI</span></span>
        </Link>
        <SideNav nav={nav} />
        <div className="border-t border-line p-3 text-[11px] leading-snug text-ink-3">Demo environment · seeded data resets on restart · telemetry simulated</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: org.brandColor }} aria-hidden="true" />
            <span className="truncate text-sm font-semibold">{org.name}</span>
            <span className="hidden rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-ink-2 sm:inline">{org.plan}</span>
          </div>
          <div className="flex items-center gap-2">
            {live > 0 && (
              <Link href="/app/live" className="hidden items-center gap-2 rounded-full border border-ok/30 bg-ok/10 px-3 py-1 text-xs text-ok sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" /> {live} live
              </Link>
            )}
            <Link href="/app/notifications" className="btn btn-ghost relative px-2" aria-label={`Notifications (${unread} unread)`}>
              <Bell size={18} />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white">{unread}</span>}
            </Link>
            <div className="hidden text-right sm:block">
              <div className="text-sm leading-tight">{user.fullName}</div>
              <div className="text-[11px] text-ink-3">{ROLE_LABELS[ctx.role]}</div>
            </div>
            <form action={logoutAction}><button className="btn btn-ghost px-2" aria-label="Sign out" title="Sign out"><LogOut size={18} /></button></form>
          </div>
        </header>
        <nav className="no-print flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden" aria-label="Mobile">
          {nav.flatMap((g) => g.items).map((i) => <Link key={i.href} href={i.href} className="whitespace-nowrap rounded-md px-2.5 py-1 text-xs text-ink-2 hover:bg-raised">{i.label}</Link>)}
        </nav>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
