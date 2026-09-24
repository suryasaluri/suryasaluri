import { describe, test, expect } from "bun:test";
import { validCitationRefs, filterValidCitations } from "../src/citations";
import type { NormalizedSchema } from "../src/schema/types";

const schema: NormalizedSchema = {
  tables: [
    {
      name: "AGENTS",
      objectType: "TABLE",
      primaryKey: ["ID"],
      foreignKeys: [],
      rowEstimate: 10,
      columns: [{ name: "ID", dataType: "NUMBER", nullable: false }, { name: "EMAIL", dataType: "VARCHAR2", nullable: true }],
    },
    {
      name: "PROPERTIES",
      objectType: "TABLE",
      primaryKey: ["ID"],
      foreignKeys: [{ constraintName: "PROPERTIES_AGENT_FK", columns: ["AGENT_ID"], refTable: "AGENTS", refColumns: ["ID"] }],
      rowEstimate: 100,
      columns: [{ name: "ID", dataType: "NUMBER", nullable: false }, { name: "AGENT_ID", dataType: "NUMBER", nullable: false }],
    },
  ],
  checkConstraints: [],
};

describe("validCitationRefs", () => {
  test("includes every table name, table.column pair, and FK constraint name", () => {
    const refs = validCitationRefs(schema);
    expect(refs.has("AGENTS")).toBe(true);
    expect(refs.has("AGENTS.EMAIL")).toBe(true);
    expect(refs.has("PROPERTIES.AGENT_ID")).toBe(true);
    expect(refs.has("PROPERTIES_AGENT_FK")).toBe(true);
  });

  test("does not include a column that doesn't exist", () => {
    expect(validCitationRefs(schema).has("AGENTS.PHONE")).toBe(false);
  });
});

describe("filterValidCitations", () => {
  test("keeps citations that reference something real", () => {
    const result = filterValidCitations([{ ref: "AGENTS.EMAIL" }, { ref: "PROPERTIES_AGENT_FK" }], schema);
    expect(result.length).toBe(2);
  });

  test("drops a hallucinated ref rather than passing it through as if it were grounded", () => {
    const result = filterValidCitations([{ ref: "AGENTS.EMAIL" }, { ref: "AGENTS.SSN" }, { ref: "MADE_UP_TABLE" }], schema);
    expect(result).toEqual([{ ref: "AGENTS.EMAIL" }]);
  });

  test("drops a citation with a non-string ref rather than throwing", () => {
    // @ts-expect-error -- exercising a malformed tool-use response
    const result = filterValidCitations([{ ref: 42 }, { ref: "AGENTS" }], schema);
    expect(result).toEqual([{ ref: "AGENTS" }]);
  });
});
