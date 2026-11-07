import "server-only";

import { cache } from "react";

import { dateInZone, safeTimeZone } from "@/lib/time";
import { createClient } from "@/server/supabase/server";

/** The signed-in user's "now". Cached for the length of one request. */
export const getUserClock = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("user_preferences").select("timezone").maybeSingle();
  const timeZone = safeTimeZone(data?.timezone);
  const now = new Date();
  return { now, timeZone, today: dateInZone(now, timeZone) };
});
