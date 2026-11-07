import "server-only";

import type { CvAnalysisResult } from "@/lib/cv/analysis";
import { createAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/types/database";

type NewAnalysis = {
  userId: string;
  resumeId: string;
  profileHash: string;
  promptVersion: string;
  model: string;
  result: CvAnalysisResult;
};

/**
 * Users cannot write analyses themselves. The foreign key on (resume_id, user_id)
 * rejects a resume that does not belong to the verified user.
 */
export async function saveCvAnalysis(analysis: NewAnalysis) {
  const { error } = await createAdminClient()
    .from("cv_analyses")
    .upsert(
      {
        user_id: analysis.userId,
        resume_id: analysis.resumeId,
        profile_hash: analysis.profileHash,
        prompt_version: analysis.promptVersion,
        model: analysis.model,
        result: analysis.result as unknown as NonNullable<Json>,
      },
      { onConflict: "resume_id,profile_hash,prompt_version" },
    );
  if (error) throw new Error(`Saving the analysis failed: ${error.code}`);
}
