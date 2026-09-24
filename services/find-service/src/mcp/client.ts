/**
 * Thin proxy over find-service's own HTTP API — this is what turns the MCP
 * server into infrastructure other AI tools can query directly (a coding
 * agent working on the customer's own codebase, not just a human in the
 * Nexus web app), the same role DeepWiki's MCP server plays for a codebase
 * wiki. `fetchImpl` is injected so this is testable with a mocked fetch,
 * without a live find-service instance.
 */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type McpClientConfig = {
  baseUrl: string;
  token: string;
  fetchImpl?: FetchLike;
};

async function call<T>(config: McpClientConfig, path: string, init?: RequestInit): Promise<T> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const res = await fetchImpl(`${config.baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}`, ...(init?.headers ?? {}) },
  });
  const body = (await res.json()) as { error?: unknown };
  if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : `find-service request failed: ${res.status}`);
  return body as T;
}

export function askSchema(config: McpClientConfig, connectionId: string, question: string) {
  return call<{ answer: string; citations: { ref: string; note?: string }[] } | { unavailable: true; reason: string }>(
    config,
    `/connections/${connectionId}/copilot/ask`,
    { method: "POST", body: JSON.stringify({ question }) },
  );
}

export function readGlossary(config: McpClientConfig, connectionId: string) {
  return call<unknown>(config, `/connections/${connectionId}/glossary`);
}

export function readRelationships(config: McpClientConfig, connectionId: string) {
  return call<{ tables: unknown[]; relationships: unknown[] }>(config, `/connections/${connectionId}/schema`);
}
