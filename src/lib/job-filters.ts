import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

export const PAGE_SIZE = 20;

export const remoteOptions = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
] as const satisfies { value: Enums["remote_policy"]; label: string }[];

export const employmentOptions = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
  { value: "internship", label: "Internship" },
] as const satisfies { value: Enums["employment_type"]; label: string }[];

export const experienceOptions = [
  { value: "intern", label: "Intern" },
  { value: "entry", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
] as const satisfies { value: Enums["experience_level"]; label: string }[];

export type JobSort = "date" | "relevance";

export type JobFilters = {
  title: string;
  keywords: string;
  company: string;
  country: string;
  city: string;
  remote: Enums["remote_policy"][];
  type: Enums["employment_type"][];
  level: Enums["experience_level"][];
  minSalary: number | null;
  sort: JobSort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function text(value: string | string[] | undefined, max = 200): string {
  const first = Array.isArray(value) ? value[0] : value;
  return (first ?? "").trim().slice(0, max);
}

function allowed<T extends string>(
  value: string | string[] | undefined,
  options: readonly { value: T }[],
): T[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return options.map((o) => o.value).filter((v) => values.includes(v));
}

function wholeNumber(value: string | string[] | undefined): number | null {
  const parsed = Number(text(value, 12).replace(/[,\s]/g, ""));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Reads the URL. Anything invalid is ignored, because links can be edited by hand. */
export function parseJobFilters(params: RawParams): JobFilters {
  return {
    title: text(params.title),
    keywords: text(params.q),
    company: text(params.company),
    country: text(params.country, 100),
    city: text(params.city, 100),
    remote: allowed(params.remote, remoteOptions),
    type: allowed(params.type, employmentOptions),
    level: allowed(params.level, experienceOptions),
    minSalary: wholeNumber(params.minSalary),
    sort: text(params.sort) === "relevance" ? "relevance" : "date",
    page: Math.min(wholeNumber(params.page) ?? 1, 10_000),
  };
}

export function hasActiveFilters(filters: JobFilters): boolean {
  return Boolean(
    filters.title ||
      filters.keywords ||
      filters.company ||
      filters.country ||
      filters.city ||
      filters.remote.length ||
      filters.type.length ||
      filters.level.length ||
      filters.minSalary,
  );
}

export function jobFiltersQuery(filters: JobFilters, page = filters.page) {
  const query = new URLSearchParams();
  const add = (key: string, value: string) => value && query.append(key, value);

  add("title", filters.title);
  add("q", filters.keywords);
  add("company", filters.company);
  add("country", filters.country);
  add("city", filters.city);
  filters.remote.forEach((value) => add("remote", value));
  filters.type.forEach((value) => add("type", value));
  filters.level.forEach((value) => add("level", value));
  if (filters.minSalary) add("minSalary", String(filters.minSalary));
  if (filters.sort !== "date") add("sort", filters.sort);
  if (page > 1) add("page", String(page));

  return query.toString();
}
