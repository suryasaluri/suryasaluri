import type { NormalizedSchema, TableDef, ColumnDef } from "../schema/types";
import type { StatusFieldCandidate } from "../schema/statusFields";
import type { ReportTemplate, ReportFilter } from "./types";

const STRING_TYPE = /^(VARCHAR2|CHAR|NVARCHAR2|NCHAR)/i;
const NUMERIC_TYPE = /^(NUMBER|FLOAT|BINARY_DOUBLE|BINARY_FLOAT)/i;
const DATE_TYPE = /^(DATE|TIMESTAMP)/i;
const LOW_VALUE_HINT = /email|phone|address|name$|ssn|url|description|notes/i;

function isKeyColumn(table: TableDef, col: ColumnDef): boolean {
  if (table.primaryKey.includes(col.name)) return true;
  return table.foreignKeys.some((fk) => fk.columns.includes(col.name));
}

/**
 * A human-readable "label" for a joined table — e.g. AGENTS.NAME when
 * grouping PROPERTIES by agent. Deliberately doesn't apply the
 * high-cardinality/PII exclusion groupableStringColumns uses for a table's
 * *own* group-by candidates: a referenced table's own name/title column is
 * exactly what a join wants to display, not noise to filter out.
 */
function labelColumn(table: TableDef): ColumnDef | undefined {
  const candidates = table.columns.filter((c) => STRING_TYPE.test(c.dataType) && !isKeyColumn(table, c));
  return candidates.find((c) => /name|title|label/i.test(c.name)) ?? candidates[0];
}

function groupableStringColumns(table: TableDef, limit: number): ColumnDef[] {
  return table.columns
    .filter((c) => STRING_TYPE.test(c.dataType) && !isKeyColumn(table, c) && !LOW_VALUE_HINT.test(c.name))
    .slice(0, limit);
}

function aggregatableNumericColumns(table: TableDef, limit: number): ColumnDef[] {
  return table.columns
    .filter((c) => NUMERIC_TYPE.test(c.dataType) && !isKeyColumn(table, c) && !/_id$/i.test(c.name) && c.name.toLowerCase() !== "id")
    .slice(0, limit);
}

function dateColumn(table: TableDef): ColumnDef | undefined {
  return table.columns.find((c) => DATE_TYPE.test(c.dataType));
}

function statusFilterFor(table: TableDef, statusFields: StatusFieldCandidate[]): ReportFilter[] {
  const filters: ReportFilter[] = [];
  const status = statusFields.find((s) => s.table === table.name);
  if (status) filters.push({ name: status.column.toLowerCase(), column: `${table.name}.${status.column}`, type: "categorical" });
  const date = dateColumn(table);
  if (date) filters.push({ name: date.name.toLowerCase(), column: `${table.name}.${date.name}`, type: "date_range" });
  return filters;
}

function slug(...parts: string[]): string {
  return parts.join("_").toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

/**
 * Heuristics decide the candidate set (magnitude by category, joined
 * aggregate, time-range-filterable) — the LLM, in nlParse.ts, only narrows
 * and names from what's actually in the schema. No AI call here, so
 * suggestions are instant and always available.
 */
export function suggestReports(
  schema: NormalizedSchema,
  statusFields: StatusFieldCandidate[],
  tableDomains?: Record<string, string>,
): ReportTemplate[] {
  const templates: ReportTemplate[] = [];
  const byName = new Map(schema.tables.map((t) => [t.name, t]));

  const candidateTables = schema.tables.filter((t) => {
    if (t.objectType !== "TABLE") return false;
    if (!tableDomains) return true;
    const tag = tableDomains[t.name];
    if (!tag) return true; // unclassified — don't exclude
    return !/system/i.test(tag);
  });

  // Join-based: "T count by <referenced table's label>" — e.g. listings by agent.
  for (const t of candidateTables) {
    for (const fk of t.foreignKeys) {
      const ref = byName.get(fk.refTable);
      if (!ref) continue;
      const label = labelColumn(ref);
      if (!label) continue;
      templates.push({
        id: slug(t.name, "by", fk.refTable),
        name: `${t.name} by ${ref.name}`,
        description: `Count of ${t.name.toLowerCase()} rows, grouped by ${ref.name.toLowerCase()}.`,
        baseTable: t.name,
        joinTable: ref.name,
        groupBy: `${ref.name}.${label.name}`,
        aggregation: "count",
        filters: statusFilterFor(t, statusFields),
      });
      if (templates.length >= 6) return templates;
    }
  }

  // Group-by string column: "T count by <column>" — e.g. properties by city.
  for (const t of candidateTables) {
    for (const col of groupableStringColumns(t, 1)) {
      templates.push({
        id: slug(t.name, "by", col.name),
        name: `${t.name} by ${col.name}`,
        description: `Count of ${t.name.toLowerCase()} rows, grouped by ${col.name.toLowerCase()}.`,
        baseTable: t.name,
        groupBy: `${t.name}.${col.name}`,
        aggregation: "count",
        filters: statusFilterFor(t, statusFields),
      });
      if (templates.length >= 6) return templates;
    }
  }

  // Numeric aggregation paired with a group-by column: "Average <num> by <col>".
  for (const t of candidateTables) {
    const groupCol = groupableStringColumns(t, 1)[0];
    if (!groupCol) continue;
    for (const numCol of aggregatableNumericColumns(t, 1)) {
      templates.push({
        id: slug("avg", numCol.name, "by", groupCol.name),
        name: `Average ${numCol.name} by ${groupCol.name}`,
        description: `Mean ${numCol.name.toLowerCase()} of ${t.name.toLowerCase()} rows, grouped by ${groupCol.name.toLowerCase()}.`,
        baseTable: t.name,
        groupBy: `${t.name}.${groupCol.name}`,
        aggregation: "avg",
        aggregationColumn: `${t.name}.${numCol.name}`,
        filters: statusFilterFor(t, statusFields),
      });
      if (templates.length >= 6) return templates;
    }
  }

  return templates;
}
