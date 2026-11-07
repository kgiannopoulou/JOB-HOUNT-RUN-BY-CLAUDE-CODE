import { NextResponse, type NextRequest } from "next/server";

import { isCronRequest } from "@/server/cron-auth";
import { jobProviders } from "@/server/jobs/providers";
import { syncProvider } from "@/server/jobs/sync";
import { createAdminClient } from "@/server/supabase/admin";

/** Called by Vercel Cron. See vercel.json. */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results = [];
  for (const provider of jobProviders) {
    results.push(await syncProvider(admin, provider));
  }

  const failed = results.some((result) => result.status === "failed");
  return NextResponse.json({ results }, { status: failed ? 502 : 200 });
}
