/** Hard cap on rows parsed from a single uploaded file — this connector is for trying Nexus against a real export before wiring up a live database, not for ingesting arbitrarily large files. */
export const MAX_ROWS = 5000;

export type ParsedTable = { headers: string[]; rows: string[][]; truncated: boolean };

/**
 * A small RFC4180-ish CSV parser — handles quoted fields, embedded commas,
 * embedded newlines inside quotes, and "" as an escaped quote. Written by
 * hand rather than pulled in as a dependency: the format is small and
 * well-understood, and real exports (e.g. an Oracle Fusion sales extract)
 * reliably contain quoted fields with embedded commas that a naive
 * text.split(",") would silently corrupt.
 */
export function parseCsv(text: string): ParsedTable {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  function pushField() {
    row.push(field);
    field = "";
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < n && rows.length <= MAX_ROWS) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  const truncated = i < n;
  const nonEmptyRows = rows.filter((r) => r.some((v) => v.trim() !== ""));
  const [headers, ...dataRows] = nonEmptyRows;
  return { headers: headers ?? [], rows: dataRows, truncated };
}
