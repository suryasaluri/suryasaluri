import type { SchemaConnectorModule, TestResult } from "../types";
import { tablesFromUpload, fileIntrospectSchema } from "./introspect";

async function fileTestConnection(fields: Record<string, string>): Promise<TestResult> {
  if (!fields.file1) return { ok: false, message: "Choose a .csv or .xlsx file first." };
  try {
    const tables = tablesFromUpload(fields.file1Name || "file1", fields.file1);
    if (!tables.length) return { ok: false, message: "No table-shaped sheets found in that file — check it has a header row." };
    const tableCount = tables.length + (fields.file2 ? tablesFromUpload(fields.file2Name || "file2", fields.file2).length : 0);
    return { ok: true, message: `Parsed ${tableCount} table${tableCount === 1 ? "" : "s"}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not parse that file." };
  }
}

async function fileIntrospect(fields: Record<string, string>, onProgress: Parameters<SchemaConnectorModule["introspectSchema"]>[1]) {
  return fileIntrospectSchema(fields, onProgress);
}

export const fileConnector: SchemaConnectorModule = {
  meta: {
    id: "file",
    label: "Upload a file (.csv / .xlsx)",
    category: "File",
    connectorType: "file-upload",
    fields: [
      { key: "file1", label: "File 1 (.csv or .xlsx)", type: "file" },
      { key: "file1Name", label: "File 1 name", type: "text", hidden: true },
      { key: "file2", label: "File 2 (.csv or .xlsx, optional)", type: "file" },
      { key: "file2Name", label: "File 2 name (optional)", type: "text", hidden: true },
    ],
  },
  testConnection: fileTestConnection,
  introspectSchema: fileIntrospect,
};
