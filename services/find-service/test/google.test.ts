import { describe, test, expect } from "bun:test";
import { googleServiceAccountTest } from "../src/connectors/shapes/google";

describe("googleServiceAccountTest", () => {
  test("requires a service account key", async () => {
    const result = await googleServiceAccountTest({ serviceAccountJson: "", url: "https://example.test", scopes: [] });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/missing required/i);
  });

  test("rejects malformed JSON before attempting auth", async () => {
    const result = await googleServiceAccountTest({ serviceAccountJson: "{not json", url: "https://example.test", scopes: [] });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/valid json/i);
  });

  test("reports a failure for well-formed but non-credential JSON rather than throwing", async () => {
    const result = await googleServiceAccountTest({
      serviceAccountJson: JSON.stringify({ not: "a real service account" }),
      url: "https://example.test",
      scopes: ["https://www.googleapis.com/auth/devstorage.read_only"],
    });
    expect(result.ok).toBe(false);
  });
});
