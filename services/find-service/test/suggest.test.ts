import { describe, test, expect } from "bun:test";
import { suggestReports } from "../src/reports/suggest";
import type { NormalizedSchema } from "../src/schema/types";
import type { StatusFieldCandidate } from "../src/schema/statusFields";

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
        { name: "EMAIL", dataType: "VARCHAR2", nullable: true },
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
        { name: "LISTED_DATE", dataType: "DATE", nullable: true },
      ],
    },
    {
      name: "AUDIT_LOG",
      objectType: "TABLE",
      primaryKey: ["ID"],
      foreignKeys: [],
      rowEstimate: 82000,
      columns: [
        { name: "ID", dataType: "NUMBER", nullable: false },
        { name: "ACTOR", dataType: "VARCHAR2", nullable: false },
        { name: "ACTION", dataType: "VARCHAR2", nullable: false },
      ],
    },
  ],
  checkConstraints: [],
};

const statusFields: StatusFieldCandidate[] = [
  { table: "PROPERTIES", column: "STATUS", candidateValues: ["ACTIVE", "PENDING", "SOLD"], source: "check_constraint" },
];

describe("suggestReports", () => {
  test("proposes a join-based report from a table with an FK to a table with a label column", () => {
    const templates = suggestReports(schema, statusFields);
    const byAgent = templates.find((t) => t.baseTable === "PROPERTIES" && t.joinTable === "AGENTS");
    expect(byAgent).toBeDefined();
    expect(byAgent!.groupBy).toBe("AGENTS.NAME");
    expect(byAgent!.aggregation).toBe("count");
  });

  test("attaches the detected status field as a categorical filter, and a date column as a date_range filter", () => {
    const templates = suggestReports(schema, statusFields);
    const byAgent = templates.find((t) => t.baseTable === "PROPERTIES" && t.joinTable === "AGENTS")!;
    expect(byAgent.filters).toContainEqual({ name: "status", column: "PROPERTIES.STATUS", type: "categorical" });
    expect(byAgent.filters).toContainEqual({ name: "listed_date", column: "PROPERTIES.LISTED_DATE", type: "date_range" });
  });

  test("proposes a group-by report on a non-key string column", () => {
    const templates = suggestReports(schema, statusFields);
    const byCity = templates.find((t) => t.baseTable === "PROPERTIES" && !t.joinTable && t.groupBy === "PROPERTIES.CITY");
    expect(byCity).toBeDefined();
    expect(byCity!.aggregation).toBe("count");
  });

  test("proposes a numeric aggregation paired with a group-by column", () => {
    const templates = suggestReports(schema, statusFields);
    const avgPrice = templates.find((t) => t.aggregation === "avg" && t.aggregationColumn === "PROPERTIES.PRICE");
    expect(avgPrice).toBeDefined();
    expect(avgPrice!.groupBy).toBe("PROPERTIES.CITY");
  });

  test("never proposes joining, grouping, or aggregating by a key column", () => {
    const templates = suggestReports(schema, statusFields);
    for (const t of templates) {
      expect(t.groupBy.endsWith(".ID")).toBe(false);
      if (t.aggregationColumn) expect(t.aggregationColumn.endsWith(".ID")).toBe(false);
    }
  });

  test("excludes tables tagged system when a domain classification is supplied", () => {
    const tableDomains = { PROPERTIES: "real_estate:core", AGENTS: "real_estate:core", AUDIT_LOG: "system" };
    const templates = suggestReports(schema, statusFields, tableDomains);
    expect(templates.some((t) => t.baseTable === "AUDIT_LOG")).toBe(false);
  });

  test("does not exclude AUDIT_LOG when no domain classification is supplied", () => {
    const templates = suggestReports(schema, statusFields);
    // AUDIT_LOG has an ACTION string column, so it's a valid group-by candidate absent domain info.
    expect(templates.some((t) => t.baseTable === "AUDIT_LOG")).toBe(true);
  });
});
