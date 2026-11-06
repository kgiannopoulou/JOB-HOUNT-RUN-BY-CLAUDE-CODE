import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// These tests create and delete users, so they must never reach a hosted project.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
  throw new Error(`Integration tests only run against local Supabase, not ${url}`);
}
