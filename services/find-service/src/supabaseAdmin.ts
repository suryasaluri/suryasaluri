import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * Service-role client — bypasses RLS. Server-only, never exposed to clients.
 * Also used to validate caller-supplied access tokens via auth.getUser(jwt):
 * that call only needs a valid project API key alongside the bearer token,
 * so the service-role key works fine for verification too.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
