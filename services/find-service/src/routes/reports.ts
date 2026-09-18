import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { loadLatestSchema } from "../schema/loadLatest";
import { getConnector } from "../connectors/registry";
import { suggestReports } from "../reports/suggest";
import { validateSpec, buildOracleSql, DEFAULT_MAX_ROWS } from "../reports/spec";
import { parseNaturalLanguageReport } from "../reports/nlParse";
import { cacheKey, getCached, setCached } from "../reports/cache";
import { evaluateEstimate } from "../reports/costControl";
import type { ReportSpec, ReportTemplate, ReportOutcome, AppliedFilter } from "../reports/types";

const runSchema = z.object({
  templateId: z.string().min(1),
  fields: z.record(z.string()).default({}),
  filterValues: z.record(z.string()).default({}),
});
const customSchema = z.object({ text: z.string().min(1), fields: z.record(z.string()).default({}) });

function specFromTemplate(template: ReportTemplate, filterValues: Record<string, string>): ReportSpec {
  const filters: AppliedFilter[] = [];
  for (const f of template.filters) {
    if (f.type === "categorical" && filterValues[f.name]) {
      filters.push({ column: f.column, op: "=", value: filterValues[f.name] });
    }
    if (f.type === "date_range") {
      if (filterValues[`${f.name}_since`]) filters.push({ column: f.column, op: ">=", value: filterValues[`${f.name}_since`] });
      if (filterValues[`${f.name}_until`]) filters.push({ column: f.column, op: "<=", value: filterValues[`${f.name}_until`] });
    }
  }
  return {
    baseTable: template.baseTable,
    joinTable: template.joinTable,
    groupBy: template.groupBy,
    aggregation: template.aggregation,
    aggregationColumn: template.aggregationColumn,
    filters,
    maxRows: DEFAULT_MAX_ROWS,
  };
}

export function registerReportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  async function loadConnection(orgId: string, id: string) {
    const { data } = await supabaseAdmin().from("data_sources").select("*").eq("id", id).eq("org_id", orgId).single();
    return data;
  }

  async function writeAudit(orgId: string, sessionId: string | undefined, action: string, dataSourceId: string, details: Record<string, unknown>) {
    await supabaseAdmin()
      .from("audit_logs")
      .insert({ org_id: orgId, session_id: sessionId ?? null, action, resource_type: "data_source", resource_id: dataSourceId, details });
  }

  /** Shared by /reports/run and /reports/custom: validate -> dry-run estimate -> cache check -> execute or block. */
  async function executeSpec(
    orgId: string,
    sessionId: string | undefined,
    dataSourceId: string,
    connectorId: string,
    fields: Record<string, string>,
    spec: ReportSpec,
    input: string | undefined,
    auditAction: string,
  ): Promise<ReportOutcome> {
    const { schema } = await loadLatestSchema(orgId, dataSourceId);
    const errors = validateSpec(spec, schema);
    if (errors.length) return { status: "validation_error", input, errors };

    const { sql, binds } = buildOracleSql(spec, schema, spec.maxRows || DEFAULT_MAX_ROWS);
    const connector = getConnector(connectorId);
    if (!connector?.estimateQueryCost || !connector.runQuery) {
      return { status: "validation_error", input, errors: [{ field: "connector", reason: "This connector does not support running reports.", suggestions: [] }] };
    }

    const key = cacheKey(orgId, dataSourceId, sql, binds);
    const cached = getCached(key);
    if (cached) {
      await writeAudit(orgId, sessionId, auditAction, dataSourceId, { cached: true, sql });
      return { status: "success", input, sql, binds, estimate: cached.estimate, cached: true, rows: cached.rows, latencyMs: 0 };
    }

    const rawEstimate = await connector.estimateQueryCost(fields, sql);
    const estimate = evaluateEstimate(rawEstimate);
    if (estimate.blocked) {
      await writeAudit(orgId, sessionId, "report.blocked", dataSourceId, { sql, estimate });
      return { status: "blocked", input, sql, binds, estimate };
    }

    const startedAt = Date.now();
    const rows = await connector.runQuery(fields, sql, binds);
    const latencyMs = Date.now() - startedAt;
    setCached(key, rows, estimate);
    await writeAudit(orgId, sessionId, auditAction, dataSourceId, { cached: false, sql, estimate, rowCount: rows.length });
    return { status: "success", input, sql, binds, estimate, cached: false, rows, latencyMs };
  }

  app.get<{ Params: { id: string } }>("/connections/:id/reports/suggestions", async (request, reply) => {
    const { orgId } = request as AuthedRequest;
    const { id } = request.params;
    const { schema, statusFields } = await loadLatestSchema(orgId, id);

    const { data: domainRow } = await supabaseAdmin()
      .from("domain_classifications")
      .select("table_domains")
      .eq("org_id", orgId)
      .eq("data_source_id", id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const tableDomains = (domainRow?.table_domains as Record<string, string> | undefined) ?? undefined;
    reply.send(suggestReports(schema, statusFields, tableDomains));
  });

  app.post<{ Params: { id: string }; Body: unknown }>("/connections/:id/reports/run", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const { id } = request.params;
    const parsed = runSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }
    const src = await loadConnection(orgId, id);
    if (!src) {
      reply.code(404).send({ error: "Connection not found" });
      return;
    }

    const { schema, statusFields } = await loadLatestSchema(orgId, id);
    const templates = suggestReports(schema, statusFields);
    const template = templates.find((t) => t.id === parsed.data.templateId);
    if (!template) {
      reply.code(404).send({ error: "Unknown or stale report template id — re-fetch /reports/suggestions" });
      return;
    }

    const spec = specFromTemplate(template, parsed.data.filterValues);
    const outcome = await executeSpec(orgId, sessionId, id, src.connector_id, parsed.data.fields, spec, template.name, "report.suggested_run");
    return outcome;
  });

  app.post<{ Params: { id: string }; Body: unknown }>("/connections/:id/reports/custom", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const { id } = request.params;
    const parsed = customSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }
    const src = await loadConnection(orgId, id);
    if (!src) {
      reply.code(404).send({ error: "Connection not found" });
      return;
    }

    const { schema } = await loadLatestSchema(orgId, id);
    const draft = await parseNaturalLanguageReport(parsed.data.text, schema);
    if (!draft) {
      const outcome: ReportOutcome = {
        status: "validation_error",
        input: parsed.data.text,
        errors: [{ field: "request", reason: "AI parsing is not configured (ANTHROPIC_API_KEY missing) or could not draft a spec from this request.", suggestions: [] }],
      };
      return outcome;
    }

    const spec: ReportSpec = { ...draft, maxRows: DEFAULT_MAX_ROWS };
    const outcome = await executeSpec(orgId, sessionId, id, src.connector_id, parsed.data.fields, spec, parsed.data.text, "report.custom_run");
    return outcome;
  });
}
