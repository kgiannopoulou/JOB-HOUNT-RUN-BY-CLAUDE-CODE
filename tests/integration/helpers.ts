import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type Client = SupabaseClient<Database>;

const options = { auth: { autoRefreshToken: false, persistSession: false } };

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function adminClient(): Client {
  return createClient<Database>(url(), process.env.SUPABASE_SECRET_KEY!, options);
}

export function anonClient(): Client {
  return createClient<Database>(
    url(),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    options,
  );
}

export type TestUser = { id: string; email: string; client: Client };

export const testPassword = "correct-horse-battery";

export async function createUser(fullName = "Test User"): Promise<TestUser> {
  const email = `test-${randomUUID()}@example.com`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;

  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({
    email,
    password: testPassword,
  });
  if (signIn.error) throw signIn.error;

  return { id: data.user.id, email, client };
}

export async function deleteUser(user: TestUser | undefined) {
  if (user) await adminClient().auth.admin.deleteUser(user.id);
}

type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];

export function jobRow(overrides: Partial<JobInsert> = {}): JobInsert {
  const id = randomUUID();
  return {
    provider: "test",
    provider_job_id: id,
    fingerprint: id,
    title: "Data Analyst",
    company: "Test Company",
    source_url: "https://example.com/job",
    ...overrides,
  };
}

export async function insertJob(overrides: Partial<JobInsert> = {}) {
  const { data, error } = await adminClient()
    .from("jobs")
    .insert(jobRow(overrides))
    .select()
    .single();
  if (error) throw error;
  return data;
}
