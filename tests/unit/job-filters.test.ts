import { describe, expect, it } from "vitest";

import {
  hasActiveFilters,
  jobFiltersQuery,
  parseJobFilters,
} from "@/lib/job-filters";
import { canonicalLocation, expandLocation } from "@/lib/locations";

describe("parseJobFilters", () => {
  it("has safe defaults", () => {
    const filters = parseJobFilters({});
    expect(filters).toMatchObject({ sort: "date", page: 1, minSalary: null });
    expect(hasActiveFilters(filters)).toBe(false);
  });

  it("reads every filter", () => {
    expect(
      parseJobFilters({
        title: " Analyst ",
        q: "sql",
        company: "Acme",
        country: "Greece",
        city: "Athens",
        remote: ["remote", "hybrid"],
        type: "contract",
        level: "senior",
        minSalary: "50000",
        sort: "relevance",
        page: "3",
      }),
    ).toEqual({
      title: "Analyst",
      keywords: "sql",
      company: "Acme",
      country: "Greece",
      city: "Athens",
      remote: ["remote", "hybrid"],
      type: ["contract"],
      level: ["senior"],
      minSalary: 50000,
      sort: "relevance",
      page: 3,
    });
  });

  it("ignores values that are not allowed", () => {
    const filters = parseJobFilters({
      remote: ["moon"],
      type: "'; drop table jobs",
      minSalary: "-5",
      sort: "price",
      page: "0",
    });
    expect(filters).toMatchObject({
      remote: [],
      type: [],
      minSalary: null,
      sort: "date",
      page: 1,
    });
  });

  it("limits very long and very large input", () => {
    const filters = parseJobFilters({
      title: "a".repeat(5000),
      page: "99999999",
    });
    expect(filters.title).toHaveLength(200);
    expect(filters.page).toBe(10_000);
  });
});

describe("jobFiltersQuery", () => {
  it("survives a round trip through the URL", () => {
    const filters = parseJobFilters({
      title: "Data & BI",
      remote: ["remote", "hybrid"],
      minSalary: "60000",
      sort: "relevance",
      page: "2",
    });
    const params = new URLSearchParams(jobFiltersQuery(filters));
    expect(
      parseJobFilters({
        title: params.get("title") ?? undefined,
        remote: params.getAll("remote"),
        minSalary: params.get("minSalary") ?? undefined,
        sort: params.get("sort") ?? undefined,
        page: params.get("page") ?? undefined,
      }),
    ).toEqual(filters);
  });

  it("leaves defaults out of the URL", () => {
    expect(jobFiltersQuery(parseJobFilters({}))).toBe("");
  });

  it("can link to another page", () => {
    expect(jobFiltersQuery(parseJobFilters({ page: "2" }), 3)).toBe("page=3");
  });
});

describe("locations", () => {
  it("uses one spelling per place", () => {
    expect(canonicalLocation(" usa ")).toBe("United States");
    expect(canonicalLocation("greece")).toBe("Greece");
    expect(canonicalLocation("UK")).toBe("United Kingdom");
  });

  it("includes regions that cover a European country", () => {
    const expanded = expandLocation("greece");
    expect(expanded).toEqual(expect.arrayContaining(["Greece", "Europe", "Worldwide"]));
  });

  it("does not add Europe to countries outside it", () => {
    const expanded = expandLocation("Canada");
    expect(expanded).toEqual(["Canada", "Worldwide"]);
  });
});
