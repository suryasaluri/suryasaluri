import { describe, test, expect } from "bun:test";
import { isSafeOracleIdentifier, buildForeignKeyConstraintName, isFixableReference, buildForeignKeySafetyCheckSql, buildForeignKeyFixSql } from "../src/quality/fkFix";
import type { UnconstrainedReference } from "../src/quality/dataQuality";

describe("isSafeOracleIdentifier", () => {
  test("accepts ordinary uppercase table/column names", () => {
    expect(isSafeOracleIdentifier("SALES_ORDERS")).toBe(true);
    expect(isSafeOracleIdentifier("STORE_ID")).toBe(true);
  });

  test("rejects an identifier starting with a digit", () => {
    expect(isSafeOracleIdentifier("1TABLE")).toBe(false);
  });

  test("rejects anything with a SQL-meaningful character — the injection defense", () => {
    expect(isSafeOracleIdentifier("USERS; DROP TABLE USERS--")).toBe(false);
    expect(isSafeOracleIdentifier("USERS (SELECT 1)")).toBe(false);
    expect(isSafeOracleIdentifier("a.b")).toBe(false);
    expect(isSafeOracleIdentifier("a'b")).toBe(false);
  });

  test("rejects an identifier over 30 characters", () => {
    expect(isSafeOracleIdentifier("A".repeat(31))).toBe(false);
    expect(isSafeOracleIdentifier("A".repeat(30))).toBe(true);
  });
});

describe("buildForeignKeyConstraintName", () => {
  test("builds a readable name for short identifiers", () => {
    expect(buildForeignKeyConstraintName("ORDERS", "STORE_ID")).toBe("FK_ORDERS_STORE_ID");
  });

  test("truncates to Oracle's 30-character identifier limit", () => {
    const name = buildForeignKeyConstraintName("A_VERY_LONG_TABLE_NAME_HERE", "AN_EQUALLY_LONG_COLUMN_NAME");
    expect(name.length).toBeLessThanOrEqual(30);
  });
});

const fixableRef: UnconstrainedReference = { table: "SALES_ORDERS", column: "STORE_ID", likelyTargetTable: "STORES", likelyTargetColumn: "ID" };
const manualRef: UnconstrainedReference = { table: "SALES_ORDERS", column: "WAREHOUSE_ID", likelyTargetTable: "WAREHOUSES", likelyTargetColumn: null };

describe("isFixableReference", () => {
  test("a ref with a single-column target is fixable", () => {
    expect(isFixableReference(fixableRef)).toBe(true);
  });

  test("a ref with no inferable target column needs manual entry", () => {
    expect(isFixableReference(manualRef)).toBe(false);
  });
});

describe("buildForeignKeySafetyCheckSql / buildForeignKeyFixSql", () => {
  test("the safety check is read-only (a plain SELECT COUNT)", () => {
    if (!isFixableReference(fixableRef)) throw new Error("fixture should be fixable");
    const sql = buildForeignKeySafetyCheckSql(fixableRef);
    expect(sql).toMatch(/^SELECT COUNT\(\*\)/);
    expect(sql).not.toMatch(/ALTER|DROP|UPDATE|DELETE|INSERT/i);
    expect(sql).toContain("SALES_ORDERS");
    expect(sql).toContain("STORE_ID");
    expect(sql).toContain("STORES");
  });

  test("the fix statement is exactly an ADD CONSTRAINT ... FOREIGN KEY, nothing else", () => {
    if (!isFixableReference(fixableRef)) throw new Error("fixture should be fixable");
    const { sql, constraintName } = buildForeignKeyFixSql(fixableRef);
    expect(sql).toBe("ALTER TABLE SALES_ORDERS ADD CONSTRAINT " + constraintName + " FOREIGN KEY (STORE_ID) REFERENCES STORES(ID)");
    expect(sql).not.toMatch(/DROP|UPDATE|DELETE|INSERT|TRUNCATE|CASCADE/i);
  });
});
