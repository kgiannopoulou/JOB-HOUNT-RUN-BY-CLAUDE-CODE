import "server-only";

import { createAdminClient } from "@/server/supabase/admin";

export type AiFeature = "cv_extract" | "cv_analysis" | "job_match";

export type AiTokens = {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
};

/** Returns null when the user has no calls left today. */
export async function reserveAiCall(
  userId: string,
  feature: AiFeature,
  model: string,
  dailyLimit: number,
): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc("reserve_ai_call", {
    p_user_id: userId,
    p_feature: feature,
    p_model: model,
    p_daily_limit: dailyLimit,
  });
  if (error) throw new Error(`AI budget check failed: ${error.message}`);
  return data;
}

export async function finishAiCall(
  id: string,
  status: "succeeded" | "failed",
  usage?: AiTokens,
) {
  const { error } = await createAdminClient()
    .from("ai_usage")
    .update({ status, ...usage })
    .eq("id", id);
  if (error) console.error(`AI usage update failed: ${error.code}`);
}
