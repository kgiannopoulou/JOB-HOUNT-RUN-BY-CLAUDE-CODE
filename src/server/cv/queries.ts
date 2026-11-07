import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { cvProfileSchema, type CvProfile } from "@/lib/cv/profile";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export function parseProfile(content: unknown): CvProfile | null {
  const parsed = cvProfileSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

/** Row level security limits these reads to the signed-in user. */
export async function getResume(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`CV lookup failed: ${error.code}`);
  return data;
}

/** The CV used for matching: the primary one if verified, otherwise the newest verified one. */
export async function getMatchingResume(supabase: Client) {
  const { data, error } = await supabase
    .from("resumes")
    .select("id, title, content, verified_at, is_primary")
    .eq("parse_status", "ready")
    .not("verified_at", "is", null)
    .order("is_primary", { ascending: false })
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`CV lookup failed: ${error.code}`);
  const profile = data && parseProfile(data.content);
  return data && profile ? { ...data, profile } : null;
}

export async function aiCallsUsedToday(supabase: Client) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .gt("created_at", since);
  if (error) throw new Error(`AI usage lookup failed: ${error.code}`);
  return count ?? 0;
}
