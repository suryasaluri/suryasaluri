import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";
import { loadLatestSchema } from "../schema/loadLatest";
import { detectUnconstrainedReferences, type UnconstrainedReference } from "../quality/dataQuality";
import { isFixableReference, buildForeignKeySafetyCheckSql, buildForeignKeyFixSql, type FixableReference } from "../quality/fkFix";
import { getConnector } from "../connectors/registry";

const fixSchema = z.object({
  fields: z.record(z.string()).default({}),
  table: z.string().min(1),
  column: z.string().min(1),
});

type FixResult =
  | { status: "safe"; violatingRows: 0; sql: string; ref: UnconstrainedReference }
  | { status: "unsafe"; violatingRows: number; sql: string; ref: UnconstrainedReference }
  | { status: "needs_manual_entry"; reason: string; ref: UnconstrainedReference }
  | { status: "unsupported_connector"; reason: string }
  | { status: "not_found"; reason: string }
  | { status: "applied"; sql: string; constraintName: string; ref: UnconstrainedReference };

/**
 * Never trusts a client-supplied table/column pair directly — always
 * re-derives the flagged unconstrained references from the latest
 * *persisted* crawl (the same schema the Glossary tab is showing) and only
 * proceeds if the requested pair is actually one of them. Same "never trust
 * a draft" discipline reports/spec.ts uses for report specs.
 */
async function resolveFixableRef(orgId: string, dataSourceId: string, table: string, column: string): Promise<UnconstrainedReference | null> {
  const { schema } = await loadLatestSchema(orgId, dataSourceId);
  const flagged = detectUnconstrainedReferences(schema);
  return flagged.find((r) => r.table === table && r.column === column) ?? null;
}

/** Runs the live orphan-row count against the customer's database with freshly supplied credentials — never stored. */
async function checkSafety(connectorId: string, fields: Record<string, string>, ref: FixableReference): Promise<{ violatingRows: number } | { unsupported: true }> {
  const connector = getConnector(connectorId);
  if (!connector?.countRows) return { unsupported: true };
  const sql = buildForeignKeySafetyCheckSql(ref);
  const violatingRows = await connector.countRows(fields, sql);
  return { violatingRows };
}

export function registerUnconstrainedRefFixRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  async function loadConnection(orgId: string, id: string) {
    const { data } = await supabaseAdmin().from("data_sources").select("*").eq("id", id).eq("org_id", orgId).single();
    return data;
  }

  /** Read-only — identifies whether the recommended fix is safe to apply, without writing anything. */
  app.post<{ Params: { id: string }; Body: unknown }>("/connections/:id/unconstrained-refs/check", async (request, reply) => {
    const { orgId } = request as AuthedRequest;
    const { id } = request.params;
    const parsed = fixSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }

    const src = await loadConnection(orgId, id);
    if (!src) {
      reply.code(404).send({ error: "Connection not found" });
      return;
    }

    const ref = await resolveFixableRef(orgId, id, parsed.data.table, parsed.data.column);
    if (!ref) {
      const result: FixResult = { status: "not_found", reason: "This column is no longer flagged as an unconstrained reference — the schema may have changed since this page loaded." };
      return result;
    }
    if (!isFixableReference(ref)) {
      const result: FixResult = { status: "needs_manual_entry", reason: "The target table's primary key isn't a single column, so the right column to reference can't be inferred automatically.", ref };
      return result;
    }

    const safety = await checkSafety(src.connector_id, parsed.data.fields, ref);
    if ("unsupported" in safety) {
      const result: FixResult = { status: "unsupported_connector", reason: "This connector doesn't support checking or applying schema fixes yet." };
      return result;
    }

    const sql = buildForeignKeySafetyCheckSql(ref);
    const result: FixResult =
      safety.violatingRows === 0 ? { status: "safe", violatingRows: 0, sql, ref } : { status: "unsafe", violatingRows: safety.violatingRows, sql, ref };
    return result;
  });

  /** Identifies AND solves — re-runs the exact same safety check right before writing (never trusts a prior check response, which could be stale), then applies the constraint. */
  app.post<{ Params: { id: string }; Body: unknown }>("/connections/:id/unconstrained-refs/apply", async (request, reply) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const { id } = request.params;
    const parsed = fixSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }

    const src = await loadConnection(orgId, id);
    if (!src) {
      reply.code(404).send({ error: "Connection not found" });
      return;
    }

    const ref = await resolveFixableRef(orgId, id, parsed.data.table, parsed.data.column);
    if (!ref) {
      const result: FixResult = { status: "not_found", reason: "This column is no longer flagged as an unconstrained reference — the schema may have changed since this page loaded." };
      return result;
    }
    if (!isFixableReference(ref)) {
      const result: FixResult = { status: "needs_manual_entry", reason: "The target table's primary key isn't a single column, so the right column to reference can't be inferred automatically.", ref };
      return result;
    }

    const connector = getConnector(src.connector_id);
    if (!connector?.countRows || !connector.applyDdl) {
      const result: FixResult = { status: "unsupported_connector", reason: "This connector doesn't support checking or applying schema fixes yet." };
      return result;
    }

    const safety = await checkSafety(src.connector_id, parsed.data.fields, ref);
    if ("unsupported" in safety) {
      const result: FixResult = { status: "unsupported_connector", reason: "This connector doesn't support checking or applying schema fixes yet." };
      return result;
    }
    if (safety.violatingRows > 0) {
      const result: FixResult = { status: "unsafe", violatingRows: safety.violatingRows, sql: buildForeignKeySafetyCheckSql(ref), ref };
      return result;
    }

    const { sql, constraintName } = buildForeignKeyFixSql(ref);
    await connector.applyDdl(parsed.data.fields, sql);

    // Keep the persisted schema_objects row in sync so the Glossary/Schema/
    // Relationships tabs reflect the new constraint immediately, without
    // waiting on the customer to trigger a full re-crawl.
    const { data: objectRow } = await supabaseAdmin()
      .from("schema_objects")
      .select("id, foreign_keys")
      .eq("org_id", orgId)
      .eq("data_source_id", id)
      .eq("name", ref.table)
      .maybeSingle();
    if (objectRow) {
      const foreignKeys = Array.isArray(objectRow.foreign_keys) ? objectRow.foreign_keys : [];
      foreignKeys.push({ constraintName, columns: [ref.column], refTable: ref.likelyTargetTable, refColumns: [ref.likelyTargetColumn] });
      await supabaseAdmin().from("schema_objects").update({ foreign_keys: foreignKeys }).eq("id", objectRow.id);
    }

    await supabaseAdmin().from("audit_logs").insert({
      org_id: orgId,
      session_id: sessionId ?? null,
      action: "schema.constraint_added",
      resource_type: "data_source",
      resource_id: id,
      details: { table: ref.table, column: ref.column, refTable: ref.likelyTargetTable, refColumn: ref.likelyTargetColumn, constraintName, sql },
    });

    const result: FixResult = { status: "applied", sql, constraintName, ref };
    return result;
  });
}
