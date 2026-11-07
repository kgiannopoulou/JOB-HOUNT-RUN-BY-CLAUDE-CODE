import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { cronSecret } from "@/server/env";

const digest = (value: string) => createHash("sha256").update(value).digest();

export function isCronRequest(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(header), digest(`Bearer ${cronSecret()}`));
}
