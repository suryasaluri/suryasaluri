import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { FEATURE_DEFAULT_MAX_TOKENS, MIN_ORG_CAP_TOKENS, getOrgAiSettings, setOrgAiSettings, type AiFeature } from "../ai/maxTokensCap";

type AiUsageRow = {
  feature: AiFeature;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
};

type AiUsageBucket = {
  totalTokens: number;
  totalCostUsd: number;
  requestCount: number;
  byFeature: { feature: string; requestCount: number; totalTokens: number; costUsd: number }[];
  recent: { feature: string; model: string; inputTokens: number; outputTokens: number; costUsd: number; createdAt: string }[];
};

function bucketFromRows(rows: AiUsageRow[]): AiUsageBucket {
  const byFeature = new Map<string, { requestCount: number; totalTokens: number; costUsd: number }>();
  let totalTokens = 0;
  let totalCostUsd = 0;
  for (const r of rows) {
    const tokens = r.input_tokens + r.output_tokens + r.cache_creation_input_tokens + r.cache_read_input_tokens;
    totalTokens += tokens;
    totalCostUsd += Number(r.estimated_cost_usd) || 0;
    const bucket = byFeature.get(r.feature) ?? { requestCount: 0, totalTokens: 0, costUsd: 0 };
    bucket.requestCount += 1;
    bucket.totalTokens += tokens;
    bucket.costUsd += Number(r.estimated_cost_usd) || 0;
    byFeature.set(r.feature, bucket);
  }

  return {
    totalTokens,
    totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
    requestCount: rows.length,
    byFeature: Array.from(byFeature.entries())
      .map(([feature, b]) => ({ feature, requestCount: b.requestCount, totalTokens: b.totalTokens, costUsd: Math.round(b.costUsd * 1_000_000) / 1_000_000 }))
      .sort((a, b) => b.costUsd - a.costUsd),
    recent: rows
      .slice(0, 15)
      .map((r) => ({ feature: r.feature, model: r.model, inputTokens: r.input_tokens, outputTokens: r.output_tokens, costUsd: Number(r.estimated_cost_usd) || 0, createdAt: r.created_at })),
  };
}

async function loadRows(orgId: string, sessionId?: string): Promise<AiUsageRow[]> {
  let query = supabaseAdmin()
    .from("ai_usage_events")
    .select("feature, model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, estimated_cost_usd, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (sessionId) query = query.eq("session_id", sessionId);
  const { data } = await query;
  return (data ?? []) as AiUsageRow[];
}

const settingsSchema = z.object({ maxOutputTokens: z.number().int().positive().nullable() });

/**
 * Shows users what their AI-powered features (domain classification,
 * glossary, functional documentation, copilot, NL report parsing) actually
 * cost — token counts + an estimated USD cost, split total-vs-session like
 * the existing action-count /usage report — and lets an org cap the
 * max_tokens sent on every future AI request. A cap only ever tightens a
 * feature's own tuned default; see ai/maxTokensCap.ts.
 */
export function registerAiUsageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/ai-usage", async (request) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const [totalRows, sessionRows, settings] = await Promise.all([loadRows(orgId), loadRows(orgId, sessionId), getOrgAiSettings(orgId)]);
    return {
      total: bucketFromRows(totalRows),
      session: bucketFromRows(sessionRows),
      sessionId: sessionId ?? null,
      settings,
      featureDefaults: FEATURE_DEFAULT_MAX_TOKENS,
      minCapTokens: MIN_ORG_CAP_TOKENS,
    };
  });

  app.put<{ Body: unknown }>("/ai-usage/settings", async (request, reply) => {
    const { orgId } = request as AuthedRequest;
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }
    try {
      const settings = await setOrgAiSettings(orgId, parsed.data.maxOutputTokens);
      return settings;
    } catch (err) {
      reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid setting" });
    }
  });
}
