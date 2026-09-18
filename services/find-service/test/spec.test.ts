import { describe, test, expect } from "bun:test";
import { validateSpec, buildOracleSql, DEFAULT_MAX_ROWS } from "../src/reports/spec";
import type { NormalizedSchema } from "../src/schema/types";
import type { ReportSpec } from "../src/reports/types";

const schema: NormalizedSchema = {
  tables: [
    {
      name: "AGENTS",
      objectType: "TABLE",
      primaryKey: ["ID"],
      foreignKeys: [],
      rowEstimate: 38,
      columns: [
        { name: "ID", dataType: "NUMBER", nullable: false },
        { name: "NAME", dataType: "VARCHAR2", nullable: false },
      ],
    },
    {
      name: "PROPERTIES",
      objectType: "TABLE",
      primaryKey: ["ID"],
      foreignKeys: [{ constraintName: "PROPERTIES_AGENT_FK", columns: ["AGENT_ID"], refTable: "AGENTS", refColumns: ["ID"] }],
      rowEstimate: 1240,
      columns: [
        { name: "ID", dataType: "NUMBER", nullable: false },
        { name: "AGENT_ID", dataType: "NUMBER", nullable: false },
        { name: "CITY", dataType: "VARCHAR2", nullable: false },
        { name: "PRICE", dataType: "NUMBER", nullable: false },
        { name: "STATUS", dataType: "VARCHAR2", nullable: false },
      ],
    },
  ],
  checkConstraints: [],
};

function baseSpec(overrides: Partial<ReportSpec> = {}): ReportSpec {
  return {
    baseTable: "PROPERTIES",
    groupBy: "PROPERTIES.CITY",
    aggregation: "count",
    filters: [],
    maxRows: DEFAULT_MAX_ROWS,
    ...overrides,
  };
}

describe("validateSpec", () => {
  test("accepts a well-formed count spec", () => {
    expect(validateSpec(baseSpec(), schema)).toEqual([]);
  });

  test("rejects an unknown base table with suggestions", () => {
    const errors = validateSpec(baseSpec({ baseTable: "PROPERTY" }), schema);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("PROPERTY");
    expect(errors[0].suggestions.length).toBeGreaterThan(0);
  });

  test("rejects a groupBy column that doesn't exist, with fuzzy suggestions from the real schema", () => {
    const errors = validateSpec(baseSpec({ groupBy: "PROPERTIES.SQUARE_FT" }), schema);
    expect(errors.some((e) => e.field === "PROPERTIES.SQUARE_FT" && /not found/.test(e.reason))).toBe(true);
    const suggestions = errors.find((e) => e.field === "PROPERTIES.SQUARE_FT")!.suggestions;
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    for (const s of suggestions) expect(s).toMatch(/^[A-Z]+\.[A-Z_]+$/);
  });

  test("rejects a join table with no connecting foreign key", () => {
    const errors = validateSpec(baseSpec({ baseTable: "AGENTS", joinTable: "PROPERTIES", groupBy: "AGENTS.NAME" }), schema);
    expect(errors.some((e) => /foreign key/.test(e.reason))).toBe(true);
  });

  test("accepts a valid join in the FK's actual direction", () => {
    const errors = validateSpec(baseSpec({ joinTable: "AGENTS", groupBy: "AGENTS.NAME" }), schema);
    expect(errors).toEqual([]);
  });

  test("requires aggregationColumn for avg/sum, and rejects a non-numeric one", () => {
    const missing = validateSpec(baseSpec({ aggregation: "avg" }), schema);
    expect(missing.some((e) => e.field === "aggregationColumn")).toBe(true);

    const nonNumeric = validateSpec(baseSpec({ aggregation: "avg", aggregationColumn: "PROPERTIES.CITY" }), schema);
    expect(nonNumeric.some((e) => /not numeric/.test(e.reason))).toBe(true);

    const ok = validateSpec(baseSpec({ aggregation: "avg", aggregationColumn: "PROPERTIES.PRICE" }), schema);
    expect(ok).toEqual([]);
  });

  test("rejects a filter column not in scope for the report", () => {
    const errors = validateSpec(baseSpec({ filters: [{ column: "AGENTS.NAME", op: "=", value: "x" }] }), schema);
    expect(errors.some((e) => e.field === "AGENTS.NAME")).toBe(true);
  });
});

describe("buildOracleSql", () => {
  test("builds a simple grouped count with a bound filter and an inlined row cap", () => {
    const spec = baseSpec({ filters: [{ column: "PROPERTIES.STATUS", op: "=", value: "ACTIVE" }] });
    const { sql, binds } = buildOracleSql(spec, schema, 50);
    expect(sql).toContain("SELECT PROPERTIES.CITY AS group_value, COUNT(*) AS agg_value");
    expect(sql).toContain("FROM PROPERTIES");
    expect(sql).toContain("WHERE PROPERTIES.STATUS = :p0");
    expect(sql).toContain("GROUP BY PROPERTIES.CITY");
    expect(sql).toContain("FETCH FIRST 50 ROWS ONLY");
    expect(binds).toEqual({ p0: "ACTIVE" });
  });

  test("builds the join condition from the base table's actual foreign key", () => {
    const spec = baseSpec({ joinTable: "AGENTS", groupBy: "AGENTS.NAME" });
    const { sql } = buildOracleSql(spec, schema, 50);
    expect(sql).toContain("JOIN AGENTS ON PROPERTIES.AGENT_ID = AGENTS.ID");
  });

  test("builds an aggregation expression for avg/sum", () => {
    const spec = baseSpec({ aggregation: "avg", aggregationColumn: "PROPERTIES.PRICE" });
    const { sql } = buildOracleSql(spec, schema, 50);
    expect(sql).toContain("AVG(PROPERTIES.PRICE) AS agg_value");
  });

  test("never inlines a filter value into the SQL text — always a bind", () => {
    const spec = baseSpec({ filters: [{ column: "PROPERTIES.STATUS", op: "=", value: "'; DROP TABLE PROPERTIES; --" }] });
    const { sql, binds } = buildOracleSql(spec, schema, 50);
    expect(sql).not.toContain("DROP TABLE");
    expect(binds.p0).toBe("'; DROP TABLE PROPERTIES; --");
  });
});
