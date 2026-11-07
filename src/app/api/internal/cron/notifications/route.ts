import { NextResponse, type NextRequest } from "next/server";

import { isCronRequest } from "@/server/cron-auth";
import { deliverNotifications } from "@/server/notifications/deliver";
import { createAdminClient } from "@/server/supabase/admin";

const PAGE = 500;

/**
 * Called by Vercel Cron, so people who are not using the app still have their
 * notifications waiting when they return. See vercel.json.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let users = 0;
  let created = 0;
  let failed = 0;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("user_preferences")
      .select("user_id")
      .order("user_id")
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: "Lookup failed" }, { status: 502 });

    for (const { user_id } of data) {
      users += 1;
      try {
        created += await deliverNotifications(user_id);
      } catch {
        // One person's failure must not stop everyone else's notifications.
        failed += 1;
      }
    }
    if (data.length < PAGE) break;
  }

  return NextResponse.json({ users, created, failed }, { status: failed ? 502 : 200 });
}
