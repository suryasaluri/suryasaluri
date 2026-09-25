import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedSchema } from "../schema/types";
import type { ReportSpec } from "./types";

function schemaMap(schema: NormalizedSchema): string {
  return schema.tables
    .map((t) => {
      const fks = t.foreignKeys.map((f) => `${f.columns.join(",")} -> ${f.refTable}(${f.refColumns.join(",")})`).join("; ");
      return `Table: ${t.name} (columns: ${t.columns.map((c) => `${c.name} ${c.dataType.toLowerCase()}`).join(", ")})${fks ? ` [FKs: ${fks}]` : ""}`;
    })
    .join("\n");
}

const PARSE_TOOL: Anthropic.Tool = {
  name: "draft_report_spec",
  description: "Draft a report specification from a natural-language request, referencing only tables/columns visible in the schema map.",
  input_schema: {
    type: "object",
    properties: {
      baseTable: { type: "string" },
      joinTable: { type: "string" },
      groupBy: { type: "string", description: "table.column" },
      aggregation: { type: "string", enum: ["count", "avg", "sum"] },
      aggregationColumn: { type: "string", description: "table.column, required for avg/sum" },
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            column: { type: "string", description: "table.column" },
            op: { type: "string", enum: ["=", ">=", "<="] },
            value: { type: "string" },
          },
          required: ["column", "op", "value"],
        },
      },
    },
    required: ["baseTable", "groupBy", "aggregation", "filters"],
  },
};

export type ParseNaturalLanguageReportResult = { spec: ReportSpec; message: Anthropic.Message };

/**
 * Drafts a ReportSpec from free text via Claude's structured tool-use
 * output. This draft is NEVER trusted directly — every field still goes
 * through validateSpec (spec.ts) against the real schema before any SQL is
 * built, exactly like a suggested template's spec. Returns null (not an
 * error) without ANTHROPIC_API_KEY. Returns the raw message alongside the
 * spec so the caller can record its token usage/cost.
 */
export async function parseNaturalLanguageReport(
  text: string,
  schema: NormalizedSchema,
  maxTokens: number,
): Promise<ParseNaturalLanguageReportResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: maxTokens,
    tools: [PARSE_TOOL],
    tool_choice: { type: "tool", name: "draft_report_spec" },
    messages: [
      {
        role: "user",
        content:
          "Draft a report spec for this request, using only tables and columns that actually appear in the schema map below. " +
          "If the request implies a filter value like a relative date range, express it as a literal value you compute now " +
          "(e.g. an ISO date), not a formula.\n\n" +
          `SCHEMA:\n${schemaMap(schema)}\n\nREQUEST: ${text}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "draft_report_spec",
  );
  if (!toolUse) return null;

  const input = toolUse.input as Partial<ReportSpec>;
  if (!input.baseTable || !input.groupBy || !input.aggregation) return null;

  return {
    spec: {
      baseTable: input.baseTable,
      joinTable: input.joinTable,
      groupBy: input.groupBy,
      aggregation: input.aggregation,
      aggregationColumn: input.aggregationColumn,
      filters: input.filters ?? [],
      maxRows: 0, // clamped server-side before use, never trusted from a draft
    },
    message,
  };
}
