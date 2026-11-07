import { containsPhrase, normalizeForMatch, profileText } from "@/lib/cv/grounding";
import {
  experienceMonths,
  profileWithoutContact,
  type CvProfile,
} from "@/lib/cv/profile";
import {
  categories,
  type Category,
  type MatchOutput,
  type ModelRequirement,
  type RequirementStatus,
} from "@/lib/matching/schema";

/**
 * The compatibility score. A pure function of the model's reading, the verified
 * profile and the job text: the same input always gives the same result, and
 * every rule below is explained to the user.
 */

export const SCORING_VERSION = "scoring-v1";

export const categoryWeights: Record<Category, number> = {
  skills: 35,
  experience: 20,
  responsibilities: 15,
  education: 10,
  certifications: 10,
  seniority: 5,
  languages: 5,
};

export const categoryLabels: Record<Category, string> = {
  skills: "Skills",
  experience: "Experience",
  responsibilities: "Responsibilities",
  education: "Education",
  certifications: "Certifications",
  seniority: "Seniority",
  languages: "Languages",
};

/** A mandatory requirement counts three times as much as a preferred one. */
const importanceWeights = { mandatory: 3, preferred: 1 };
const statusPoints: Record<RequirementStatus, number> = { met: 2, partial: 1, not_met: 0 };

export const STRONG_FROM = 75;
export const MODERATE_FROM = 50;
/** Missing any mandatory requirement rules out a strong match. */
export const SOME_MANDATORY_MISSING_CAP = 74;
/** Missing half of them or more rules out a moderate match. */
export const MOST_MANDATORY_MISSING_CAP = 49;
/** Reaching this share of the requested years counts as partly met. */
const PARTIAL_YEARS_SHARE = 0.75;
const LIMITED_DATA_BELOW = 3;

const PREFERRED_WORDS =
  /\b(nice to have|preferred|preferably|desirable|desired|a plus|bonus|ideally|advantage|advantageous|beneficial|optional)\b/i;
const MANDATORY_WORDS = /\b(must|required|requirement|essential|mandatory|minimum)\b/i;

export type Band = "strong" | "moderate" | "limited" | "insufficient";

export const bandLabels: Record<Band, string> = {
  strong: "Strong match",
  moderate: "Moderate match",
  limited: "Limited match",
  insufficient: "Not enough information",
};

export type ScoredRequirement = {
  category: Category;
  importance: "mandatory" | "preferred";
  requirement: string;
  job_quote: string;
  status: RequirementStatus;
  model_status: RequirementStatus;
  evidence: string;
  explanation: string;
  /** Why the rules changed what the model said, if they did. */
  adjustment: string | null;
};

export type CategoryScore = {
  category: Category;
  label: string;
  weight: number;
  /** Null when the job asks for nothing in this category. */
  score: number | null;
  met: number;
  partial: number;
  missing: number;
};

type Counts = { total: number; met: number; partial: number; missing: number };

export type MatchScore = {
  score: number;
  raw_score: number;
  band: Band;
  cap: number | null;
  limited_data: boolean;
  categories: CategoryScore[];
  mandatory: Counts;
  preferred: Counts;
  requirements: ScoredRequirement[];
  excluded_requirements: string[];
  strengths: MatchOutput["strengths"];
  removed_strengths: number;
  concerns: string[];
  recommendations: string[];
  summary: string;
  explanation: string[];
  scoring_version: string;
};

type ScoreInput = {
  output: MatchOutput;
  profile: CvProfile;
  jobText: string;
  now: Date;
};

function resolveImportance(requirement: ModelRequirement) {
  const quote = requirement.job_quote;
  if (PREFERRED_WORDS.test(quote)) return "preferred";
  if (MANDATORY_WORDS.test(quote)) return "mandatory";
  return requirement.importance;
}

function statusFromYears(required: number, months: number): RequirementStatus {
  const years = months / 12;
  if (years >= required) return "met";
  return years >= required * PARTIAL_YEARS_SHARE ? "partial" : "not_met";
}

function namedInProfile(requirement: ModelRequirement, profile: CvProfile) {
  const listed =
    requirement.category === "skills"
      ? profile.skills
      : requirement.category === "certifications"
        ? profile.certifications.map((entry) => entry.name)
        : [];
  return listed.find((item) => containsPhrase(normalizeForMatch(item), requirement.term));
}

function assess(
  requirement: ModelRequirement,
  profile: CvProfile,
  profileSource: string,
  months: number,
): ScoredRequirement {
  const base = {
    category: requirement.category,
    importance: resolveImportance(requirement),
    requirement: requirement.requirement,
    job_quote: requirement.job_quote,
    model_status: requirement.status,
    explanation: requirement.explanation,
  } as const;

  // Total experience is arithmetic, so it never depends on the model's opinion.
  if (
    requirement.years_scope === "total" &&
    requirement.min_years !== null &&
    requirement.min_years > 0 &&
    (requirement.category === "experience" || requirement.category === "seniority")
  ) {
    const status = statusFromYears(requirement.min_years, months);
    const years = (months / 12).toFixed(1);
    return {
      ...base,
      status,
      evidence: `${years} years of dated work in your confirmed CV`,
      adjustment:
        status === requirement.status
          ? null
          : `Calculated from your role dates: ${years} years against ${requirement.min_years} requested.`,
    };
  }

  // A skill or certification listed in the profile is met, whatever the model said.
  const named = requirement.term ? namedInProfile(requirement, profile) : undefined;
  if (named) {
    return {
      ...base,
      status: "met",
      evidence: named,
      adjustment:
        requirement.status === "met" ? null : `"${named}" is listed in your confirmed CV.`,
    };
  }

  if (requirement.status === "not_met") {
    return { ...base, status: "not_met", evidence: "", adjustment: null };
  }

  // Credit needs proof. Text that is not in the profile earns nothing, which also
  // defeats a job description that tells the model to rate the candidate highly.
  if (!containsPhrase(profileSource, requirement.candidate_evidence)) {
    return {
      ...base,
      status: "not_met",
      evidence: "",
      adjustment: "No matching text was found in your confirmed CV, so this earned no credit.",
    };
  }
  return {
    ...base,
    status: requirement.status,
    evidence: requirement.candidate_evidence,
    adjustment: null,
  };
}

const requirementKey = (r: ModelRequirement) =>
  `${r.category}|${normalizeForMatch(r.term || r.requirement)}`;

/** The same requirement listed twice must not count twice. The first mention stays. */
function withoutDuplicates(requirements: ModelRequirement[]) {
  const sorted = [...requirements].sort((a, b) => {
    const key = requirementKey(a).localeCompare(requirementKey(b));
    if (key !== 0) return key;
    const rank = (r: ModelRequirement) => (resolveImportance(r) === "mandatory" ? 0 : 1);
    return rank(a) - rank(b) || a.job_quote.localeCompare(b.job_quote);
  });
  const seen = new Set<string>();
  return sorted.filter((requirement) => {
    const key = requirementKey(requirement);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function count(requirements: ScoredRequirement[]): Counts {
  return {
    total: requirements.length,
    met: requirements.filter((r) => r.status === "met").length,
    partial: requirements.filter((r) => r.status === "partial").length,
    missing: requirements.filter((r) => r.status === "not_met").length,
  };
}

function categoryRatio(requirements: ScoredRequirement[]) {
  let earned = 0;
  let possible = 0;
  for (const requirement of requirements) {
    const weight = importanceWeights[requirement.importance];
    earned += weight * statusPoints[requirement.status];
    possible += weight * statusPoints.met;
  }
  return possible === 0 ? null : earned / possible;
}

function bandFor(score: number): Band {
  if (score >= STRONG_FROM) return "strong";
  return score >= MODERATE_FROM ? "moderate" : "limited";
}

function explain(result: {
  included: CategoryScore[];
  mandatory: Counts;
  preferred: Counts;
  cap: number | null;
  raw: number;
  score: number;
  excluded: number;
  adjusted: number;
}) {
  const parts = result.included
    .map((c) => `${c.label} ${c.score}% (weight ${c.weight})`)
    .join(", ");
  const lines = [
    `Each requirement counts as met (full credit), partly met (half credit) or not met (no credit). Mandatory requirements count three times as much as preferred ones.`,
    `Category results: ${parts}. Categories the job does not mention are left out, and the remaining weights are scaled to 100%.`,
    `The weighted result is ${result.raw}%.`,
    `Mandatory requirements: ${result.mandatory.met} met, ${result.mandatory.partial} partly met and ${result.mandatory.missing} not met, out of ${result.mandatory.total}. Preferred requirements: ${result.preferred.met} met, ${result.preferred.partial} partly met and ${result.preferred.missing} not met, out of ${result.preferred.total}.`,
  ];
  if (result.cap !== null && result.raw > result.score) {
    lines.push(
      `The score is limited to ${result.cap}% because ${result.mandatory.missing} mandatory ${result.mandatory.missing === 1 ? "requirement is" : "requirements are"} not met.`,
    );
  }
  if (result.adjusted > 0) {
    lines.push(
      `Fixed checks changed the AI's reading of ${result.adjusted} ${result.adjusted === 1 ? "requirement" : "requirements"}. Each change is shown in the list of requirements.`,
    );
  }
  if (result.excluded > 0) {
    lines.push(
      `${result.excluded} suggested ${result.excluded === 1 ? "requirement was" : "requirements were"} left out because the wording is not in the job description.`,
    );
  }
  return lines;
}

export function scoreMatch({ output, profile, jobText, now }: ScoreInput): MatchScore {
  const job = normalizeForMatch(jobText);
  const profileSource = normalizeForMatch(profileText(profileWithoutContact(profile)));
  const months = experienceMonths(profile, now);

  const real = output.requirements.filter((r) => containsPhrase(job, r.job_quote));
  const excluded = output.requirements
    .filter((r) => !containsPhrase(job, r.job_quote))
    .map((r) => r.requirement);

  const requirements = withoutDuplicates(real).map((r) =>
    assess(r, profile, profileSource, months),
  );

  const categoryScores = categories
    .map((category) => {
      const inCategory = requirements.filter((r) => r.category === category);
      const ratio = categoryRatio(inCategory);
      const { met, partial, missing } = count(inCategory);
      const summary: CategoryScore = {
        category,
        label: categoryLabels[category],
        weight: categoryWeights[category],
        score: ratio === null ? null : Math.round(ratio * 100),
        met,
        partial,
        missing,
      };
      return { summary, ratio };
    })
    .sort((a, b) => b.summary.weight - a.summary.weight);

  const mandatory = count(requirements.filter((r) => r.importance === "mandatory"));
  const preferred = count(requirements.filter((r) => r.importance === "preferred"));
  const included = categoryScores.flatMap(({ summary, ratio }) =>
    ratio === null ? [] : [{ summary, ratio }],
  );
  const totalWeight = included.reduce((sum, c) => sum + c.summary.weight, 0);
  const weighted = included.reduce((sum, c) => sum + c.summary.weight * c.ratio, 0);
  const raw = totalWeight === 0 ? 0 : Math.round((weighted / totalWeight) * 100);

  let cap: number | null = null;
  if (mandatory.missing > 0) {
    cap =
      mandatory.missing / mandatory.total >= 0.5
        ? MOST_MANDATORY_MISSING_CAP
        : SOME_MANDATORY_MISSING_CAP;
  }
  const score = cap === null ? raw : Math.min(raw, cap);

  const profileHasEvidence = (evidence: string) => containsPhrase(profileSource, evidence);
  const strengths = output.strengths.filter((s) => profileHasEvidence(s.evidence));
  const insufficient = requirements.length === 0;

  return {
    score,
    raw_score: raw,
    band: insufficient ? "insufficient" : bandFor(score),
    cap,
    limited_data: requirements.length < LIMITED_DATA_BELOW,
    categories: categoryScores.map(({ summary }) => summary),
    mandatory,
    preferred,
    requirements,
    excluded_requirements: excluded,
    strengths,
    removed_strengths: output.strengths.length - strengths.length,
    concerns: output.concerns,
    recommendations: output.recommendations,
    summary: output.summary,
    explanation: insufficient
      ? ["No checkable requirements were found in this job description, so no score can be given."]
      : explain({
          included: included.map(({ summary }) => summary),
          mandatory,
          preferred,
          cap,
          raw,
          score,
          excluded: excluded.length,
          adjusted: requirements.filter((r) => r.adjustment).length,
        }),
    scoring_version: SCORING_VERSION,
  };
}
