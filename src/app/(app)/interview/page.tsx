import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessagesSquare } from "lucide-react";

import { NewSessionForm } from "@/components/interview/new-session-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDay } from "@/lib/applications/schema";
import { modeDetails, type SessionMode } from "@/lib/interview/questions";
import { isAiConfigured } from "@/server/ai/gateway";
import { listApplications } from "@/server/applications/queries";
import { requireUser } from "@/server/auth/user";
import { getMatchingResume } from "@/server/cv/queries";
import { listSessions } from "@/server/interview/queries";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Interview prep" };

/** Server actions on this page can wait for a model response. */
export const maxDuration = 240;

export default async function InterviewPage({ searchParams }: PageProps<"/interview">) {
  await requireUser("/interview");
  const { application } = await searchParams;

  const supabase = await createClient();
  const [sessions, applications, resume] = await Promise.all([
    listSessions(supabase),
    listApplications(supabase),
    getMatchingResume(supabase),
  ]);
  const open = applications.filter((item) => item.status !== "rejected");
  const selected =
    typeof application === "string" && open.some((item) => item.id === application)
      ? application
      : undefined;
  const aiReady = isAiConfigured();

  return (
    <>
      <PageHeader
        title="Interview prep"
        description="Practise for a specific application, in your own words, and see what to improve."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-label="Your sessions" className="min-w-0 space-y-3">
          {sessions.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No practice sessions yet"
              description="Sessions are saved here, with every answer and its feedback."
            />
          ) : (
            <ul className="space-y-3">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Card>
                    <CardContent>
                      <Link
                        href={`/interview/${session.id}`}
                        className="group flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {session.role_title}, {session.company}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {modeDetails[session.mode as SessionMode]?.label} ·{" "}
                            {formatDay(session.created_at)} · {session.summary.answered} of{" "}
                            {session.summary.total} answered
                          </span>
                          <span className="mt-1.5 flex flex-wrap gap-1.5">
                            {session.status === "in_progress" && session.mode === "mock" && (
                              <Badge variant="outline">In progress</Badge>
                            )}
                            {session.summary.weak > 0 && (
                              <Badge variant="destructive">
                                {session.summary.weak} to work on
                              </Badge>
                            )}
                            {session.summary.strong > 0 && (
                              <Badge variant="secondary">{session.summary.strong} strong</Badge>
                            )}
                          </span>
                        </span>
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </Link>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>New session</CardTitle>
            <CardDescription>Questions are written for one application.</CardDescription>
          </CardHeader>
          <CardContent>
            {!aiReady ? (
              <p role="status" className="text-sm text-muted-foreground">
                AI features are not set up on this server yet.
              </p>
            ) : !resume ? (
              <p className="text-sm text-muted-foreground">
                <Link href="/cv" className="underline">
                  Confirm a CV
                </Link>{" "}
                first, so questions can reflect your real experience.
              </p>
            ) : open.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <Link href="/applications" className="underline">
                  Track an application
                </Link>{" "}
                first, so there is a role to prepare for.
              </p>
            ) : (
              <NewSessionForm applications={open} selected={selected} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
