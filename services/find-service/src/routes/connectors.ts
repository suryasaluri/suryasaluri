import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listConnectors, getConnector } from "../connectors/registry";

const testSchema = z.object({ fields: z.record(z.string()).optional() });

export function registerConnectorRoutes(app: FastifyInstance) {
  // Public: other systems should be able to discover the catalog without a Nexus Command session.
  app.get("/connectors", async () => listConnectors().map((c) => c.meta));

  app.post<{ Params: { id: string }; Body: unknown }>("/connectors/:id/test", async (request, reply) => {
    const connector = getConnector(request.params.id);
    if (!connector) {
      reply.code(404).send({ error: `Unknown connector id: ${request.params.id}` });
      return;
    }
    const parsed = testSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }
    return connector.testConnection(parsed.data.fields ?? {});
  });
}
