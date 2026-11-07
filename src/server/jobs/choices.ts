import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_JOB_TEXT_LENGTH } from "@/lib/matching/result";
import type { MatchJob } from "@/server/matching/ai";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type JobChoice = { id: string; title: string; company: string };

const JOB_COLUMNS = "id, title, company";

/**
 * Jobs the user has shown an interest in, for the "which job?" lists. Saved jobs
 * are on the board as applications, so these two queries cover all of them.
 */
export async function listJobChoices(supabase: Client, selectedId?: string): Promise<JobChoice[]> {
  const [applications, matches, selected] = await Promise.all([
    supabase.from("applications").select(`jobs (${JOB_COLUMNS})`).not("job_id", "is", null),
    supabase.from("job_matches").select(`jobs (${JOB_COLUMNS})`),
    selectedId
      ? supabase.from("jobs").select(JOB_COLUMNS).eq("id", selectedId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (applications.error || matches.error || selected.error) {
    throw new Error("Job list failed");
  }

  const jobs = new Map<string, JobChoice>();
  if (selected.data) jobs.set(selected.data.id, selected.data);
  for (const row of [...applications.data, ...matches.data]) {
    if (row.jobs) jobs.set(row.jobs.id, row.jobs);
  }
  return [...jobs.values()].toSorted((a, b) => a.title.localeCompare(b.title));
}

export type JobForAi = MatchJob & { id: string };

/** Loads a job for an AI feature. Returns a message to show when it cannot be used. */
export async function loadJobForAi(
  supabase: Client,
  jobId: string,
): Promise<{ job: JobForAi } | { problem: string }> {
  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, title, company, description, experience_level, tags")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !job) return { problem: "This job could not be found." };
  if (!job.description.trim()) return { problem: "This job has no description to work from." };
  if (job.description.length > MAX_JOB_TEXT_LENGTH) {
    return { problem: "This job description is too long to use." };
  }
  return { job };
}
