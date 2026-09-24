import jsPDF from "jspdf";

/** Plain Markdown/text file download via an in-memory blob — used for documentation, glossary, and report exports. */
export function downloadTextFile(filename: string, content: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Paginated plain-text PDF rendering of a Markdown document — strips syntax markers rather than fully formatting, since the deliverable is the content (technical/functional documentation, glossary), not typeset styling. */
export function downloadMarkdownAsPdf(filename: string, title: string, markdown: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const maxWidth = pageW - margin * 2;
  let y = margin;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(title, margin, y);
  y += 26;

  for (const rawLine of markdown.split("\n")) {
    const isHeading = /^#{1,6}\s/.test(rawLine);
    const line = rawLine.replace(/^#{1,6}\s*/, "").replace(/[*`_]/g, "").trimEnd();
    pdf.setFont("helvetica", isHeading ? "bold" : "normal");
    pdf.setFontSize(isHeading ? 12 : 10);
    const wrapped = pdf.splitTextToSize(line || " ", maxWidth);
    for (const w of wrapped) {
      if (y > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(w, margin, y);
      y += isHeading ? 18 : 14;
    }
    if (isHeading) y += 4;
  }

  pdf.save(filename);
}

/** Report rows as a downloadable CSV — client-side, no backend round-trip. */
export function downloadReportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.join(","), ...rows.map((r) => columns.map((c) => escape(r[c])).join(","))].join("\n");
  downloadTextFile(filename, csv, "text/csv");
}

/** A report's rows + SQL as a Markdown table, reused by both the PDF and (for a quick copy/paste) Markdown export. */
function reportMarkdown(sql: string, rows: Record<string, unknown>[]): string {
  const lines: string[] = [];
  if (rows.length) {
    const columns = Object.keys(rows[0]);
    lines.push(`| ${columns.join(" | ")} |`, `| ${columns.map(() => "---").join(" | ")} |`);
    for (const r of rows) lines.push(`| ${columns.map((c) => String(r[c] ?? "")).join(" | ")} |`);
  } else {
    lines.push("_No rows returned._");
  }
  lines.push("", "## SQL", "", "```sql", sql, "```");
  return lines.join("\n");
}

/** A report result as a PDF — reuses the same paginated Markdown-to-PDF renderer the technical documentation export uses, just fed a results table instead of a doc. */
export function downloadReportPdf(filename: string, title: string, sql: string, rows: Record<string, unknown>[]) {
  downloadMarkdownAsPdf(filename, title, reportMarkdown(sql, rows));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A report result as a Word-openable .doc — an HTML document served with the application/msword type, the standard lightweight way to hand Word a file without a docx-building library. */
export function downloadReportDoc(filename: string, title: string, sql: string, rows: Record<string, unknown>[]) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const th = (s: string) => `<th style="border:1px solid #ccc;padding:4px 8px;background:#f2f2f2;text-align:left;font-family:Calibri,sans-serif;font-size:11pt">${escapeHtml(s)}</th>`;
  const td = (s: string) => `<td style="border:1px solid #ccc;padding:4px 8px;font-family:Calibri,sans-serif;font-size:11pt">${escapeHtml(s)}</td>`;
  const headerRow = `<tr>${columns.map(th).join("")}</tr>`;
  const dataRows = rows.map((r) => `<tr>${columns.map((c) => td(String(r[c] ?? ""))).join("")}</tr>`).join("");
  const table = rows.length
    ? `<table style="border-collapse:collapse">${headerRow}${dataRows}</table>`
    : `<p style="font-family:Calibri,sans-serif">No rows returned.</p>`;
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body>
<h1 style="font-family:Calibri,sans-serif;font-size:18pt">${escapeHtml(title)}</h1>
${table}
<h3 style="font-family:Calibri,sans-serif;font-size:12pt">SQL</h3>
<pre style="font-family:Consolas,monospace;font-size:9pt;white-space:pre-wrap">${escapeHtml(sql)}</pre>
</body></html>`;
  downloadTextFile(filename, html, "application/msword");
}
