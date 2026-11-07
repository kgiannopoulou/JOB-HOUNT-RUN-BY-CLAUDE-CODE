"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { errorState, type ActionState } from "@/lib/action-state";
import { MAX_JOB_TEXT_LENGTH, type MatchResult } from "@/lib/matching/result";
import { MATCH_PROMPT_VERSION } from "@/lib/matching/schema";
import { scoreMatch, SCORING_VERSION } from "@/lib/matching/score";
import { AiError } from "@/server/ai/gateway";
import { contentHash } from "@/server/ai/hash";
import { getCurrentUser } from "@/server/auth/user";
import { getMatchingResume } from "@/server/cv/queries";
import { compareProfileToJob, jobSourceText } from "@/server/matching/ai";
import { saveJobMatch } from "@/server/matching/store";
import { createClient } from "@/server/supabase/server";

const id = z.uuid();

export async function checkJobMatch(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/jobs");

  const jobId = id.safeParse(formData.get("jobId"));
  if (!jobId.success) return errorState("This job could not be found.");

  const supabase = await createClient();
  const resume = await getMatchingResume(supabase);
  if (!resume) {
    return errorState("Upload a CV and confirm its details first.");
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, title, company, description, experience_level, tags")
    .eq("id", jobId.data)
    .maybeSingle();
  if (jobError || !job) return errorState("This job could not be found.");
  if (!job.description.trim()) {
    return errorState("This job has no description to compare with.");
  }
  if (job.description.length > MAX_JOB_TEXT_LENGTH) {
    return errorState("This job description is too long to compare.");
  }

  const profileHash = contentHash(resume.profile);
  const jobHash = contentHash(jobSourceText(job));

  // The same inputs always show the same result, and cost nothing to view again.
  const { data: existing } = await supabase
    .from("job_matches")
    .select("id, result")
    .eq("job_id", job.id)
    .eq("resume_id", resume.id)
    .eq("prompt_version", MATCH_PROMPT_VERSION)
    .maybeSingle();
  const stored = existing?.result as unknown as MatchResult | undefined;
  if (
    existing &&
    stored?.profile_hash === profileHash &&
    stored.job_hash === jobHash &&
    stored.scoring_version === SCORING_VERSION
  ) {
    redirect(`/matches/${existing.id}`);
  }

  let matchId: string;
  try {
    const { output, model } = await compareProfileToJob(user.id, resume.profile, job);
    const result: MatchResult = {
      ...scoreMatch({
        output,
        profile: resume.profile,
        jobText: jobSourceText(job),
        now: new Date(),
      }),
      profile_hash: profileHash,
      job_hash: jobHash,
    };
    matchId = await saveJobMatch({
      userId: user.id,
      jobId: job.id,
      resumeId: resume.id,
      promptVersion: MATCH_PROMPT_VERSION,
      model,
      result,
    });
  } catch (error) {
    if (error instanceof AiError) return errorState(error.message);
    console.error("Job match failed");
    return errorState("The comparison failed. Please try again.");
  }

  revalidatePath("/matches");
  revalidatePath("/jobs", "layout");
  redirect(`/matches/${matchId}`);
}

export async function deleteMatch(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/matches");

  const matchId = id.safeParse(formData.get("matchId"));
  if (!matchId.success) return errorState("This result could not be found.");

  const supabase = await createClient();
  const { error } = await supabase.from("job_matches").delete().eq("id", matchId.data);
  if (error) return errorState("This result could not be deleted.");

  revalidatePath("/matches");
  revalidatePath("/jobs", "layout");
  redirect("/matches");
}
