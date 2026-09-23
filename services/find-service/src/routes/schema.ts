import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import type { ForeignKeyDef, ColumnDef, NormalizedSchema } from "../schema/types";
import { detectUnconstrainedReferences } from "../quality/dataQuality";
import { diffTableSummaries, isDriftEmpty, type TableSummary } from "../schema/drift";

export function registerSchemaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/connections/:id/schema", async (request) => {
    const { orgId } = request as AuthedRequest;
    const { id } = request.params;

    const { data: objects, error } = await supabaseAdmin()
      .from("schema_objects")
      .select("*")
      .eq("org_id", orgId)
      .eq("data_source_id", id)
      .order("name", { ascending: true });
    if (error) throw error;

    const { data: lastCrawls } = await supabaseAdmin()
      .from("schema_crawls")
      .select("*")
      .eq("org_id", orgId)
      .eq("data_source_id", id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(2);
    const lastCrawl = lastCrawls?.[0];
    const previousCrawl = lastCrawls?.[1];

    const tables = (objects ?? []).map((r) => ({
      name: r.name as string,
      objectType: r.object_type as "TABLE" | "VIEW",
      columns: r.columns as ColumnDef[],
      primaryKey: r.primary_key as string[],
      foreignKeys: r.foreign_keys as ForeignKeyDef[],
      rowEstimate: r.row_estimate as number | null,
      sensitivityLabels: r.sensitivity_labels as string[],
    }));

    const relationships = tables.flatMap((t) =>
      (t.foreignKeys ?? []).map((fk) => ({
        fromTable: t.name,
        fromColumns: fk.columns,
        toTable: fk.refTable,
        toColumns: fk.refColumns,
        constraintName: fk.constraintName,
      })),
    );

    const normalizedSchema: NormalizedSchema = { tables, checkConstraints: [] };
    const unconstrainedReferences = detectUnconstrainedReferences(normalizedSchema);

    const drift =
      previousCrawl && lastCrawl
        ? diffTableSummaries(previousCrawl.table_summary as TableSummary[], lastCrawl.table_summary as TableSummary[])
        : null;

    return {
      tables,
      relationships,
      statusFields: lastCrawl?.status_fields ?? [],
      lastCrawledAt: lastCrawl?.completed_at ?? null,
      unconstrainedReferences,
      drift: drift && !isDriftEmpty(drift) ? drift : null,
    };
  });
}
