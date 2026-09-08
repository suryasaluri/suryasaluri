import { describe, test, expect } from "bun:test";
import { listConnectors, getConnector, CATEGORIES } from "../src/connectors/registry";

describe("connector registry", () => {
  test("has 20 connectors with unique ids", () => {
    const modules = listConnectors();
    const ids = modules.map((m) => m.meta.id);
    expect(ids.length).toBe(20);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("splits evenly between real and simulated integrations", () => {
    const modules = listConnectors();
    const real = modules.filter((m) => m.meta.integration === "real").length;
    const simulated = modules.filter((m) => m.meta.integration === "simulated").length;
    expect(real).toBe(10);
    expect(simulated).toBe(10);
  });

  test("every connector belongs to a known category", () => {
    for (const m of listConnectors()) {
      expect(CATEGORIES as readonly string[]).toContain(m.meta.category);
    }
  });

  test("getConnector resolves a known id and returns undefined for an unknown one", () => {
    expect(getConnector("stripe")?.meta.label).toBe("Stripe");
    expect(getConnector("nonexistent")).toBeUndefined();
  });
});
