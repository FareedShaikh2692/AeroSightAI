import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  neutral: "bg-white/5 text-ink-2 ring-white/10",
  info: "bg-info/10 text-info ring-info/30",
  ok: "bg-ok/10 text-ok ring-ok/30",
  warn: "bg-warn/10 text-warn ring-warn/30",
  bad: "bg-bad/10 text-bad ring-bad/30",
  high: "bg-high/10 text-high ring-high/30",
  accent: "bg-accent/10 text-accent ring-accent/30",
  data: "bg-data/10 text-data ring-data/30",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={clsx("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-medium ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function SimulatedBadge() {
  return <span className="sim-stripes inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold text-accent ring-1 ring-inset ring-accent/40">Simulated</span>;
}

const STATUS_TONE: Record<string, Tone> = {
  draft: "neutral", planned: "info", pending_approval: "warn", approved: "accent", ready: "accent", rejected: "bad",
  in_progress: "ok", paused: "warn", completed: "ok", aborted: "bad", failed: "bad", cancelled: "neutral",
  available: "ok", in_mission: "accent", maintenance: "warn", offline: "neutral", retired: "neutral",
  active: "ok", planning: "info", on_hold: "warn", archived: "neutral",
  scheduled: "info", submitted: "warn", in_review: "warn", closed: "neutral",
  open: "bad", resolved: "info", verified: "ok", wont_fix: "neutral",
  published: "ok", uploaded: "info", processing: "info", quarantined: "bad",
  on_track: "ok", at_risk: "warn", delayed: "bad", not_started: "neutral",
  pending: "warn", deactivated: "neutral",
  critical: "bad", high: "high", medium: "warn", low: "info",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"} dot>{status.replace(/_/g, " ")}</Badge>;
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      <div className={clsx(pad && "p-5")}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</div>
      <div className={clsx("mt-2 font-mono text-2xl font-medium tabular", tone === "bad" && "text-bad", tone === "warn" && "text-warn", tone === "ok" && "text-ok", tone === "accent" && "text-accent")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="grid-bg flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <div className="text-sm font-semibold">{title}</div>
      {body && <p className="mt-1 max-w-md text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Sections">
      {items.map((t) => (
        <Link key={t.key} href={t.href} className={clsx("whitespace-nowrap border-b-2 px-3 py-2 text-sm", t.key === active ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Progress({ value, tone = "accent" }: { value: number; tone?: "accent" | "ok" | "warn" | "bad" | "data" }) {
  const color = { accent: "bg-accent", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", data: "bg-data" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function FormError({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>;
}

export function Forbidden({ perm }: { perm: string }) {
  return <Empty title="You don't have access to this area" body={`This page requires the ${perm} permission. Ask an organization admin if you need it.`} />;
}
