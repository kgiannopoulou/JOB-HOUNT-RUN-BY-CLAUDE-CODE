import type { NextRequest } from "next/server";

import { updateSession } from "@/server/supabase/session";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|api/internal|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
