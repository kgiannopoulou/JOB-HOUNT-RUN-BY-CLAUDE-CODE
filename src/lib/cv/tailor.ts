import { z } from "zod";

import {
  containsPhrase,
  findUngrounded,
  normalizeForMatch,
  profileText,
  unsupportedTerms,
  type UngroundedField,
} from "@/lib/cv/grounding";
import { profileFacts, type CvProfile } from "@/lib/cv/profile";

export const CV_TAILOR_PROMPT_VERSION = "cv-tailor-v1";

export const MAX_VERSIONS_PER_USER = 50;

/**
 * The AI may suggest wording and an order. It has no field for titles, employers,
 * dates, qualifications or new skills, so it has no way to change them.
 */
export const tailorOutputSchema = z.object({
  job_keywords: z
    .array(z.string())
    .describe("Skills, tools and qualifications the job asks for, in the job's words."),
  summary: z.string().describe("The summary reworded for this job. Empty to keep it as it is."),
  role_descriptions: z.array(
    z.object({
      role_index: z.number().int().describe("The role's position in the experience list, from 0."),
      description: z.string().describe("The role's description reworded for this job."),
    }),
  ),
  skills_first: z
    .array(z.string())
    .describe("The candidate's own skills most relevant to this job, most relevant first."),
});

export type TailorOutput = z.infer<typeof tailorOutputSchema>;

export type TailorChange = { label: string; before: string; after: string };
export type TailorRejection = { label: string; proposed: string; terms: string[] };
export type TailorKeyword = { term: string; found: boolean };

export type Tailoring = {
  prompt_version: string;
  model: string;
  job_title: string;
  company: string;
  changes: TailorChange[];
  /** AI wording that was thrown away, because it said something the CV does not. */
  rejected: TailorRejection[];
  keywords: TailorKeyword[];
  skills_reordered: boolean;
};

export type TailorResult = Omit<Tailoring, "prompt_version" | "model" | "job_title" | "company"> & {
  profile: CvProfile;
};

const MAX_KEYWORDS = 20;

function uniqueTerms(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = normalizeForMatch(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const numbersIn = (text: string) => text.match(/\d[\d.,]*\d|\d/g) ?? [];

/**
 * Why a piece of generated text cannot be used, or an empty list if it can. It
 * fails on a name or number the source lacks, and on any job keyword the source
 * lacks, which is how a job's requirement would turn into a false claim.
 */
export function ungroundedTerms(text: string, source: unknown, missingKeywords: string[]): string[] {
  const normalized = normalizeForMatch(text);
  return [
    ...new Set([
      ...unsupportedTerms(text, source),
      ...missingKeywords.filter((keyword) => containsPhrase(normalized, keyword)),
    ]),
  ];
}

/** Fits the AI's suggestions onto the verified profile. Only checked wording gets through. */
export function applyTailoring(
  source: CvProfile,
  output: TailorOutput,
  extraKeywords: string[] = [],
): TailorResult {
  const facts = profileFacts(source);
  const factsText = normalizeForMatch(profileText(facts));

  const terms = uniqueTerms([...output.job_keywords, ...extraKeywords]).slice(0, MAX_KEYWORDS);
  const keywords = terms.map((term) => ({ term, found: containsPhrase(factsText, term) }));
  const missing = keywords.filter((keyword) => !keyword.found).map((keyword) => keyword.term);

  const changes: TailorChange[] = [];
  const rejected: TailorRejection[] = [];

  const reword = (label: string, before: string, after: string, numberSource: string) => {
    const proposed = after.trim();
    if (!proposed || proposed === before) return before;

    // A number has to come from this same entry, or a figure could move between roles.
    const allowed = new Set(numbersIn(numberSource));
    const movedNumbers = numbersIn(proposed).filter((number) => !allowed.has(number));
    const problems = [...new Set([...ungroundedTerms(proposed, facts, missing), ...movedNumbers])];

    if (problems.length > 0) {
      rejected.push({ label, proposed, terms: problems });
      return before;
    }
    changes.push({ label, before, after: proposed });
    return proposed;
  };

  const summary = reword("Professional summary", source.summary, output.summary, profileText(facts));

  const rewritten = new Map<number, string>();
  for (const { role_index, description } of output.role_descriptions) {
    if (!rewritten.has(role_index)) rewritten.set(role_index, description);
  }
  const experience = source.experience.map((role, index) => {
    const proposed = rewritten.get(index);
    if (proposed === undefined) return role;
    const label = `${role.title} at ${role.company}`;
    const numberSource = [role.description, role.title, role.start_date, role.end_date].join(" ");
    return { ...role, description: reword(label, role.description, proposed, numberSource) };
  });

  // Reordering only: a skill the CV does not list is ignored, and none are dropped.
  const byKey = new Map(source.skills.map((skill) => [normalizeForMatch(skill), skill]));
  const first = uniqueTerms(output.skills_first).flatMap((skill) => {
    const own = byKey.get(normalizeForMatch(skill));
    return own ? [own] : [];
  });
  const skills = [...first, ...source.skills.filter((skill) => !first.includes(skill))];

  return {
    profile: { ...source, summary, experience, skills },
    changes,
    rejected,
    keywords,
    skills_reordered: skills.some((skill, index) => skill !== source.skills[index]),
  };
}

/**
 * Differences a person should look at before confirming a version: anything in
 * it that the verified CV it came from does not contain, however it got there.
 */
export function versionWarnings(version: CvProfile, source: CvProfile): UngroundedField[] {
  const warnings = findUngrounded(version, profileText(source));
  const check = (section: string, text: string) => {
    for (const value of unsupportedTerms(text, source)) warnings.push({ section, value });
  };
  check("Summary", version.summary);
  version.experience.forEach((role) => check("Experience", role.description));

  const seen = new Set<string>();
  return warnings.filter(({ section, value }) => {
    const key = `${section}|${value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
