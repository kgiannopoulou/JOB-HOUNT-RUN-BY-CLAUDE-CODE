import { describe, expect, it } from "vitest";

import {
  completeness,
  dropInvalidDates,
  emptyProfile,
  experienceMonths,
  isValidCvDate,
  normalizeProfile,
  profileChecks,
  profileIssues,
  profileWithoutContact,
  type CvExperience,
  type CvProfile,
} from "@/lib/cv/profile";

import { sampleProfile } from "../fixtures/profile";

const role = (overrides: Partial<CvExperience>): CvExperience => ({
  title: "Analyst",
  company: "Acme",
  location: "",
  start_date: "",
  end_date: "",
  is_current: false,
  description: "",
  ...overrides,
});

const withRoles = (...experience: CvExperience[]): CvProfile => ({
  ...emptyProfile,
  experience,
});

const now = new Date("2026-11-07T00:00:00Z");

describe("normalizeProfile", () => {
  it("trims text and removes empty and repeated entries", () => {
    const result = normalizeProfile({
      ...emptyProfile,
      contact: { ...emptyProfile.contact, full_name: "  Alex   Example ", links: ["", "a.com", "A.com"] },
      skills: ["SQL", " sql ", "", "Python"],
      experience: [role({ title: "", company: "" })],
      languages: [{ name: "", level: "C1" }],
    });
    expect(result.contact.full_name).toBe("Alex Example");
    expect(result.contact.links).toEqual(["a.com"]);
    expect(result.skills).toEqual(["SQL", "Python"]);
    expect(result.experience).toEqual([]);
    expect(result.languages).toEqual([]);
  });

  it("clears the end date of a current role", () => {
    const result = normalizeProfile(
      withRoles(role({ start_date: "2020", end_date: "2021", is_current: true })),
    );
    expect(result.experience[0].end_date).toBe("");
  });

  it("keeps line breaks in descriptions", () => {
    const result = normalizeProfile(withRoles(role({ description: "One\nTwo" })));
    expect(result.experience[0].description).toBe("One\nTwo");
  });
});

describe("dates", () => {
  it.each(["", "2021", "2021-01", "2021-12"])("accepts %j", (value) => {
    expect(isValidCvDate(value)).toBe(true);
  });

  it.each(["2021-13", "2021-1", "Jan 2021", "21", "2021-00"])("rejects %j", (value) => {
    expect(isValidCvDate(value)).toBe(false);
  });

  it("drops dates a model returned in the wrong format", () => {
    const result = dropInvalidDates(withRoles(role({ start_date: "Spring 2021", end_date: "2022" })));
    expect(result.experience[0].start_date).toBe("");
    expect(result.experience[0].end_date).toBe("2022");
  });
});

describe("profileIssues", () => {
  const valid = { ...sampleProfile };

  it("accepts a complete profile", () => {
    expect(profileIssues(valid)).toEqual([]);
  });

  it("requires a name", () => {
    const profile = { ...valid, contact: { ...valid.contact, full_name: "" } };
    expect(profileIssues(profile)).toContain("Enter your full name.");
  });

  it("rejects badly written dates", () => {
    const profile = { ...valid, experience: [role({ start_date: "March 2021" })] };
    expect(profileIssues(profile).join()).toContain("YYYY-MM");
  });

  it("rejects an end date before the start date", () => {
    const profile = { ...valid, experience: [role({ start_date: "2022-05", end_date: "2021-01" })] };
    expect(profileIssues(profile).join()).toContain("before the start date");
  });

  it("allows a year-only end date in the same year as the start", () => {
    const profile = { ...valid, experience: [role({ start_date: "2022-05", end_date: "2022" })] };
    expect(profileIssues(profile)).toEqual([]);
  });

  it("rejects a role without a company", () => {
    const profile = { ...valid, experience: [role({ company: "" })] };
    expect(profileIssues(profile).join()).toContain("job title and a company");
  });

  it("rejects a profile that is too large", () => {
    const profile = { ...valid, summary: "x".repeat(100_001) };
    expect(profileIssues(profile).join()).toContain("too long");
  });
});

describe("experienceMonths", () => {
  it("counts a closed role", () => {
    const profile = withRoles(role({ start_date: "2020-01", end_date: "2020-12" }));
    expect(experienceMonths(profile, now)).toBe(12);
  });

  it("counts a current role up to now", () => {
    const profile = withRoles(role({ start_date: "2026-01", is_current: true }));
    expect(experienceMonths(profile, now)).toBe(10);
  });

  it("counts overlapping roles once", () => {
    const profile = withRoles(
      role({ start_date: "2020-01", end_date: "2020-12" }),
      role({ start_date: "2020-07", end_date: "2021-06" }),
    );
    expect(experienceMonths(profile, now)).toBe(18);
  });

  it("does not count a role inside another twice", () => {
    const profile = withRoles(
      role({ start_date: "2020-01", end_date: "2021-12" }),
      role({ start_date: "2020-06", end_date: "2020-08" }),
    );
    expect(experienceMonths(profile, now)).toBe(24);
  });

  it("counts gaps as nothing", () => {
    const profile = withRoles(
      role({ start_date: "2020-01", end_date: "2020-06" }),
      role({ start_date: "2022-01", end_date: "2022-06" }),
    );
    expect(experienceMonths(profile, now)).toBe(12);
  });

  it("ignores roles it cannot date", () => {
    const profile = withRoles(role({ start_date: "2020-01" }), role({ end_date: "2021" }));
    expect(experienceMonths(profile, now)).toBe(0);
  });

  it("does not count future dates", () => {
    const profile = withRoles(role({ start_date: "2026-01", end_date: "2030-12" }));
    expect(experienceMonths(profile, now)).toBe(10);
  });

  it("gives the same answer whatever the order of roles", () => {
    const a = role({ start_date: "2020-01", end_date: "2020-12" });
    const b = role({ start_date: "2019-01", end_date: "2020-03" });
    expect(experienceMonths(withRoles(a, b), now)).toBe(experienceMonths(withRoles(b, a), now));
  });
});

describe("profileChecks", () => {
  it("gives an empty profile no credit", () => {
    expect(completeness(profileChecks(emptyProfile))).toBe(0);
  });

  it("scores the sample profile the same every time", () => {
    const checks = profileChecks(sampleProfile);
    expect(checks.every((check) => check.passed)).toBe(true);
    expect(completeness(checks)).toBe(100);
  });

  it("handles an empty list of checks", () => {
    expect(completeness([])).toBe(0);
  });
});

describe("profileWithoutContact", () => {
  it("removes contact details from what is sent for analysis", () => {
    const text = JSON.stringify(profileWithoutContact(sampleProfile));
    expect(text).not.toContain("alex@example.com");
    expect(text).not.toContain("Alex Example");
    expect(text).not.toContain("+30 210");
  });
});
