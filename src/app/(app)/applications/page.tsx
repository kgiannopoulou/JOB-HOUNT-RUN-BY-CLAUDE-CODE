import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ApplicationFiltersForm } from "@/components/applications/application-filters";
import { ApplicationsTabs } from "@/components/applications/applications-tabs";
import { Board } from "@/components/applications/board";
import { DueItems } from "@/components/applications/due-items";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { addDays } from "@/lib/applications/calendar";
import {
  filterApplications,
  hasActiveFilters,
  parseApplicationFilters,
} from "@/lib/applications/filters";
import {
  listApplications,
  listDueReminders,
  listUpcomingInterviews,
} from "@/server/applications/queries";
import { requireUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";
import { getUserClock } from "@/server/time";

export const metadata: Metadata = { title: "Applications" };

const REMINDER_WINDOW_DAYS = 3;

export default async function ApplicationsPage({ searchParams }: PageProps<"/applications">) {
  await requireUser("/applications");
  const filters = parseApplicationFilters(await searchParams);

  const supabase = await createClient();
  const { today } = await getUserClock();
  const soon = addDays(today, REMINDER_WINDOW_DAYS);
  const [applications, reminders, interviews] = await Promise.all([
    listApplications(supabase),
    listDueReminders(supabase, soon),
    listUpcomingInterviews(supabase, today, 3),
  ]);
  const shown = filterApplications(applications, filters);

  return (
    <>
      <PageHeader
        title="Applications"
        description="Follow every application from saved to offer, with a record of what you sent."
      >
        <Button asChild size="lg">
          <Link href="/applications/new">
            <Plus data-icon="inline-start" /> Add application
          </Link>
        </Button>
      </PageHeader>

      <ApplicationsTabs current="/applications" />
      <DueItems reminders={reminders} interviews={interviews} today={today} />
      <ApplicationFiltersForm filters={filters} action="/applications" />

      {hasActiveFilters(filters) && (
        <p role="status" className="text-sm text-muted-foreground">
          Showing {shown.length} of {applications.length} applications.
        </p>
      )}

      <Board applications={shown} />
    </>
  );
}
