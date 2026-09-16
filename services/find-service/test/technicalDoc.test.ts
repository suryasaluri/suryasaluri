import { describe, test, expect } from "bun:test";
import { renderTechnicalMarkdown } from "../src/docs/technicalDoc";
import type { NormalizedSchema } from "../src/schema/types";
import type { StatusFieldCandidate } from "../src/schema/statusFields";

const schema: NormalizedSchema = {
  tables: [
    {
      name: "AGENTS",
      objectType: "TABLE",
      primaryKey: ["ID"],
      foreignKeys: [],
      rowEstimate: 42,
      columns: [
        { name: "ID", dataType: "NUMBER", nullable: false },
        { name: "EMAIL", dataType: "VARCHAR2", nullable: true },
      ],
    },
    {
      name: "PROPERTIES",
      objectType: "TABLE",
      primaryKey: ["ID"],
      foreignKeys: [{ constraintName: "PROPERTIES_AGENT_FK", columns: ["AGENT_ID"], refTable: "AGENTS", refColumns: ["ID"] }],
      rowEstimate: 1200,
      columns: [
        { name: "ID", dataType: "NUMBER", nullable: false },
        { name: "AGENT_ID", dataType: "NUMBER", nullable: false },
        { name: "STATUS", dataType: "VARCHAR2", nullable: false },
      ],
    },
  ],
  checkConstraints: [],
};

const statusFields: StatusFieldCandidate[] = [
  { table: "PROPERTIES", column: "STATUS", candidateValues: ["ACTIVE", "SOLD"], source: "check_constraint" },
];

describe("renderTechnicalMarkdown", () => {
  const md = renderTechnicalMarkdown(schema, statusFields);

  test("includes every table as a heading", () => {
    expect(md).toContain("## AGENTS (TABLE)");
    expect(md).toContain("## PROPERTIES (TABLE)");
  });

  test("marks primary keys and foreign keys in the column table", () => {
    expect(md).toMatch(/\| ID \| NUMBER \| no \| PK \|/);
    expect(md).toMatch(/\| AGENT_ID \| NUMBER \| no \| FK → AGENTS \|/);
  });

  test("flags a sensitive column by name", () => {
    expect(md).toMatch(/\| EMAIL \| VARCHAR2 \| yes \| \s*\| PII \|/);
  });

  test("lists the derived relationship", () => {
    expect(md).toContain("`PROPERTIES(AGENT_ID)` → `AGENTS(ID)` (PROPERTIES_AGENT_FK)");
  });

  test("lists detected status fields with their candidate values", () => {
    expect(md).toContain("`PROPERTIES.STATUS`: `ACTIVE`, `SOLD`");
  });
});
