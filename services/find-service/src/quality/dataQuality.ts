import type { NormalizedSchema } from "../schema/types";

export type UnconstrainedReference = {
  table: string;
  column: string;
  likelyTargetTable: string;
  /** The target table's own single-column primary key — the obvious REFERENCES target for a recommended FK fix. Null when the target has a composite or missing primary key, meaning the right target column can't be inferred and needs a human to pick it. */
  likelyTargetColumn: string | null;
};

function candidateTargetNames(base: string): string[] {
  const lower = base.toLowerCase();
  const candidates = new Set([lower, `${lower}s`, `${lower}es`]);
  if (lower.endsWith("y")) candidates.add(`${lower.slice(0, -1)}ies`);
  return Array.from(candidates);
}

/**
 * Schema-only heuristic — no AI, no live query, always available. Flags
 * columns that are shaped like a foreign key (name ends in _id, isn't the
 * table's own primary key) and aren't backed by a declared FOREIGN KEY
 * constraint, but where a table matching the implied name actually exists —
 * a real, common failure mode (an unconstrained reference column left behind
 * by a bad delete/import, or one the schema owner never got around to
 * constraining). Only flags where a plausible target table exists, to avoid
 * false positives on join/audit columns that were never meant to reference
 * anything (e.g. external_id).
 */
export function detectUnconstrainedReferences(schema: NormalizedSchema): UnconstrainedReference[] {
  const tableByLowerName = new Map(schema.tables.map((t) => [t.name.toLowerCase(), t.name]));
  const tableByName = new Map(schema.tables.map((t) => [t.name, t]));
  const out: UnconstrainedReference[] = [];

  for (const t of schema.tables) {
    const fkColumns = new Set(t.foreignKeys.flatMap((fk) => fk.columns));
    for (const c of t.columns) {
      if (!/_id$/i.test(c.name)) continue;
      if (t.primaryKey.includes(c.name)) continue;
      if (fkColumns.has(c.name)) continue;

      const base = c.name.replace(/_id$/i, "");
      if (!base) continue;
      const target = candidateTargetNames(base)
        .map((n) => tableByLowerName.get(n))
        .find((n): n is string => !!n && n !== t.name);
      if (!target) continue;

      const targetTable = tableByName.get(target);
      const likelyTargetColumn = targetTable && targetTable.primaryKey.length === 1 ? targetTable.primaryKey[0] : null;
      out.push({ table: t.name, column: c.name, likelyTargetTable: target, likelyTargetColumn });
    }
  }

  return out;
}
