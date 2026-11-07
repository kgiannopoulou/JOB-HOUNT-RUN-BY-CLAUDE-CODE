import "server-only";

import { createClient } from "@supabase/supabase-js";

import { appEnv, secretKey } from "@/server/env";
import type { Database } from "@/types/database";

/**
 * Bypasses row level security. Use only for job sync and for server-produced
 * records (AI usage, analyses, match scores, interview ratings, notifications)
 * that users must not be able to write. The user id must come from the verified session, never from input.
 */
export function createAdminClient() {
  return createClient<Database>(appEnv().NEXT_PUBLIC_SUPABASE_URL, secretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
