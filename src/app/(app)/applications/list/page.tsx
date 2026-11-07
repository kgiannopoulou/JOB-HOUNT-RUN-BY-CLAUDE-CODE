import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, KanbanSquare, Plus } from "lucide-react";

import { ApplicationFiltersForm } from "@/components/applications/application-filters";
import { ApplicationsTabs } from "@/components/applications/applications-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { filterApplications, parseApplicationFilters } from "@/lib/applications/filters";
import { formatDay } from "@/lib/applications/schema";
import { statusLabels } from "@/lib/applications/status";
import { listApplications } from "@/server/applications/queries";
import { requireUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Applications list" };

export default async function ApplicationsListPage({
  searchParams,
}: PageProps<"/applications/list">) {
  await requireUser("/applications/list");
  const filters = parseApplicationFilters(await searchParams);

  const supabase = await createClient();
  const applications = await listApplications(supabase);
  const shown = filterApplications(applications, filters);

  return (
    <>
      <PageHeader title="Applications" description="Search and sort everything you are tracking.">
        <Button asChild size="lg">
          <Link href="/applications/new">
            <Plus data-icon="inline-start" /> Add application
          </Link>
        </Button>
      </PageHeader>

      <ApplicationsTabs current="/applications/list" />
      <ApplicationFiltersForm filters={filters} action="/applications/list" />

      {shown.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title={applications.length ? "No applications match" : "No applications yet"}
          description={
            applications.length
              ? "Try fewer filters."
              : "Save a job or add an application to start tracking."
          }
        />
      ) : (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {shown.length} of {applications.length} applications
          </p>
          <ul className="divide-y rounded-xl border">
            {shown.map((application) => (
              <li key={application.id}>
                <Link
                  href={`/applications/${application.id}`}
                  className="group flex items-center gap-3 p-3 hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {application.role_title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {application.company}
                      {application.applied_at && ` · Applied ${formatDay(application.applied_at)}`}
                    </span>
                  </span>
                  <Badge variant="outline">{statusLabels[application.status]}</Badge>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
