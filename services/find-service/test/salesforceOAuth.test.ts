import { describe, test, expect, afterEach } from "bun:test";
import { salesforcePasswordGrantTest } from "../src/connectors/shapes/salesforceOAuth";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const baseArgs = {
  loginUrl: "https://login.salesforce.com",
  clientId: "id",
  clientSecret: "secret",
  username: "user@example.com",
  password: "pw+token",
};

describe("salesforcePasswordGrantTest", () => {
  test("succeeds when the token exchange and sobjects call both succeed", async () => {
    let call = 0;
    globalThis.fetch = (async (url: string) => {
      call++;
      if (call === 1) {
        expect(url).toContain("/services/oauth2/token");
        return new Response(JSON.stringify({ access_token: "tok", instance_url: "https://inst.my.salesforce.com" }), { status: 200 });
      }
      expect(url).toContain("/services/data/v59.0/sobjects");
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await salesforcePasswordGrantTest(baseArgs);
    expect(result.ok).toBe(true);
    expect(result.meta).toEqual({ instance_url: "https://inst.my.salesforce.com" });
  });

  test("reports auth failure when the token endpoint rejects the grant", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "invalid_grant", error_description: "authentication failure" }), { status: 400 })) as unknown as typeof fetch;

    const result = await salesforcePasswordGrantTest(baseArgs);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/authentication failed/i);
  });

  test("reports failure when the sobjects call fails after a good token", async () => {
    let call = 0;
    globalThis.fetch = (async () => {
      call++;
      if (call === 1) return new Response(JSON.stringify({ access_token: "tok", instance_url: "https://inst.my.salesforce.com" }), { status: 200 });
      return new Response("", { status: 500 });
    }) as unknown as typeof fetch;

    const result = await salesforcePasswordGrantTest(baseArgs);
    expect(result.ok).toBe(false);
  });

  test("requires all credential fields", async () => {
    const result = await salesforcePasswordGrantTest({ ...baseArgs, clientSecret: "" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/missing required/i);
  });
});
