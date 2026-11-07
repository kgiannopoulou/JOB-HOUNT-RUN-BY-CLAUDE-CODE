import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { z } from "zod";

import { AnswerForm } from "@/components/interview/answer-form";
import { FeedbackPanel, RatingBadge } from "@/components/interview/feedback-panel";
import { MockRunner } from "@/components/interview/mock-runner";
import { SessionNotice } from "@/components/interview/session-notice";
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
import { formatDay } from "@/lib/applications/schema";
import { summarizeSession, type AnswerFeedback, type AnswerRating } from "@/lib/interview/feedback";
import {
  categoryLabels,
  modeDetails,
  type QuestionCategory,
  type SessionMode,
} from "@/lib/interview/questions";
import { requireUser } from "@/server/auth/user";
import { deleteInterviewSession } from "@/server/interview/actions";
import { getSessionDetail, latestByQuestion } from "@/server/interview/queries";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Practice session" };

/** Server actions on this page can wait for a model response. */
export const maxDuration = 240;

/** Private to one user, so there is no shared shell to prerender for each id. */
export const instant = false;

type Question = {
  id: string;
  question: string;
  category: string;
  why_it_may_come_up: string;
  job_quote: string;
  structure_name: string;
  structure_steps: string[];
};

function QuestionGuide({ question }: { question: Question }) {
  return (
    <>
      {question.why_it_may_come_up && (
        <p className="text-sm text-muted-foreground">{question.why_it_may_come_up}</p>
      )}
      {question.job_quote && (
        <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">
          From the job posting: &ldquo;{question.job_quote}&rdquo;
        </blockquote>
      )}
      {question.structure_steps.length > 0 && (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Suggested structure{question.structure_name && `: ${question.structure_name}`}
          </summary>
          <ol className="mt-2 list-inside list-decimal space-y-0.5">
            {question.structure_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      )}
    </>
  );
}

export default async function InterviewSessionPage({ params }: PageProps<"/interview/[id]">) {
  const { id } = await params;
  await requireUser(`/interview/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const detail = await getSessionDetail(supabase, id);
  if (!detail) notFound();

  const { session, questions, answers } = detail;
  const mode = session.mode as SessionMode;
  const latest = latestByQuestion(answers);
  const summary = summarizeSession(questions.length, [...latest.values()]);
  const runningMock = mode === "mock" && session.status === "in_progress";
  const completedMock = mode === "mock" && session.status === "completed";

  return (
    <>
      <PageHeader
        title={session.role_title}
        description={`${session.company} · ${modeDetails[mode]?.label} · ${formatDay(session.created_at)}`}
      />
      <Button asChild variant="link" className="w-fit px-0">
        <Link href="/interview">Back to all sessions</Link>
      </Button>

      <SessionNotice hadJobText={session.had_job_text} />

      {runningMock ? (
        <MockRunner
          sessionId={id}
          questions={questions.map(({ id: questionId, question }) => ({
            id: questionId,
            question,
          }))}
          answeredIds={[...latest.keys()]}
        />
      ) : (
        <>
          {(completedMock || summary.answered > 0) && (
            <section aria-label="Session summary" className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">
                {summary.answered} of {summary.total} answered
              </Badge>
              {summary.strong > 0 && <Badge variant="secondary">{summary.strong} strong</Badge>}
              {summary.adequate > 0 && (
                <Badge variant="secondary">{summary.adequate} adequate</Badge>
              )}
              {summary.weak > 0 && (
                <Badge variant="destructive">{summary.weak} to work on</Badge>
              )}
            </section>
          )}

          <ol className="space-y-4">
            {questions.map((question, index) => {
              const attempt = latest.get(question.id);
              const feedback = attempt?.feedback as unknown as AnswerFeedback | null | undefined;
              const earlier = answers.filter(
                (item) => item.question_id === question.id && item.id !== attempt?.id,
              );
              return (
                <li key={question.id}>
                  <Card>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {categoryLabels[question.category as QuestionCategory]}
                        </Badge>
                        {attempt?.rating && (
                          <RatingBadge rating={attempt.rating as AnswerRating} />
                        )}
                      </div>
                      <CardTitle className="leading-snug">
                        {index + 1}. {question.question}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <QuestionGuide question={question} />

                      {completedMock ? (
                        attempt ? (
                          <div className="space-y-1">
                            <h3 className="text-sm font-medium">Your answer</h3>
                            <p className="whitespace-pre-line break-words text-sm">
                              {attempt.answer}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">You skipped this one.</p>
                        )
                      ) : (
                        <AnswerForm
                          key={attempt?.id ?? question.id}
                          sessionId={id}
                          questionId={question.id}
                          label={`Your answer to question ${index + 1}`}
                          initial={attempt?.answer ?? ""}
                        />
                      )}

                      {feedback && <FeedbackPanel feedback={feedback} />}

                      {earlier.length > 0 && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-muted-foreground">
                            Earlier attempts ({earlier.length})
                          </summary>
                          <ul className="mt-2 space-y-2">
                            {earlier.map((item) => (
                              <li key={item.id} className="rounded-md border p-2">
                                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {formatDay(item.created_at)}
                                  {item.rating && (
                                    <RatingBadge rating={item.rating as AnswerRating} />
                                  )}
                                </p>
                                <p className="whitespace-pre-line break-words">{item.answer}</p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Delete this session</CardTitle>
          <CardDescription>
            This removes its questions, answers and feedback. It cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButton
            action={deleteInterviewSession}
            fields={{ sessionId: id }}
            pendingLabel="Deleting…"
            variant="destructive"
            confirmLabel="Yes, delete this session"
          >
            <Trash2 data-icon="inline-start" /> Delete session
          </ActionButton>
        </CardContent>
      </Card>
    </>
  );
}
