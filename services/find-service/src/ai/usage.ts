import type Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../supabaseAdmin";
import { estimateCostUsd } from "./pricing";
import type { AiFeature } from "./maxTokensCap";

// The pinned SDK version's Usage type only declares input_tokens/output_tokens;
// the API has returned cache token counts on every response for a long time.
// None of these five call sites use cache_control, so these are simply 0 in
// practice today — reading them now means usage is captured correctly the
// moment caching is added, without another migration.
type UsageWithCache = Anthropic.Usage & { cache_creation_input_tokens?: number; cache_read_input_tokens?: number };

/**
 * Records one Claude call's token usage/cost so it can be shown back to
 * users (the AI resource-usage report) — mirrors the existing audit_logs
 * pattern (org_id/session_id/data_source_id) but token-level, not
 * action-level. Deliberately never throws: a usage-tracking failure must
 * never break the feature that just successfully answered the user.
 */
export async function recordAiUsage(params: {
  orgId: string;
  sessionId?: string | null;
  dataSourceId?: string | null;
  feature: AiFeature;
  message: Pick<Anthropic.Message, "model" | "usage">;
  maxTokensRequested: number;
  capApplied: number | null;
}): Promise<void> {
  try {
    const usage = params.message.usage as UsageWithCache;
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const cacheCreationInputTokens = usage.cache_creation_input_tokens ?? 0;
    const cacheReadInputTokens = usage.cache_read_input_tokens ?? 0;
    const costUsd = estimateCostUsd(params.message.model, {
      inputTokens,
      outputTokens,
      cacheCreationInputTokens,
      cacheReadInputTokens,
    });

    await supabaseAdmin().from("ai_usage_events").insert({
      org_id: params.orgId,
      data_source_id: params.dataSourceId ?? null,
      session_id: params.sessionId ?? null,
      feature: params.feature,
      model: params.message.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreationInputTokens,
      cache_read_input_tokens: cacheReadInputTokens,
      estimated_cost_usd: costUsd,
      max_output_tokens_requested: params.maxTokensRequested,
      max_output_tokens_cap_applied: params.capApplied,
    });
  } catch (err) {
    console.warn("recordAiUsage failed (non-fatal):", err);
  }
}
