import * as XLSX from "xlsx";
import { MAX_ROWS, type ParsedTable } from "./csv";

export type ParsedWorkbook = { sheets: { name: string; table: ParsedTable }[] };

/**
 * Parses every sheet in an uploaded workbook. A sheet whose first row has
 * fewer than 2 non-empty cells is skipped — real vendor/config workbooks
 * routinely carry a "Read Me" or cover sheet that's prose, not a table, and
 * including it as a "table" with one giant text column would be noise, not
 * signal.
 */
export function parseXlsx(buffer: Buffer): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheets: ParsedWorkbook["sheets"] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" });
    if (!rows.length) continue;

    const headerRow = (rows[0] ?? []).map((v) => String(v ?? "").trim());
    const nonEmptyHeaderCount = headerRow.filter((h) => h !== "").length;
    if (nonEmptyHeaderCount < 2) continue;

    const dataRowsRaw = rows.slice(1, MAX_ROWS + 1);
    const dataRows = dataRowsRaw.map((r) => headerRow.map((_, idx) => String(r[idx] ?? "")));
    sheets.push({
      name: sheetName,
      table: { headers: headerRow, rows: dataRows, truncated: rows.length - 1 > MAX_ROWS },
    });
  }

  return { sheets };
}
