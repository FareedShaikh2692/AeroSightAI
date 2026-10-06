// Claude client wrapper (ADR-010). Enabled only when ANTHROPIC_API_KEY is set; otherwise AI features run
// in a clearly labelled heuristic mode. Credits are metered per organization (AI-014).
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../store";
import type { UUID } from "../types";

export const AI_MODEL = process.env.AI_MODEL ?? "claude-opus-5-5";
export const isClaudeConfigured = () => !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
export function claude(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 2 });
  return client;
}

/** 1 credit per 1,000 tokens (input + output), minimum 1 (docs/09-AI §7). */
export function creditsFor(usage: { input_tokens: number; output_tokens: number }) {
  return Math.max(1, Math.ceil((usage.input_tokens + usage.output_tokens) / 1000));
}

export class AiUnavailableError extends Error {}

export function assertAiAllowed(orgId: UUID, estimate = 5) {
  const org = db().organizations.find((o) => o.id === orgId)!;
  if (!org.settings.aiEnabled) throw new AiUnavailableError("AI features are turned off for your organization (Settings → Organization).");
  if (org.aiCreditsUsed + estimate > org.aiCreditsLimit) throw new AiUnavailableError("Your organization has used its AI credits for this period.");
}

export function chargeCredits(orgId: UUID, credits: number) {
  const org = db().organizations.find((o) => o.id === orgId)!;
  org.aiCreditsUsed += credits;
}

/** Shared request options: refusal fallback opted in (server-side, "default" routing). */
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as const;

export interface JsonCallResult<T> { data: T; model: string; credits: number }

/** One structured-output call: the response is constrained to `schema` (output_config.format). */
export async function jsonCall<T>(opts: { system: string; user: string; schema: Record<string, unknown>; effort?: "low" | "medium" | "high"; maxTokens?: number }): Promise<JsonCallResult<T>> {
  const res = await claude().beta.messages.create({
    ...FALLBACK,
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: { effort: opts.effort ?? "medium", format: { type: "json_schema", schema: opts.schema } },
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
  if (res.stop_reason === "refusal") throw new AiUnavailableError("The model declined this request.");
  if (res.stop_reason === "max_tokens") throw new AiUnavailableError("The model response was cut off. Try a smaller scope.");
  const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
  return { data: JSON.parse(text) as T, model: res.model, credits: creditsFor(res.usage) };
}

export interface ToolDef {
  name: string; description: string; input_schema: Anthropic.Tool.InputSchema;
  run: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

/** Manual agentic loop (max 8 tool rounds). Tools run server-side with the caller's permissions. */
export async function toolLoop(opts: { system: string; messages: Anthropic.Beta.BetaMessageParam[]; tools: ToolDef[]; maxRounds?: number }) {
  const messages = [...opts.messages];
  let credits = 0, model = AI_MODEL;
  const used: { name: string; input: unknown }[] = [];
  for (let round = 0; round < (opts.maxRounds ?? 8); round++) {
    const res = await claude().beta.messages.create({
      ...FALLBACK,
      model: AI_MODEL,
      max_tokens: 16000,
      system: opts.system,
      output_config: { effort: "medium" },
      tools: opts.tools.map(({ name, description, input_schema }) => ({ name, description, input_schema })),
      messages,
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
    credits += creditsFor(res.usage);
    model = res.model;
    if (res.stop_reason === "refusal") return { text: "I can't help with that request.", credits, model, used };
    if (res.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: res.content }); continue; }
    const toolUses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      return { text: text || "(no answer)", credits, model, used };
    }
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const tool = opts.tools.find((t) => t.name === tu.name);
      used.push({ name: tu.name, input: tu.input });
      try {
        if (!tool) throw new Error(`Unknown tool ${tu.name}`);
        const out = await tool.run((tu.input ?? {}) as Record<string, unknown>);
        // Tenant data is untrusted content: wrap it so it can't masquerade as instructions (AI-012).
        results.push({ type: "tool_result", tool_use_id: tu.id, content: `<data>${JSON.stringify(out).slice(0, 20000)}</data>` });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: (e as Error).message });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "I couldn't finish within the tool-call limit. Try a narrower question.", credits, model, used };
}
