import { describe, expect, it } from "vitest";

import {
  buildFeedback,
  countWords,
  feedbackOutputSchema,
  isTooShort,
  overallRating,
  summarizeSession,
  tooShortFeedback,
  type FeedbackItem,
} from "@/lib/interview/feedback";
import {
  checkQuestions,
  questionOutputSchema,
  type QuestionOutput,
} from "@/lib/interview/questions";

import { sampleProfile } from "../fixtures/profile";

const jobText = "Reporting Analyst\nYou must have strong SQL skills. Build reports for product teams.";

type Raw = QuestionOutput["questions"][number];

const raw = (overrides: Partial<Raw>): Raw => ({
  category: "technical",
  question: "How would you speed up a slow query?",
  why_it_may_come_up: "The role asks for SQL.",
  job_quote: "",
  structure_name: "Problem, approach, result",
  structure_steps: ["Problem", "Approach", "Result"],
  ...overrides,
});

const check = (
  questions: Raw[],
  overrides: Partial<Parameters<typeof checkQuestions>[0]> = {},
) =>
  checkQuestions({
    output: { questions },
    profile: sampleProfile,
    jobText,
    company: "Acme Data",
    roleTitle: "Reporting Analyst",
    focus: "mixed",
    mode: "practice",
    ...overrides,
  });

describe("question checks: company facts", () => {
  it("keeps a company question that quotes the posting", () => {
    const { questions } = check([
      raw({
        category: "company",
        question: "How would you build reports for product teams here?",
        job_quote: "Build reports for product teams",
      }),
    ]);
    expect(questions).toHaveLength(1);
    expect(questions[0].job_quote).toBe("Build reports for product teams");
  });

  it("drops a company question with no quote", () => {
    const { questions, dropped } = check([
      raw({ category: "company", question: "What do you think of our culture?" }),
    ]);
    expect(questions).toEqual([]);
    expect(dropped[0].reason).toContain("did not quote");
  });

  it("drops a company question whose quote is not in the posting", () => {
    const { questions } = check([
      raw({
        category: "company",
        question: "Why do you want to join us?",
        job_quote: "A market leader since 1990",
      }),
    ]);
    expect(questions).toEqual([]);
  });

  it("drops a real quote attached to an invented company fact", () => {
    const { questions, dropped } = check([
      raw({
        category: "company",
        question: "How do reports fit with the recent merger with Globex?",
        job_quote: "Build reports for product teams",
      }),
    ]);
    expect(questions).toEqual([]);
    expect(dropped[0].reason).toContain("Globex");
  });

  it("drops an invented number about the company", () => {
    const { questions } = check([
      raw({
        category: "company",
        question: "How would you serve our 500 product teams?",
        job_quote: "Build reports for product teams",
      }),
    ]);
    expect(questions).toEqual([]);
  });

  it("allows no company questions when there is no job posting", () => {
    const { questions } = check(
      [
        raw({ category: "company", question: "Why this employer?", job_quote: "anything" }),
        raw({}),
      ],
      { jobText: "" },
    );
    expect(questions.map((question) => question.category)).toEqual(["technical"]);
  });

  it("clears a quote on another question that is not really in the posting", () => {
    const { questions } = check([raw({ job_quote: "Not in the posting at all" })]);
    expect(questions[0].job_quote).toBe("");
  });
});

describe("question checks: the candidate", () => {
  it("keeps a behavioural question built on the CV", () => {
    const { questions } = check([
      raw({
        category: "behavioural",
        question: "Tell me about a report you built at Example Analytics.",
      }),
    ]);
    expect(questions).toHaveLength(1);
  });

  it("drops a behavioural question assuming an employer the CV lacks", () => {
    const { questions, dropped } = check([
      raw({ category: "behavioural", question: "Tell me about your time at Google." }),
    ]);
    expect(questions).toEqual([]);
    expect(dropped[0].reason).toContain("Google");
  });

  it("allows general technical topics the posting does not name", () => {
    const { questions } = check([raw({ question: "When would you choose Postgres over MongoDB?" })]);
    expect(questions).toHaveLength(1);
  });
});

describe("question checks: no promises", () => {
  it.each([
    "You will definitely be asked this.",
    "This will be asked.",
    "This is guaranteed to come up.",
    "They are going to certainly raise this.",
  ])("removes %s", (why_it_may_come_up) => {
    expect(check([raw({ why_it_may_come_up })]).questions[0].why_it_may_come_up).toBe("");
  });

  it("keeps careful wording", () => {
    const why_it_may_come_up = "This could come up, because the role asks for SQL.";
    expect(check([raw({ why_it_may_come_up })]).questions[0].why_it_may_come_up).toBe(
      why_it_may_come_up,
    );
  });

  it("drops a question that itself makes the promise", () => {
    expect(check([raw({ question: "You will be asked about SQL. Ready?" })]).questions).toEqual([]);
  });
});

describe("question checks: shape", () => {
  const many = (category: Raw["category"], count: number, extra: Partial<Raw> = {}) =>
    Array.from({ length: count }, (_, index) =>
      raw({ category, question: `What about ${category} topic ${"abcdefgh"[index]}?`, ...extra }),
    );

  it("removes repeats, ignoring case and punctuation", () => {
    const { questions } = check([
      raw({ question: "How do you test SQL?" }),
      raw({ question: "how do you test sql" }),
      raw({ question: "  " }),
    ]);
    expect(questions).toHaveLength(1);
  });

  it("balances a mixed session", () => {
    const { questions } = check([...many("technical", 6), ...many("behavioural", 6)]);
    const count = (category: string) => questions.filter((q) => q.category === category).length;
    expect(count("technical")).toBe(3);
    expect(count("behavioural")).toBe(3);
  });

  it("follows the chosen focus", () => {
    const { questions } = check([...many("technical", 8), ...many("behavioural", 8)], {
      focus: "technical",
    });
    expect(questions.filter((q) => q.category === "technical")).toHaveLength(6);
  });

  it("keeps a mock interview shorter than a practice session", () => {
    const input = [...many("technical", 8), ...many("behavioural", 8)];
    expect(check(input, { focus: "technical", mode: "mock" }).questions).toHaveLength(6);
  });

  it("removes empty structure steps", () => {
    const { questions } = check([raw({ structure_steps: ["One", " ", "Two"] })]);
    expect(questions[0].structure_steps).toEqual(["One", "Two"]);
  });

  it("rejects malformed AI output", () => {
    expect(questionOutputSchema.safeParse({ questions: [{ category: "trivia" }] }).success).toBe(false);
  });
});

const answer = "I added indexes to the slowest tables and rewrote the joins in the weekly report.";
const question = "How would you speed up a slow query?";

const item = (overrides: Partial<FeedbackItem> = {}): FeedbackItem => ({
  question_index: 0,
  criteria: [
    { criterion: "relevance", rating: "strong", comment: "On topic.", answer_quote: "added indexes" },
    { criterion: "structure", rating: "strong", comment: "Clear.", answer_quote: "rewrote the joins" },
    { criterion: "specificity", rating: "strong", comment: "Detailed.", answer_quote: "weekly report" },
    { criterion: "impact", rating: "adequate", comment: "Implied.", answer_quote: "" },
  ],
  strengths: [{ text: "Concrete technique.", answer_quote: "added indexes" }],
  weaknesses: ["No result."],
  improvements: ["Add the result you really achieved."],
  summary: "A solid answer.",
  ...overrides,
});

describe("overallRating", () => {
  it.each([
    [{ relevance: "strong", structure: "strong", specificity: "strong", impact: "adequate" }, "strong"],
    [{ relevance: "strong", structure: "strong", specificity: "adequate", impact: "adequate" }, "adequate"],
    [{ relevance: "strong", structure: "strong", specificity: "strong", impact: "weak" }, "adequate"],
    [{ relevance: "weak", structure: "strong", specificity: "strong", impact: "strong" }, "weak"],
    [{ relevance: "strong", structure: "weak", specificity: "weak", impact: "strong" }, "weak"],
    [{}, "adequate"],
  ] as const)("rates %j as %s", (ratings, expected) => {
    expect(overallRating(ratings)).toBe(expected);
  });
});

describe("buildFeedback", () => {
  it("gives the same result for the same assessment", () => {
    expect(buildFeedback(item(), answer, question)).toEqual(buildFeedback(item(), answer, question));
  });

  it("rates a well-evidenced answer as strong", () => {
    expect(buildFeedback(item(), answer, question).rating).toBe("strong");
  });

  it("will not call something strong without a quote from the answer", () => {
    const feedback = buildFeedback(
      item({
        criteria: [
          { criterion: "relevance", rating: "strong", comment: "", answer_quote: "" },
          { criterion: "structure", rating: "strong", comment: "", answer_quote: "not in the answer" },
          { criterion: "specificity", rating: "strong", comment: "", answer_quote: "weekly report" },
        ],
      }),
      answer,
      question,
    );
    expect(feedback.criteria.map((c) => c.rating)).toEqual(["adequate", "adequate", "strong"]);
    expect(feedback.rating).toBe("adequate");
  });

  it("removes praise that points at words not in the answer", () => {
    const feedback = buildFeedback(
      item({
        strengths: [
          { text: "Real.", answer_quote: "added indexes" },
          { text: "Invented.", answer_quote: "cut costs by half" },
          { text: "No quote.", answer_quote: "" },
        ],
      }),
      answer,
      question,
    );
    expect(feedback.strengths).toEqual(["Real."]);
  });

  it("removes advice that supplies a figure the person never gave", () => {
    const feedback = buildFeedback(
      item({ improvements: ["Say the report ran 80% faster.", "Add your own result."] }),
      answer,
      question,
    );
    expect(feedback.improvements).toEqual(["Add your own result."]);
  });

  it("keeps a figure the person did give", () => {
    const feedback = buildFeedback(
      item({ improvements: ["Explain how you reached the 40% you mention."] }),
      `${answer} It ran 40% faster.`,
      question,
    );
    expect(feedback.improvements).toHaveLength(1);
  });

  it("counts a repeated criterion once", () => {
    const [first] = item().criteria;
    const feedback = buildFeedback(item({ criteria: [first, { ...first, rating: "weak" }] }), answer, question);
    expect(feedback.criteria).toHaveLength(1);
    expect(feedback.criteria[0].rating).toBe("strong");
  });

  it("marks a weak answer as weak", () => {
    const feedback = buildFeedback(
      item({
        criteria: [{ criterion: "relevance", rating: "weak", comment: "Off topic.", answer_quote: "" }],
      }),
      answer,
      question,
    );
    expect(feedback.rating).toBe("weak");
  });

  it("rejects malformed AI output", () => {
    expect(feedbackOutputSchema.safeParse({ items: [{ criteria: "good" }] }).success).toBe(false);
  });
});

describe("short answers", () => {
  it("counts words in any language", () => {
    expect(countWords("  one two\nthree ")).toBe(3);
    expect(countWords("Φτιάχνω αναφορές")).toBe(2);
    expect(countWords("   ")).toBe(0);
  });

  it("does not spend an AI call on a very short answer", () => {
    expect(isTooShort("I would use an index.")).toBe(true);
    expect(isTooShort(answer)).toBe(false);
  });

  it("rates a too-short answer as weak and says why", () => {
    const feedback = tooShortFeedback();
    expect(feedback.rating).toBe("weak");
    expect(feedback.too_short).toBe(true);
    expect(feedback.improvements.length).toBeGreaterThan(0);
  });
});

describe("summarizeSession", () => {
  it("counts answers and ratings, leaving unrated answers out of the ratings", () => {
    expect(
      summarizeSession(5, [
        { rating: "strong" },
        { rating: "weak" },
        { rating: "weak" },
        { rating: null },
      ]),
    ).toEqual({ total: 5, answered: 4, strong: 1, adequate: 0, weak: 2 });
  });
});
