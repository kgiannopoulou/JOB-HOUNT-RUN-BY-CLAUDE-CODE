import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PAGE_SIZE, parseJobFilters } from "@/lib/job-filters";
import { getLocationOptions, searchJobs } from "@/server/jobs/search";

import { adminClient, anonClient, jobRow } from "./helpers";

// Every search is scoped to this company, so other rows cannot affect results.
const company = `Searchco ${randomUUID()}`;
const provider = "test-search";

function search(params: Record<string, string | string[]>) {
  return searchJobs(anonClient(), parseJobFilters({ company, ...params }));
}

const titles = async (params: Record<string, string | string[]>) =>
  (await search(params)).jobs.map((job) => job.title).sort();

beforeAll(async () => {
  const row = (overrides: Parameters<typeof jobRow>[0]) =>
    jobRow({ provider, company, ...overrides });

  const { error } = await adminClient()
    .from("jobs")
    .insert([
      row({
        title: "Senior Data Engineer",
        description: "Build pipelines with Python and Airflow.",
        locations: ["Germany"],
        location_raw: "Germany",
        remote_policy: "remote",
        employment_type: "full_time",
        experience_level: "senior",
        salary_annual_min: 90000,
        salary_annual_max: 120000,
        posted_at: "2026-11-01T00:00:00Z",
      }),
      row({
        title: "Junior Data Analyst",
        description: "Reporting with SQL. Data data data.",
        locations: ["Worldwide"],
        location_raw: "Worldwide",
        remote_policy: "remote",
        employment_type: "contract",
        experience_level: "entry",
        salary_annual_min: 30000,
        salary_annual_max: 40000,
        posted_at: "2026-11-03T00:00:00Z",
      }),
      row({
        title: "Office Manager",
        description: "Run the Athens office.",
        locations: ["Greece"],
        location_raw: "Athens, Greece",
        city: "Athens",
        remote_policy: "onsite",
        employment_type: "part_time",
        posted_at: "2026-11-02T00:00:00Z",
      }),
      row({
        title: "Hybrid Designer",
        locations: ["Canada"],
        location_raw: "Canada",
        remote_policy: "hybrid",
        employment_type: "freelance",
        posted_at: null,
      }),
      row({
        title: "Closed Role",
        is_active: false,
        posted_at: "2026-11-05T00:00:00Z",
      }),
    ], { defaultToNull: false });
  if (error) throw error;
});

afterAll(async () => {
  await adminClient().from("jobs").delete().eq("provider", provider);
});

describe("text search", () => {
  it("finds by job title, in any case", async () => {
    expect(await titles({ title: "data analyst" })).toEqual(["Junior Data Analyst"]);
  });

  it("finds keywords in the description", async () => {
    expect(await titles({ q: "airflow" })).toEqual(["Senior Data Engineer"]);
  });

  it("supports stemmed keywords", async () => {
    expect(await titles({ q: "pipeline" })).toEqual(["Senior Data Engineer"]);
  });

  it("handles search syntax without failing", async () => {
    await expect(search({ q: `"python" OR -sql (` })).resolves.toBeDefined();
  });

  it("treats % and _ as ordinary characters", async () => {
    expect(await titles({ title: "%" })).toEqual([]);
    expect(await titles({ title: "_" })).toEqual([]);
  });

  it("is not open to SQL injection", async () => {
    expect(await titles({ title: "'; drop table public.jobs; --" })).toEqual([]);
    expect((await search({})).total).toBeGreaterThan(0);
  });

  it("filters by company", async () => {
    const { jobs } = await searchJobs(
      anonClient(),
      parseJobFilters({ company: "no such company anywhere" }),
    );
    expect(jobs).toEqual([]);
  });
});

describe("filters", () => {
  it("filters by country, including jobs open worldwide", async () => {
    expect(await titles({ country: "Canada" })).toEqual([
      "Hybrid Designer",
      "Junior Data Analyst",
    ]);
  });

  it("filters by city", async () => {
    expect(await titles({ city: "athens" })).toEqual(["Office Manager"]);
  });

  it("filters by work arrangement", async () => {
    expect(await titles({ remote: "onsite" })).toEqual(["Office Manager"]);
    expect(await titles({ remote: ["onsite", "hybrid"] })).toEqual([
      "Hybrid Designer",
      "Office Manager",
    ]);
  });

  it("filters by employment type", async () => {
    expect(await titles({ type: "contract" })).toEqual(["Junior Data Analyst"]);
  });

  it("filters by experience level", async () => {
    expect(await titles({ level: "senior" })).toEqual(["Senior Data Engineer"]);
  });

  it("filters by salary, leaving out jobs with no salary", async () => {
    expect(await titles({ minSalary: "100000" })).toEqual(["Senior Data Engineer"]);
    expect(await titles({ minSalary: "1000" })).toEqual([
      "Junior Data Analyst",
      "Senior Data Engineer",
    ]);
  });

  it("combines filters", async () => {
    expect(await titles({ remote: "remote", level: "entry", q: "sql" })).toEqual([
      "Junior Data Analyst",
    ]);
    expect(await titles({ remote: "onsite", level: "senior" })).toEqual([]);
  });

  it("leaves out inactive jobs", async () => {
    expect(await titles({})).not.toContain("Closed Role");
  });
});

describe("sorting", () => {
  it("puts the newest first and undated jobs last", async () => {
    const { jobs } = await search({});
    expect(jobs.map((job) => job.title)).toEqual([
      "Junior Data Analyst",
      "Office Manager",
      "Senior Data Engineer",
      "Hybrid Designer",
    ]);
  });

  it("can sort by relevance to the keywords", async () => {
    const { jobs } = await search({ q: "data", sort: "relevance" });
    expect(jobs[0].title).toBe("Junior Data Analyst");
    expect(jobs.map((job) => job.title)).toContain("Senior Data Engineer");
  });

  it("falls back to date when there are no keywords", async () => {
    const { jobs } = await search({ sort: "relevance" });
    expect(jobs[0].title).toBe("Junior Data Analyst");
  });
});

describe("pagination", () => {
  const pagedCompany = `Pagedco ${randomUUID()}`;
  const count = PAGE_SIZE + 3;

  beforeAll(async () => {
    const { error } = await adminClient()
      .from("jobs")
      .insert(
        Array.from({ length: count }, (_, index) =>
          jobRow({
            provider,
            company: pagedCompany,
            title: `Role ${index}`,
            posted_at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
          }),
        ),
      );
    if (error) throw error;
  });

  const page = (value: string) =>
    searchJobs(anonClient(), parseJobFilters({ company: pagedCompany, page: value }));

  it("reports the full total on each page", async () => {
    const [first, second] = await Promise.all([page("1"), page("2")]);
    expect(first.total).toBe(count);
    expect(first.jobs).toHaveLength(PAGE_SIZE);
    expect(second.total).toBe(count);
    expect(second.jobs).toHaveLength(3);
  });

  it("never shows a job on two pages", async () => {
    const [first, second] = await Promise.all([page("1"), page("2")]);
    const ids = [...first.jobs, ...second.jobs].map((job) => job.id);
    expect(new Set(ids).size).toBe(count);
  });

  it("returns nothing past the last page", async () => {
    expect((await page("3")).jobs).toEqual([]);
  });

  it("caps the page size", async () => {
    const { data } = await anonClient().rpc("search_jobs", {
      p_company: pagedCompany,
      p_limit: 100000,
    });
    expect(data!.length).toBeLessThanOrEqual(50);
  });
});

describe("location options", () => {
  it("lists real locations from active jobs", async () => {
    const options = await getLocationOptions(anonClient());
    expect(options).toEqual(expect.arrayContaining(["Germany", "Greece", "Worldwide"]));
  });
});
