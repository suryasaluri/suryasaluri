import { describe, test, expect } from "bun:test";
import { introspectOracleSchema, type OracleExecutor } from "../src/connectors/oracle/introspect";

/**
 * Fixture: AGENTS (PK ID) <- PROPERTIES (PK ID, FK AGENT_ID -> AGENTS.ID),
 * plus a CHECK constraint on PROPERTIES.STATUS and a view ACTIVE_LISTINGS.
 * Mimics exactly the shape oracledb returns with OUT_FORMAT_OBJECT.
 */
function fixtureExecutor(): OracleExecutor {
  return async (sql: string) => {
    if (sql.includes("USER_TABLES")) {
      return [
        { TABLE_NAME: "AGENTS", NUM_ROWS: 42 },
        { TABLE_NAME: "PROPERTIES", NUM_ROWS: 1200 },
      ];
    }
    if (sql.includes("USER_VIEWS")) {
      return [{ VIEW_NAME: "ACTIVE_LISTINGS" }];
    }
    if (sql.includes("USER_TAB_COLUMNS")) {
      return [
        { TABLE_NAME: "AGENTS", COLUMN_NAME: "ID", DATA_TYPE: "NUMBER", NULLABLE: "N", COLUMN_ID: 1 },
        { TABLE_NAME: "AGENTS", COLUMN_NAME: "NAME", DATA_TYPE: "VARCHAR2", NULLABLE: "Y", COLUMN_ID: 2 },
        { TABLE_NAME: "PROPERTIES", COLUMN_NAME: "ID", DATA_TYPE: "NUMBER", NULLABLE: "N", COLUMN_ID: 1 },
        { TABLE_NAME: "PROPERTIES", COLUMN_NAME: "AGENT_ID", DATA_TYPE: "NUMBER", NULLABLE: "N", COLUMN_ID: 2 },
        { TABLE_NAME: "PROPERTIES", COLUMN_NAME: "STATUS", DATA_TYPE: "VARCHAR2", NULLABLE: "N", COLUMN_ID: 3 },
      ];
    }
    if (sql.includes("CONSTRAINT_TYPE = 'P'")) {
      return [
        { TABLE_NAME: "AGENTS", COLUMN_NAME: "ID", POSITION: 1 },
        { TABLE_NAME: "PROPERTIES", COLUMN_NAME: "ID", POSITION: 1 },
      ];
    }
    if (sql.includes("CONSTRAINT_TYPE IN ('P','U')")) {
      return [
        { CONSTRAINT_NAME: "AGENTS_PK", TABLE_NAME: "AGENTS", COLUMN_NAME: "ID", POSITION: 1 },
        { CONSTRAINT_NAME: "PROPERTIES_PK", TABLE_NAME: "PROPERTIES", COLUMN_NAME: "ID", POSITION: 1 },
      ];
    }
    if (sql.includes("CONSTRAINT_TYPE = 'R'")) {
      return [{ TABLE_NAME: "PROPERTIES", CONSTRAINT_NAME: "PROPERTIES_AGENT_FK", COLUMN_NAME: "AGENT_ID", POSITION: 1, R_CONSTRAINT_NAME: "AGENTS_PK" }];
    }
    if (sql.includes("CONSTRAINT_TYPE = 'C'")) {
      return [{ TABLE_NAME: "PROPERTIES", CONSTRAINT_NAME: "PROPERTIES_STATUS_CHK", SEARCH_CONDITION: "STATUS IN ('ACTIVE','OFF_MARKET','SOLD')" }];
    }
    throw new Error(`Unexpected query in test: ${sql}`);
  };
}

describe("introspectOracleSchema", () => {
  test("assembles tables, views, columns, keys and check constraints", async () => {
    const found: string[] = [];
    const schema = await introspectOracleSchema(fixtureExecutor(), (e) => found.push(e.table.name));

    expect(schema.tables.map((t) => t.name).sort()).toEqual(["ACTIVE_LISTINGS", "AGENTS", "PROPERTIES"].sort());
    expect(found.sort()).toEqual(["ACTIVE_LISTINGS", "AGENTS", "PROPERTIES"].sort());

    const properties = schema.tables.find((t) => t.name === "PROPERTIES")!;
    expect(properties.objectType).toBe("TABLE");
    expect(properties.rowEstimate).toBe(1200);
    expect(properties.primaryKey).toEqual(["ID"]);
    expect(properties.columns.map((c) => c.name)).toEqual(["ID", "AGENT_ID", "STATUS"]);

    const view = schema.tables.find((t) => t.name === "ACTIVE_LISTINGS")!;
    expect(view.objectType).toBe("VIEW");
    expect(view.rowEstimate).toBeNull();
  });

  test("resolves a foreign key to its referenced table and columns", async () => {
    const schema = await introspectOracleSchema(fixtureExecutor(), () => {});
    const properties = schema.tables.find((t) => t.name === "PROPERTIES")!;
    expect(properties.foreignKeys).toEqual([
      { constraintName: "PROPERTIES_AGENT_FK", columns: ["AGENT_ID"], refTable: "AGENTS", refColumns: ["ID"] },
    ]);
  });

  test("carries check constraints through for status-field detection", async () => {
    const schema = await introspectOracleSchema(fixtureExecutor(), () => {});
    expect(schema.checkConstraints).toEqual([
      { tableName: "PROPERTIES", constraintName: "PROPERTIES_STATUS_CHK", searchCondition: "STATUS IN ('ACTIVE','OFF_MARKET','SOLD')" },
    ]);
  });
});
