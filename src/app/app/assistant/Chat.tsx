"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { askAction, type AiState } from "../ai/actions";
import { FormError } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string; at: string };

function render(text: string) {
  // Minimal, safe rendering: internal markdown links become <Link>, everything else is plain text.
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[([^\]]+)\]\((\/app\/[^)\s]+)\)/g)) {
    parts.push(text.slice(last, m.index));
    parts.push(<Link key={m.index} href={m[2]} className="text-accent underline">{m[1]}</Link>);
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

export function Chat({ conversationId, messages, enabled }: { conversationId?: string; messages: Msg[]; enabled: boolean }) {
  const [s, a, p] = useActionState<AiState, FormData>(askAction, { conversationId });
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, p]);
  return (
    <div className="card flex h-[70vh] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && <p className="text-sm text-ink-2">Ask about your projects, e.g. “Which open findings are critical or overdue?” or “How far behind plan is Al Khail?”</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-auto max-w-[80%] rounded-xl bg-accent/15 px-4 py-2 text-sm" : "max-w-[85%] whitespace-pre-wrap rounded-xl bg-raised px-4 py-3 text-sm leading-relaxed"}>
            {m.role === "assistant" ? render(m.content) : m.content}
          </div>
        ))}
        {p && <div className="max-w-[85%] animate-pulse rounded-xl bg-raised px-4 py-3 text-sm text-ink-3">Looking through your data…</div>}
        <div ref={end} />
      </div>
      <form action={a} className="border-t border-line p-3">
        <FormError error={s.error} />
        <input type="hidden" name="conversationId" value={s.conversationId ?? conversationId ?? ""} />
        <div className="flex gap-2">
          <input name="question" className="input" placeholder={enabled ? "Ask about projects, missions, progress or findings…" : "Assistant unavailable — ANTHROPIC_API_KEY not configured"} disabled={!enabled || p} maxLength={2000} required autoComplete="off" />
          <button className="btn btn-primary" disabled={!enabled || p}>Ask</button>
        </div>
        <p className="mt-1 text-[11px] text-ink-3">Answers only use data you can access. AI-assisted — verify important answers.</p>
      </form>
    </div>
  );
}
