"use server";
import { revalidatePath } from "next/cache";
import { requireContext, audit } from "@/lib/auth";
import { analyzeProgress, decideSuggestion, askAssistant } from "@/lib/ai/features";
import { AiUnavailableError } from "@/lib/ai/llm";
import { HttpError } from "@/lib/policy";
import { emit } from "@/lib/events";

export type AiState = { error?: string | null; ok?: string | null; conversationId?: string };
const fail = (e: unknown): AiState => { if (e instanceof HttpError || e instanceof AiUnavailableError) return { error: e.message }; throw e; };

export async function analyzeAction(_: AiState, f: FormData): Promise<AiState> {
  const ctx = await requireContext();
  try {
    const projectId = String(f.get("projectId"));
    const a = await analyzeProgress(ctx, projectId);
    await audit(ctx, "ai.analysis_requested", "ai_analysis", a.id, { projectId, changes: { engine: [null, a.engine], status: [null, a.status] } });
    if (a.status === "failed") return { error: `Analysis failed: ${a.error}` };
    emit({ key: "ai.analysis_completed", orgId: ctx.orgId, projectId, entityType: "ai_analysis", entityId: a.id, title: "AI progress analysis ready", body: `${(a.output as { proposals: number }).proposals} proposal(s) to review`, href: "/app/ai", recipients: [ctx.userId] });
  } catch (e) { return fail(e); }
  revalidatePath("/app/ai");
  return { ok: "Analysis complete. Review the proposals below." };
}

export async function decideAction(_: AiState, f: FormData): Promise<AiState> {
  const ctx = await requireContext();
  try {
    const decision = String(f.get("decision")) as "accepted" | "edited" | "rejected";
    const pct = f.get("percent") ? Number(f.get("percent")) : undefined;
    const r = decideSuggestion(ctx, String(f.get("id")), decision, { percent: pct, reason: String(f.get("reason") ?? "") });
    await audit(ctx, "ai.suggestion_decided", "ai_suggestion", r.suggestion.id, { projectId: r.suggestion.projectId, changes: { decision: ["pending", decision], percent: [r.suggestion.payload.currentPercent, r.suggestion.finalPercent ?? null] } });
  } catch (e) { return fail(e); }
  revalidatePath("/app/ai");
  revalidatePath("/app/progress");
  return { ok: "Saved." };
}

export async function askAction(_: AiState, f: FormData): Promise<AiState> {
  const ctx = await requireContext();
  try {
    const r = await askAssistant(ctx, (f.get("conversationId") as string) || null, String(f.get("question") ?? ""));
    revalidatePath("/app/assistant");
    return { conversationId: r.conversation.id };
  } catch (e) { return fail(e); }
}
