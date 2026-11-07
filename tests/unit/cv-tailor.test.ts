import { describe, expect, it } from "vitest";

import { applyTailoring, ungroundedTerms, versionWarnings, type TailorOutput } from "@/lib/cv/tailor";
import type { CvProfile } from "@/lib/cv/profile";

import { sampleProfile } from "../fixtures/profile";

const output = (overrides: Partial<TailorOutput> = {}): TailorOutput => ({
  job_keywords: [],
  summary: "",
  role_descriptions: [],
  skills_first: [],
  ...overrides,
});

const twoRoles: CvProfile = {
  ...sampleProfile,
  experience: [
    sampleProfile.experience[0],
    {
      title: "Junior Analyst",
      company: "Older Company",
      location: "",
      start_date: "2019-01",
      end_date: "2020-12",
      is_current: false,
      description: "Cleaned 300 spreadsheets each month.",
    },
  ],
};

describe("applyTailoring", () => {
  it("keeps accurate rewording and records it", () => {
    const result = applyTailoring(
      sampleProfile,
      output({ summary: "Data analyst building reporting for product teams." }),
    );
    expect(result.profile.summary).toBe("Data analyst building reporting for product teams.");
    expect(result.changes).toHaveLength(1);
    expect(result.rejected).toEqual([]);
  });

  it("rejects an invented employer and keeps the verified text", () => {
    const result = applyTailoring(
      sampleProfile,
      output({ summary: "Data analyst formerly at Google." }),
    );
    expect(result.profile.summary).toBe(sampleProfile.summary);
    expect(result.rejected[0].terms).toContain("Google");
  });

  it("rejects an invented number", () => {
    const result = applyTailoring(
      sampleProfile,
      output({
        role_descriptions: [{ role_index: 0, description: "Built 40 weekly SQL reports." }],
      }),
    );
    expect(result.profile.experience[0].description).toBe(
      sampleProfile.experience[0].description,
    );
    expect(result.rejected[0].terms).toContain("40");
  });

  it("does not let a figure move from one role to another", () => {
    const result = applyTailoring(
      twoRoles,
      output({
        role_descriptions: [{ role_index: 0, description: "Built 300 weekly SQL reports." }],
      }),
    );
    expect(result.profile.experience[0].description).toBe(twoRoles.experience[0].description);
    expect(result.rejected).toHaveLength(1);
  });

  it("rejects a lower-case job keyword the CV does not have", () => {
    const result = applyTailoring(
      sampleProfile,
      output({
        job_keywords: ["dbt"],
        summary: "Data analyst who builds reporting in dbt for product teams.",
      }),
    );
    expect(result.profile.summary).toBe(sampleProfile.summary);
    expect(result.rejected[0].terms).toContain("dbt");
  });

  it("treats job tags as keywords too", () => {
    const result = applyTailoring(
      sampleProfile,
      output({ summary: "Data analyst who uses looker for product teams." }),
      ["looker"],
    );
    expect(result.profile.summary).toBe(sampleProfile.summary);
    expect(result.keywords).toEqual([{ term: "looker", found: false }]);
  });

  it("can change wording only: facts about roles and education are untouched", () => {
    const result = applyTailoring(
      twoRoles,
      output({
        summary: "Data analyst building reporting for product teams.",
        role_descriptions: [
          { role_index: 0, description: "Built weekly reports in SQL for the sales team." },
        ],
      }),
    );
    const facts = (profile: CvProfile) => ({
      contact: profile.contact,
      roles: profile.experience.map((role) => ({ ...role, description: "" })),
      education: profile.education,
      certifications: profile.certifications,
      languages: profile.languages,
    });
    expect(facts(result.profile)).toEqual(facts(twoRoles));
  });

  it("reorders skills without adding or dropping any", () => {
    const result = applyTailoring(
      sampleProfile,
      output({ skills_first: ["python", "Rust", "SQL"] }),
    );
    expect(result.profile.skills.slice(0, 2)).toEqual(["Python", "SQL"]);
    expect(result.profile.skills).not.toContain("Rust");
    expect(result.profile.skills.toSorted()).toEqual(sampleProfile.skills.toSorted());
    expect(result.skills_reordered).toBe(true);
  });

  it("ignores a role that does not exist and a repeated role", () => {
    const result = applyTailoring(
      sampleProfile,
      output({
        role_descriptions: [
          { role_index: 7, description: "Worked somewhere else." },
          { role_index: 0, description: "Built weekly reports in SQL for the sales team." },
          { role_index: 0, description: "Built reports." },
        ],
      }),
    );
    expect(result.profile.experience).toHaveLength(1);
    expect(result.profile.experience[0].description).toBe(
      "Built weekly reports in SQL for the sales team.",
    );
  });

  it("keeps the verified text when the AI leaves a field empty", () => {
    const result = applyTailoring(
      sampleProfile,
      output({ role_descriptions: [{ role_index: 0, description: "  " }] }),
    );
    expect(result.profile).toEqual(sampleProfile);
    expect(result.changes).toEqual([]);
  });

  it("reports which keywords the CV has, without repeats", () => {
    const { keywords } = applyTailoring(
      sampleProfile,
      output({ job_keywords: ["SQL", "sql", "dbt", " "] }),
    );
    expect(keywords).toEqual([
      { term: "SQL", found: true },
      { term: "dbt", found: false },
    ]);
  });

  it("does not change the profile it was given", () => {
    const copy = structuredClone(sampleProfile);
    applyTailoring(sampleProfile, output({ summary: "Data analyst.", skills_first: ["Excel"] }));
    expect(sampleProfile).toEqual(copy);
  });
});

describe("ungroundedTerms", () => {
  it("passes text that uses only the source's names and numbers", () => {
    expect(ungroundedTerms("Reports at Example Analytics.", sampleProfile, [])).toEqual([]);
  });

  it("does not match a keyword inside a longer word", () => {
    expect(ungroundedTerms("javascript and more", {}, ["java"])).toEqual([]);
  });
});

describe("versionWarnings", () => {
  it("is empty for an untouched copy", () => {
    expect(versionWarnings(sampleProfile, sampleProfile)).toEqual([]);
  });

  it("flags what a person added, in any field", () => {
    const edited: CvProfile = {
      ...sampleProfile,
      summary: "Data analyst formerly at Google.",
      skills: [...sampleProfile.skills, "Kubernetes"],
      experience: [{ ...sampleProfile.experience[0], company: "Other Company" }],
    };
    const values = versionWarnings(edited, sampleProfile).map((warning) => warning.value);
    expect(values).toEqual(expect.arrayContaining(["Google", "Kubernetes", "Other Company"]));
  });
});
