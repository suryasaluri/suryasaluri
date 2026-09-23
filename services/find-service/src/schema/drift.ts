import type { NormalizedSchema } from "./types";

export type TableSummary = { name: string; objectType: "TABLE" | "VIEW"; columnNames: string[] };

export type ChangedTable = { table: string; addedColumns: string[]; removedColumns: string[] };

export type SchemaDrift = {
  addedTables: string[];
  removedTables: string[];
  changedTables: ChangedTable[];
};

/** Captured at the moment a crawl completes and stored on schema_crawls.table_summary, so the next crawl has something to diff against — schema_objects only ever holds the latest state. */
export function buildTableSummary(schema: NormalizedSchema): TableSummary[] {
  return schema.tables.map((t) => ({ name: t.name, objectType: t.objectType, columnNames: t.columns.map((c) => c.name) }));
}

/** Pure diff, no AI, no live query — the "did the logic move under us?" check between two crawls of the same connection. */
export function diffTableSummaries(previous: TableSummary[], current: TableSummary[]): SchemaDrift {
  const prevByName = new Map(previous.map((t) => [t.name, t]));
  const curByName = new Map(current.map((t) => [t.name, t]));

  const addedTables = current.filter((t) => !prevByName.has(t.name)).map((t) => t.name);
  const removedTables = previous.filter((t) => !curByName.has(t.name)).map((t) => t.name);

  const changedTables: ChangedTable[] = [];
  for (const curTable of current) {
    const prevTable = prevByName.get(curTable.name);
    if (!prevTable) continue;
    const prevCols = new Set(prevTable.columnNames);
    const curCols = new Set(curTable.columnNames);
    const addedColumns = curTable.columnNames.filter((c) => !prevCols.has(c));
    const removedColumns = prevTable.columnNames.filter((c) => !curCols.has(c));
    if (addedColumns.length || removedColumns.length) changedTables.push({ table: curTable.name, addedColumns, removedColumns });
  }

  return { addedTables, removedTables, changedTables };
}

export function isDriftEmpty(drift: SchemaDrift): boolean {
  return drift.addedTables.length === 0 && drift.removedTables.length === 0 && drift.changedTables.length === 0;
}
