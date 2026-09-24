import { describe, test, expect } from "bun:test";
import { listConnectors, getConnector } from "../src/connectors/registry";

describe("connector registry", () => {
  test("has two connectors today: Oracle (a live database) and file (an upload)", () => {
    const modules = listConnectors();
    expect(modules.length).toBe(2);
    expect(modules.map((m) => m.meta.id).sort()).toEqual(["file", "oracle"]);
  });

  test("getConnector resolves each known id and returns undefined for an unknown one", () => {
    expect(getConnector("oracle")?.meta.label).toBe("Oracle / Oracle Fusion");
    expect(getConnector("file")?.meta.category).toBe("File");
    expect(getConnector("postgresql")).toBeUndefined();
  });

  test("every connector exposes both testConnection and introspectSchema", () => {
    for (const id of ["oracle", "file"]) {
      const connector = getConnector(id)!;
      expect(typeof connector.testConnection).toBe("function");
      expect(typeof connector.introspectSchema).toBe("function");
    }
  });
});
