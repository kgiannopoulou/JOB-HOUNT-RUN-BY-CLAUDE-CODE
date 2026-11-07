import Link from "next/link";
import { BellRing, CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { reminderState } from "@/lib/applications/calendar";
import { formatDay, formatDayAndTime } from "@/lib/applications/schema";

type Named = { applications: { company: string; role_title: string } | null };

type DueItemsProps = {
  reminders: (Named & { id: string; application_id: string; title: string; due_on: string })[];
  interviews: (Named & { id: string; application_id: string; scheduled_at: string })[];
  today: string;
};

const stateLabels = { overdue: "Overdue", today: "Today", upcoming: "Soon" } as const;

/** Reminders are shown inside the app. They do not send emails. */
export function DueItems({ reminders, interviews, today }: DueItemsProps) {
  if (reminders.length === 0 && interviews.length === 0) return null;

  return (
    <ul aria-label="Coming up" className="divide-y rounded-xl border">
      {reminders.map((reminder) => {
        const state = reminderState(reminder.due_on, today);
        return (
          <li key={reminder.id}>
            <Link
              href={`/applications/${reminder.application_id}`}
              className="flex items-center gap-3 p-3 text-sm hover:bg-muted/50"
            >
              <BellRing className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{reminder.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {reminder.applications?.company} · {formatDay(reminder.due_on)}
                </span>
              </span>
              <Badge variant={state === "overdue" ? "destructive" : "outline"}>
                {stateLabels[state]}
              </Badge>
            </Link>
          </li>
        );
      })}
      {interviews.map((interview) => (
        <li key={interview.id}>
          <Link
            href={`/applications/${interview.application_id}`}
            className="flex items-center gap-3 p-3 text-sm hover:bg-muted/50"
          >
            <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                Interview: {interview.applications?.role_title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {interview.applications?.company} · {formatDayAndTime(interview.scheduled_at)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
