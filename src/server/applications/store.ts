import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

const UNIQUE_VIOLATION = "23505";

/** A saved job is the first stage of an application, so both stay in step. */
export async function addJobToBoard(supabase: Client, userId: string, jobId: string) {
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("title, company, source_url")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError || !job) throw new Error("The job could not be found.");

  const { error } = await supabase.from("applications").insert({
    user_id: userId,
    job_id: jobId,
    company: job.company,
    role_title: job.title,
    job_url: job.source_url,
  });
  // Already on the board, perhaps further along. That card is left as it is.
  if (error && error.code !== UNIQUE_VIOLATION) {
    throw new Error(`Adding to the board failed: ${error.code}`);
  }
}

/**
 * Unsaving a job takes its card off the board only if nothing was recorded on it.
 * Anything the user wrote, or any progress, is theirs to delete on purpose.
 */
export async function removeUntouchedFromBoard(supabase: Client, jobId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, status, notes, recruiter_name, recruiter_email, recruiter_phone, resume_id, cover_letter_id, application_interviews (id), application_reminders (id)",
    )
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw new Error(`Board lookup failed: ${error.code}`);
  if (
    !data ||
    data.status !== "saved" ||
    data.notes ||
    data.recruiter_name ||
    data.recruiter_email ||
    data.recruiter_phone ||
    data.resume_id ||
    data.cover_letter_id ||
    data.application_interviews.length > 0 ||
    data.application_reminders.length > 0
  ) {
    return;
  }

  const { error: deleteError } = await supabase.from("applications").delete().eq("id", data.id);
  if (deleteError) throw new Error(`Removing from the board failed: ${deleteError.code}`);
}
