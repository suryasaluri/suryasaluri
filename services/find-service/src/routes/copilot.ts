import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { loadLatestSchema } from "../schema/loadLatest";
import { answerCopilotQuestion } from "../copilot/ask";
import type { Glossary } from "../docs/glossary";
import { getOrgAiSettings, resolveMaxTokens } from "../ai/maxTokensCap";
import { recordAiUsage } from "../ai/usage";

const askSchema = z.object({ question: z.string().min(1) });

export function registerCopilotRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post<{ Params: { id: string }; Body: unknown }>("/connections/:id/copilot/ask", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const { id } = request.params;
    const parsed = askSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }

    const { schema, statusFields } = await loadLatestSchema(orgId, id);

    const [{ data: glossaryRow }, { data: docRow }] = await Promise.all([
      supabaseAdmin()
        .from("glossary_snapshots")
        .select("terms, synonym_groups")
        .eq("org_id", orgId)
        .eq("data_source_id", id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin()
        .from("documentation_snapshots")
        .select("technical_markdown, functional_markdown")
        .eq("org_id", orgId)
        .eq("data_source_id", id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const glossary: Glossary | null = glossaryRow ? { terms: glossaryRow.terms, synonymGroups: glossaryRow.synonym_groups } : null;

    const orgAiSettings = await getOrgAiSettings(orgId);
    const { maxTokens, capApplied } = resolveMaxTokens("copilot", orgAiSettings);
    const result = await answerCopilotQuestion(
      parsed.data.question,
      schema,
      statusFields,
      glossary,
      docRow?.technical_markdown ?? null,
      docRow?.functional_markdown ?? null,
      maxTokens,
    );

    if (!result) {
      reply.code(200);
      return { unavailable: true, reason: "ANTHROPIC_API_KEY not configured, or no crawled schema yet" };
    }

    await recordAiUsage({ orgId, sessionId, dataSourceId: id, feature: "copilot", message: result.message, maxTokensRequested: maxTokens, capApplied });

    await supabaseAdmin().from("audit_logs").insert({
      org_id: orgId,
      session_id: sessionId ?? null,
      action: "copilot.asked",
      resource_type: "data_source",
      resource_id: id,
      details: { question: parsed.data.question, citationCount: result.answer.citations.length },
    });

    return result.answer;
  });
}
