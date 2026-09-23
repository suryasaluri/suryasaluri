import { describe, test, expect } from "bun:test";
import { buildTableSummary, diffTableSummaries, isDriftEmpty } from "../src/schema/drift";
import type { NormalizedSchema } from "../src/schema/types";

describe("buildTableSummary", () => {
  test("captures table name, type, and column names only", () => {
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
      ],
      checkConstraints: [],
    };
    expect(buildTableSummary(schema)).toEqual([{ name: "AGENTS", objectType: "TABLE", columnNames: ["ID", "EMAIL"] }]);
  });
});

describe("diffTableSummaries", () => {
  const previous = [
    { name: "AGENTS", objectType: "TABLE" as const, columnNames: ["ID", "EMAIL"] },
    { name: "PROPERTIES", objectType: "TABLE" as const, columnNames: ["ID", "AGENT_ID", "STATUS"] },
  ];

  test("reports no drift when nothing changed", () => {
    const drift = diffTableSummaries(previous, previous);
    expect(isDriftEmpty(drift)).toBe(true);
  });

  test("detects an added table", () => {
    const current = [...previous, { name: "REVIEWS", objectType: "TABLE" as const, columnNames: ["ID"] }];
    const drift = diffTableSummaries(previous, current);
    expect(drift.addedTables).toEqual(["REVIEWS"]);
    expect(isDriftEmpty(drift)).toBe(false);
  });

  test("detects a removed table", () => {
    const current = previous.filter((t) => t.name !== "PROPERTIES");
    const drift = diffTableSummaries(previous, current);
    expect(drift.removedTables).toEqual(["PROPERTIES"]);
  });

  test("detects added and removed columns on a table present in both", () => {
    const current = [
      previous[0],
      { name: "PROPERTIES", objectType: "TABLE" as const, columnNames: ["ID", "AGENT_ID", "LISTED_AT"] }, // STATUS removed, LISTED_AT added
    ];
    const drift = diffTableSummaries(previous, current);
    expect(drift.changedTables).toEqual([{ table: "PROPERTIES", addedColumns: ["LISTED_AT"], removedColumns: ["STATUS"] }]);
  });
});
