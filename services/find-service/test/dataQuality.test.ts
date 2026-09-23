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
      ],
    },
  ],
  checkConstraints: [],
};

describe("detectUnconstrainedReferences", () => {
  const flags = detectUnconstrainedReferences(schema);

  test("flags an *_id column with no FK when a matching table exists", () => {
    expect(flags).toContainEqual({ table: "order_items", column: "title_id", likelyTargetTable: "titles" });
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
