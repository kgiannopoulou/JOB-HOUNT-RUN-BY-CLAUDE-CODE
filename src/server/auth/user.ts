import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/server/supabase/server";

/** Verifies the session with Supabase Auth. Cached for the length of one request. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

/** The real gate for protected pages. The proxy redirect is only a convenience. */
export async function requireUser(next = "/dashboard") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
