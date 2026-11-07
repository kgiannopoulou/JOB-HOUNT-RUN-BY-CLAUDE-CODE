import { z } from "zod";

import {
  containsPhrase,
  normalizeForMatch,
  profileText,
  unsupportedTerms,
} from "@/lib/cv/grounding";
import {
  completeness,
  experienceMonths,
  profileChecks,
  profileWithoutContact,
  type CvProfile,
  type ProfileCheck,
} from "@/lib/cv/profile";

export const CV_ANALYSIS_PROMPT_VERSION = "cv-analysis-v1";

const priority = z.enum(["high", "medium", "low"]);

/** The part the model writes. Everything else on the dashboard is calculated. */
export const cvAnalysisOutputSchema = z.object({
  overview: z.string(),
  strengths: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      evidence: z.string().describe("Exact words copied from the CV that support this."),
    }),
  ),
  weaknesses: z.array(z.object({ title: z.string(), detail: z.string() })),
  missing_information: z.array(
    z.object({ item: z.string(), why_it_matters: z.string() }),
  ),
  improvements: z.array(
    z.object({ section: z.string(), suggestion: z.string(), priority }),
  ),
  improved_summary: z.string(),
  keywords: z.array(z.object({ term: z.string(), reason: z.string() })),
  recommendations: z.array(
    z.object({ action: z.string(), reason: z.string(), priority }),
  ),
});

export type CvAnalysisOutput = z.infer<typeof cvAnalysisOutputSchema>;

export type CvAnalysisResult = Omit<CvAnalysisOutput, "strengths" | "keywords"> & {
  strengths: (CvAnalysisOutput["strengths"][number] & { evidence_found: boolean })[];
  keywords: (CvAnalysisOutput["keywords"][number] & { in_cv: boolean })[];
  checks: ProfileCheck[];
  completeness: number;
  experience_months: number;
  summary_terms_to_check: string[];
};

const order = { high: 0, medium: 1, low: 2 };

/** Adds the fixed calculations and the checks of the model's claims against the CV. */
export function buildCvAnalysis(
  output: CvAnalysisOutput,
  profile: CvProfile,
  now: Date,
): CvAnalysisResult {
  const facts = profileWithoutContact(profile);
  const source = normalizeForMatch(profileText(facts));
  const checks = profileChecks(profile);

  return {
    ...output,
    strengths: output.strengths.map((strength) => ({
      ...strength,
      evidence_found: containsPhrase(source, strength.evidence),
    })),
    keywords: output.keywords.map((keyword) => ({
      ...keyword,
      in_cv: containsPhrase(source, keyword.term),
    })),
    improvements: [...output.improvements].sort(
      (a, b) => order[a.priority] - order[b.priority],
    ),
    recommendations: [...output.recommendations].sort(
      (a, b) => order[a.priority] - order[b.priority],
    ),
    checks,
    completeness: completeness(checks),
    experience_months: experienceMonths(profile, now),
    summary_terms_to_check: unsupportedTerms(output.improved_summary, facts),
  };
}

export function formatExperience(months: number): string {
  if (months === 0) return "None dated";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (rest) parts.push(`${rest} ${rest === 1 ? "month" : "months"}`);
  return parts.join(" ");
}
