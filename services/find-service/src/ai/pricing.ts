/**
 * Anthropic first-party API pricing, $ per million tokens — used only to
 * estimate spend for the usage report shown to users, never to gate a
 * request (the per-request cap in maxTokensCap.ts does that by bounding
 * max_tokens directly). Cache tokens are billed at different rates than
 * plain input tokens: writes cost more than a fresh input token, reads cost
 * far less.
 */
const MODEL_PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-sonnet-5": { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-opus-5": { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
};

// Every call site in this service currently pins claude-sonnet-5; fall back
// to it for cost estimation if that ever drifts rather than silently
// reporting $0.
const FALLBACK_PRICING = MODEL_PRICING["claude-sonnet-5"];

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
};

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const rates = MODEL_PRICING[model] ?? FALLBACK_PRICING;
  const cost =
    (usage.inputTokens / 1_000_000) * rates.input +
    (usage.outputTokens / 1_000_000) * rates.output +
    (usage.cacheCreationInputTokens / 1_000_000) * rates.cacheWrite +
    (usage.cacheReadInputTokens / 1_000_000) * rates.cacheRead;
  return Math.round(cost * 1_000_000) / 1_000_000; // 6 decimal places — sub-cent costs are common per call
}
