import "server-only";

import { createHash } from "node:crypto";

/** Identifies an input, so the same input never needs a second paid call. */
export function contentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
