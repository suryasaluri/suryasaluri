import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { askSchema, readGlossary, readRelationships, type McpClientConfig } from "./client";

/**
 * Exposes Nexus's schema intelligence to any MCP-capable client (a coding
 * agent working on the customer's own codebase, Claude Desktop, etc.) —
 * the same role DeepWiki's MCP server plays for a code wiki. Deliberately
 * read-only and grounded: ask_schema never runs a query itself (it proxies
 * to the same guarded copilot endpoint the web app uses, which refuses to
 * state a data value as fact), so an external agent gets the same trust
 * guarantees a human using the Find UI gets.
 */
export function buildMcpServer(config: McpClientConfig): McpServer {
  const server = new McpServer({ name: "nexus-find", version: "1.0.0" });

  server.registerTool(
    "ask_schema",
    {
      title: "Ask Nexus about a connection's schema",
      description:
        "Grounded Q&A over a Nexus connection's crawled schema, business glossary, and documentation. Never runs a live query or states a specific data value as fact — for that, use the connection's Reports feature in the Nexus web app instead.",
      inputSchema: {
        connectionId: z.string().describe("The Nexus connection id (data_source id)"),
        question: z.string().describe("A question about what a table/column means, how things relate, or what a status value likely represents"),
      },
    },
    async ({ connectionId, question }) => {
      const result = await askSchema(config, connectionId, question);
      if ("unavailable" in result) {
        return { content: [{ type: "text", text: `Unavailable: ${result.reason}` }] };
      }
      const citations = result.citations.map((c) => c.ref).join(", ") || "none";
      return { content: [{ type: "text", text: `${result.answer}\n\nCitations: ${citations}` }] };
    },
  );

  server.registerTool(
    "read_glossary",
    {
      title: "Read a connection's business glossary",
      description: "The reconstructed business glossary for a Nexus connection — plain-English terms per column, derived-field flags, and cross-table synonym groups.",
      inputSchema: { connectionId: z.string().describe("The Nexus connection id (data_source id)") },
    },
    async ({ connectionId }) => {
      const result = await readGlossary(config, connectionId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "read_relationships",
    {
      title: "Read a connection's schema and relationships",
      description: "The crawled tables/columns and the foreign-key relationship graph for a Nexus connection.",
      inputSchema: { connectionId: z.string().describe("The Nexus connection id (data_source id)") },
    },
    async ({ connectionId }) => {
      const result = await readRelationships(config, connectionId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  return server;
}

/** Only runs when this file is executed directly (`bun run src/mcp/server.ts`), not when imported by tests. */
if (import.meta.main) {
  const baseUrl = process.env.FIND_SERVICE_URL ?? "http://localhost:4001";
  const token = process.env.FIND_API_TOKEN;
  if (!token) {
    console.error("FIND_API_TOKEN is required — a Supabase access token for the org this MCP server should act as.");
    process.exit(1);
  }

  const server = buildMcpServer({ baseUrl, token });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
