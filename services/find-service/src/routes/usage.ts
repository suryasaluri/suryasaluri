import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth, type AuthedRequest } from "../auth";

type UsageBucket = { totalEvents: number; byAction: { action: string; count: number }[]; recent: { action: string; createdAt: string }[] };

async function bucket(orgId: string, sessionId?: string): Promise<UsageBucket> {
  let countQuery = supabaseAdmin().from("audit_logs").select("*", { count: "exact", head: true }).eq("org_id", orgId);
  let rowsQuery = supabaseAdmin().from("audit_logs").select("action, created_at").eq("org_id", orgId).order("created_at", { ascending: false });
  if (sessionId) {
    countQuery = countQuery.eq("session_id", sessionId);
    rowsQuery = rowsQuery.eq("session_id", sessionId);
  }

  const [{ count }, { data: rows }] = await Promise.all([countQuery, rowsQuery]);

  const counts = new Map<string, number>();
  for (const r of rows ?? []) counts.set(r.action, (counts.get(r.action) ?? 0) + 1);
  const byAction = Array.from(counts.entries())
    .map(([action, c]) => ({ action, count: c }))
    .sort((a, b) => b.count - a.count);

  const recent = (rows ?? []).slice(0, 10).map((r) => ({ action: r.action, createdAt: r.created_at }));

  return { totalEvents: count ?? 0, byAction, recent };
}

/**
 * Home-page usage report: every action already flows through audit_logs
 * (connection lifecycle, crawls, domain classification, documentation,
 * report runs) — this just aggregates it two ways: org-wide "total usage"
 * and "this session" (the caller's X-Session-Id, set by requireAuth).
 */
export function registerUsageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/usage", async (request) => {
    const { orgId, sessionId } = request as AuthedRequest;
    const [total, session] = await Promise.all([bucket(orgId), bucket(orgId, sessionId)]);
    return { total, session, sessionId: sessionId ?? null };
  });
}
