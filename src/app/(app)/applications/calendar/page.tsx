import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarCheck, CalendarClock, ChevronLeft, ChevronRight, Hourglass } from "lucide-react";

import { ApplicationsTabs } from "@/components/applications/applications-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  buildMonth,
  monthRange,
  parseMonth,
  type CalendarEvent,
  type CalendarEventKind,
} from "@/lib/applications/calendar";
import { formatDay } from "@/lib/applications/schema";
import { cn } from "@/lib/utils";
import { listCalendarItems } from "@/server/applications/queries";
import { requireUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";
import { getUserClock } from "@/server/time";

export const metadata: Metadata = { title: "Application calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const icons: Record<CalendarEventKind, typeof BellRing> = {
  interview: CalendarClock,
  reminder: BellRing,
  deadline: Hourglass,
  applied: CalendarCheck,
};

function EventLink({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  const Icon = icons[event.kind];
  return (
    <Link
      href={event.href}
      className={cn(
        "flex items-center gap-1 rounded hover:underline",
        compact ? "text-xs" : "gap-2 text-sm",
      )}
    >
      <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate">
        {event.time && `${event.time} `}
        {event.title}
      </span>
    </Link>
  );
}

export default async function ApplicationCalendarPage({
  searchParams,
}: PageProps<"/applications/calendar">) {
  await requireUser("/applications/calendar");
  const { month: requested } = await searchParams;

  const supabase = await createClient();
  const { today } = await getUserClock();
  const month = parseMonth(requested, today);
  const { start, end } = monthRange(month);
  const items = await listCalendarItems(supabase, start, end);

  const href = (applicationId: string) => `/applications/${applicationId}`;
  const events: CalendarEvent[] = [
    ...items.interviews.map((interview) => ({
      id: `interview-${interview.id}`,
      date: interview.scheduled_at.slice(0, 10),
      time: interview.scheduled_at.slice(11, 16),
      kind: "interview" as const,
      title: `Interview: ${interview.applications?.company}`,
      href: href(interview.application_id),
    })),
    ...items.reminders.map((reminder) => ({
      id: `reminder-${reminder.id}`,
      date: reminder.due_on,
      time: "",
      kind: "reminder" as const,
      title: reminder.title,
      href: href(reminder.application_id),
    })),
    ...items.deadlines.flatMap((application) =>
      application.offer_deadline
        ? [
            {
              id: `deadline-${application.id}`,
              date: application.offer_deadline,
              time: "",
              kind: "deadline" as const,
              title: `Offer deadline: ${application.company}`,
              href: href(application.id),
            },
          ]
        : [],
    ),
    ...items.applied.flatMap((application) =>
      application.applied_at
        ? [
            {
              id: `applied-${application.id}`,
              date: application.applied_at,
              time: "",
              kind: "applied" as const,
              title: `Applied: ${application.company}`,
              href: href(application.id),
            },
          ]
        : [],
    ),
  ];

  const calendar = buildMonth(month, events, today);
  const days = calendar.weeks.flat().filter((day) => day.inMonth && day.events.length > 0);

  return (
    <>
      <PageHeader
        title="Applications"
        description="Interviews, reminders, offer deadlines and application dates."
      />
      <ApplicationsTabs current="/applications/calendar" />

      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="outline" size="icon" aria-label="Previous month">
          <Link href={`/applications/calendar?month=${calendar.previous}`}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h2 className="text-lg font-semibold tracking-tight">{calendar.label}</h2>
        <Button asChild variant="outline" size="icon" aria-label="Next month">
          <Link href={`/applications/calendar?month=${calendar.next}`}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>

      {/* A seven-column grid is unreadable on a phone, which gets the agenda instead. */}
      <table className="hidden w-full table-fixed border-collapse text-sm md:table">
        <caption className="sr-only">{calendar.label}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((day) => (
              <th key={day} scope="col" className="p-1 text-left text-xs font-medium text-muted-foreground">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calendar.weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((day) => (
                <td
                  key={day.date}
                  className={cn(
                    "h-24 border p-1 align-top",
                    !day.inMonth && "bg-muted/40 text-muted-foreground",
                  )}
                >
                  <span
                    aria-current={day.isToday ? "date" : undefined}
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs",
                      day.isToday && "bg-primary font-medium text-primary-foreground",
                    )}
                  >
                    {Number(day.date.slice(8))}
                  </span>
                  <div className="space-y-0.5">
                    {day.events.map((event) => (
                      <EventLink key={event.id} event={event} compact />
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="md:hidden">
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing this month.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {days.map((day) => (
              <li key={day.date} className="space-y-1 p-3">
                <h3 className="text-sm font-medium">{formatDay(day.date)}</h3>
                {day.events.map((event) => (
                  <EventLink key={event.id} event={event} />
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
