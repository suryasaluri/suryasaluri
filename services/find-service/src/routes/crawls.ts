import type { FastifyInstance } from "fastify";
import { EventEmitter } from "node:events";
import { z } from "zod";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { getConnector } from "../connectors/registry";
import { detectStatusFields } from "../schema/statusFields";
import { classifyColumnSensitivity } from "../sensitivity";
import type { NormalizedSchema } from "../schema/types";

const startSchema = z.object({ fields: z.record(z.string()).default({}) });

const crawlEmitters = new Map<string, EventEmitter>();
function emitterFor(id: string): EventEmitter {
  let e = crawlEmitters.get(id);
  if (!e) {
    e = new EventEmitter();
    crawlEmitters.set(id, e);
  }
  return e;
}

async function persistSchemaObjects(orgId: string, dataSourceId: string, schema: NormalizedSchema) {
  const rows = schema.tables.map((t) => ({
    org_id: orgId,
    data_source_id: dataSourceId,
    object_type: t.objectType,
    name: t.name,
    columns: t.columns,
    primary_key: t.primaryKey,
    foreign_keys: t.foreignKeys,
    row_estimate: t.rowEstimate,
    sensitivity_labels: Array.from(new Set(t.columns.flatMap((c) => classifyColumnSensitivity(c.name)))),
  }));
  if (!rows.length) return;
  const { error } = await supabaseAdmin().from("schema_objects").upsert(rows, { onConflict: "data_source_id,object_type,name" });
  if (error) throw error;
}

async function runCrawl(orgId: string, dataSourceId: string, crawlId: string, connectorId: string, fields: Record<string, string>, sessionId?: string) {
  const emitter = emitterFor(crawlId);
  const connector = getConnector(connectorId);
  if (!connector) {
    await supabaseAdmin()
      .from("schema_crawls")
      .update({ status: "failed", error_message: "Unknown connector", completed_at: new Date().toISOString() })
      .eq("id", crawlId);
    emitter.emit("error", { message: "Unknown connector" });
    crawlEmitters.delete(crawlId);
    return;
  }

  try {
    const schema = await connector.introspectSchema(fields, (event) => {
      if (event.type === "table_found") emitter.emit("table_found", event.table);
    });
    const statusFields = detectStatusFields(schema);
    await persistSchemaObjects(orgId, dataSourceId, schema);

    const tablesFound = schema.tables.filter((t) => t.objectType === "TABLE").length;
    const viewsFound = schema.tables.filter((t) => t.objectType === "VIEW").length;

    await supabaseAdmin()
      .from("schema_crawls")
      .update({
        status: "completed",
        tables_found: tablesFound,
        views_found: viewsFound,
        status_fields: statusFields,
        completed_at: new Date().toISOString(),
      })
      .eq("id", crawlId);

    await supabaseAdmin().from("audit_logs").insert({
      org_id: orgId,
      session_id: sessionId ?? null,
      action: "crawl.completed",
      resource_type: "schema_crawl",
      resource_id: crawlId,
      details: { tablesFound, viewsFound, statusFieldsFound: statusFields.length },
    });

    emitter.emit("completed", { tablesFound, viewsFound });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabaseAdmin()
      .from("schema_crawls")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", crawlId);
    emitter.emit("error", { message });
  } finally {
    crawlEmitters.delete(crawlId);
  }
}

export function registerCrawlRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/connections/:id/crawls", async (request) => {
    const { orgId } = request as AuthedRequest;
    const { data } = await supabaseAdmin()
      .from("schema_crawls")
      .select("*")
      .eq("org_id", orgId)
      .eq("data_source_id", request.params.id)
      .order("created_at", { ascending: false })
      .limit(10);
    return data ?? [];
  });

  app.post<{ Params: { id: string }; Body: unknown }>("/connections/:id/crawl", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const { id } = request.params;
    const parsed = startSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }
    const { data: src } = await supabaseAdmin().from("data_sources").select("*").eq("id", id).eq("org_id", orgId).single();
    if (!src) {
      reply.code(404).send({ error: "Connection not found" });
      return;
    }

    const { data: crawlRow, error } = await supabaseAdmin()
      .from("schema_crawls")
      .insert({ org_id: orgId, data_source_id: id, status: "running" })
      .select()
      .single();
    if (error) throw error;

    runCrawl(orgId, id, crawlRow.id, src.connector_id, parsed.data.fields, sessionId).catch((e) => app.log.error(e, "crawl failed"));

    reply.code(202);
    return { id: crawlRow.id, status: "running" };
  });

  app.get<{ Params: { id: string } }>("/crawls/:id/stream", async (request, reply) => {
    const { id } = request.params;
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const emitter = emitterFor(id);
    const onFound = (table: unknown) => reply.raw.write(`event: table_found\ndata: ${JSON.stringify(table)}\n\n`);
    const onCompleted = (payload: unknown) => {
      reply.raw.write(`event: completed\ndata: ${JSON.stringify(payload)}\n\n`);
      cleanup();
    };
    const onError = (payload: unknown) => {
      reply.raw.write(`event: error\ndata: ${JSON.stringify(payload)}\n\n`);
      cleanup();
    };
    function cleanup() {
      emitter.off("table_found", onFound);
      emitter.off("completed", onCompleted);
      emitter.off("error", onError);
      reply.raw.end();
    }

    emitter.on("table_found", onFound);
    emitter.on("completed", onCompleted);
    emitter.on("error", onError);
    request.raw.on("close", cleanup);
  });
}
