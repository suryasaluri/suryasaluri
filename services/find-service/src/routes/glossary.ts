import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { loadLatestSchema, getLastCrawledAt, isStale } from "../schema/loadLatest";
import { generateGlossary } from "../docs/glossary";
import { getOrgAiSettings, resolveMaxTokens } from "../ai/maxTokensCap";
import { recordAiUsage } from "../ai/usage";

export function registerGlossaryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  async function buildAndStore(orgId: string, dataSourceId: string, sessionId?: string) {
    const { schema, statusFields } = await loadLatestSchema(orgId, dataSourceId);
    const orgAiSettings = await getOrgAiSettings(orgId);
    const { maxTokens, capApplied } = resolveMaxTokens("glossary", orgAiSettings);
    const result = await generateGlossary(schema, statusFields, maxTokens);
    if (!result) return null;
    const { glossary, message } = result;

    await recordAiUsage({ orgId, sessionId, dataSourceId, feature: "glossary", message, maxTokensRequested: maxTokens, capApplied });

    const { data, error } = await supabaseAdmin()
      .from("glossary_snapshots")
      .insert({
        org_id: orgId,
        data_source_id: dataSourceId,
        terms: glossary.terms,
        synonym_groups: glossary.synonymGroups,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    await supabaseAdmin().from("audit_logs").insert({
      org_id: orgId,
      session_id: sessionId ?? null,
      action: "glossary.generated",
      resource_type: "data_source",
      resource_id: dataSourceId,
      details: { termCount: glossary.terms.length, synonymGroupCount: glossary.synonymGroups.length },
    });
    return data;
  }

  app.get<{ Params: { id: string } }>("/connections/:id/glossary", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const { id } = request.params;
    const { data } = await supabaseAdmin()
      .from("glossary_snapshots")
      .select("*")
      .eq("org_id", orgId)
      .eq("data_source_id", id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const lastCrawledAt = await getLastCrawledAt(orgId, id);
      return { ...data, stale: isStale(data.generated_at, lastCrawledAt) };
    }

    const built = await buildAndStore(orgId, id, sessionId);
    if (!built) {
      reply.code(200);
      return { unavailable: true, reason: "ANTHROPIC_API_KEY not configured, or no crawled schema yet" };
    }
    return { ...built, stale: false };
  });

  app.post<{ Params: { id: string } }>("/connections/:id/glossary/regenerate", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const built = await buildAndStore(orgId, request.params.id, sessionId);
    if (!built) {
      reply.code(200);
      return { unavailable: true, reason: "ANTHROPIC_API_KEY not configured, or no crawled schema yet" };
    }
    return { ...built, stale: false };
  });
}
