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
