import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { summarizeSession } from "@/lib/interview/feedback";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/** Keeps the newest answer to each question. Expects answers oldest first. */
export function latestByQuestion<T extends { question_id: string }>(answers: T[]) {
  return new Map(answers.map((answer) => [answer.question_id, answer]));
}

/** Row level security limits these reads to the signed-in user. */
export async function listSessions(supabase: Client) {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(
      "id, company, role_title, mode, status, created_at, interview_questions (id), interview_answers (question_id, rating, created_at)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Session list failed: ${error.code}`);

  return data.map(({ interview_questions: questions, interview_answers: answers, ...session }) => {
    const ordered = answers.toSorted((a, b) => a.created_at.localeCompare(b.created_at));
    return {
      ...session,
      summary: summarizeSession(questions.length, [...latestByQuestion(ordered).values()]),
    };
  });
}

export async function getSessionDetail(supabase: Client, id: string) {
  const [session, questions, answers] = await Promise.all([
    supabase.from("interview_sessions").select("*").eq("id", id).maybeSingle(),
    supabase.from("interview_questions").select("*").eq("session_id", id).order("position"),
    supabase.from("interview_answers").select("*").eq("session_id", id).order("created_at"),
  ]);
  const failed = session.error ?? questions.error ?? answers.error;
  if (failed) throw new Error(`Session lookup failed: ${failed.code}`);
  if (!session.data) return null;
  return {
    session: session.data,
    questions: questions.data ?? [],
    answers: answers.data ?? [],
  };
}
