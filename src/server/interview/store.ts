import "server-only";

import type { AnswerFeedback } from "@/lib/interview/feedback";
import {
  INTERVIEW_PROMPT_VERSION,
  type PreparedQuestion,
  type SessionFocus,
  type SessionMode,
} from "@/lib/interview/questions";
import { createAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/types/database";

type NewSession = {
  userId: string;
  applicationId: string;
  jobId: string | null;
  company: string;
  roleTitle: string;
  focus: SessionFocus;
  mode: SessionMode;
  hadJobText: boolean;
  model: string;
  questions: PreparedQuestion[];
};

/**
 * Users cannot write questions, answers or ratings themselves. The composite
 * foreign keys reject anything that belongs to a different user.
 */
export async function createSession(session: NewSession): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("interview_sessions")
    .insert({
      user_id: session.userId,
      application_id: session.applicationId,
      job_id: session.jobId,
      company: session.company,
      role_title: session.roleTitle,
      kind: session.focus,
      mode: session.mode,
      had_job_text: session.hadJobText,
      prompt_version: INTERVIEW_PROMPT_VERSION,
      model: session.model,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Saving the session failed: ${error.code}`);

  const { error: questionsError } = await admin.from("interview_questions").insert(
    session.questions.map((question, position) => ({
      ...question,
      session_id: data.id,
      user_id: session.userId,
      position,
    })),
  );
  if (questionsError) {
    await admin.from("interview_sessions").delete().eq("id", data.id);
    throw new Error(`Saving the questions failed: ${questionsError.code}`);
  }
  return data.id;
}

type NewAnswer = {
  userId: string;
  sessionId: string;
  questionId: string;
  answer: string;
  answerHash: string;
};

export async function saveAnswer(answer: NewAnswer): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("interview_answers")
    .insert({
      user_id: answer.userId,
      session_id: answer.sessionId,
      question_id: answer.questionId,
      answer: answer.answer,
      answer_hash: answer.answerHash,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Saving the answer failed: ${error.code}`);
  return data.id;
}

export async function saveFeedback(
  userId: string,
  answerId: string,
  feedback: AnswerFeedback,
  model: string | null,
) {
  const { error } = await createAdminClient()
    .from("interview_answers")
    .update({
      rating: feedback.rating,
      feedback: feedback as unknown as NonNullable<Json>,
      prompt_version: INTERVIEW_PROMPT_VERSION,
      model,
    })
    .eq("id", answerId)
    .eq("user_id", userId);
  if (error) throw new Error(`Saving the feedback failed: ${error.code}`);
}

export async function completeSession(userId: string, sessionId: string) {
  const { error } = await createAdminClient()
    .from("interview_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw new Error(`Finishing the session failed: ${error.code}`);
}
