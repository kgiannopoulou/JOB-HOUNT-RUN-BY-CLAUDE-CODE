import type { Metadata } from "next";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  KanbanSquare,
  MessagesSquare,
  Reply,
} from "lucide-react";

import { DueItems } from "@/components/applications/due-items";
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
import { applicationStats } from "@/lib/applications/stats";
import {
  listApplicationEvents,
  listApplications,
  listDueReminders,
  listUpcomingInterviews,
} from "@/server/applications/queries";
import { requireUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

const setupSteps = [
  {
    title: "Set your job preferences",
    text: "Tell us which roles and locations you want.",
    href: "/settings",
  },
  {
    title: "Find your first role",
    text: "Search real listings and save the ones you like.",
    href: "/jobs",
  },
  {
    title: "Add your CV",
    text: "Upload the CV that everything else builds on.",
    href: "/cv",
  },
  {
    title: "Check a job match",
    text: "Compare your confirmed CV with a job you like.",
    href: "/matches",
  },
  {
    title: "Track an application",
    text: "Keep a record of what you sent and when.",
    href: "/applications",
  },
];

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const count = { count: "exact", head: true } as const;
  const [profile, saved, applications, events, reminders, interviews] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("saved_jobs").select("job_id", count),
    listApplications(supabase),
    listApplicationEvents(supabase),
    listDueReminders(supabase, today),
    listUpcomingInterviews(supabase, today),
  ]);
  const stats = applicationStats(applications, events, today);

  const firstName = profile.data?.full_name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : "Dashboard"}
        description="Your job search at a glance."
      />

      <section
        aria-label="Summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Saved jobs"
          value={String(saved.count ?? 0)}
          hint="Roles you are considering"
          icon={BriefcaseBusiness}
        />
        <StatCard
          label="Applications"
          value={String(stats.applied)}
          hint="Sent so far"
          icon={KanbanSquare}
        />
        <StatCard
          label="Interviews"
          value={String(stats.interviewed)}
          hint="Applications that reached an interview"
          icon={MessagesSquare}
        />
        <StatCard
          label="Response rate"
          value={stats.responseRate === null ? undefined : `${stats.responseRate}%`}
          hint={
            stats.applied
              ? `${stats.responded} of ${stats.applied} applications got a reply`
              : "Shown once you have applications"
          }
          icon={Reply}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              Five steps to a working job search.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="divide-y">
              {setupSteps.map((step, index) => (
                <li key={step.href}>
                  <Link
                    href={step.href}
                    className="group flex items-center gap-3 rounded-md py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {step.title}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {step.text}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {reminders.length + interviews.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Coming up</CardTitle>
              <CardDescription>Reminders due and your next interviews.</CardDescription>
            </CardHeader>
            <CardContent>
              <DueItems reminders={reminders} interviews={interviews} today={today} />
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="Nothing to follow up yet"
            description="Follow-ups and interview dates will appear here when you start tracking applications."
          />
        )}
      </div>
    </>
  );
}
