import { z } from "zod";

import { containsPhrase, normalizeForMatch } from "@/lib/cv/grounding";

export const MAX_ANSWER_LENGTH = 6000;

/** Below this there is nothing to assess, so no AI call is spent on it. */
export const MIN_ANSWER_WORDS = 15;

export const answerRatings = ["strong", "adequate", "weak"] as const;
export type AnswerRating = (typeof answerRatings)[number];

export const ratingLabels: Record<AnswerRating, string> = {
  strong: "Strong",
  adequate: "Adequate",
  weak: "Needs work",
};

const criteria = ["relevance", "structure", "specificity", "impact"] as const;
export type FeedbackCriterion = (typeof criteria)[number];

export const criterionLabels: Record<FeedbackCriterion, string> = {
  relevance: "Answers the question",
  structure: "Clear structure",
  specificity: "Specific detail",
  impact: "Shows the result",
};

export const feedbackOutputSchema = z.object({
  items: z.array(
    z.object({
      question_index: z.number().int().describe("The question's number, from 0."),
      criteria: z.array(
        z.object({
          criterion: z.enum(criteria),
          rating: z.enum(answerRatings),
          comment: z.string(),
          answer_quote: z
            .string()
            .describe("Words copied exactly from the answer. Empty if there are none."),
        }),
      ),
      strengths: z.array(z.object({ text: z.string(), answer_quote: z.string() })),
      weaknesses: z.array(z.string()),
      improvements: z.array(z.string()),
      summary: z.string(),
    }),
  ),
});

export type FeedbackItem = z.infer<typeof feedbackOutputSchema>["items"][number];

export type AnswerFeedback = {
  rating: AnswerRating;
  criteria: { criterion: FeedbackCriterion; rating: AnswerRating; comment: string }[];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  summary: string;
  /** True when the rating comes from length alone, with no AI call. */
  too_short: boolean;
};

export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const isTooShort = (answer: string) => countWords(answer) < MIN_ANSWER_WORDS;

export const tooShortFeedback = (): AnswerFeedback => ({
  rating: "weak",
  criteria: [],
  strengths: [],
  weaknesses: ["This answer is too short to assess."],
  improvements: ["Write what you would say out loud: the situation, what you did and the result."],
  summary: `Aim for at least ${MIN_ANSWER_WORDS} words so there is something to assess.`,
  too_short: true,
});

/** The rule behind the overall rating, so the same assessments always give the same result. */
export function overallRating(ratings: Record<string, AnswerRating>): AnswerRating {
  const values = Object.values(ratings);
  const weak = values.filter((rating) => rating === "weak").length;
  if (ratings.relevance === "weak" || weak >= 2) return "weak";
  const strong = values.filter((rating) => rating === "strong").length;
  return weak === 0 && strong >= 3 ? "strong" : "adequate";
}

const numbersIn = (text: string) => text.match(/\d[\d.,]*\d|\d/g) ?? [];

/**
 * Turns the model's view into feedback that can be trusted. Praise has to point at
 * words really in the answer. Advice cannot supply a figure the person never gave,
 * because it could be copied into an interview as if it were true.
 */
export function buildFeedback(item: FeedbackItem, answer: string, question: string): AnswerFeedback {
  const text = normalizeForMatch(answer);
  const quoted = (quote: string) => Boolean(quote.trim()) && containsPhrase(text, quote);

  const assessed = new Map<string, AnswerFeedback["criteria"][number]>();
  for (const entry of item.criteria) {
    if (assessed.has(entry.criterion)) continue;
    assessed.set(entry.criterion, {
      criterion: entry.criterion,
      rating: entry.rating === "strong" && !quoted(entry.answer_quote) ? "adequate" : entry.rating,
      comment: entry.comment.trim(),
    });
  }

  const known = new Set(numbersIn(`${answer} ${question}`));
  const inventsNumber = (advice: string) => numbersIn(advice).some((number) => !known.has(number));

  const list = [...assessed.values()];
  return {
    rating: overallRating(Object.fromEntries(list.map((c) => [c.criterion, c.rating]))),
    criteria: list,
    strengths: item.strengths
      .filter((strength) => quoted(strength.answer_quote))
      .map((strength) => strength.text.trim()),
    weaknesses: item.weaknesses.map((weakness) => weakness.trim()).filter(Boolean),
    improvements: item.improvements
      .map((improvement) => improvement.trim())
      .filter((improvement) => improvement && !inventsNumber(improvement)),
    summary: inventsNumber(item.summary) ? "" : item.summary.trim(),
    too_short: false,
  };
}

export type SessionSummary = {
  total: number;
  answered: number;
  strong: number;
  adequate: number;
  weak: number;
};

/** One rating per question: its latest answer's. */
export function summarizeSession(
  total: number,
  latest: { rating: string | null }[],
): SessionSummary {
  const count = (rating: AnswerRating) => latest.filter((a) => a.rating === rating).length;
  return {
    total,
    answered: latest.length,
    strong: count("strong"),
    adequate: count("adequate"),
    weak: count("weak"),
  };
}
