import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { loadLatestSchema } from "../schema/loadLatest";
import { classifyDomain } from "../domain/classifier";
import { getOrgAiSettings, resolveMaxTokens } from "../ai/maxTokensCap";
import { recordAiUsage } from "../ai/usage";

export function registerDomainRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  async function buildAndStore(orgId: string, dataSourceId: string, sessionId?: string) {
    const { schema, statusFields } = await loadLatestSchema(orgId, dataSourceId);
    const orgAiSettings = await getOrgAiSettings(orgId);
    const { maxTokens, capApplied } = resolveMaxTokens("domain_classification", orgAiSettings);
    const result = await classifyDomain(schema, statusFields, maxTokens);
    if (!result) return null;
    const { classification, message } = result;

    await recordAiUsage({ orgId, sessionId, dataSourceId, feature: "domain_classification", message, maxTokensRequested: maxTokens, capApplied });

    const { data, error } = await supabaseAdmin()
      .from("domain_classifications")
      .insert({
        org_id: orgId,
        data_source_id: dataSourceId,
        domain: classification.domain,
        confidence: classification.confidence,
        rationale: classification.rationale,
        table_domains: classification.tableDomains,
        signals: classification.signals,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    await supabaseAdmin().from("audit_logs").insert({
      org_id: orgId,
      session_id: sessionId ?? null,
      action: "domain.classified",
      resource_type: "data_source",
      resource_id: dataSourceId,
      details: { domain: classification.domain, confidence: classification.confidence },
    });
    return data;
  }

  app.get<{ Params: { id: string } }>("/connections/:id/domain", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const { id } = request.params;
    const { data } = await supabaseAdmin()
      .from("domain_classifications")
      .select("*")
      .eq("org_id", orgId)
      .eq("data_source_id", id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;

    const built = await buildAndStore(orgId, id, sessionId);
    if (!built) {
      reply.code(200);
      return { unavailable: true, reason: "ANTHROPIC_API_KEY not configured, or no crawled schema yet" };
    }
    return built;
  });

  app.post<{ Params: { id: string } }>("/connections/:id/domain/regenerate", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const built = await buildAndStore(orgId, request.params.id, sessionId);
    if (!built) {
      reply.code(200);
      return { unavailable: true, reason: "ANTHROPIC_API_KEY not configured, or no crawled schema yet" };
    }
    return built;
  });
}
