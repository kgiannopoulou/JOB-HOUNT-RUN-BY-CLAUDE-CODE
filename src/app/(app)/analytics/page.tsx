import type { Metadata } from "next";
import {
  BookmarkCheck,
  CalendarCheck,
  ChartColumn,
  Reply,
  Search,
  Send,
  Trophy,
  XCircle,
} from "lucide-react";

import { WeeklyChart } from "@/components/analytics/weekly-chart";
import { Bar } from "@/components/shared/bar-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildAnalytics } from "@/lib/analytics/summary";
import { applicationStatuses, statusLabels } from "@/lib/applications/status";
import { listApplicationEvents, listApplications } from "@/server/applications/queries";
import { requireUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";
import { getUserClock } from "@/server/time";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await requireUser("/analytics");

  const supabase = await createClient();
  const [clock, jobs, saved, applications, events, interviews, sessions] = await Promise.all([
    getUserClock(),
    supabase.from("jobs").select("id", { count: "exact", head: true }),
    supabase.from("saved_jobs").select("created_at"),
    listApplications(supabase),
    listApplicationEvents(supabase),
    supabase.from("application_interviews").select("application_id, scheduled_at"),
    supabase.from("interview_sessions").select("created_at"),
  ]);
  const failed = jobs.error ?? saved.error ?? interviews.error ?? sessions.error;
  if (failed) throw new Error(`Analytics lookup failed: ${failed.code}`);

  const summary = buildAnalytics({
    jobsDiscovered: jobs.count ?? 0,
    savedJobs: saved.data ?? [],
    applications,
    events,
    interviews: interviews.data ?? [],
    practiceSessions: sessions.data ?? [],
    now: clock.now,
    timeZone: clock.timeZone,
  });

  const statusMax = Math.max(...applicationStatuses.map((status) => summary.byStatus[status]));

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Counted from your own records. Weeks follow your time zone (${clock.timeZone}).`}
      />

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Jobs discovered"
          value={String(summary.jobsDiscovered)}
          hint="Listings collected in JOB HUNT so far"
          icon={Search}
        />
        <StatCard
          label="Saved jobs"
          value={String(summary.savedJobs)}
          hint="Roles you are considering"
          icon={BookmarkCheck}
        />
        <StatCard
          label="Applications sent"
          value={String(summary.applicationsSubmitted)}
          hint="Everything past Saved"
          icon={Send}
        />
        <StatCard
          label="Response rate"
          value={summary.responseRate === null ? undefined : `${summary.responseRate}%`}
          hint={
            summary.applicationsSubmitted
              ? `${summary.responded} of ${summary.applicationsSubmitted} applications got a reply`
              : "Shown once you have sent an application"
          }
          icon={Reply}
        />
        <StatCard
          label="Interviews"
          value={String(summary.interviewsReceived)}
          hint="Applications that reached an interview"
          icon={CalendarCheck}
        />
        <StatCard
          label="Offers"
          value={String(summary.offersReceived)}
          hint="Applications that reached an offer"
          icon={Trophy}
        />
        <StatCard
          label="Rejections"
          value={String(summary.rejections)}
          hint="Applications now marked Rejected"
          icon={XCircle}
        />
      </section>

      {summary.hasActivity ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Weekly activity</CardTitle>
              <CardDescription>The last eight weeks. Each chart has its own scale.</CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklyChart weekly={summary.weekly} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Where your applications are now</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="max-w-2xl space-y-2">
                {applicationStatuses.map((status) => (
                  <Bar
                    key={status}
                    label={statusLabels[status]}
                    value={summary.byStatus[status]}
                    max={statusMax}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={ChartColumn}
          title="No activity yet"
          description="Charts appear once you save a job or track an application."
        />
      )}
    </>
  );
}
