import { describe, test, expect } from "bun:test";
import { parseCheckConstraintValues, detectStatusFields } from "../src/schema/statusFields";
import type { NormalizedSchema } from "../src/schema/types";

describe("parseCheckConstraintValues", () => {
  test("parses a simple IN-list", () => {
    expect(parseCheckConstraintValues("STATUS IN ('ACTIVE','OFF_MARKET','SOLD')")).toEqual({
      column: "STATUS",
      values: ["ACTIVE", "OFF_MARKET", "SOLD"],
    });
  });

  test("handles quoted column names and spacing", () => {
    expect(parseCheckConstraintValues(`"ORDER_STATUS" IN ( 'NEW' , 'PAID' )`)).toEqual({
      column: "ORDER_STATUS",
      values: ["NEW", "PAID"],
    });
  });

  test("returns null for constraints that aren't an IN-list", () => {
    expect(parseCheckConstraintValues("AMOUNT > 0")).toBeNull();
    expect(parseCheckConstraintValues('"EMAIL" IS NOT NULL')).toBeNull();
  });
});

describe("detectStatusFields", () => {
  const schema: NormalizedSchema = {
    tables: [
      {
        name: "PROPERTIES",
        objectType: "TABLE",
        primaryKey: ["ID"],
        foreignKeys: [],
        rowEstimate: 100,
        columns: [
          { name: "ID", dataType: "NUMBER", nullable: false },
          { name: "STATUS", dataType: "VARCHAR2", nullable: false },
          { name: "IS_FEATURED_FLAG", dataType: "CHAR", nullable: true },
          { name: "PRICE", dataType: "NUMBER", nullable: true },
        ],
      },
    ],
    checkConstraints: [{ tableName: "PROPERTIES", constraintName: "PROPERTIES_STATUS_CHK", searchCondition: "STATUS IN ('ACTIVE','SOLD')" }],
  };

  test("prefers check-constraint values when available", () => {
    const fields = detectStatusFields(schema);
    const status = fields.find((f) => f.column === "STATUS");
    expect(status).toEqual({ table: "PROPERTIES", column: "STATUS", candidateValues: ["ACTIVE", "SOLD"], source: "check_constraint" });
  });

  test("falls back to name heuristic for flag/status-like columns without a CHECK constraint", () => {
    const fields = detectStatusFields(schema);
    const flag = fields.find((f) => f.column === "IS_FEATURED_FLAG");
    expect(flag).toEqual({ table: "PROPERTIES", column: "IS_FEATURED_FLAG", candidateValues: null, source: "name_heuristic" });
  });

  test("does not flag unrelated columns", () => {
    const fields = detectStatusFields(schema);
    expect(fields.some((f) => f.column === "PRICE" || f.column === "ID")).toBe(false);
  });
});
