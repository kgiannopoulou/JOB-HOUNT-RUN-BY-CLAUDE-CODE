import type { MatchScore } from "@/lib/matching/score";

/** What is stored for a match. The hashes show whether the inputs have changed since. */
export type MatchResult = MatchScore & {
  profile_hash: string;
  job_hash: string;
};

export const MAX_JOB_TEXT_LENGTH = 40_000;
export const MAX_COMPARED_JOBS = 4;
