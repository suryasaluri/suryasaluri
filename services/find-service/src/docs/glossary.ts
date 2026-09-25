import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedSchema } from "../schema/types";
import type { StatusFieldCandidate } from "../schema/statusFields";

export type GlossaryTerm = {
  table: string;
  column: string;
  term: string;
  definition: string;
  isDerived: boolean;
  derivationLogic: string;
};

export type SynonymGroup = {
  standardizedTerm: string;
  members: string[]; // "table.column"
};

export type Glossary = {
  terms: GlossaryTerm[];
  synonymGroups: SynonymGroup[];
};

function schemaMap(schema: NormalizedSchema): string {
  return schema.tables
    .map((t) => {
      const cols = t.columns.map((c) => `${c.name} ${c.dataType.toLowerCase()}`).join(", ");
      const fks = t.foreignKeys.map((f) => `${f.columns.join(",")} -> ${f.refTable}(${f.refColumns.join(",")})`).join("; ");
      return `Table: ${t.name} (${cols})${fks ? ` [FKs: ${fks}]` : ""}`;
    })
    .join("\n");
}

const GLOSSARY_TOOL: Anthropic.Tool = {
  name: "generate_glossary",
  description:
    "Report a business glossary for a relational schema: one plain-English term/definition per meaningful column, " +
    "flags for columns whose value is computed rather than stored, and groups of columns across different tables " +
    "that represent the same underlying business concept under different names.",
  input_schema: {
    type: "object",
    properties: {
      terms: {
        type: "array",
        description: "One entry per business-meaningful column. Skip pure technical/audit columns (id, created_at, updated_at) unless the name itself carries business meaning.",
        items: {
          type: "object",
          properties: {
            table: { type: "string" },
            column: { type: "string" },
            term: { type: "string", description: "Short Title Case business term, e.g. 'Order Quantity'" },
            definition: { type: "string", description: "One sentence, plain English, no jargon" },
            isDerived: { type: "boolean", description: "true only if this value is normally computed from other columns rather than entered/stored directly" },
            derivationLogic: { type: "string", description: "e.g. 'quantity * unit_price'; empty string when isDerived is false" },
          },
          required: ["table", "column", "term", "definition", "isDerived", "derivationLogic"],
        },
      },
      synonymGroups: {
        type: "array",
        description: "Columns in different tables that mean the same business thing but are named differently (e.g. denormalized/cached fields, abbreviations). Every table.column listed must exist in the schema map. Omit groups with fewer than 2 members.",
        items: {
          type: "object",
          properties: {
            standardizedTerm: { type: "string", description: "The one business term that should be used for all members" },
            members: { type: "array", items: { type: "string", description: "table.column" } },
          },
          required: ["standardizedTerm", "members"],
        },
      },
    },
    required: ["terms", "synonymGroups"],
  },
};

export type GenerateGlossaryResult = { glossary: Glossary; message: Anthropic.Message };

/**
 * AI-generated business glossary — the reconstructed "logic" layer: what a
 * column is for (not just what it's named), which values are derived rather
 * than stored, and which differently-named columns across tables actually
 * mean the same thing. Returns null (not an error) without
 * ANTHROPIC_API_KEY, same convention as classifyDomain / generateFunctionalNarrative.
 * Returns the raw message alongside the parsed glossary so the caller can
 * record its token usage/cost.
 */
export async function generateGlossary(
  schema: NormalizedSchema,
  statusFields: StatusFieldCandidate[],
  maxTokens: number,
): Promise<GenerateGlossaryResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!schema.tables.length) return null;

  const statusText = statusFields.length
    ? statusFields.map((s) => `${s.table}.${s.column}${s.candidateValues ? ` = ${s.candidateValues.join("/")}` : ""}`).join("; ")
    : "none detected";

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: maxTokens,
    tools: [GLOSSARY_TOOL],
    tool_choice: { type: "tool", name: "generate_glossary" },
    messages: [
      {
        role: "user",
        content:
          "Generate a business glossary for this database schema, using only tables and columns that actually appear below. " +
          "For each business-meaningful column: a short term, a one-sentence plain-English definition, and whether it's derived " +
          "(computed from other columns) rather than stored directly. Separately, group columns across different tables that " +
          "represent the same business concept under different names (denormalized/cached fields, abbreviations, naming drift).\n\n" +
          `SCHEMA:\n${schemaMap(schema)}\n\nSTATUS / ENUM FIELDS:\n${statusText}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "generate_glossary",
  );
  if (!toolUse) return null;

  const input = toolUse.input as Partial<Glossary>;
  return {
    glossary: {
      terms: Array.isArray(input.terms) ? input.terms : [],
      synonymGroups: Array.isArray(input.synonymGroups) ? input.synonymGroups.filter((g) => (g.members?.length ?? 0) >= 2) : [],
    },
    message,
  };
}
