import { deriveRelationships, type NormalizedSchema } from "../schema/types";
import type { StatusFieldCandidate } from "../schema/statusFields";
import { classifyColumnSensitivity } from "../sensitivity";

/** Deterministic Markdown from the normalized schema — no external dependency, always available. */
export function renderTechnicalMarkdown(schema: NormalizedSchema, statusFields: StatusFieldCandidate[]): string {
  const lines: string[] = [];
  lines.push("# Technical schema documentation", "");
  lines.push(`_${schema.tables.length} object${schema.tables.length === 1 ? "" : "s"} introspected._`, "");

  for (const t of schema.tables) {
    lines.push(`## ${t.name} (${t.objectType})`);
    if (t.rowEstimate != null) lines.push(`Estimated rows: ${t.rowEstimate.toLocaleString()}`, "");
    lines.push("| Column | Type | Nullable | Key | Sensitivity |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const c of t.columns) {
      const isPk = t.primaryKey.includes(c.name);
      const fk = t.foreignKeys.find((f) => f.columns.includes(c.name));
      const key = isPk ? "PK" : fk ? `FK → ${fk.refTable}` : "";
      const sensitivity = classifyColumnSensitivity(c.name).join(", ");
      lines.push(`| ${c.name} | ${c.dataType} | ${c.nullable ? "yes" : "no"} | ${key} | ${sensitivity} |`);
    }
    lines.push("");
  }

  const relationships = deriveRelationships(schema);
  if (relationships.length) {
    lines.push("## Relationships", "");
    for (const r of relationships) {
      lines.push(`- \`${r.fromTable}(${r.fromColumns.join(", ")})\` → \`${r.toTable}(${r.toColumns.join(", ")})\` (${r.constraintName})`);
    }
    lines.push("");
  }

  if (statusFields.length) {
    lines.push("## Status / enum fields", "");
    for (const s of statusFields) {
      const values = s.candidateValues ? s.candidateValues.map((v) => `\`${v}\``).join(", ") : "flagged by name — values unconfirmed";
      lines.push(`- \`${s.table}.${s.column}\`: ${values}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
