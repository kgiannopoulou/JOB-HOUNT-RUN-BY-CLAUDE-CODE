import { isRealDate } from "@/lib/applications/schema";
import { applicationStatuses, type ApplicationStatus } from "@/lib/applications/status";

export const applicationSorts = ["updated", "applied", "company"] as const;
export type ApplicationSort = (typeof applicationSorts)[number];

export const sortLabels: Record<ApplicationSort, string> = {
  updated: "Recently updated",
  applied: "Application date",
  company: "Company",
};

export type ApplicationFilters = {
  q: string;
  status: ApplicationStatus | "";
  from: string;
  to: string;
  sort: ApplicationSort;
};

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

/** Anything unrecognised in the address is ignored, not an error. */
export function parseApplicationFilters(params: Params): ApplicationFilters {
  const status = first(params.status);
  const sort = first(params.sort);
  const dateOrBlank = (value: string) => (isRealDate(value) ? value : "");
  return {
    q: first(params.q).slice(0, 100),
    status: applicationStatuses.includes(status as ApplicationStatus)
      ? (status as ApplicationStatus)
      : "",
    from: dateOrBlank(first(params.from)),
    to: dateOrBlank(first(params.to)),
    sort: applicationSorts.includes(sort as ApplicationSort)
      ? (sort as ApplicationSort)
      : "updated",
  };
}

export const hasActiveFilters = (filters: ApplicationFilters) =>
  Boolean(filters.q || filters.status || filters.from || filters.to);

export type FilterableApplication = {
  company: string;
  role_title: string;
  notes: string;
  recruiter_name: string;
  status: ApplicationStatus;
  applied_at: string | null;
  updated_at: string;
};

/**
 * Runs in memory: one person's applications fit easily, and it keeps search text
 * out of the query string sent to the database.
 */
export function filterApplications<T extends FilterableApplication>(
  applications: T[],
  { q, status, from, to, sort }: ApplicationFilters,
): T[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);

  const matching = applications.filter((application) => {
    if (status && application.status !== status) return false;
    if (from && (!application.applied_at || application.applied_at < from)) return false;
    if (to && (!application.applied_at || application.applied_at > to)) return false;
    const haystack = [
      application.company,
      application.role_title,
      application.notes,
      application.recruiter_name,
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });

  return matching.toSorted((a, b) => {
    if (sort === "company") return a.company.localeCompare(b.company);
    if (sort === "applied") {
      // Applications not sent yet go last.
      return (b.applied_at ?? "").localeCompare(a.applied_at ?? "");
    }
    return b.updated_at.localeCompare(a.updated_at);
  });
}
