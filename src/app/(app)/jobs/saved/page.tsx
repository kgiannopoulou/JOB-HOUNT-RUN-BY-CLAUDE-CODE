import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark } from "lucide-react";

import { JobCard } from "@/components/jobs/job-card";
import { JobsTabs } from "@/components/jobs/jobs-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Saved jobs" };

export default async function SavedJobsPage() {
  const user = await requireUser("/jobs/saved");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_jobs")
    .select("created_at, jobs (*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Saved jobs failed: ${error.message}`);

  const jobs = data.flatMap((row) => (row.jobs ? [row.jobs] : []));

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Roles you are considering. Only you can see this list."
      />
      <JobsTabs current="/jobs/saved" />

      {jobs.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved jobs yet"
          description="Save a job from your search results to keep it here."
        >
          <Button asChild size="lg">
            <Link href="/jobs">Search jobs</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard job={job} saved returnTo="/jobs/saved" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
