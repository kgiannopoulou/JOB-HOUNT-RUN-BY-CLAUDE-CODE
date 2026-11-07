import { z } from "zod";

import { containsPhrase, normalizeForMatch } from "@/lib/cv/grounding";
import { profileFacts, type CvProfile } from "@/lib/cv/profile";
import { ungroundedTerms } from "@/lib/cv/tailor";

export const INTERVIEW_PROMPT_VERSION = "interview-v1";

export const MAX_SESSIONS_PER_USER = 100;

export const questionCategories = ["technical", "behavioural", "company"] as const;
export type QuestionCategory = (typeof questionCategories)[number];

export const categoryLabels: Record<QuestionCategory, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  company: "About this employer",
};

export const sessionFocuses = ["mixed", "technical", "behavioural"] as const;
export type SessionFocus = (typeof sessionFocuses)[number];

export const focusLabels: Record<SessionFocus, string> = {
  mixed: "Mixed",
  technical: "Mostly technical",
  behavioural: "Mostly behavioural",
};

export const sessionModes = ["practice", "mock"] as const;
export type SessionMode = (typeof sessionModes)[number];

export const modeDetails: Record<SessionMode, { label: string; hint: string }> = {
  practice: {
    label: "Practice",
    hint: "Work through questions in any order, with hints and feedback on each answer.",
  },
  mock: {
    label: "Mock interview",
    hint: "One question at a time with a timer and no hints. Feedback comes at the end.",
  },
};

export const questionOutputSchema = z.object({
  questions: z.array(
    z.object({
      category: z.enum(questionCategories),
      question: z.string(),
      why_it_may_come_up: z.string(),
      job_quote: z
        .string()
        .describe("Words copied exactly from the job text. Empty if there are none."),
      structure_name: z.string().describe('For example "STAR".'),
      structure_steps: z.array(z.string()),
    }),
  ),
});

export type QuestionOutput = z.infer<typeof questionOutputSchema>;

export type PreparedQuestion = {
  category: QuestionCategory;
  question: string;
  why_it_may_come_up: string;
  job_quote: string;
  structure_name: string;
  structure_steps: string[];
};

export type DroppedQuestion = { question: string; reason: string };

type CheckInput = {
  output: QuestionOutput;
  profile: CvProfile;
  /** Empty for an application tracked by hand, which has no job posting. */
  jobText: string;
  company: string;
  roleTitle: string;
  focus: SessionFocus;
  mode: SessionMode;
};

const LIMITS: Record<SessionMode, number> = { practice: 8, mock: 6 };

const MAX_COMPANY_QUESTIONS = 2;

const shares: Record<SessionFocus, Record<QuestionCategory, number>> = {
  mixed: { technical: 3, behavioural: 3, company: MAX_COMPANY_QUESTIONS },
  technical: { technical: 6, behavioural: 1, company: MAX_COMPANY_QUESTIONS },
  behavioural: { technical: 1, behavioural: 6, company: MAX_COMPANY_QUESTIONS },
};

/** Nobody can know what an employer will ask, so a claim that they will is removed. */
const CERTAINTY =
  /\b(will|are going to|is going to)\s+(definitely|certainly|surely|always)\b|\bguarantee[ds]?\b|\b(definitely|certainly)\s+(be\s+)?ask(ed)?\b|\bwill be asked\b/i;

const withoutCertainty = (text: string) => (CERTAINTY.test(text) ? "" : text.trim());

/**
 * Applies the rules a model cannot be trusted to follow. The only verified source
 * about an employer is the job posting, so a company question must quote it and
 * name nothing it does not contain. A behavioural question may mention only what
 * the posting or the CV says, so it cannot put words in the candidate's mouth.
 * A technical question states no facts, so general topics are allowed.
 */
export function checkQuestions({
  output,
  profile,
  jobText,
  company,
  roleTitle,
  focus,
  mode,
}: CheckInput): { questions: PreparedQuestion[]; dropped: DroppedQuestion[] } {
  const job = normalizeForMatch(jobText);
  const dropped: DroppedQuestion[] = [];
  const seen = new Set<string>();
  const used: Record<QuestionCategory, number> = { technical: 0, behavioural: 0, company: 0 };
  const questions: PreparedQuestion[] = [];

  for (const raw of output.questions) {
    const question = raw.question.trim();
    const key = normalizeForMatch(question);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const reject = (reason: string) => dropped.push({ question, reason });
    const quoteFound = Boolean(raw.job_quote.trim()) && containsPhrase(job, raw.job_quote);

    if (raw.category === "company") {
      if (!quoteFound) {
        reject("It did not quote the job posting.");
        continue;
      }
      const terms = ungroundedTerms(question, { jobText, company, roleTitle }, []);
      if (terms.length > 0) {
        reject(`It named something the job posting does not: ${terms.join(", ")}.`);
        continue;
      }
    }

    if (raw.category === "behavioural") {
      const terms = ungroundedTerms(
        question,
        { jobText, company, roleTitle, facts: profileFacts(profile) },
        [],
      );
      if (terms.length > 0) {
        reject(`It named something neither the job nor your CV does: ${terms.join(", ")}.`);
        continue;
      }
    }

    if (CERTAINTY.test(question)) {
      reject("It claimed to know what will be asked.");
      continue;
    }

    if (used[raw.category] >= shares[focus][raw.category]) continue;
    used[raw.category] += 1;

    questions.push({
      category: raw.category,
      question,
      why_it_may_come_up: withoutCertainty(raw.why_it_may_come_up),
      job_quote: quoteFound ? raw.job_quote.trim() : "",
      structure_name: raw.structure_name.trim(),
      structure_steps: raw.structure_steps.map((step) => step.trim()).filter(Boolean),
    });
  }

  return { questions: questions.slice(0, LIMITS[mode]), dropped };
}
