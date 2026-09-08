import type { FastifyReply, FastifyRequest } from "fastify";
import { supabaseAdmin } from "./supabaseAdmin";

export type AuthedRequest = FastifyRequest & {
  orgId: string;
  userId: string;
};

/**
 * Fastify preHandler: verifies the caller-supplied Supabase access token,
 * then resolves org_id server-side (never trusts a client-supplied org id) —
 * the same lookup the frontend's useOrg() does, just authoritative here.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    reply.code(401).send({ error: "Missing Authorization bearer token" });
    return;
  }

  const { data: userData, error: userError } = await supabaseAdmin().auth.getUser(token);
  if (userError || !userData.user) {
    reply.code(401).send({ error: "Invalid or expired token" });
    return;
  }

  const { data: org, error: orgError } = await supabaseAdmin()
    .from("organizations")
    .select("id")
    .eq("owner_id", userData.user.id)
    .single();
  if (orgError || !org) {
    reply.code(403).send({ error: "No organization found for this user" });
    return;
  }

  (request as AuthedRequest).orgId = org.id as string;
  (request as AuthedRequest).userId = userData.user.id;
}
