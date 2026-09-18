import type { NormalizedSchema, TableDef } from "../schema/types";
import type { ReportSpec, ValidationError } from "./types";

const NUMERIC_TYPE = /^(NUMBER|FLOAT|BINARY_DOUBLE|BINARY_FLOAT)/i;

export const DEFAULT_MAX_ROWS = 500;

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function closestColumnRefs(wanted: string, schema: NormalizedSchema, limit = 3): string[] {
  const all = schema.tables.flatMap((t) => t.columns.map((c) => `${t.name}.${c.name}`));
  return all
    .map((ref) => ({ ref, dist: levenshtein(wanted.toLowerCase(), ref.toLowerCase()) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map((r) => r.ref);
}

function resolveRef(ref: string): { table: string; column: string } | null {
  const dot = ref.indexOf(".");
  if (dot === -1) return null;
  return { table: ref.slice(0, dot), column: ref.slice(dot + 1) };
}

function findTable(schema: NormalizedSchema, name: string): TableDef | undefined {
  return schema.tables.find((t) => t.name === name);
}

/**
 * Mechanical validation against the real schema — the only thing a
 * ReportSpec is trusted on. Every field must resolve to a real table and
 * column; nothing here is inferred, guessed, or partially matched. Runs on
 * both a suggested template's spec and an LLM's NL-parsed draft alike.
 */
export function validateSpec(spec: ReportSpec, schema: NormalizedSchema): ValidationError[] {
  const errors: ValidationError[] = [];
  const base = findTable(schema, spec.baseTable);
  if (!base) {
    errors.push({ field: spec.baseTable, reason: "Table not found.", suggestions: schema.tables.map((t) => t.name).slice(0, 3) });
    return errors; // nothing else is checkable without a valid base table
  }

  let join: TableDef | undefined;
  if (spec.joinTable) {
    join = findTable(schema, spec.joinTable);
    if (!join) {
      errors.push({ field: spec.joinTable, reason: "Table not found.", suggestions: schema.tables.map((t) => t.name).slice(0, 3) });
    } else {
      const hasFk = base.foreignKeys.some((fk) => fk.refTable === spec.joinTable);
      if (!hasFk) errors.push({ field: `${spec.baseTable}->${spec.joinTable}`, reason: "No foreign key connects these tables.", suggestions: base.foreignKeys.map((fk) => fk.refTable) });
    }
  }

  const tablesInScope = [base, join].filter((t): t is TableDef => !!t);

  function checkRef(ref: string, label: string) {
    const parsed = resolveRef(ref);
    if (!parsed) {
      errors.push({ field: ref, reason: `${label} must be in "table.column" form.`, suggestions: closestColumnRefs(ref, schema) });
      return;
    }
    const table = tablesInScope.find((t) => t.name === parsed.table);
    if (!table) {
      errors.push({ field: ref, reason: `Table '${parsed.table}' is not in scope for this report (must be the base or joined table).`, suggestions: closestColumnRefs(ref, schema) });
      return;
    }
    const col = table.columns.find((c) => c.name === parsed.column);
    if (!col) {
      errors.push({ field: ref, reason: `Column not found on table '${parsed.table}'.`, suggestions: closestColumnRefs(ref, schema) });
    }
    return col;
  }

  checkRef(spec.groupBy, "groupBy");

  if (spec.aggregation !== "count") {
    if (!spec.aggregationColumn) {
      errors.push({ field: "aggregationColumn", reason: `Aggregation '${spec.aggregation}' requires a column.`, suggestions: [] });
    } else {
      const col = checkRef(spec.aggregationColumn, "aggregationColumn");
      const parsed = resolveRef(spec.aggregationColumn);
      if (col && parsed && !NUMERIC_TYPE.test(col.dataType)) {
        errors.push({ field: spec.aggregationColumn, reason: `Column '${parsed.column}' is not numeric (${col.dataType}) — cannot ${spec.aggregation} it.`, suggestions: [] });
      }
    }
  }

  for (const f of spec.filters) checkRef(f.column, "filter");

  return errors;
}

/**
 * Builds parameterized Oracle SQL from a validated spec. Table and column
 * identifiers come only from `schema` (the same object validateSpec just
 * checked the spec against) — never from string interpolation of anything
 * the client or an LLM supplied. Filter VALUES are bind variables; the row
 * cap is an inlined, server-clamped integer (never a value a caller
 * controls), which is why it's safe to inline rather than bind. Only call
 * this after validateSpec returns no errors.
 */
export function buildOracleSql(spec: ReportSpec, schema: NormalizedSchema, maxRows: number): { sql: string; binds: Record<string, unknown> } {
  const groupRef = resolveRef(spec.groupBy)!;
  const groupExpr = `${groupRef.table}.${groupRef.column}`;

  let aggExpr: string;
  if (spec.aggregation === "count") {
    aggExpr = "COUNT(*)";
  } else {
    const aggRef = resolveRef(spec.aggregationColumn!)!;
    aggExpr = `${spec.aggregation.toUpperCase()}(${aggRef.table}.${aggRef.column})`;
  }

  let sql = `SELECT ${groupExpr} AS group_value, ${aggExpr} AS agg_value\nFROM ${spec.baseTable}`;

  if (spec.joinTable) {
    const base = findTable(schema, spec.baseTable)!;
    const fk = base.foreignKeys.find((f) => f.refTable === spec.joinTable)!;
    const on = fk.columns.map((c, i) => `${spec.baseTable}.${c} = ${spec.joinTable}.${fk.refColumns[i]}`).join(" AND ");
    sql += ` JOIN ${spec.joinTable} ON ${on}`;
  }

  const binds: Record<string, unknown> = {};
  const whereClauses: string[] = [];
  spec.filters.forEach((f, i) => {
    const ref = resolveRef(f.column)!;
    const bindName = `p${i}`;
    whereClauses.push(`${ref.table}.${ref.column} ${f.op} :${bindName}`);
    binds[bindName] = f.value;
  });
  if (whereClauses.length) sql += `\nWHERE ${whereClauses.join(" AND ")}`;

  sql += `\nGROUP BY ${groupExpr}\nORDER BY agg_value DESC\nFETCH FIRST ${maxRows} ROWS ONLY`;

  return { sql, binds };
}
