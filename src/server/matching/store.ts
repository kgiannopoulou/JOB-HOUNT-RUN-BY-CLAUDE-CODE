import "server-only";

import type { MatchResult } from "@/lib/matching/result";
import { createAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/types/database";

type NewMatch = {
  userId: string;
  jobId: string;
  resumeId: string;
  promptVersion: string;
  model: string;
  result: MatchResult;
};

/**
 * Users cannot write scores themselves. The foreign key on (resume_id, user_id)
 * rejects a resume that does not belong to the verified user.
 */
export async function saveJobMatch(match: NewMatch): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("job_matches")
    .upsert(
      {
        user_id: match.userId,
        job_id: match.jobId,
        resume_id: match.resumeId,
        score: match.result.score,
        prompt_version: match.promptVersion,
        model: match.model,
        result: match.result as unknown as NonNullable<Json>,
      },
      { onConflict: "job_id,resume_id,prompt_version" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`Saving the match failed: ${error.code}`);
  return data.id;
}
