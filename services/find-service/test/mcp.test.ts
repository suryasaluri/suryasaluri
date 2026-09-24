import { describe, test, expect, mock } from "bun:test";
import { askSchema, readGlossary, readRelationships } from "../src/mcp/client";
import { buildMcpServer } from "../src/mcp/server";

function fakeFetch(response: unknown, ok = true, status = 200) {
  return mock(async (url: string | URL | Request, init?: RequestInit) => {
    return {
      ok,
      status,
      json: async () => response,
      // record what was called with, for assertion
      __url: url,
      __init: init,
    } as unknown as Response;
  });
}

describe("mcp/client", () => {
  test("askSchema posts the question and sends a bearer token", async () => {
    const fetchImpl = fakeFetch({ answer: "It's a status enum.", citations: [{ ref: "PROPERTIES.STATUS" }] });
    const result = await askSchema({ baseUrl: "http://localhost:4001", token: "tok123", fetchImpl }, "conn-1", "what does status mean?");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://localhost:4001/connections/conn-1/copilot/ask");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ question: "what does status mean?" });
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
    expect("unavailable" in result).toBe(false);
    if (!("unavailable" in result)) expect(result.answer).toContain("status enum");
  });

  test("readGlossary hits the glossary endpoint with GET", async () => {
    const fetchImpl = fakeFetch({ terms: [], synonym_groups: [] });
    await readGlossary({ baseUrl: "http://localhost:4001", token: "tok123", fetchImpl }, "conn-1");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://localhost:4001/connections/conn-1/glossary");
    expect(init?.method ?? "GET").not.toBe("POST");
  });

  test("readRelationships hits the schema endpoint", async () => {
    const fetchImpl = fakeFetch({ tables: [], relationships: [] });
    await readRelationships({ baseUrl: "http://localhost:4001", token: "tok123", fetchImpl }, "conn-1");
    expect(fetchImpl.mock.calls[0][0]).toBe("http://localhost:4001/connections/conn-1/schema");
  });

  test("a non-ok response with an error body throws that message", async () => {
    const fetchImpl = fakeFetch({ error: "Connection not found" }, false, 404);
    await expect(readRelationships({ baseUrl: "http://localhost:4001", token: "tok123", fetchImpl }, "missing")).rejects.toThrow("Connection not found");
  });

  test("a non-ok response with no error body still throws, naming the status", async () => {
    const fetchImpl = fakeFetch({}, false, 500);
    await expect(readRelationships({ baseUrl: "http://localhost:4001", token: "tok123", fetchImpl }, "conn-1")).rejects.toThrow("500");
  });
});

describe("mcp/server", () => {
  test("buildMcpServer constructs and registers the three read-only tools without throwing", () => {
    const server = buildMcpServer({ baseUrl: "http://localhost:4001", token: "tok123" });
    expect(server).toBeTruthy();
  });
});
