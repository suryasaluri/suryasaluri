import type { NormalizedSchema, TableDef, ForeignKeyDef, CheckConstraintDef } from "../../schema/types";
import type { IntrospectionProgressEvent } from "../types";

/** Runs one query and returns its rows as plain objects keyed by (uppercase) column name — exactly the shape oracledb returns with OUT_FORMAT_OBJECT. */
export type OracleExecutor = (sql: string) => Promise<Record<string, unknown>[]>;

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

const TABLES_SQL = "SELECT TABLE_NAME, NUM_ROWS FROM USER_TABLES ORDER BY TABLE_NAME";
const VIEWS_SQL = "SELECT VIEW_NAME FROM USER_VIEWS ORDER BY VIEW_NAME";
const COLUMNS_SQL = "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, NULLABLE, COLUMN_ID FROM USER_TAB_COLUMNS ORDER BY TABLE_NAME, COLUMN_ID";
const PK_SQL =
  "SELECT c.TABLE_NAME, cc.COLUMN_NAME, cc.POSITION FROM USER_CONSTRAINTS c " +
  "JOIN USER_CONS_COLUMNS cc ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME AND c.TABLE_NAME = cc.TABLE_NAME " +
  "WHERE c.CONSTRAINT_TYPE = 'P' ORDER BY c.TABLE_NAME, cc.POSITION";
// Referenced by foreign keys — a FK can point at either a primary key or a unique constraint.
const UNIQUE_SQL =
  "SELECT c.CONSTRAINT_NAME, c.TABLE_NAME, cc.COLUMN_NAME, cc.POSITION FROM USER_CONSTRAINTS c " +
  "JOIN USER_CONS_COLUMNS cc ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME AND c.TABLE_NAME = cc.TABLE_NAME " +
  "WHERE c.CONSTRAINT_TYPE IN ('P','U')";
const FK_SQL =
  "SELECT c.TABLE_NAME, c.CONSTRAINT_NAME, cc.COLUMN_NAME, cc.POSITION, c.R_CONSTRAINT_NAME FROM USER_CONSTRAINTS c " +
  "JOIN USER_CONS_COLUMNS cc ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME AND c.TABLE_NAME = cc.TABLE_NAME " +
  "WHERE c.CONSTRAINT_TYPE = 'R' ORDER BY c.TABLE_NAME, cc.POSITION";
const CHECK_SQL =
  "SELECT TABLE_NAME, CONSTRAINT_NAME, SEARCH_CONDITION FROM USER_CONSTRAINTS " +
  "WHERE CONSTRAINT_TYPE = 'C' AND SEARCH_CONDITION IS NOT NULL";

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Crawls a connected Oracle schema (the tables/views owned by the connected
 * user) into a NormalizedSchema, reporting progress as each table/view is
 * assembled. `exec` is injected so this logic is testable against fixture
 * rows without a live database.
 */
export async function introspectOracleSchema(
  exec: OracleExecutor,
  onProgress: (event: IntrospectionProgressEvent) => void,
): Promise<NormalizedSchema> {
  const [tableRows, viewRows, columnRows, pkRows, uniqueRows, fkRows, checkRows] = await Promise.all([
    exec(TABLES_SQL),
    exec(VIEWS_SQL),
    exec(COLUMNS_SQL),
    exec(PK_SQL),
    exec(UNIQUE_SQL),
    exec(FK_SQL),
    exec(CHECK_SQL),
  ]);

  const columnsByTable = groupBy(columnRows, (r) => str(r.TABLE_NAME));
  const pkByTable = groupBy(pkRows, (r) => str(r.TABLE_NAME));
  const fkByTable = groupBy(fkRows, (r) => str(r.TABLE_NAME));

  // constraint name -> { table, columns[] } for resolving what an FK points at
  const uniqueByConstraint = new Map<string, { table: string; columns: string[] }>();
  for (const [constraintName, rows] of groupBy(uniqueRows, (r) => str(r.CONSTRAINT_NAME))) {
    const sorted = [...rows].sort((a, b) => (num(a.POSITION) ?? 0) - (num(b.POSITION) ?? 0));
    uniqueByConstraint.set(constraintName, { table: str(sorted[0]?.TABLE_NAME), columns: sorted.map((r) => str(r.COLUMN_NAME)) });
  }

  const objectNames: { name: string; objectType: "TABLE" | "VIEW" }[] = [
    ...tableRows.map((r) => ({ name: str(r.TABLE_NAME), objectType: "TABLE" as const })),
    ...viewRows.map((r) => ({ name: str(r.VIEW_NAME), objectType: "VIEW" as const })),
  ];

  const tables: TableDef[] = [];
  for (const obj of objectNames) {
    const cols = (columnsByTable.get(obj.name) ?? []).map((r) => ({
      name: str(r.COLUMN_NAME),
      dataType: str(r.DATA_TYPE),
      nullable: str(r.NULLABLE) !== "N",
    }));

    const primaryKey = (pkByTable.get(obj.name) ?? [])
      .sort((a, b) => (num(a.POSITION) ?? 0) - (num(b.POSITION) ?? 0))
      .map((r) => str(r.COLUMN_NAME));

    const fkRowsForTable = fkByTable.get(obj.name) ?? [];
    const fkByConstraint = groupBy(fkRowsForTable, (r) => str(r.CONSTRAINT_NAME));
    const foreignKeys: ForeignKeyDef[] = [];
    for (const [constraintName, rows] of fkByConstraint) {
      const sorted = [...rows].sort((a, b) => (num(a.POSITION) ?? 0) - (num(b.POSITION) ?? 0));
      const target = uniqueByConstraint.get(str(sorted[0]?.R_CONSTRAINT_NAME));
      if (!target) continue;
      foreignKeys.push({
        constraintName,
        columns: sorted.map((r) => str(r.COLUMN_NAME)),
        refTable: target.table,
        refColumns: target.columns,
      });
    }

    const tableRow = tableRows.find((r) => str(r.TABLE_NAME) === obj.name);

    const table: TableDef = {
      name: obj.name,
      objectType: obj.objectType,
      columns: cols,
      primaryKey,
      foreignKeys,
      rowEstimate: obj.objectType === "TABLE" ? num(tableRow?.NUM_ROWS) : null,
    };
    tables.push(table);
    onProgress({ type: "table_found", table: { name: table.name, objectType: table.objectType } });
  }

  const checkConstraints: CheckConstraintDef[] = checkRows.map((r) => ({
    tableName: str(r.TABLE_NAME),
    constraintName: str(r.CONSTRAINT_NAME),
    searchCondition: str(r.SEARCH_CONDITION),
  }));

  return { tables, checkConstraints };
}
