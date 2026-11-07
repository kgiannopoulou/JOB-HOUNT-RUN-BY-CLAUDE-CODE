import type { Metadata } from "next";
import { CalendarClock, Clock, MessagesSquare, Reply, Trophy } from "lucide-react";

import { ApplicationsTabs } from "@/components/applications/applications-tabs";
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
import { formatDay } from "@/lib/applications/schema";
import { applicationStats } from "@/lib/applications/stats";
import { applicationStatuses, statusLabels } from "@/lib/applications/status";
import { listApplicationEvents, listApplications } from "@/server/applications/queries";
import { requireUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";
import { getUserClock } from "@/server/time";

export const metadata: Metadata = { title: "Application statistics" };

const rate = (value: number | null) => (value === null ? undefined : `${value}%`);

export default async function ApplicationStatsPage() {
  await requireUser("/applications/stats");

  const supabase = await createClient();
  const [applications, events] = await Promise.all([
    listApplications(supabase),
    listApplicationEvents(supabase),
  ]);
  const { today } = await getUserClock();
  const stats = applicationStats(applications, events, today);

  const funnel = [
    { label: "Applied", value: stats.applied },
    { label: "Replied", value: stats.responded },
    { label: "Interview", value: stats.interviewed },
    { label: "Offer", value: stats.offers },
  ];
  const weekMax = Math.max(...stats.weekly.map((week) => week.count));
  const statusMax = Math.max(...applicationStatuses.map((status) => stats.byStatus[status]));

  return (
    <>
      <PageHeader
        title="Applications"
        description="Calculated from your own records. Small numbers can swing a lot."
      />
      <ApplicationsTabs current="/applications/stats" />

      {stats.total === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No statistics yet"
          description="These appear once you are tracking applications."
        />
      ) : (
        <>
          <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Response rate"
              value={rate(stats.responseRate)}
              hint={`${stats.responded} of ${stats.applied} applications got a reply`}
              icon={Reply}
            />
            <StatCard
              label="Interview rate"
              value={rate(stats.interviewRate)}
              hint={`${stats.interviewed} of ${stats.applied} reached an interview`}
              icon={MessagesSquare}
            />
            <StatCard
              label="Offer rate"
              value={rate(stats.offerRate)}
              hint={`${stats.offers} of ${stats.applied} reached an offer`}
              icon={Trophy}
            />
            <StatCard
              label="Typical reply time"
              value={
                stats.medianDaysToResponse === null
                  ? undefined
                  : `${stats.medianDaysToResponse} days`
              }
              hint="Median days from applying to the first reply"
              icon={Clock}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>How far applications got</CardTitle>
                <CardDescription>Each counts once for every stage it reached.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {funnel.map((step) => (
                    <Bar key={step.label} {...step} max={stats.applied} />
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Where they are now</CardTitle>
                <CardDescription>{stats.total} tracked in all.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {applicationStatuses.map((status) => (
                    <Bar
                      key={status}
                      label={statusLabels[status]}
                      value={stats.byStatus[status]}
                      max={statusMax}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Applications per week</CardTitle>
                <CardDescription>The last eight weeks, by week starting.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {stats.weekly.map((week) => (
                    <Bar
                      key={week.week}
                      label={formatDay(week.week).replace(/ \d{4}$/, "")}
                      value={week.count}
                      max={weekMax}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
