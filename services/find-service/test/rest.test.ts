import { describe, test, expect, afterEach } from "bun:test";
import { bearerRestTest, basicRestTest, querySignedRestTest } from "../src/connectors/shapes/rest";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(status: number, body: unknown = {}) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("bearerRestTest", () => {
  test("maps a 2xx response to ok", async () => {
    mockFetch(200, { account: "acct_123" });
    const result = await bearerRestTest({ url: "https://example.test/api", token: "tok" });
    expect(result.ok).toBe(true);
    expect(result.meta).toEqual({ account: "acct_123" });
  });

  test("maps 401 to an auth failure message", async () => {
    mockFetch(401);
    const result = await bearerRestTest({ url: "https://example.test/api", token: "tok" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/authentication failed/i);
  });

  test("maps 403 to an auth failure message", async () => {
    mockFetch(403);
    const result = await bearerRestTest({ url: "https://example.test/api", token: "tok" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/authentication failed/i);
  });

  test("maps other error statuses to a generic failure", async () => {
    mockFetch(500);
    const result = await bearerRestTest({ url: "https://example.test/api", token: "tok" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/unexpected response/i);
  });

  test("rejects an empty token before making a request", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const result = await bearerRestTest({ url: "https://example.test/api", token: "" });
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });

  test("surfaces network failures without throwing", async () => {
    globalThis.fetch = (async () => {
      throw new Error("getaddrinfo ENOTFOUND example.test");
    }) as unknown as typeof fetch;
    const result = await bearerRestTest({ url: "https://example.test/api", token: "tok" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/connection failed/i);
  });
});

describe("basicRestTest", () => {
  test("succeeds on 2xx", async () => {
    mockFetch(200, { id: "user_1" });
    const result = await basicRestTest({ url: "https://example.test/me", username: "a@b.com/token", password: "tok" });
    expect(result.ok).toBe(true);
  });

  test("fails on 401", async () => {
    mockFetch(401);
    const result = await basicRestTest({ url: "https://example.test/me", username: "a@b.com/token", password: "tok" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/authentication failed/i);
  });

  test("requires both username and password", async () => {
    const result = await basicRestTest({ url: "https://example.test/me", username: "", password: "" });
    expect(result.ok).toBe(false);
  });
});

describe("querySignedRestTest", () => {
  test("succeeds on 2xx", async () => {
    mockFetch(200);
    const result = await querySignedRestTest({ url: "https://example.test/container?restype=container&comp=list&sig=abc" });
    expect(result.ok).toBe(true);
  });

  test("fails on 403", async () => {
    mockFetch(403);
    const result = await querySignedRestTest({ url: "https://example.test/container?restype=container&comp=list&sig=bad" });
    expect(result.ok).toBe(false);
  });
});
