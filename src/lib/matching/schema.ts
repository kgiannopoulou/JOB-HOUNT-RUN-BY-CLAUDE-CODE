import { z } from "zod";

export const MATCH_PROMPT_VERSION = "job-match-v1";

export const categories = [
  "skills",
  "experience",
  "education",
  "certifications",
  "languages",
  "responsibilities",
  "seniority",
] as const;

export type Category = (typeof categories)[number];

export const statuses = ["met", "partial", "not_met"] as const;
export type RequirementStatus = (typeof statuses)[number];

/**
 * What the model returns. It only reads the two texts and pairs them up. It never
 * gives a number: the score comes from fixed rules in score.ts.
 */
export const matchOutputSchema = z.object({
  requirements: z.array(
    z.object({
      category: z.enum(categories),
      importance: z.enum(["mandatory", "preferred"]),
      requirement: z.string().describe("The requirement in a few plain words."),
      job_quote: z.string().describe("Exact words copied from the job text."),
      term: z
        .string()
        .describe("For a skill or certification, its short name, such as SQL. Otherwise empty."),
      min_years: z
        .number()
        .nullable()
        .describe("Years of experience the job asks for, or null."),
      years_scope: z
        .enum(["total", "specific", "none"])
        .describe("total: general work experience. specific: in one field or tool. none: no years stated."),
      status: z.enum(statuses),
      candidate_evidence: z
        .string()
        .describe("Exact words copied from the profile. Empty if there are none."),
      explanation: z.string(),
    }),
  ),
  strengths: z.array(
    z.object({
      text: z.string(),
      evidence: z.string().describe("Exact words copied from the profile."),
    }),
  ),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

export type MatchOutput = z.infer<typeof matchOutputSchema>;
export type ModelRequirement = MatchOutput["requirements"][number];
