import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedSchema } from "../schema/types";
import type { StatusFieldCandidate } from "../schema/statusFields";
import { filterValidCitations } from "../citations";

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

const NARRATIVE_TOOL: Anthropic.Tool = {
  name: "draft_functional_narrative",
  description:
    "Draft a business-relationship narrative for a database schema, in Markdown, plus a list of every table/column/constraint the narrative actually relies on.",
  input_schema: {
    type: "object",
    properties: {
      narrative: { type: "string", description: "Markdown: what entities exist, how they relate, what status/enum fields likely mean operationally. Concise, headings + bullets, no raw column-list dumps." },
      citations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ref: { type: "string", description: "A table name, 'table.column', or FK constraint name — must appear verbatim in the schema summary given" },
            note: { type: "string", description: "Optional short note on why this is cited" },
          },
          required: ["ref"],
        },
      },
    },
    required: ["narrative", "citations"],
  },
};

/**
 * Business-relationship narrative drafted by Claude from the normalized
 * schema, grounded with citations back to the specific table/column/constraint
 * each part of the narrative relies on — validated against the real schema
 * (a hallucinated ref is dropped, never shown as real) and appended as a
 * "Sources" section, the same way a DeepWiki-style answer links every claim
 * back to something that actually exists rather than asking to be trusted.
 * Returns null (not an error) when ANTHROPIC_API_KEY isn't configured — the
 * technical doc still stands on its own without it.
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
    max_tokens: 1500,
    tools: [NARRATIVE_TOOL],
    tool_choice: { type: "tool", name: "draft_functional_narrative" },
    messages: [
      {
        role: "user",
        content:
          "You are documenting a client's database schema for a data integration product. " +
          "Given this schema summary, describe in plain business language: what entities exist, " +
          "how they relate to each other, and what the status/enum fields likely mean operationally. " +
          "Be concise, use Markdown headings and bullet points, and don't repeat raw column lists verbatim. " +
          "List every table/column/constraint the narrative actually relies on as a citation.\n\n" +
          `SCHEMA:\n${summarizeSchema(schema)}\n\nSTATUS / ENUM FIELDS:\n${summarizeStatusFields(statusFields)}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "draft_functional_narrative",
  );
  if (!toolUse) return null;

  const input = toolUse.input as { narrative?: string; citations?: { ref: string; note?: string }[] };
  if (!input.narrative) return null;

  const citations = filterValidCitations(Array.isArray(input.citations) ? input.citations : [], schema);
  if (!citations.length) return input.narrative;

  const sources = citations.map((c) => `\`${c.ref}\`${c.note ? ` — ${c.note}` : ""}`).join(", ");
  return `${input.narrative}\n\n## Sources\n\n${sources}`;
}
