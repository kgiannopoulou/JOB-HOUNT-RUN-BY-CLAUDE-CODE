import { describe, expect, it } from "vitest";

import {
  htmlToText,
  inferExperienceLevel,
  jobFingerprint,
  parseLocations,
  parseSalary,
} from "@/server/jobs/normalize";

describe("htmlToText", () => {
  it("removes tags and keeps line breaks", () => {
    expect(htmlToText("<p>First</p><p>Second <b>bold</b></p>")).toBe(
      "First\nSecond bold",
    );
  });

  it("drops scripts and styles with their contents", () => {
    expect(
      htmlToText("<script>alert(1)</script><style>p{}</style><p>Safe</p>"),
    ).toBe("Safe");
  });

  it("decodes named and numeric entities", () => {
    expect(htmlToText("Q&amp;A &#8211; &#x2014; caf&eacute;")).toBe(
      "Q&A – — caf&eacute;",
    );
  });
});

describe("parseSalary", () => {
  // Every string here was seen in the live Remotive feed.
  it.each([
    ["$20k -$35k", 20000, 35000, 20000, 35000],
    ["$170k - $200k", 170000, 200000, 170000, 200000],
    ["70K-80K", 70000, 80000, 70000, 80000],
    ["OTE $25k - $35k", 25000, 35000, 25000, 35000],
    ["$35,3k- $52k", 35300, 52000, 35300, 52000],
    ["$3.5k–$5k/month", 3500, 5000, 42000, 60000],
  ])("reads %s", (text, min, max, annualMin, annualMax) => {
    expect(parseSalary(text)).toMatchObject({ min, max, annualMin, annualMax });
  });

  it("applies a trailing K to both numbers", () => {
    expect(parseSalary("70-80K")).toMatchObject({ min: 70000, max: 80000 });
  });

  it("reads thousands separators and a single amount", () => {
    expect(parseSalary("$120,000")).toMatchObject({ min: 120000, max: 120000 });
  });

  it("annualises hourly pay", () => {
    expect(parseSalary("$50 per hour")).toMatchObject({ annualMin: 104000 });
  });

  it("detects the currency, with a fallback", () => {
    expect(parseSalary("€50k")?.currency).toBe("EUR");
    expect(parseSalary("£50k")?.currency).toBe("GBP");
    expect(parseSalary("50k", "USD")?.currency).toBe("USD");
  });

  it.each([
    ["empty text", ""],
    ["no text", null],
    ["pay per task", "$1000 per task"],
    ["no numbers", "Competitive"],
    ["too many numbers", "$10k, $20k, $30k"],
    ["an implausibly small amount", "$5"],
  ])("returns null for %s rather than guessing", (_name, text) => {
    expect(parseSalary(text)).toBeNull();
  });
});

describe("inferExperienceLevel", () => {
  it.each([
    ["Senior Data Engineer", "senior"],
    ["Sr. Developer", "senior"],
    ["Junior Analyst", "entry"],
    ["Graduate Software Engineer", "entry"],
    ["Marketing Intern", "intern"],
    ["Staff Engineer", "lead"],
    ["Head of Product", "lead"],
    ["Data Analyst", "unknown"],
    ["Internal Auditor", "unknown"],
  ])("reads %s as %s", (title, level) => {
    expect(inferExperienceLevel(title)).toBe(level);
  });
});

describe("parseLocations", () => {
  it("splits lists and uses one spelling per place", () => {
    expect(parseLocations("Europe, USA, Canada")).toEqual([
      "Europe",
      "United States",
      "Canada",
    ]);
  });

  it("ignores time zone notes and repeated places", () => {
    expect(parseLocations("USA, Canada, USA timezones, US")).toEqual([
      "United States",
      "Canada",
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(parseLocations("")).toEqual([]);
    expect(parseLocations(null)).toEqual([]);
  });
});

describe("jobFingerprint", () => {
  const base = {
    company: "Acme Inc.",
    title: "Data Analyst",
    locations: ["Germany", "France"],
  };

  it("matches despite case, punctuation, suffixes and location order", () => {
    expect(
      jobFingerprint({
        company: "ACME",
        title: "data analyst (Remote)",
        locations: ["France", "Germany"],
      }),
    ).toBe(jobFingerprint(base));
  });

  it("differs when the company, title or location differs", () => {
    const fingerprint = jobFingerprint(base);
    expect(jobFingerprint({ ...base, company: "Other" })).not.toBe(fingerprint);
    expect(jobFingerprint({ ...base, title: "Data Engineer" })).not.toBe(fingerprint);
    expect(jobFingerprint({ ...base, locations: ["Spain"] })).not.toBe(fingerprint);
  });
});
