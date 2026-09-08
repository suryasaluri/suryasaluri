import type { FastifyInstance } from "fastify";
import { EventEmitter } from "node:events";
import { z } from "zod";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { listConnectors } from "../connectors/registry";
import { classifySensitivity } from "../sensitivity";
import type { ConnectorCategory, ConnectorMeta } from "../connectors/types";

const scanSchema = z.object({
  scanType: z.enum(["network", "cloud", "saas"]),
  target: z.string().optional(),
});

const SCAN_SCOPES: Record<string, ConnectorCategory[]> = {
  network: ["Database", "Streaming"],
  cloud: ["Warehouse", "Storage"],
  saas: ["SaaS"],
};

const OPEN_STATUS_POOL = ["open", "open", "open", "auth_required", "blocked"];
const scanEmitters = new Map<string, EventEmitter>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildCandidate(meta: ConnectorMeta) {
  const needsAuth = meta.fields.some((f) => f.type === "password");
  const status = needsAuth ? randomOf(["auth_required", "open", "blocked"]) : randomOf(OPEN_STATUS_POOL);
  const blocked = status === "blocked";
  const name = `${meta.label} ${randomOf(["Prod", "Analytics", "Core", "Warehouse", "Reporting", "Ops"])}`;
  return {
    name,
    service_type: meta.label,
    connector_id: meta.id,
    integration_mode: meta.integration,
    host: meta.id === "bigquery" ? `project-${Math.floor(1000 + Math.random() * 9000)}` : `${meta.id}.internal`,
    port: meta.defaultPort ?? null,
    status,
    connector_type: meta.connectorType,
    table_count: blocked ? 0 : Math.floor(10 + Math.random() * 240),
    row_count: blocked ? 0 : Math.floor(50_000 + Math.random() * 90_000_000),
    difficulty_score: blocked ? 4 : needsAuth ? 2 : 1,
    category: meta.category,
    tags: [] as string[],
    sensitivity_labels: classifySensitivity(name, meta.label, meta.category),
    schema_metadata: {},
  };
}

function emitterFor(scanId: string): EventEmitter {
  let emitter = scanEmitters.get(scanId);
  if (!emitter) {
    emitter = new EventEmitter();
    scanEmitters.set(scanId, emitter);
  }
  return emitter;
}

async function runScanAsync(orgId: string, scanId: string, scanType: string, target: string | null, pool: ConnectorMeta[]) {
  const emitter = emitterFor(scanId);

  if (pool.length === 0) {
    await sleep(400);
    await supabaseAdmin()
      .from("discovery_scans")
      .update({ status: "completed", completed_at: new Date().toISOString(), sources_found: 0 })
      .eq("id", scanId);
    emitter.emit("completed", { found: 0 });
    scanEmitters.delete(scanId);
    return;
  }

  const count = Math.min(pool.length, 2 + Math.floor(Math.random() * 3));
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  const candidates = shuffled.map(buildCandidate);

  const found: (typeof candidates)[number][] = [];
  for (const candidate of candidates) {
    await sleep(600 + Math.random() * 300);
    found.push(candidate);
    emitter.emit("found", candidate);
  }
  await sleep(300);

  const { error: insertErr } = await supabaseAdmin()
    .from("data_sources")
    .insert(found.map((c) => ({ ...c, org_id: orgId })));
  if (insertErr) {
    emitter.emit("error", { message: insertErr.message });
    scanEmitters.delete(scanId);
    return;
  }

  await supabaseAdmin()
    .from("discovery_scans")
    .update({ status: "completed", completed_at: new Date().toISOString(), sources_found: found.length })
    .eq("id", scanId);

  await supabaseAdmin()
    .from("audit_logs")
    .insert({
      org_id: orgId,
      action: "scan.completed",
      resource_type: "discovery_scan",
      resource_id: scanId,
      details: { scan_type: scanType, target, sources_found: found.length },
    });

  emitter.emit("completed", { found: found.length });
  scanEmitters.delete(scanId);
}

export function registerScanRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/scans", async (request) => {
    const { orgId } = request as AuthedRequest;
    const { data } = await supabaseAdmin()
      .from("discovery_scans")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(8);
    return data ?? [];
  });

  app.post<{ Body: unknown }>("/scans", async (request, reply) => {
    const { orgId } = request as AuthedRequest;
    const parsed = scanSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }
    const { scanType, target } = parsed.data;
    const categories = SCAN_SCOPES[scanType];

    const { data: existing } = await supabaseAdmin().from("data_sources").select("service_type").eq("org_id", orgId);
    const existingTypes = new Set((existing ?? []).map((s) => s.service_type as string));
    const pool = listConnectors()
      .filter((c) => categories.includes(c.meta.category) && !existingTypes.has(c.meta.label))
      .map((c) => c.meta);

    const { data: scanRow, error } = await supabaseAdmin()
      .from("discovery_scans")
      .insert({ org_id: orgId, scan_type: scanType, target: target ?? null, status: "running" })
      .select()
      .single();
    if (error) throw error;

    runScanAsync(orgId, scanRow.id, scanType, target ?? null, pool).catch((e) => app.log.error(e, "scan failed"));

    reply.code(202);
    return { id: scanRow.id, status: "running" };
  });

  app.get<{ Params: { id: string } }>("/scans/:id/stream", async (request, reply) => {
    const { id } = request.params;
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const emitter = emitterFor(id);

    const onFound = (candidate: unknown) => reply.raw.write(`event: found\ndata: ${JSON.stringify(candidate)}\n\n`);
    const onCompleted = (payload: unknown) => {
      reply.raw.write(`event: completed\ndata: ${JSON.stringify(payload)}\n\n`);
      cleanup();
    };
    const onError = (payload: unknown) => {
      reply.raw.write(`event: error\ndata: ${JSON.stringify(payload)}\n\n`);
      cleanup();
    };
    function cleanup() {
      emitter.off("found", onFound);
      emitter.off("completed", onCompleted);
      emitter.off("error", onError);
      reply.raw.end();
    }

    emitter.on("found", onFound);
    emitter.on("completed", onCompleted);
    emitter.on("error", onError);
    request.raw.on("close", cleanup);
  });
}
