import { describe, expect, it } from "vitest";

import {
  buildLetter,
  letterOutputSchema,
  letterParagraphs,
  letterWarnings,
  type LetterOutput,
} from "@/lib/letters/letter";

import { sampleProfile } from "../fixtures/profile";

const job = { company: "Acme Data", roleTitle: "Reporting Analyst" };

const output = (overrides: Partial<LetterOutput> = {}): LetterOutput => ({
  greeting: "Dear Hiring Team,",
  paragraphs: ["I am applying for the Reporting Analyst role at Acme Data."],
  closing: "Kind regards,",
  job_keywords: [],
  ...overrides,
});

const build = (overrides: Partial<LetterOutput> = {}, tags: string[] = []) =>
  buildLetter({ output: output(overrides), profile: sampleProfile, ...job, tags });

describe("buildLetter", () => {
  it("assembles greeting, body, closing and the name from the CV", () => {
    const { content, removed } = build();
    expect(content).toBe(
      "Dear Hiring Team,\n\nI am applying for the Reporting Analyst role at Acme Data.\n\nKind regards,\nAlex Example",
    );
    expect(removed).toEqual([]);
  });

  it("allows the company and position, which the CV does not contain", () => {
    expect(build().content).toContain("Acme Data");
  });

  it("removes a sentence naming an invented employer, and keeps the rest", () => {
    const { content, removed } = build({
      paragraphs: ["I build weekly SQL reports. I worked at Google for a while. I use Python."],
    });
    expect(content).not.toContain("Google");
    expect(content).toContain("I build weekly SQL reports. I use Python.");
    expect(removed).toEqual([
      { sentence: "I worked at Google for a while.", terms: ["Google"] },
    ]);
  });

  it("removes a sentence with an invented number", () => {
    const { content, removed } = build({
      paragraphs: ["I build reports. I cut costs by 40% last year."],
    });
    expect(content).not.toContain("40");
    expect(removed[0].terms).toContain("40");
  });

  it("removes a claim to a required skill the CV lacks, even in lower case", () => {
    const { content } = build({
      job_keywords: ["dbt"],
      paragraphs: ["I build reports. I am comfortable with dbt."],
    });
    expect(content).not.toContain("dbt");
  });

  it("uses job tags as a second list of skills that cannot be claimed", () => {
    const { content } = build(
      { paragraphs: ["I build reports. I also know looker well."] },
      ["looker"],
    );
    expect(content).not.toContain("looker");
  });

  it("keeps a keyword the CV really has", () => {
    const { removed } = build({
      job_keywords: ["SQL"],
      paragraphs: ["I write SQL every week."],
    });
    expect(removed).toEqual([]);
  });

  it("does not treat words in the position as false claims", () => {
    const { removed } = build({
      job_keywords: ["reporting"],
      paragraphs: ["I am applying to the reporting team."],
    });
    expect(removed).toEqual([]);
  });

  it("drops a paragraph with nothing left in it", () => {
    const { content } = build({
      paragraphs: ["I build reports.", "I worked at Google."],
    });
    expect(content.split("\n\n")).toHaveLength(3);
  });

  it("returns nothing if no sentence survives", () => {
    expect(build({ paragraphs: ["I worked at Google."] }).content).toBe("");
  });

  it("replaces a greeting naming an invented person", () => {
    expect(build({ greeting: "Dear Ms Papadopoulou," }).content).toMatch(/^Dear Hiring Team,/);
  });

  it("handles Greek sentences", () => {
    const { content, removed } = build({
      greeting: "Αξιότιμη ομάδα,",
      paragraphs: ["Φτιάχνω αναφορές με SQL. Εργάστηκα στη Google."],
      closing: "Με εκτίμηση,",
    });
    expect(content).toContain("Φτιάχνω αναφορές με SQL.");
    expect(removed[0].terms).toContain("Google");
  });
});

describe("letterWarnings", () => {
  const body = "I am applying for the Reporting Analyst role at Acme Data.";

  it("is empty for a letter naming the job and only what the CV shows", () => {
    expect(letterWarnings(body, job.company, job.roleTitle, sampleProfile)).toEqual([]);
  });

  it("warns when the company or position is missing", () => {
    const labels = letterWarnings("I would like this job.", job.company, job.roleTitle, null).map(
      (warning) => warning.label,
    );
    expect(labels).toEqual(["Company", "Position"]);
  });

  it("warns about anything a person added that the CV lacks", () => {
    const [warning] = letterWarnings(
      `${body} I worked at Google.`,
      job.company,
      job.roleTitle,
      sampleProfile,
    );
    expect(warning.detail).toContain("Google");
  });

  it("does not flag the candidate's own name", () => {
    expect(
      letterWarnings(`${body}\n\nKind regards,\nAlex Example`, job.company, job.roleTitle, sampleProfile),
    ).toEqual([]);
  });
});

describe("letterParagraphs", () => {
  it("splits on blank lines and keeps line breaks inside a paragraph", () => {
    expect(letterParagraphs("One\n\n\nTwo\nThree\n \nFour")).toEqual(["One", "Two\nThree", "Four"]);
  });
});

describe("letterOutputSchema", () => {
  it("rejects output with no paragraphs field", () => {
    expect(letterOutputSchema.safeParse({ greeting: "Hi" }).success).toBe(false);
  });
});
