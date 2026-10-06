import Link from "next/link";
import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { PageHeader, StatusBadge, Empty } from "@/components/ui";
import { markAllReadAction } from "../actions";
import { relTime } from "@/lib/format";

export default async function Notifications() {
  const ctx = await requireContext();
  const items = repo.listNotifications(ctx);
  return (
    <>
      <PageHeader eyebrow="Inbox" title="Notifications" actions={<form action={markAllReadAction}><button className="btn btn-secondary">Mark all read</button></form>} />
      {items.length === 0 ? <Empty title="You're all caught up" /> : (
        <ul className="card divide-y divide-line">
          {items.map((n) => (
            <li key={n.id} className={`flex items-start gap-4 px-5 py-4 ${n.readAt ? "opacity-60" : ""}`}>
              <StatusBadge status={n.severity === "critical" ? "critical" : n.severity === "warning" ? "medium" : "low"} />
              <div className="min-w-0 flex-1"><div className="text-sm font-medium">{n.href ? <Link href={n.href} className="hover:text-accent">{n.title}</Link> : n.title}</div><div className="text-sm text-ink-2">{n.body}</div></div>
              <span className="shrink-0 text-xs text-ink-3">{relTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
