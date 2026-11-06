import "server-only";

import { createClient } from "@supabase/supabase-js";

import { appEnv, secretKey } from "@/server/env";
import type { Database } from "@/types/database";

/**
 * Bypasses row level security. Use only for background work such as job sync,
 * never with input that decides whose data is touched.
 */
export function createAdminClient() {
  return createClient<Database>(appEnv().NEXT_PUBLIC_SUPABASE_URL, secretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
