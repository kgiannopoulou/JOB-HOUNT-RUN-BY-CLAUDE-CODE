import Link from "next/link";
import { BriefcaseBusiness, SearchX } from "lucide-react";

import { JobCard } from "@/components/jobs/job-card";
import { SortSelect } from "@/components/jobs/sort-select";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PAGE_SIZE,
  hasActiveFilters,
  jobFiltersQuery,
  type JobFilters,
} from "@/lib/job-filters";
import { getCurrentUser } from "@/server/auth/user";
import { getSavedJobIds, searchJobs } from "@/server/jobs/search";
import { getMatchIdsForJobs } from "@/server/matching/queries";
import { createClient } from "@/server/supabase/server";

const pageHref = (filters: JobFilters, page: number) => {
  const query = jobFiltersQuery(filters, page);
  return query ? `/jobs?${query}` : "/jobs";
};

export async function JobResults({ filters }: { filters: JobFilters }) {
  const supabase = await createClient();
  const [{ jobs, total }, user] = await Promise.all([
    searchJobs(supabase, filters),
    getCurrentUser(),
  ]);

  if (jobs.length === 0) {
    if (filters.page > 1) {
      return (
        <EmptyState
          icon={SearchX}
          title="No more results"
          description="There are no jobs on this page."
        >
          <Button asChild variant="outline" size="lg">
            <Link href={pageHref(filters, 1)}>Back to the first page</Link>
          </Button>
        </EmptyState>
      );
    }
    if (!hasActiveFilters(filters)) {
      return (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No jobs available yet"
          description="Listings appear here after the next sync with our job source."
        />
      );
    }
    const onlyOffice =
      filters.remote.length > 0 && !filters.remote.includes("remote");
    return (
      <EmptyState
        icon={SearchX}
        title="No jobs match your search"
        description={
          onlyOffice
            ? "Our current source, Remotive, lists remote jobs only. Try including remote work."
            : "Try fewer filters or a broader search."
        }
      >
        <Button asChild variant="outline" size="lg">
          <Link href="/jobs">Clear all filters</Link>
        </Button>
      </EmptyState>
    );
  }

  const jobIds = jobs.map((job) => job.id);
  const [savedIds, matches] = user
    ? await Promise.all([
        getSavedJobIds(supabase, user.id, jobIds),
        getMatchIdsForJobs(supabase, jobIds),
      ])
    : [new Set<string>(), new Map()];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const returnTo = pageHref(filters, filters.page);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" role="status">
          {total} {total === 1 ? "job" : "jobs"} found
        </p>
        <SortSelect value={filters.sort} />
      </div>

      <ul className="space-y-3">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobCard
              job={job}
              saved={savedIds.has(job.id)}
              returnTo={returnTo}
              signedIn={Boolean(user)}
              match={matches.get(job.id)}
            />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-2"
        >
          {filters.page > 1 ? (
            <Button asChild variant="outline" size="lg">
              <Link href={pageHref(filters, filters.page - 1)}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <p className="text-sm text-muted-foreground">
            Page {filters.page} of {totalPages}
          </p>
          {filters.page < totalPages ? (
            <Button asChild variant="outline" size="lg">
              <Link href={pageHref(filters, filters.page + 1)}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

export function JobResultsSkeleton() {
  return (
    <div role="status" aria-label="Loading jobs" className="space-y-3">
      <Skeleton className="h-5 w-32" />
      {[0, 1, 2, 3].map((item) => (
        <Skeleton key={item} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  );
}
