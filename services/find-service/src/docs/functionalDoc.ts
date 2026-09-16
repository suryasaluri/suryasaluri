import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedSchema } from "../schema/types";
import type { StatusFieldCandidate } from "../schema/statusFields";

function summarizeSchema(schema: NormalizedSchema): string {
  return schema.tables
    .map((t) => {
      const fks = t.foreignKeys.map((f) => `${f.columns.join(",")} → ${f.refTable}(${f.refColumns.join(",")})`).join("; ");
      return `${t.name} (${t.objectType}): columns [${t.columns.map((c) => c.name).join(", ")}]${fks ? `; foreign keys: ${fks}` : ""}`;
    })
    .join("\n");
}

function summarizeStatusFields(statusFields: StatusFieldCandidate[]): string {
  if (!statusFields.length) return "none detected";
  return statusFields.map((s) => `${s.table}.${s.column}${s.candidateValues ? ` = ${s.candidateValues.join(" / ")}` : " (values unconfirmed)"}`).join("\n");
}

/**
 * Business-relationship narrative drafted by Claude from the normalized
 * schema. Returns null (not an error) when ANTHROPIC_API_KEY isn't
 * configured — the technical doc still stands on its own without it.
 */
export async function generateFunctionalNarrative(
  schema: NormalizedSchema,
  statusFields: StatusFieldCandidate[],
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!schema.tables.length) return null;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content:
          "You are documenting a client's database schema for a data integration product. " +
          "Given this schema summary, describe in plain business language: what entities exist, " +
          "how they relate to each other, and what the status/enum fields likely mean operationally. " +
          "Be concise, use Markdown headings and bullet points, and don't repeat raw column lists verbatim.\n\n" +
          `SCHEMA:\n${summarizeSchema(schema)}\n\nSTATUS / ENUM FIELDS:\n${summarizeStatusFields(statusFields)}`,
      },
    ],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return text || null;
}
