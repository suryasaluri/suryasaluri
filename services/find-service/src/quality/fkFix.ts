import type { UnconstrainedReference } from "./dataQuality";

// Oracle identifier rules: starts with a letter, then letters/digits/_/$/#,
// max 30 bytes (safe across pre-12.2 and later Oracle alike). Every
// identifier interpolated into DDL here is checked against this AND must
// come from the freshly-loaded schema (never a raw client string) — the
// same "never trust a draft directly" rule reports/spec.ts uses for SQL.
const ORACLE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_$#]{0,29}$/;

export function isSafeOracleIdentifier(name: string): boolean {
  return ORACLE_IDENTIFIER.test(name);
}

/** Deterministic, collision-resistant-enough constraint name, truncated to Oracle's identifier length. */
export function buildForeignKeyConstraintName(table: string, column: string): string {
  const raw = `FK_${table}_${column}`;
  return raw.length <= 30 ? raw : raw.slice(0, 30);
}

export type FixableReference = UnconstrainedReference & { likelyTargetColumn: string };

/** A ref is fixable only when every identifier involved is schema-safe and a single-column target was inferred — never guess a composite target. */
export function isFixableReference(ref: UnconstrainedReference): ref is FixableReference {
  if (!ref.likelyTargetColumn) return false;
  return [ref.table, ref.column, ref.likelyTargetTable, ref.likelyTargetColumn].every(isSafeOracleIdentifier);
}

/** Read-only — counts rows that would violate the constraint (a non-null value with no matching parent row). 0 means safe to add. */
export function buildForeignKeySafetyCheckSql(ref: FixableReference): string {
  return (
    `SELECT COUNT(*) AS VIOLATING_ROWS FROM ${ref.table} t ` +
    `WHERE t.${ref.column} IS NOT NULL ` +
    `AND NOT EXISTS (SELECT 1 FROM ${ref.likelyTargetTable} r WHERE r.${ref.likelyTargetColumn} = t.${ref.column})`
  );
}

/** The actual fix — adds the constraint Oracle itself validates on creation, so this only ever succeeds if the data really is clean. */
export function buildForeignKeyFixSql(ref: FixableReference): { sql: string; constraintName: string } {
  const constraintName = buildForeignKeyConstraintName(ref.table, ref.column);
  const sql = `ALTER TABLE ${ref.table} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${ref.column}) REFERENCES ${ref.likelyTargetTable}(${ref.likelyTargetColumn})`;
  return { sql, constraintName };
}
