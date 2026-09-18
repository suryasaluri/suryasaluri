import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedSchema } from "../schema/types";
import type { StatusFieldCandidate } from "../schema/statusFields";

export type DomainClassification = {
  domain: string;
  confidence: number;
  rationale: string;
  tableDomains: Record<string, string>;
  signals: { tables: string[]; columns: string[]; values: string[] };
};

function schemaMap(schema: NormalizedSchema): string {
  return schema.tables
    .map((t) => {
      const cols = t.columns.map((c) => `${c.name} ${c.dataType.toLowerCase()}`).join(", ");
      return `Table: ${t.name} (${t.columns.length} cols: ${cols})`;
    })
    .join("\n");
}

function statusSignal(statusFields: StatusFieldCandidate[]): string {
  if (!statusFields.length) return "none detected";
  return statusFields
    .map((s) => `${s.table}.${s.column}${s.candidateValues ? ` = ${s.candidateValues.join("/")}` : ""}`)
    .join("; ");
}

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: "classify_domain",
  description: "Report the inferred business domain of a relational schema, tagged per table.",
  input_schema: {
    type: "object",
    properties: {
      domain: { type: "string", description: "snake_case domain label, e.g. real_estate" },
      confidence: { type: "number", description: "0 to 1" },
      rationale: { type: "string" },
      tableDomains: {
        type: "object",
        description: "table name -> tag, e.g. 'real_estate:core' or 'system'",
        additionalProperties: { type: "string" },
      },
      signals: {
        type: "object",
        properties: {
          tables: { type: "array", items: { type: "string" } },
          columns: { type: "array", items: { type: "string" } },
          values: { type: "array", items: { type: "string" } },
        },
        required: ["tables", "columns", "values"],
      },
    },
    required: ["domain", "confidence", "rationale", "tableDomains", "signals"],
  },
};

/**
 * AI domain classification over a crawled schema. Tags each table rather
 * than forcing one global label — a schema mixes a core domain with
 * generic system tables (audit_log, sessions), and callers (report
 * suggestion in particular) need that distinction, not just a headline.
 * Returns null (not an error) without ANTHROPIC_API_KEY, same convention
 * as generateFunctionalNarrative.
 */
export async function classifyDomain(
  schema: NormalizedSchema,
  statusFields: StatusFieldCandidate[],
): Promise<DomainClassification | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!schema.tables.length) return null;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: "tool", name: "classify_domain" },
    messages: [
      {
        role: "user",
        content:
          "Classify the business domain of this database schema from its table/column names and detected status fields. " +
          "Tag each table individually — a schema can mix a core domain with generic system tables (audit_log, sessions, users). " +
          "Do not force every table into the primary domain; tag non-domain tables as \"system\".\n\n" +
          `SCHEMA:\n${schemaMap(schema)}\n\nSTATUS / ENUM FIELDS:\n${statusSignal(statusFields)}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "classify_domain",
  );
  if (!toolUse) return null;

  const input = toolUse.input as DomainClassification;
  if (!input?.domain) return null;
  return {
    domain: input.domain,
    confidence: typeof input.confidence === "number" ? input.confidence : 0,
    rationale: input.rationale ?? "",
    tableDomains: input.tableDomains ?? {},
    signals: {
      tables: input.signals?.tables ?? [],
      columns: input.signals?.columns ?? [],
      values: input.signals?.values ?? [],
    },
  };
}
