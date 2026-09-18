import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { getConnector } from "../connectors/registry";
import { classifySensitivity } from "../sensitivity";

const registerSchema = z.object({
  name: z.string().optional(),
  connectorId: z.string().min(1),
  fields: z.record(z.string()).default({}),
});

const testSchema = z.object({ fields: z.record(z.string()).default({}) });

function maskCredential(fields: Record<string, string>): string | null {
  if (!fields.username) return null;
  return fields.serviceName ? `${fields.username}@${fields.serviceName}` : fields.username;
}

/** Test-result messages call out auth problems by wording ("Authentication failed…"); anything else is treated as unreachable. */
function statusFromTestResult(ok: boolean, message: string): "connected" | "auth_required" | "unreachable" {
  if (ok) return "connected";
  return /authentication failed/i.test(message) ? "auth_required" : "unreachable";
}

async function writeAudit(
  orgId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details: Record<string, unknown>,
  sessionId?: string,
) {
  await supabaseAdmin()
    .from("audit_logs")
    .insert({ org_id: orgId, session_id: sessionId ?? null, action, resource_type: resourceType, resource_id: resourceId, details });
}

export function registerConnectionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/connections", async (request) => {
    const { orgId } = request as AuthedRequest;
    const { data, error } = await supabaseAdmin().from("data_sources").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

  app.post<{ Body: unknown }>("/connections", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const parsed = registerSchema.safeParse(request.body);
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
    const status = statusFromTestResult(result.ok, result.message);
    const connectionName = name?.trim() || `${connector.meta.label} connection`;

    const { data, error } = await supabaseAdmin()
      .from("data_sources")
      .insert({
        org_id: orgId,
        name: connectionName,
        service_type: connector.meta.label,
        connector_id: connector.meta.id,
        integration_mode: "real",
        host: fields.host || null,
        port: fields.port ? Number(fields.port) : connector.meta.defaultPort ?? null,
        service_name: fields.serviceName || null,
        username: fields.username || null,
        connector_type: connector.meta.connectorType,
        status,
        category: connector.meta.category,
        credential_label: maskCredential(fields),
        connected_at: result.ok ? new Date().toISOString() : null,
        sensitivity_labels: classifySensitivity(connectionName, connector.meta.label, connector.meta.category),
      })
      .select()
      .single();
    if (error) throw error;

    await writeAudit(orgId, "connection.registered", "data_source", data.id, { connector: connectorId, status, test_message: result.message }, sessionId);
    reply.code(201);
    return data;
  });

  app.post<{ Params: { id: string }; Body: unknown }>("/connections/:id/test", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const { id } = request.params;
    const parsed = testSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }
    const { data: src, error: fetchErr } = await supabaseAdmin().from("data_sources").select("*").eq("id", id).eq("org_id", orgId).single();
    if (fetchErr || !src) {
      reply.code(404).send({ error: "Connection not found" });
      return;
    }
    const connector = getConnector(src.connector_id);
    if (!connector) {
      reply.code(400).send({ error: "Unknown connector for this connection" });
      return;
    }

    const result = await connector.testConnection(parsed.data.fields);
    const status = statusFromTestResult(result.ok, result.message);
    const { data, error } = await supabaseAdmin()
      .from("data_sources")
      .update({ status, connected_at: result.ok ? new Date().toISOString() : null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    await writeAudit(orgId, "connection.tested", "data_source", id, { status, test_message: result.message }, sessionId);
    return data;
  });

  app.delete<{ Params: { id: string } }>("/connections/:id", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const { id } = request.params;
    const { data: src } = await supabaseAdmin().from("data_sources").select("name").eq("id", id).eq("org_id", orgId).single();
    const { error } = await supabaseAdmin().from("data_sources").delete().eq("id", id).eq("org_id", orgId);
    if (error) throw error;
    await writeAudit(orgId, "connection.deleted", "data_source", id, { name: src?.name }, sessionId);
    reply.code(204);
  });
}
