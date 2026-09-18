import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerConnectorRoutes } from "./routes/connectors";
import { registerConnectionRoutes } from "./routes/connections";
import { registerCrawlRoutes } from "./routes/crawls";
import { registerSchemaRoutes } from "./routes/schema";
import { registerDocumentationRoutes } from "./routes/documentation";
import { registerDomainRoutes } from "./routes/domain";
import { registerReportRoutes } from "./routes/reports";
import { registerUsageRoutes } from "./routes/usage";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: (process.env.CORS_ORIGIN ?? "http://localhost:8080").split(","),
});

app.get("/health", async () => ({ ok: true }));

// Public — no auth hook on the root instance.
registerConnectorRoutes(app);

// Each wrapped in its own encapsulated plugin context so requireAuth (added
// via addHook inside these) only applies to their own routes, not globally.
app.register(async (instance) => registerConnectionRoutes(instance));
app.register(async (instance) => registerCrawlRoutes(instance));
app.register(async (instance) => registerSchemaRoutes(instance));
app.register(async (instance) => registerDocumentationRoutes(instance));
app.register(async (instance) => registerDomainRoutes(instance));
app.register(async (instance) => registerReportRoutes(instance));
app.register(async (instance) => registerUsageRoutes(instance));

const port = Number(process.env.PORT ?? 4001);
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`find-service listening on :${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
