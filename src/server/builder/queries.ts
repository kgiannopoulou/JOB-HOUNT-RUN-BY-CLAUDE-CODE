import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseProfile } from "@/server/cv/queries";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/** Row level security limits these reads to the signed-in user. */
export async function listVersions(supabase: Client) {
  const { data, error } = await supabase
    .from("resumes")
    .select("id, title, template, parse_status, created_at, updated_at")
    .eq("kind", "version")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Version list failed: ${error.code}`);
  return data;
}

export async function getVersion(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", id)
    .eq("kind", "version")
    .maybeSingle();
  if (error) throw new Error(`Version lookup failed: ${error.code}`);
  return data;
}

/** Original CVs whose details the user has confirmed: the only source for new documents. */
export async function listVerifiedCvs(supabase: Client) {
  const { data, error } = await supabase
    .from("resumes")
    .select("id, title, is_primary")
    .eq("kind", "original")
    .eq("parse_status", "ready")
    .not("verified_at", "is", null)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`CV list failed: ${error.code}`);
  return data;
}

export async function getVerifiedCv(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("resumes")
    .select("id, title, content")
    .eq("id", id)
    .eq("kind", "original")
    .eq("parse_status", "ready")
    .not("verified_at", "is", null)
    .maybeSingle();
  if (error) throw new Error(`CV lookup failed: ${error.code}`);
  const profile = data && parseProfile(data.content);
  return data && profile ? { ...data, profile } : null;
}
