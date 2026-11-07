import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ExternalLink, RotateCcw, Trash2, X } from "lucide-react";
import { z } from "zod";

import {
  DetailsForm,
  InterviewForm,
  ReminderForm,
  StatusForm,
} from "@/components/applications/detail-forms";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { reminderState } from "@/lib/applications/calendar";
import {
  formatDay,
  formatDayAndTime,
  interviewKindLabels,
  interviewKinds,
} from "@/lib/applications/schema";
import { statusLabels, type ApplicationStatus } from "@/lib/applications/status";
import {
  deleteApplication,
  deleteInterview,
  deleteReminder,
  setReminderDone,
} from "@/server/applications/actions";
import { getApplicationDetail, listDocumentChoices } from "@/server/applications/queries";
import { requireUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";
import { getUserClock } from "@/server/time";

export const metadata: Metadata = { title: "Application" };

/** Private to one user, so there is no shared shell to prerender for each id. */
export const instant = false;

type HistoryEvent = {
  kind: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus | null;
};

function eventText({ kind, from_status, to_status }: HistoryEvent) {
  if (kind === "interview_added") return "Interview added";
  if (kind === "created") return `Added to ${to_status ? statusLabels[to_status] : "the board"}`;
  return `Moved from ${from_status ? statusLabels[from_status] : "?"} to ${
    to_status ? statusLabels[to_status] : "?"
  }`;
}

export default async function ApplicationPage({ params }: PageProps<"/applications/[id]">) {
  const { id } = await params;
  await requireUser(`/applications/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [detail, documents] = await Promise.all([
    getApplicationDetail(supabase, id),
    listDocumentChoices(supabase),
  ]);
  if (!detail) notFound();

  const { application, interviews, reminders, events } = detail;
  const { today } = await getUserClock();

  return (
    <>
      <PageHeader title={application.role_title} description={application.company}>
        {application.job_url && (
          <Button asChild variant="outline" size="lg">
            <a href={application.job_url} target="_blank" rel="noopener noreferrer">
              View job <ExternalLink data-icon="inline-end" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Badge>{statusLabels[application.status]}</Badge>
        {application.applied_at && (
          <Badge variant="outline">Applied {formatDay(application.applied_at)}</Badge>
        )}
        <Button asChild variant="link">
          <Link href="/applications">Back to the board</Link>
        </Button>
      </div>

      {application.job_id && (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="lg">
            <Link href={`/cv?job=${application.job_id}#new-version`}>Tailor my CV</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/cover-letters?job=${application.job_id}`}>Write a cover letter</Link>
          </Button>
        </div>
      )}

      <Button asChild variant="outline" size="lg" className="w-fit">
        <Link href={`/interview?application=${id}`}>Prepare for the interview</Link>
      </Button>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailsForm
                applicationId={id}
                details={application}
                resumes={documents.resumes}
                letters={documents.letters}
                status={application.status}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {interviews.length > 0 && (
                <ul className="divide-y">
                  {interviews.map((interview) => (
                    <li key={interview.id} className="flex items-start gap-3 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{formatDayAndTime(interview.scheduled_at)}</p>
                        <p className="text-muted-foreground">
                          {interviewKinds.includes(interview.kind as (typeof interviewKinds)[number])
                            ? interviewKindLabels[interview.kind as (typeof interviewKinds)[number]]
                            : interview.kind}
                          {interview.interviewer && ` with ${interview.interviewer}`}
                        </p>
                        {interview.location && (
                          <p className="break-words text-muted-foreground">{interview.location}</p>
                        )}
                        {interview.notes && (
                          <p className="whitespace-pre-line break-words">{interview.notes}</p>
                        )}
                      </div>
                      <ActionButton
                        action={deleteInterview}
                        fields={{ interviewId: interview.id, applicationId: id }}
                        pendingLabel="Removing…"
                        variant="outline"
                        confirmLabel="Confirm"
                      >
                        <X aria-hidden /> <span className="sr-only">Remove interview</span>
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              )}
              <InterviewForm applicationId={id} />
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusForm applicationId={id} status={application.status} today={today} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reminders</CardTitle>
              <CardDescription>Shown here, on the board and on your dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reminders.length > 0 && (
                <ul className="divide-y">
                  {reminders.map((reminder) => {
                    const done = Boolean(reminder.completed_at);
                    return (
                      <li key={reminder.id} className="flex items-center gap-2 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className={done ? "break-words line-through" : "break-words font-medium"}>
                            {reminder.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDay(reminder.due_on)}
                            {!done &&
                              reminderState(reminder.due_on, today) === "overdue" &&
                              " · Overdue"}
                          </p>
                        </div>
                        <ActionButton
                          action={setReminderDone}
                          fields={{
                            reminderId: reminder.id,
                            applicationId: id,
                            done: String(!done),
                          }}
                          pendingLabel="…"
                          variant="outline"
                        >
                          {done ? <RotateCcw aria-hidden /> : <Check aria-hidden />}
                          <span className="sr-only">
                            {done ? "Reopen" : "Mark done"}: {reminder.title}
                          </span>
                        </ActionButton>
                        <ActionButton
                          action={deleteReminder}
                          fields={{ reminderId: reminder.id, applicationId: id }}
                          pendingLabel="…"
                          variant="outline"
                        >
                          <X aria-hidden />
                          <span className="sr-only">Remove reminder: {reminder.title}</span>
                        </ActionButton>
                      </li>
                    );
                  })}
                </ul>
              )}
              <ReminderForm applicationId={id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <ol aria-label="Application history" className="space-y-2 text-sm">
                {events.map((event) => (
                  <li key={event.id}>
                    <p>{eventText(event)}</p>
                    <p className="text-xs text-muted-foreground">{formatDay(event.created_at)}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delete this application</CardTitle>
              <CardDescription>
                This removes its interviews, reminders and history. It cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionButton
                action={deleteApplication}
                fields={{ applicationId: id }}
                pendingLabel="Deleting…"
                variant="destructive"
                confirmLabel="Yes, delete this application"
              >
                <Trash2 data-icon="inline-start" /> Delete application
              </ActionButton>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
