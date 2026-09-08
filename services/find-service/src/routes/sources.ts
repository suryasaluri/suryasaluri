import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { getConnector } from "../connectors/registry";
import { mockSchemaPreview } from "../schemaPreview";
import { classifySensitivity } from "../sensitivity";

const createSourceSchema = z.object({
  name: z.string().optional(),
  connectorId: z.string().min(1),
  fields: z.record(z.string()).default({}),
});

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(["connect", "delete"]),
});

const LIFECYCLE_ACTIONS = ["connect", "authenticate", "firewall-request", "disconnect"] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskCredential(fields: Record<string, string>): string | null {
  const secretKey = Object.keys(fields).find((k) => k === "password" || k === "client_secret");
  if (!secretKey) return null;
  const value = fields[secretKey] ?? "";
  const tail = value.slice(-4).padStart(4, "•");
  return `•••${tail}`;
}

async function writeAudit(orgId: string, action: string, resourceType: string, resourceId: string | null, details: Record<string, unknown>) {
  await supabaseAdmin().from("audit_logs").insert({ org_id: orgId, action, resource_type: resourceType, resource_id: resourceId, details });
}

export function registerSourceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/sources", async (request) => {
    const { orgId } = request as AuthedRequest;
    const { data, error } = await supabaseAdmin()
      .from("data_sources")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

  app.post<{ Body: unknown }>("/sources", async (request, reply) => {
    const { orgId } = request as AuthedRequest;
    const parsed = createSourceSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }
    const { name, connectorId, fields } = parsed.data;
    const connector = getConnector(connectorId);
    if (!connector) {
      reply.code(400).send({ error: `Unknown connector id: ${connectorId}` });
      return;
    }

    const result = await connector.testConnection(fields);
    const status = result.ok ? "open" : /auth/i.test(result.message) ? "auth_required" : "blocked";
    const sourceName = name?.trim() || `${connector.meta.label} source`;

    const { data, error } = await supabaseAdmin()
      .from("data_sources")
      .insert({
        org_id: orgId,
        name: sourceName,
        service_type: connector.meta.label,
        connector_id: connector.meta.id,
        integration_mode: connector.meta.integration,
        host: fields.host || null,
        port: fields.port ? Number(fields.port) : connector.meta.defaultPort ?? null,
        connector_type: connector.meta.connectorType,
        status,
        category: connector.meta.category,
        table_count: 0,
        row_count: 0,
        difficulty_score: 1,
        sensitivity_labels: classifySensitivity(sourceName, connector.meta.label, connector.meta.category),
        tags: [],
        credential_label: maskCredential(fields),
        schema_metadata: result.meta ?? {},
      })
      .select()
      .single();
    if (error) throw error;

    await writeAudit(orgId, "source.added", "data_source", data.id, {
      connector: connectorId,
      status,
      integration: connector.meta.integration,
      test_message: result.message,
    });
    reply.code(201);
    return data;
  });

  for (const action of LIFECYCLE_ACTIONS) {
    app.post<{ Params: { id: string } }>(`/sources/:id/${action}`, async (request, reply) => {
      const { orgId } = request as AuthedRequest;
      const { id } = request.params;
      const { data: src, error: fetchErr } = await supabaseAdmin()
        .from("data_sources")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .single();
      if (fetchErr || !src) {
        reply.code(404).send({ error: "Source not found" });
        return;
      }

      if (action === "authenticate" || action === "firewall-request") await sleep(900 + Math.random() * 500);

      const patch =
        action === "connect"
          ? { status: "connected", connected_at: new Date().toISOString() }
          : action === "authenticate"
            ? {
                status: "connected",
                connected_at: new Date().toISOString(),
                credential_label: `OAuth token •••${Math.floor(1000 + Math.random() * 9000)}`,
              }
            : action === "firewall-request"
              ? { status: "open" }
              : { status: "open", connected_at: null };

      const { data, error } = await supabaseAdmin().from("data_sources").update(patch).eq("id", id).select().single();
      if (error) throw error;

      await writeAudit(orgId, `source.${action.replace("-", "_")}`, "data_source", id, { name: src.name });
      return data;
    });
  }

  app.delete<{ Params: { id: string } }>("/sources/:id", async (request, reply) => {
    const { orgId } = request as AuthedRequest;
    const { id } = request.params;
    const { data: src } = await supabaseAdmin().from("data_sources").select("name").eq("id", id).eq("org_id", orgId).single();
    const { error } = await supabaseAdmin().from("data_sources").delete().eq("id", id).eq("org_id", orgId);
    if (error) throw error;
    await writeAudit(orgId, "source.deleted", "data_source", id, { name: src?.name });
    reply.code(204);
  });

  app.post<{ Body: unknown }>("/sources/bulk", async (request, reply) => {
    const { orgId } = request as AuthedRequest;
    const parsed = bulkSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }
    const { ids, action } = parsed.data;
    if (action === "connect") {
      const { error } = await supabaseAdmin()
        .from("data_sources")
        .update({ status: "connected", connected_at: new Date().toISOString() })
        .in("id", ids)
        .eq("org_id", orgId);
      if (error) throw error;
      await writeAudit(orgId, "source.bulk_connect", "data_source", null, { count: ids.length });
    } else {
      const { error } = await supabaseAdmin().from("data_sources").delete().in("id", ids).eq("org_id", orgId);
      if (error) throw error;
      await writeAudit(orgId, "source.bulk_delete", "data_source", null, { count: ids.length });
    }
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/sources/:id/schema", async (request, reply) => {
    const { orgId } = request as AuthedRequest;
    const { data: src } = await supabaseAdmin()
      .from("data_sources")
      .select("id, table_count, row_count")
      .eq("id", request.params.id)
      .eq("org_id", orgId)
      .single();
    if (!src) {
      reply.code(404).send({ error: "Source not found" });
      return;
    }
    return mockSchemaPreview(src);
  });

  app.get<{ Params: { id: string } }>("/sources/:id/audit", async (request) => {
    const { orgId } = request as AuthedRequest;
    const { data } = await supabaseAdmin()
      .from("audit_logs")
      .select("*")
      .eq("org_id", orgId)
      .eq("resource_id", request.params.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });
}
