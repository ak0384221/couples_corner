import "server-only";
// Admin client. Uses the Supabase secret (service role) key and BYPASSES Row Level Security.
// Server only. Use it rarely (for example reading a user's email for Resend later),
// and never for anything that a normal user-scoped query can do.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client is not configured.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
