import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";
import { demoLoginAction } from "../actions";
import { DEMO_PASSWORD } from "@/lib/seed";
import { ROLE_LABELS } from "@/lib/permissions";
import { db } from "@/lib/store";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; staff?: string; mfa?: string }> }) {
  const { next, mfa } = await searchParams;
  const data = db();
  const personas = data.organizations.filter((o) => o.slug === "atlas" || o.slug === "borealis").map((o) => ({
    org: o,
    users: data.memberships.filter((m) => m.organizationId === o.id).map((m) => ({ role: m.role, email: data.users.find((u) => u.id === m.userId)!.email })),
  }));
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo />
          <h1 className="mt-10 text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-ink-2">New here? <Link href="/signup" className="text-accent hover:underline">Start a free trial</Link></p>
          <LoginForm next={next ?? ""} notice={mfa ? "This account has two-factor authentication enabled. Sign in with the password and your authenticator code." : undefined} />
        </div>
      </div>
      <aside className="border-l border-line bg-surface/60 px-6 py-12 sm:px-12">
        <div className="mx-auto max-w-xl">
          <h2 className="text-lg font-semibold">Demo accounts</h2>
          <p className="mt-1 text-sm text-ink-2">
            Two separate demo organizations with one user per role. Each sees only its own organization&apos;s data and only what its role allows.
            Password for every demo account: <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs text-accent">{DEMO_PASSWORD}</code>
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {personas.map(({ org, users }) => (
              <div key={org.id}>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: org.brandColor }} />{org.name}</div>
                <div className="space-y-1">
                  {users.map((u) => (
                    <form key={u.email} action={demoLoginAction}>
                      <input type="hidden" name="email" value={u.email} />
                      <button className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-accent hover:bg-raised">
                        <span>{ROLE_LABELS[u.role]}</span><span className="truncate pl-2 font-mono text-[11px] text-ink-3">{u.email.split("@")[0]}</span>
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <form action={demoLoginAction} className="mt-6">
            <input type="hidden" name="email" value="platform-admin@aerosight.demo" />
            <button className="btn btn-secondary w-full justify-center">Platform admin console</button>
          </form>
          <p className="mt-6 text-xs text-ink-3">Demo environment: data lives in memory and resets when the server restarts. Telemetry is simulated.</p>
        </div>
      </aside>
    </div>
  );
}
