import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedSchema } from "../schema/types";
import type { StatusFieldCandidate } from "../schema/statusFields";
import type { Glossary } from "../docs/glossary";

function schemaMap(schema: NormalizedSchema): string {
  return schema.tables
    .map((t) => `Table: ${t.name} (columns: ${t.columns.map((c) => c.name).join(", ")})`)
    .join("\n");
}

function glossaryText(glossary: Glossary | null): string {
  if (!glossary || !glossary.terms.length) return "none generated yet";
  return glossary.terms
    .map((t) => `${t.table}.${t.column} = "${t.term}": ${t.definition}${t.isDerived ? ` (derived: ${t.derivationLogic})` : ""}`)
    .join("\n");
}

function statusText(statusFields: StatusFieldCandidate[]): string {
  if (!statusFields.length) return "none detected";
  return statusFields.map((s) => `${s.table}.${s.column}${s.candidateValues ? ` = ${s.candidateValues.join("/")}` : ""}`).join("; ");
}

/**
 * Grounded schema/glossary/documentation Q&A — deliberately separate from
 * the guarded report pipeline (nlParse.ts + spec.ts), which is the only
 * path allowed to draft SQL. This copilot never runs a query or invents a
 * number; it explains structure using only the context it's given, and
 * points the user at the Reports tab for anything that needs a real number
 * pulled from the database. Returns null (not an error) without
 * ANTHROPIC_API_KEY.
 */
export async function answerCopilotQuestion(
  question: string,
  schema: NormalizedSchema,
  statusFields: StatusFieldCandidate[],
  glossary: Glossary | null,
  technicalMarkdown: string | null,
  functionalMarkdown: string | null,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!schema.tables.length) return null;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content:
          "You are Nexus's documentation copilot for this database connection. Answer the question strictly from the context " +
          "below — never claim a table or column exists that isn't listed in the schema map, and never state a specific data " +
          "value (a count, sum, or row) as fact, since you have no live query access. If the question actually asks for a " +
          "number pulled from the data, say so plainly and suggest asking it in the Reports tab instead, where it runs as a " +
          "validated, schema-checked query. Otherwise, answer concisely in Markdown, grounded in the schema/glossary/docs.\n\n" +
          `SCHEMA:\n${schemaMap(schema)}\n\nSTATUS / ENUM FIELDS:\n${statusText(statusFields)}\n\n` +
          `GLOSSARY:\n${glossaryText(glossary)}\n\n` +
          `TECHNICAL DOCUMENTATION:\n${technicalMarkdown ?? "not yet generated"}\n\n` +
          `FUNCTIONAL NARRATIVE:\n${functionalMarkdown ?? "not yet generated"}\n\n` +
          `QUESTION: ${question}`,
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
