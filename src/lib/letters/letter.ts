import { z } from "zod";

import { containsPhrase, normalizeForMatch, profileText } from "@/lib/cv/grounding";
import { profileFacts, type CvProfile } from "@/lib/cv/profile";
import { ungroundedTerms } from "@/lib/cv/tailor";

export const COVER_LETTER_PROMPT_VERSION = "cover-letter-v1";

export const MAX_LETTERS_PER_USER = 100;
export const MAX_LETTER_LENGTH = 8000;

export const letterTones = ["professional", "warm", "confident", "concise"] as const;
export type LetterTone = (typeof letterTones)[number];

export const toneDetails: Record<LetterTone, { label: string; instruction: string }> = {
  professional: {
    label: "Professional",
    instruction: "Formal and measured, without being stiff.",
  },
  warm: {
    label: "Warm",
    instruction: "Friendly and personable, while staying businesslike.",
  },
  confident: {
    label: "Confident",
    instruction: "Direct and assured. State what the candidate has done, with no boasting.",
  },
  concise: {
    label: "Concise",
    instruction: "Short and plain. Three brief paragraphs at most.",
  },
};

export const letterOutputSchema = z.object({
  greeting: z.string().describe('For example "Dear Hiring Team,". Do not invent a person\'s name.'),
  paragraphs: z.array(z.string()).describe("The body of the letter, one item per paragraph."),
  closing: z.string().describe('For example "Kind regards,". No name.'),
  job_keywords: z
    .array(z.string())
    .describe("Skills, tools and qualifications the job asks for, in the job's words."),
});

export type LetterOutput = z.infer<typeof letterOutputSchema>;

export type RemovedSentence = { sentence: string; terms: string[] };

type LetterInput = {
  output: LetterOutput;
  profile: CvProfile;
  company: string;
  roleTitle: string;
  tags?: string[];
};

export type BuiltLetter = { content: string; removed: RemovedSentence[] };

/** Splits after sentence punctuation, keeping it. Greek's question mark is ";". */
const sentencesOf = (paragraph: string) =>
  paragraph
    .split(/(?<=[.!?;…])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

/**
 * Assembles the letter. A sentence is dropped if it names anything the CV does
 * not, other than the company and the position. The name comes from the CV, so
 * the AI is never given it and cannot get it wrong.
 */
export function buildLetter({ output, profile, company, roleTitle, tags = [] }: LetterInput): BuiltLetter {
  const facts = profileFacts(profile);
  const factsText = normalizeForMatch(profileText(facts));
  const missing = [...output.job_keywords, ...tags].filter(
    (keyword) => keyword.trim() && !containsPhrase(factsText, keyword),
  );

  // The company and position are allowed to appear, even though the CV lacks them.
  const allowed = { facts, company, roleTitle };
  const stated = normalizeForMatch(`${company} ${roleTitle}`);
  const notTheJob = missing.filter((keyword) => !containsPhrase(stated, keyword));

  const removed: RemovedSentence[] = [];
  const paragraphs = output.paragraphs.flatMap((paragraph) => {
    const kept = sentencesOf(paragraph).filter((sentence) => {
      const terms = ungroundedTerms(sentence, allowed, notTheJob);
      if (terms.length > 0) removed.push({ sentence, terms });
      return terms.length === 0;
    });
    return kept.length ? [kept.join(" ")] : [];
  });

  const safeLine = (line: string, fallback: string) => {
    const text = line.trim();
    return text && ungroundedTerms(text, allowed, notTheJob).length === 0 ? text : fallback;
  };

  const content = [
    safeLine(output.greeting, "Dear Hiring Team,"),
    ...paragraphs,
    [safeLine(output.closing, "Kind regards,"), profile.contact.full_name]
      .filter(Boolean)
      .join("\n"),
  ].join("\n\n");

  return { content: paragraphs.length ? content : "", removed };
}

export type LetterWarning = { label: string; detail: string };

/** Fixed checks on what a person is about to send, whoever wrote it. */
export function letterWarnings(
  content: string,
  company: string,
  roleTitle: string,
  profile: CvProfile | null,
): LetterWarning[] {
  const text = normalizeForMatch(content);
  const warnings: LetterWarning[] = [];
  if (!containsPhrase(text, company)) {
    warnings.push({ label: "Company", detail: `The letter does not mention ${company}.` });
  }
  if (!containsPhrase(text, roleTitle)) {
    warnings.push({ label: "Position", detail: `The letter does not mention ${roleTitle}.` });
  }
  if (profile) {
    const terms = ungroundedTerms(content, { profile, company, roleTitle }, []);
    if (terms.length > 0) {
      warnings.push({
        label: "Not in your CV",
        detail: `Check these are true: ${terms.join(", ")}.`,
      });
    }
  }
  return warnings;
}

/** The body as paragraphs, for the PDF. */
export const letterParagraphs = (content: string) =>
  content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
