import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { renderTechnicalMarkdown } from "../docs/technicalDoc";
import { generateFunctionalNarrative } from "../docs/functionalDoc";
import type { NormalizedSchema, ForeignKeyDef } from "../schema/types";
import type { StatusFieldCandidate } from "../schema/statusFields";

async function loadLatestSchema(orgId: string, dataSourceId: string): Promise<{ schema: NormalizedSchema; statusFields: StatusFieldCandidate[] }> {
  const { data: objects } = await supabaseAdmin()
    .from("schema_objects")
    .select("*")
    .eq("org_id", orgId)
    .eq("data_source_id", dataSourceId)
    .order("name", { ascending: true });

  const { data: lastCrawl } = await supabaseAdmin()
    .from("schema_crawls")
    .select("*")
    .eq("org_id", orgId)
    .eq("data_source_id", dataSourceId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const schema: NormalizedSchema = {
    tables: (objects ?? []).map((r) => ({
      name: r.name as string,
      objectType: r.object_type as "TABLE" | "VIEW",
      columns: r.columns as { name: string; dataType: string; nullable: boolean }[],
      primaryKey: r.primary_key as string[],
      foreignKeys: r.foreign_keys as ForeignKeyDef[],
      rowEstimate: r.row_estimate as number | null,
    })),
    checkConstraints: [],
  };

  return { schema, statusFields: (lastCrawl?.status_fields as StatusFieldCandidate[]) ?? [] };
}

export function registerDocumentationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  async function buildAndStore(orgId: string, dataSourceId: string) {
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
      action: "documentation.generated",
      resource_type: "data_source",
      resource_id: dataSourceId,
      details: { hasFunctionalNarrative: !!functional },
    });
    return data;
  }

  app.get<{ Params: { id: string } }>("/connections/:id/documentation", async (request) => {
    const { orgId } = request as AuthedRequest;
    const { id } = request.params;
    const { data } = await supabaseAdmin()
      .from("documentation_snapshots")
      .select("*")
      .eq("org_id", orgId)
      .eq("data_source_id", id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
    return buildAndStore(orgId, id);
  });

  app.post<{ Params: { id: string } }>("/connections/:id/documentation/regenerate", async (request) => {
    const { orgId } = request as AuthedRequest;
    return buildAndStore(orgId, request.params.id);
  });
}
