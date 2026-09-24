import type { NormalizedSchema, TableDef, ColumnDef } from "../../schema/types";
import type { IntrospectionProgressEvent } from "../types";
import { parseCsv, type ParsedTable } from "./csv";
import { parseXlsx } from "./xlsx";
import { sanitizeIdentifier, dedupe } from "./identifiers";
import { inferColumnType } from "./typeInference";

function tableFromParsed(tableName: string, table: ParsedTable): TableDef {
  const rawHeaders = table.headers.map((h, i) => (h && h.trim()) || `COLUMN_${i + 1}`);
  const headerNames = dedupe(rawHeaders.map((h) => sanitizeIdentifier(h, "COLUMN")));
  const columns: ColumnDef[] = headerNames.map((name, idx) => {
    const values = table.rows.map((r) => r[idx] ?? "");
    return { name, dataType: inferColumnType(values), nullable: values.some((v) => v.trim() === "") };
  });
  return { name: tableName, objectType: "TABLE", columns, primaryKey: [], foreignKeys: [], rowEstimate: table.rows.length };
}

function decodeDataUri(value: string): Buffer {
  const commaIdx = value.indexOf(",");
  const meta = value.slice(0, commaIdx);
  const data = value.slice(commaIdx + 1);
  return meta.includes(";base64") ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf-8");
}

function isXlsxUpload(fileName: string, content: string): boolean {
  return /\.xlsx?$/i.test(fileName) || content.startsWith("data:application/vnd.openxmlformats") || content.startsWith("data:application/vnd.ms-excel");
}

/**
 * A single uploaded file's tables. CSV becomes one table named after the
 * file; a workbook becomes one table per non-instructional sheet, named
 * after the sheet. `content` is either a raw data: URI (as produced by the
 * browser's FileReader.readAsDataURL) or plain base64/text, so this works
 * the same whether it arrives from the web app or a direct API call.
 */
export function tablesFromUpload(fileName: string, content: string): TableDef[] {
  const stem = fileName.replace(/\.[^.]+$/, "") || "UPLOAD";

  if (isXlsxUpload(fileName, content)) {
    const buffer = content.startsWith("data:") ? decodeDataUri(content) : Buffer.from(content, "base64");
    const { sheets } = parseXlsx(buffer);
    const names = dedupe(sheets.map((s) => sanitizeIdentifier(s.name, "SHEET")));
    return sheets.map((s, i) => tableFromParsed(names[i], s.table));
  }

  const text = content.startsWith("data:") ? decodeDataUri(content).toString("utf-8") : content;
  const table = parseCsv(text);
  return [tableFromParsed(sanitizeIdentifier(stem, "TABLE"), table)];
}

const FILE_FIELD_PAIRS = [
  { nameKey: "file1Name", contentKey: "file1" },
  { nameKey: "file2Name", contentKey: "file2" },
];

/** Combines every non-empty file field into one schema — e.g. a fact-table export plus a config workbook, uploaded together as one "connection". */
export function fileIntrospectSchema(
  fields: Record<string, string>,
  onProgress: (event: IntrospectionProgressEvent) => void,
): NormalizedSchema {
  const tables: TableDef[] = [];
  for (const { nameKey, contentKey } of FILE_FIELD_PAIRS) {
    const content = fields[contentKey];
    if (!content) continue;
    const fileName = fields[nameKey] || contentKey;
    for (const table of tablesFromUpload(fileName, content)) {
      tables.push(table);
      onProgress({ type: "table_found", table: { name: table.name, objectType: table.objectType } });
    }
  }
  return { tables, checkConstraints: [] };
}
