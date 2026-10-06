import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { isClaudeConfigured, AI_MODEL } from "@/lib/ai/llm";
import { PageHeader, Badge, Forbidden } from "@/components/ui";
import { Chat } from "./Chat";
import { relTime } from "@/lib/format";

export default async function Assistant({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx, "ai:assistant")) return <Forbidden perm="ai:assistant" />;
  const { c } = await searchParams;
  const convs = db().aiConversations.filter((x) => x.organizationId === ctx.orgId && x.userId === ctx.userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const conv = convs.find((x) => x.id === c) ?? (c ? undefined : convs[0]);
  const enabled = isClaudeConfigured() && db().organizations.find((o) => o.id === ctx.orgId)!.settings.aiEnabled;
  return (
    <>
      <PageHeader eyebrow="AI" title={<span className="flex items-center gap-3">Assistant <Badge tone="info">Beta</Badge></span>}
        subtitle={enabled ? `Claude (${AI_MODEL}) with read-only tools that run with your permissions. Conversations are private to you.` : "Needs ANTHROPIC_API_KEY on the server and AI enabled for your organization."}
        actions={<Link href="/app/assistant?c=new" className="btn btn-secondary">New conversation</Link>} />
      <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
        <nav className="card h-fit p-2" aria-label="Conversations">
          {convs.length === 0 ? <p className="p-3 text-xs text-ink-3">No conversations yet.</p> : convs.map((x) => (
            <Link key={x.id} href={`/app/assistant?c=${x.id}`} className={`block rounded-lg px-3 py-2 text-sm ${x.id === conv?.id ? "bg-raised" : "hover:bg-raised"}`}>
              <div className="truncate">{x.title}</div><div className="text-[11px] text-ink-3">{relTime(x.updatedAt)}</div></Link>
          ))}
        </nav>
        <Chat key={conv?.id ?? "new"} conversationId={conv?.id} messages={(conv?.messages ?? []).map(({ role, content, at }) => ({ role, content, at }))} enabled={enabled} />
      </div>
    </>
  );
}
