import { describe, test, expect } from "bun:test";
import { detectUnconstrainedReferences } from "../src/quality/dataQuality";
import type { NormalizedSchema } from "../src/schema/types";

const schema: NormalizedSchema = {
  tables: [
    {
      name: "titles",
      objectType: "TABLE",
      primaryKey: ["id"],
      foreignKeys: [],
      rowEstimate: 150,
      columns: [
        { name: "id", dataType: "NUMBER", nullable: false },
        { name: "title", dataType: "VARCHAR2", nullable: false },
      ],
    },
    {
      name: "authors",
      objectType: "TABLE",
      primaryKey: ["id"],
      foreignKeys: [],
      rowEstimate: 40,
      columns: [{ name: "id", dataType: "NUMBER", nullable: false }],
    },
    {
      name: "order_items",
      objectType: "TABLE",
      primaryKey: ["id"],
      foreignKeys: [{ constraintName: "ORDER_ITEMS_AUTHOR_FK", columns: ["author_id"], refTable: "authors", refColumns: ["id"] }],
      rowEstimate: 1500,
      columns: [
        { name: "id", dataType: "NUMBER", nullable: false },
        { name: "author_id", dataType: "NUMBER", nullable: false }, // declared FK — must not be flagged
        { name: "title_id", dataType: "NUMBER", nullable: false }, // no FK, but "titles" exists — should be flagged
        { name: "external_id", dataType: "VARCHAR2", nullable: true }, // no matching table — must not be flagged
        { name: "warehouse_id", dataType: "NUMBER", nullable: true }, // "warehouses" exists but has a composite PK — flagged, but no inferable target column
      ],
    },
    {
      name: "warehouses",
      objectType: "TABLE",
      primaryKey: ["region", "code"], // composite PK — no single obvious REFERENCES target
      foreignKeys: [],
      rowEstimate: 12,
      columns: [
        { name: "region", dataType: "VARCHAR2", nullable: false },
        { name: "code", dataType: "VARCHAR2", nullable: false },
      ],
    },
  ],
  checkConstraints: [],
};

describe("detectUnconstrainedReferences", () => {
  const flags = detectUnconstrainedReferences(schema);

  test("flags an *_id column with no FK when a matching table exists, with the target's single-column PK as the likely target column", () => {
    expect(flags).toContainEqual({ table: "order_items", column: "title_id", likelyTargetTable: "titles", likelyTargetColumn: "id" });
  });

  test("flags a reference to a table with a composite primary key, but leaves likelyTargetColumn null (needs manual entry)", () => {
    expect(flags).toContainEqual({ table: "order_items", column: "warehouse_id", likelyTargetTable: "warehouses", likelyTargetColumn: null });
  });

  test("does not flag a column already backed by a declared foreign key", () => {
    expect(flags.some((f) => f.column === "author_id")).toBe(false);
  });

  test("does not flag an *_id column with no plausible target table", () => {
    expect(flags.some((f) => f.column === "external_id")).toBe(false);
  });

  test("does not flag a table's own primary key", () => {
    expect(flags.some((f) => f.column === "id")).toBe(false);
  });
});
