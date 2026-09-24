const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
const DATE_RE = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/;

/** Column type guessed from its sampled values — expressed as the same Oracle-style tokens (NUMBER/DATE/VARCHAR2) the rest of the pipeline already pattern-matches on (suggest.ts's STRING_TYPE/NUMERIC_TYPE/DATE_TYPE, technicalDoc.ts), so a file-sourced schema behaves identically downstream to a crawled one. */
export function inferColumnType(values: string[]): string {
  const nonEmpty = values.map((v) => v.trim()).filter((v) => v !== "");
  if (!nonEmpty.length) return "VARCHAR2";
  const sample = nonEmpty.slice(0, 200);
  if (sample.every((v) => NUMERIC_RE.test(v))) return "NUMBER";
  if (sample.every((v) => DATE_RE.test(v))) return "DATE";
  return "VARCHAR2";
}
