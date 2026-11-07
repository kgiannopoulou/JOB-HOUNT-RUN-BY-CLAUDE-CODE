import { describe, expect, it } from "vitest";

import { buildCvAnalysis, formatExperience, type CvAnalysisOutput } from "@/lib/cv/analysis";
import {
  containsPhrase,
  findUngrounded,
  normalizeForMatch,
  unsupportedTerms,
} from "@/lib/cv/grounding";

import { sampleCvLines } from "../fixtures/documents";
import { sampleProfile } from "../fixtures/profile";

describe("containsPhrase", () => {
  const source = normalizeForMatch("Skilled in JavaScript, C++ and C#. Used Node.js at Café Ltd.");

  it("matches whole words only", () => {
    expect(containsPhrase(source, "JavaScript")).toBe(true);
    expect(containsPhrase(source, "Java")).toBe(false);
  });

  it("keeps the symbols that tell technologies apart", () => {
    expect(containsPhrase(source, "C++")).toBe(true);
    expect(containsPhrase(source, "C#")).toBe(true);
    expect(containsPhrase(source, "C")).toBe(false);
    expect(containsPhrase(source, "Node.js")).toBe(true);
  });

  it("ignores case, accents and line breaks", () => {
    expect(containsPhrase(source, "cafe ltd")).toBe(true);
    expect(containsPhrase(normalizeForMatch("weekly\nreports"), "weekly reports")).toBe(true);
  });

  it("never matches an empty phrase", () => {
    expect(containsPhrase(source, "")).toBe(false);
    expect(containsPhrase(source, " - ")).toBe(false);
  });
});

describe("findUngrounded", () => {
  const text = sampleCvLines.join("\n");

  it("accepts values found in the file", () => {
    expect(findUngrounded(sampleProfile, text)).toEqual([]);
  });

  it("flags an invented skill and employer", () => {
    const flagged = findUngrounded(
      {
        ...sampleProfile,
        skills: [...sampleProfile.skills, "Kubernetes"],
        experience: [{ ...sampleProfile.experience[0], company: "Google" }],
      },
      text,
    );
    expect(flagged).toEqual([
      { section: "Experience", value: "Google" },
      { section: "Skills", value: "Kubernetes" },
    ]);
  });
});

describe("unsupportedTerms", () => {
  it("accepts text built from the profile", () => {
    const text = "Data Analyst at Example Analytics using SQL and Python.";
    expect(unsupportedTerms(text, sampleProfile)).toEqual([]);
  });

  it("flags a new employer and a new number", () => {
    const text = "Analyst who worked with Google and improved revenue by 40%.";
    expect(unsupportedTerms(text, sampleProfile)).toEqual(["Google", "40"]);
  });

  it("ignores ordinary capitals at the start of a sentence", () => {
    expect(unsupportedTerms("Experienced analyst. Reliable reporting.", sampleProfile)).toEqual([]);
  });
});

const output: CvAnalysisOutput = {
  overview: "A clear CV.",
  strengths: [
    { title: "Reporting", detail: "Regular reports", evidence: "Built weekly SQL reports" },
    { title: "Leadership", detail: "Led a team", evidence: "Led a team of ten" },
  ],
  weaknesses: [],
  missing_information: [],
  improvements: [
    { section: "Skills", suggestion: "Group them", priority: "low" },
    { section: "Experience", suggestion: "Add results", priority: "high" },
  ],
  improved_summary: "Data analyst with 9 years at Google.",
  keywords: [
    { term: "SQL", reason: "Common" },
    { term: "dbt", reason: "Common" },
  ],
  recommendations: [],
};

describe("buildCvAnalysis", () => {
  const now = new Date("2026-11-07T00:00:00Z");
  const result = buildCvAnalysis(output, sampleProfile, now);

  it("marks evidence that is not in the CV", () => {
    expect(result.strengths.map((s) => s.evidence_found)).toEqual([true, false]);
  });

  it("checks keywords against the CV itself", () => {
    expect(result.keywords.map((k) => k.in_cv)).toEqual([true, false]);
  });

  it("flags invented facts in the improved summary", () => {
    expect(result.summary_terms_to_check).toEqual(["9", "Google"]);
  });

  it("calculates completeness and experience without the model", () => {
    expect(result.completeness).toBe(100);
    expect(result.experience_months).toBe(70);
  });

  it("puts high priority items first", () => {
    expect(result.improvements[0].priority).toBe("high");
  });
});

describe("formatExperience", () => {
  it.each([
    [0, "None dated"],
    [1, "1 month"],
    [12, "1 year"],
    [26, "2 years 2 months"],
  ])("formats %i months", (months, text) => {
    expect(formatExperience(months)).toBe(text);
  });
});
