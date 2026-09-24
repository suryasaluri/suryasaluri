import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { renderTechnicalMarkdown } from "../docs/technicalDoc";
import { generateFunctionalNarrative } from "../docs/functionalDoc";
import { loadLatestSchema, getLastCrawledAt, isStale } from "../schema/loadLatest";

export function registerDocumentationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  async function buildAndStore(orgId: string, dataSourceId: string, sessionId?: string) {
    const { schema, statusFields } = await loadLatestSchema(orgId, dataSourceId);
    const technical = renderTechnicalMarkdown(schema, statusFields);
    const functional = await generateFunctionalNarrative(schema, statusFields);

    const { data, error } = await supabaseAdmin()
      .from("documentation_snapshots")
      .insert({
        org_id: orgId,
        data_source_id: dataSourceId,
        technical_markdown: technical,
        functional_markdown: functional,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    await supabaseAdmin().from("audit_logs").insert({
      org_id: orgId,
      session_id: sessionId ?? null,
      action: "documentation.generated",
      resource_type: "data_source",
      resource_id: dataSourceId,
      details: { hasFunctionalNarrative: !!functional },
    });
    return data;
  }

  app.get<{ Params: { id: string } }>("/connections/:id/documentation", async (request) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const { id } = request.params;
    const { data } = await supabaseAdmin()
      .from("documentation_snapshots")
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
    return { ...built, stale: false };
  });

  app.post<{ Params: { id: string } }>("/connections/:id/documentation/regenerate", async (request) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const built = await buildAndStore(orgId, request.params.id, sessionId);
    return { ...built, stale: false };
  });
}
