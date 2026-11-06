import { describe, expect, it } from "vitest";

import { planUpsert, type ExistingJob } from "@/server/jobs/dedupe";
import type { NormalizedJob } from "@/server/jobs/types";

function job(overrides: Partial<NormalizedJob>): NormalizedJob {
  return {
    provider: "remotive",
    providerJobId: "1",
    fingerprint: "fp-1",
    title: "Analyst",
    company: "Acme",
    description: "",
    sourceUrl: "https://example.com/1",
    locationRaw: "",
    locations: [],
    city: null,
    remotePolicy: "remote",
    employmentType: "unknown",
    experienceLevel: "unknown",
    category: null,
    tags: [],
    salaryText: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryAnnualMin: null,
    salaryAnnualMax: null,
    postedAt: null,
    ...overrides,
  };
}

const row = (overrides: Partial<ExistingJob>): ExistingJob => ({
  id: "row-1",
  provider: "remotive",
  provider_job_id: "1",
  fingerprint: "fp-1",
  ...overrides,
});

describe("planUpsert", () => {
  it("inserts new jobs", () => {
    const plan = planUpsert([job({})], []);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.updates).toHaveLength(0);
  });

  it("updates a job it already has from the same provider", () => {
    const plan = planUpsert([job({ title: "New title" })], [row({})]);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates).toEqual([
      { id: "row-1", job: expect.objectContaining({ title: "New title" }) },
    ]);
  });

  it("does not store the same job twice within one fetch", () => {
    const plan = planUpsert(
      [job({ providerJobId: "1" }), job({ providerJobId: "2" })],
      [],
    );
    expect(plan.inserts).toHaveLength(1);
    expect(plan.duplicates).toBe(1);
  });

  it("treats the same job from another provider as a duplicate", () => {
    const plan = planUpsert(
      [job({ provider: "adzuna", providerJobId: "99" })],
      [row({})],
    );
    expect(plan.inserts).toHaveLength(0);
    expect(plan.duplicates).toBe(1);
    expect(plan.seenIds).toEqual(["row-1"]);
  });

  it("treats a repost under a new ID as a duplicate", () => {
    const plan = planUpsert([job({ providerJobId: "2" })], [row({})]);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.duplicates).toBe(1);
  });

  it("keeps the old fingerprint if an edit would collide with another row", () => {
    const plan = planUpsert(
      [job({ providerJobId: "2", fingerprint: "fp-1" })],
      [
        row({}),
        row({ id: "row-2", provider_job_id: "2", fingerprint: "fp-2" }),
      ],
    );
    expect(plan.updates[0].job.fingerprint).toBe("fp-2");
  });

  it("does nothing for an empty fetch", () => {
    expect(planUpsert([], [row({})])).toEqual({
      inserts: [],
      updates: [],
      seenIds: [],
      duplicates: 0,
    });
  });
});
