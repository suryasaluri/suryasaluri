import type { NormalizedSchema } from "./types";

export type StatusFieldCandidate = {
  table: string;
  column: string;
  candidateValues: string[] | null;
  source: "check_constraint" | "name_heuristic";
};

const NAME_HINT = /status|state|flag/i;

/**
 * Extracts a column name and its candidate values out of an Oracle CHECK
 * constraint's SEARCH_CONDITION text, e.g. `STATUS IN ('ACTIVE','SOLD')` or
 * `"STATUS" IN ('A', 'B')`. Returns null when the condition isn't a simple
 * IN-list (arithmetic checks, NOT NULL checks, etc. are left alone).
 */
export function parseCheckConstraintValues(searchCondition: string): { column: string; values: string[] } | null {
  const m = /^\s*"?([A-Za-z0-9_]+)"?\s+IN\s*\(([^)]+)\)/i.exec(searchCondition.trim());
  if (!m) return null;
  const column = m[1];
  const values = m[2]
    .split(",")
    .map((v) => v.trim().replace(/^'(.*)'$/, "$1"))
    .filter(Boolean);
  if (!values.length) return null;
  return { column, values };
}

/**
 * Flags likely status/enum columns: first from CHECK constraints (where we
 * can also recover the candidate values), then by name heuristic for
 * anything a CHECK constraint didn't already catch.
 */
export function detectStatusFields(schema: NormalizedSchema): StatusFieldCandidate[] {
  const out: StatusFieldCandidate[] = [];
  const seen = new Set<string>();

  for (const c of schema.checkConstraints) {
    const parsed = parseCheckConstraintValues(c.searchCondition);
    if (!parsed) continue;
    const key = `${c.tableName}.${parsed.column}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ table: c.tableName, column: parsed.column, candidateValues: parsed.values, source: "check_constraint" });
  }

  for (const t of schema.tables) {
    for (const col of t.columns) {
      const key = `${t.name}.${col.name}`;
      if (seen.has(key)) continue;
      if (NAME_HINT.test(col.name)) {
        seen.add(key);
        out.push({ table: t.name, column: col.name, candidateValues: null, source: "name_heuristic" });
      }
    }
  }

  return out;
}
