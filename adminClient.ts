import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// A throwaway Supabase client for admin-initiated signups (new employee or
// customer accounts). `persistSession: false` keeps its session purely in
// this instance's memory, so calling `.auth.signUp()` here never touches
// localStorage or the main `supabase` singleton — the signed-in admin's own
// session is untouched, even though signUp briefly creates a session for
// the new account under the hood.
export function createIsolatedAuthClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
