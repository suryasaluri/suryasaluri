import type { NormalizedSchema } from "./schema/types";

export type Citation = { ref: string; note?: string };

/** Every ref an AI-generated citation is allowed to point at: a table name, a "table.column" pair, or an FK constraint name — anything else is a hallucinated reference and gets dropped, never shown as if it were grounded. */
export function validCitationRefs(schema: NormalizedSchema): Set<string> {
  const refs = new Set<string>();
  for (const t of schema.tables) {
    refs.add(t.name);
    for (const c of t.columns) refs.add(`${t.name}.${c.name}`);
    for (const fk of t.foreignKeys) refs.add(fk.constraintName);
  }
  return refs;
}

/** Drops any citation whose ref doesn't actually exist in the schema — the same "never trust the draft directly" discipline nlParse.ts applies to a drafted report spec before it's allowed near real SQL. */
export function filterValidCitations(citations: Citation[], schema: NormalizedSchema): Citation[] {
  const valid = validCitationRefs(schema);
  return citations.filter((c) => typeof c.ref === "string" && valid.has(c.ref));
}
