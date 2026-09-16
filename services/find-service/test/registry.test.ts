import { describe, test, expect } from "bun:test";
import { listConnectors, getConnector } from "../src/connectors/registry";

describe("connector registry", () => {
  test("has exactly one connector today: Oracle", () => {
    const modules = listConnectors();
    expect(modules.length).toBe(1);
    expect(modules[0].meta.id).toBe("oracle");
  });

  test("getConnector resolves oracle and returns undefined for an unknown id", () => {
    expect(getConnector("oracle")?.meta.label).toBe("Oracle / Oracle Fusion");
    expect(getConnector("postgresql")).toBeUndefined();
  });

  test("oracle connector exposes both testConnection and introspectSchema", () => {
    const oracle = getConnector("oracle")!;
    expect(typeof oracle.testConnection).toBe("function");
    expect(typeof oracle.introspectSchema).toBe("function");
  });
});
