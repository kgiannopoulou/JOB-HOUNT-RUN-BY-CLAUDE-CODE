import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { MatchResult } from "@/lib/matching/result";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

const COLUMNS =
  "id, job_id, resume_id, score, result, model, created_at, jobs (title, company, source_url, provider), resumes (title, content)";

/** Row level security limits these reads to the signed-in user. */
function typed<T extends { result: unknown }>(row: T) {
  return { ...row, result: row.result as unknown as MatchResult };
}

export async function listMatches(supabase: Client) {
  const { data, error } = await supabase
    .from("job_matches")
    .select(COLUMNS)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Match list failed: ${error.code}`);
  return data.map(typed);
}

export async function getMatch(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("job_matches")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Match lookup failed: ${error.code}`);
  return data && typed(data);
}

export async function getMatches(supabase: Client, ids: string[]) {
  const { data, error } = await supabase
    .from("job_matches")
    .select(COLUMNS)
    .in("id", ids)
    .order("score", { ascending: false });
  if (error) throw new Error(`Match lookup failed: ${error.code}`);
  return data.map(typed);
}

/** The newest result for each job, used to show scores on job cards. */
export async function getMatchIdsForJobs(supabase: Client, jobIds: string[]) {
  const { data, error } = await supabase
    .from("job_matches")
    .select("id, job_id, score, result")
    .in("job_id", jobIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Match lookup failed: ${error.code}`);
  return new Map(
    data.map((row) => [
      row.job_id,
      {
        id: row.id,
        score: (row.result as unknown as MatchResult).band === "insufficient" ? null : row.score,
      },
    ]),
  );
}
