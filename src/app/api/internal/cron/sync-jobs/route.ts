import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { cronSecret } from "@/server/env";
import { jobProviders } from "@/server/jobs/providers";
import { syncProvider } from "@/server/jobs/sync";
import { createAdminClient } from "@/server/supabase/admin";

const digest = (value: string) => createHash("sha256").update(value).digest();

function isAuthorized(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(header), digest(`Bearer ${cronSecret()}`));
}

/** Called by Vercel Cron. See vercel.json. */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
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
