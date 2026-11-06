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

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseBadge } from "@/components/shared/phase-badge";
import { StatCard } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

const setupSteps = [
  {
    title: "Add your CV",
    text: "Upload the CV that everything else builds on.",
    href: "/cv",
    phase: 4,
  },
  {
    title: "Set your job preferences",
    text: "Tell us which roles and locations you want.",
    href: "/settings",
    phase: 3,
  },
  {
    title: "Find your first role",
    text: "Search for a job or paste in a listing.",
    href: "/jobs",
    phase: 5,
  },
  {
    title: "Track an application",
    text: "Keep a record of what you sent and when.",
    href: "/applications",
    phase: 8,
  },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your job search at a glance. Figures appear here once your account is connected."
      />

      <section
        aria-label="Summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Saved jobs"
          hint="Roles you are considering"
          icon={BriefcaseBusiness}
        />
        <StatCard
          label="Applications"
          hint="Sent so far"
          icon={KanbanSquare}
        />
        <StatCard
          label="Interviews"
          hint="Scheduled or completed"
          icon={MessagesSquare}
        />
        <StatCard
          label="Response rate"
          hint="Applications that got a reply"
          icon={Reply}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              Four steps to a working job search.
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
                    <span className="hidden sm:block">
                      <PhaseBadge phase={step.phase} />
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

        <EmptyState
          icon={CalendarClock}
          title="Nothing to follow up yet"
          description="Follow-ups and interview dates will appear here when you start tracking applications."
        />
      </div>
    </>
  );
}
