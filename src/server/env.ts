import "server-only";

import { z } from "zod";

const publicSchema = z.object({
  SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

function missing(names: string): Error {
  return new Error(
    `Missing or invalid environment variables: ${names}. Copy .env.example to .env.local and fill it in.`,
  );
}

export function appEnv() {
  const result = publicSchema.safeParse({
    SITE_URL: process.env.SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!result.success) {
    throw missing(result.error.issues.map((i) => i.path.join(".")).join(", "));
  }
  return result.data;
}

export function secretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw missing("SUPABASE_SECRET_KEY");
  return key;
}

export function cronSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw missing("CRON_SECRET");
  return secret;
}

/** Empty when AI features are not set up. The app then runs without them. */
export function anthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
}

export function aiDailyLimit(): number {
  const limit = Number(process.env.AI_DAILY_LIMIT);
  return Number.isInteger(limit) && limit > 0 ? limit : 30;
}
