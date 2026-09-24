import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../src/connectors/file/csv";
import { parseXlsx } from "../src/connectors/file/xlsx";
import { tablesFromUpload, fileIntrospectSchema } from "../src/connectors/file/introspect";
import { fileConnector } from "../src/connectors/file";
import { detectUnconstrainedReferences } from "../src/quality/dataQuality";
import { renderTechnicalMarkdown } from "../src/docs/technicalDoc";

// These fixtures are real files: a trimmed extract of an Oracle Fusion sales
// export (FPI_STA_SALES) and the actual multi-sheet vendor-config workbook
// (CONFIG_Vendors), both supplied to test the file-upload connector against
// something other than a hand-built fixture.
const CSV_PATH = join(import.meta.dir, "fixtures/FPI_STA_SALES_sample.csv");
const XLSX_PATH = join(import.meta.dir, "fixtures/CONFIG_Vendors.xlsx");

describe("parseCsv", () => {
  const text = readFileSync(CSV_PATH, "utf-8");
  const table = parseCsv(text);

  test("reads the real 113-column header", () => {
    expect(table.headers.length).toBe(113);
    expect(table.headers[0]).toBe("SALES_ID");
    expect(table.headers).toContain("CUSTOMER_ID");
    expect(table.headers).toContain("GL_COA_SEG_01");
  });

  test("correctly splits a quoted field containing an embedded comma", () => {
    // SPECIFIC_BATCH_TYPES in this export holds a literal "REV,ACC" value —
    // a naive text.split(",") would shatter this into two columns and shift
    // every field after it.
    const idx = table.headers.indexOf("SPECIFIC_BATCH_TYPES");
    expect(idx).toBeGreaterThan(-1);
    expect(table.rows.some((r) => r[idx] === "REV,ACC")).toBe(true);
  });

  test("row count matches the real data rows in the fixture", () => {
    // 120 lines in the fixture file minus 1 header row.
    expect(table.rows.length).toBe(119);
  });
});

describe("parseXlsx", () => {
  const buffer = readFileSync(XLSX_PATH);
  const { sheets } = parseXlsx(buffer);
  const names = sheets.map((s) => s.name);

  test("skips the non-tabular Read Me cover sheet", () => {
    expect(names).not.toContain("Read Me");
  });

  test("keeps every real vendor-config sheet", () => {
    expect(names).toEqual(["EBooks", "WebSales", "UK-AUD", "A&M", "HBG", "HBG-No Discount Override", "Ingram"]);
  });

  test("EBooks sheet has its real header row and row count", () => {
    const ebooks = sheets.find((s) => s.name === "EBooks")!;
    expect(ebooks.table.headers).toContain("VENDOR");
    expect(ebooks.table.headers).toContain("ROYALTY_GROUPING");
    // 65 max_row - 1 header row = 64 candidate rows, but 8 of those are
    // genuinely blank in the real workbook (verified with openpyxl) and
    // correctly dropped rather than kept as empty rows.
    expect(ebooks.table.rows.length).toBe(56);
  });

  test("HBG-No Discount Override sheet keeps every real non-blank row", () => {
    const sheet = sheets.find((s) => s.name === "HBG-No Discount Override")!;
    // 1273 max_row - 1 header row = 1272 candidate rows; 252 are blank in
    // the real workbook (verified with openpyxl) and correctly dropped.
    expect(sheet.table.rows.length).toBe(1020);
  });
});

describe("tablesFromUpload", () => {
  test("CSV upload becomes one table named after the file, columns sanitized and typed", () => {
    const content = readFileSync(CSV_PATH, "utf-8");
    const tables = tablesFromUpload("FPI_STA_SALES_01312026145612.csv", content);
    expect(tables.length).toBe(1);
    const t = tables[0];
    expect(t.name).toBe("FPI_STA_SALES_01312026145612");
    expect(t.columns.length).toBe(113);

    const grossUnits = t.columns.find((c) => c.name === "GROSS_UNITS");
    expect(grossUnits?.dataType).toBe("NUMBER");
    const invoiceDate = t.columns.find((c) => c.name === "INVOICE_DATE");
    expect(invoiceDate?.dataType).toBe("DATE");
    const productTitle = t.columns.find((c) => c.name === "PRODUCT_TITLE");
    expect(productTitle?.dataType).toBe("VARCHAR2");
  });

  test("XLSX upload becomes one table per real sheet, sheet names sanitized to identifiers", () => {
    const b64 = readFileSync(XLSX_PATH).toString("base64");
    const tables = tablesFromUpload("CONFIG_Vendors.xlsx", b64);
    const names = tables.map((t) => t.name);
    expect(names).toContain("EBOOKS");
    expect(names).toContain("UK_AUD"); // "UK-AUD" sanitized
    expect(names).toContain("A_M"); // "A&M" sanitized
    expect(names).toContain("HBG_NO_DISCOUNT_OVERRIDE");
  });

  test("a data: URI (as the browser's FileReader.readAsDataURL produces) parses identically to raw base64", () => {
    const raw = readFileSync(XLSX_PATH).toString("base64");
    const dataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${raw}`;
    const tables = tablesFromUpload("CONFIG_Vendors.xlsx", dataUri);
    expect(tables.map((t) => t.name)).toEqual(tablesFromUpload("CONFIG_Vendors.xlsx", raw).map((t) => t.name));
  });
});

describe("fileIntrospectSchema", () => {
  test("combines both real files into one schema, emitting table_found per table", () => {
    const csv = readFileSync(CSV_PATH, "utf-8");
    const xlsxB64 = readFileSync(XLSX_PATH).toString("base64");
    const found: string[] = [];
    const schema = fileIntrospectSchema(
      { file1Name: "FPI_STA_SALES_01312026145612.csv", file1: csv, file2Name: "CONFIG_Vendors.xlsx", file2: xlsxB64 },
      (e) => found.push(e.table.name),
    );
    expect(schema.tables.length).toBe(1 + 7); // the sales table + 7 real vendor sheets
    expect(found.length).toBe(schema.tables.length);
    expect(found).toContain("FPI_STA_SALES_01312026145612");
    expect(found).toContain("EBOOKS");
  });
});

describe("the file connector against the real pipeline (unconstrained refs, technical doc)", () => {
  const csv = readFileSync(CSV_PATH, "utf-8");
  const xlsxB64 = readFileSync(XLSX_PATH).toString("base64");
  const schema = fileIntrospectSchema(
    { file1Name: "FPI_STA_SALES_01312026145612.csv", file1: csv, file2Name: "CONFIG_Vendors.xlsx", file2: xlsxB64 },
    () => {},
  );

  test("runs the same unconstrained-reference heuristic used for a crawled DB schema without throwing", () => {
    const refs = detectUnconstrainedReferences(schema);
    // Honest negative: none of the sales table's *_id columns (CUSTOMER_ID,
    // PRODUCT_PARENT, ORG_ID, ...) match a table name actually present in
    // this upload (there's no CUSTOMERS/PRODUCTS table here, just the
    // vendor-config sheets) — the heuristic correctly finds nothing to flag
    // rather than guessing.
    expect(Array.isArray(refs)).toBe(true);
    expect(refs.length).toBe(0);
  });

  test("renders real technical documentation from the uploaded files without throwing", () => {
    const md = renderTechnicalMarkdown(schema, []);
    expect(md).toContain("## FPI_STA_SALES_01312026145612 (TABLE)");
    expect(md).toContain("## EBOOKS (TABLE)");
    expect(md).toContain("GROSS_UNITS");
  });
});

describe("fileConnector.testConnection", () => {
  test("reports how many tables a real upload would produce", async () => {
    const csv = readFileSync(CSV_PATH, "utf-8");
    const result = await fileConnector.testConnection({ file1Name: "sales.csv", file1: csv });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("1 table");
  });

  test("reports both files when two are supplied", async () => {
    const csv = readFileSync(CSV_PATH, "utf-8");
    const xlsxB64 = readFileSync(XLSX_PATH).toString("base64");
    const result = await fileConnector.testConnection({ file1Name: "sales.csv", file1: csv, file2Name: "vendors.xlsx", file2: xlsxB64 });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("8 tables");
  });

  test("fails cleanly with no file", async () => {
    const result = await fileConnector.testConnection({});
    expect(result.ok).toBe(false);
  });
});
