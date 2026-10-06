import { requireStaff } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { logoutAction } from "../(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface/60 px-6">
        <div className="flex items-center gap-3"><Logo href="/admin" /><span className="rounded-full bg-bad/15 px-2 py-0.5 text-[11px] font-semibold text-bad">PLATFORM ADMIN</span></div>
        <form action={logoutAction}><button className="btn btn-ghost">Sign out</button></form>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
