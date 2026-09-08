import { describe, test, expect } from "bun:test";
import { simulatedConnectors } from "../src/connectors/simulated";

describe("simulated connectors", () => {
  test(
    "fail fast when required fields are missing",
    async () => {
      for (const connector of simulatedConnectors) {
        const result = await connector.testConnection({});
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/missing required/i);
      }
    },
    15000,
  );

  test("are all marked as simulated integration", () => {
    for (const connector of simulatedConnectors) {
      expect(connector.meta.integration).toBe("simulated");
    }
  });

  test(
    "succeed or fail (never throw) when all required fields are present",
    async () => {
      for (const connector of simulatedConnectors) {
        const fields: Record<string, string> = {};
        for (const f of connector.meta.fields) {
          if (f.type !== "number") fields[f.key] = "value";
        }
        const result = await connector.testConnection(fields);
        expect(typeof result.ok).toBe("boolean");
      }
    },
    15000,
  );
});
