import { Suspense } from "react";
import type { Metadata } from "next";

import { JobFiltersForm } from "@/components/jobs/job-filters-form";
import { JobResults, JobResultsSkeleton } from "@/components/jobs/job-results";
import { JobsTabs } from "@/components/jobs/jobs-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { jobFiltersQuery, parseJobFilters } from "@/lib/job-filters";
import { providerDetails } from "@/lib/job-providers";
import { getLocationOptions } from "@/server/jobs/search";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const filters = parseJobFilters(await searchParams);
  const supabase = await createClient();
  const locations = await getLocationOptions(supabase);
  const remotive = providerDetails.remotive;

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Search real listings. You can browse without an account, and sign in to save jobs."
      />
      <JobsTabs current="/jobs" />

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_1fr]">
        <JobFiltersForm filters={filters} locations={locations} />
        <div className="min-w-0 space-y-4">
          <Suspense
            key={jobFiltersQuery(filters)}
            fallback={<JobResultsSkeleton />}
          >
            <JobResults filters={filters} />
          </Suspense>
          <p className="text-xs text-muted-foreground">
            Listings come from{" "}
            <a
              href={remotive.url}
              target="_blank"
              rel="noopener"
              className="underline underline-offset-2"
            >
              {remotive.name}
            </a>
            , appear up to 24 hours after publication, and open on the original
            site.
          </p>
        </div>
      </div>
    </>
  );
}
