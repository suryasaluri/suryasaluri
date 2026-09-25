import { describe, test, expect } from "bun:test";
import { estimateCostUsd } from "../src/ai/pricing";
import { resolveMaxTokens, FEATURE_DEFAULT_MAX_TOKENS } from "../src/ai/maxTokensCap";

describe("estimateCostUsd", () => {
  test("computes input + output cost for a known model", () => {
    const cost = estimateCostUsd("claude-sonnet-5", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    });
    expect(cost).toBeCloseTo(2.0 + 10.0, 6);
  });

  test("includes cache write/read at their own rates", () => {
    const cost = estimateCostUsd("claude-sonnet-5", {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 1_000_000,
      cacheReadInputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(2.5 + 0.2, 6);
  });

  test("falls back to sonnet-5 pricing for an unknown model rather than reporting $0", () => {
    const known = estimateCostUsd("claude-sonnet-5", { inputTokens: 500, outputTokens: 500, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 });
    const unknown = estimateCostUsd("some-future-model", { inputTokens: 500, outputTokens: 500, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 });
    expect(unknown).toBe(known);
  });

  test("small token counts still produce a non-zero cost (sub-cent precision)", () => {
    const cost = estimateCostUsd("claude-sonnet-5", { inputTokens: 100, outputTokens: 100, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 });
    expect(cost).toBeGreaterThan(0);
  });
});

describe("resolveMaxTokens", () => {
  test("uses the feature's own default when no org cap is set", () => {
    const { maxTokens, capApplied } = resolveMaxTokens("glossary", { maxOutputTokens: null });
    expect(maxTokens).toBe(FEATURE_DEFAULT_MAX_TOKENS.glossary);
    expect(capApplied).toBeNull();
  });

  test("a cap below the feature default tightens it", () => {
    const { maxTokens, capApplied } = resolveMaxTokens("glossary", { maxOutputTokens: 500 });
    expect(maxTokens).toBe(500);
    expect(capApplied).toBe(500);
  });

  test("a cap above the feature default never raises it — the cap can only tighten", () => {
    const { maxTokens, capApplied } = resolveMaxTokens("report_nl_parse", { maxOutputTokens: 999_999 });
    expect(maxTokens).toBe(FEATURE_DEFAULT_MAX_TOKENS.report_nl_parse);
    expect(capApplied).toBe(999_999);
  });

  test("every feature has its own tuned default greater than zero", () => {
    for (const value of Object.values(FEATURE_DEFAULT_MAX_TOKENS)) {
      expect(value).toBeGreaterThan(0);
    }
  });
});
