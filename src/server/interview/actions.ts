"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { errorState, successState, type ActionState } from "@/lib/action-state";
import {
  buildFeedback,
  isTooShort,
  MAX_ANSWER_LENGTH,
  tooShortFeedback,
} from "@/lib/interview/feedback";
import {
  MAX_SESSIONS_PER_USER,
  sessionFocuses,
  sessionModes,
} from "@/lib/interview/questions";
import { MAX_JOB_TEXT_LENGTH } from "@/lib/matching/result";
import { AiError, isAiConfigured } from "@/server/ai/gateway";
import { contentHash } from "@/server/ai/hash";
import { getCurrentUser } from "@/server/auth/user";
import { getMatchingResume } from "@/server/cv/queries";
import { generateQuestions, reviewAnswers } from "@/server/interview/ai";
import { getSessionDetail, latestByQuestion } from "@/server/interview/queries";
import {
  completeSession,
  createSession,
  saveAnswer,
  saveFeedback,
} from "@/server/interview/store";
import { jobSourceText } from "@/server/matching/ai";
import { createClient } from "@/server/supabase/server";

const uuid = z.uuid();

const newSessionSchema = z.object({
  applicationId: uuid,
  focus: z.enum(sessionFocuses),
  mode: z.enum(sessionModes),
});

async function signedInUser(next = "/interview") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

function refresh(id?: string) {
  revalidatePath("/interview");
  if (id) revalidatePath(`/interview/${id}`);
  revalidatePath("/analytics");
}

export async function createInterviewSession(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await signedInUser();

  const parsed = newSessionSchema.safeParse({
    applicationId: formData.get("applicationId"),
    focus: formData.get("focus"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) return errorState("Choose an application, a focus and a format.");
  const { applicationId, focus, mode } = parsed.data;

  if (!isAiConfigured()) return errorState("AI features are not set up on this server yet.");

  const supabase = await createClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select(
      "id, company, role_title, job_id, jobs (title, company, description, experience_level, tags)",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError || !application) return errorState("This application could not be found.");

  const resume = await getMatchingResume(supabase);
  if (!resume) return errorState("Upload a CV and confirm its details first.");

  const { count, error: countError } = await supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true });
  if (countError) return errorState("The session could not be created. Please try again.");
  if ((count ?? 0) >= MAX_SESSIONS_PER_USER) {
    return errorState(`You can keep up to ${MAX_SESSIONS_PER_USER} sessions. Delete one first.`);
  }

  const job = application.jobs;
  const jobText = job?.description.trim() ? jobSourceText(job) : "";
  if (jobText.length > MAX_JOB_TEXT_LENGTH) {
    return errorState("This job description is too long to use.");
  }

  let sessionId: string;
  try {
    const { questions, model } = await generateQuestions({
      userId: user.id,
      profile: resume.profile,
      company: application.company,
      roleTitle: application.role_title,
      jobText,
      focus,
      mode,
    });
    if (questions.length === 0) throw new AiError("invalid_output");

    sessionId = await createSession({
      userId: user.id,
      applicationId: application.id,
      jobId: application.job_id,
      company: application.company,
      roleTitle: application.role_title,
      focus,
      mode,
      hadJobText: Boolean(jobText),
      model,
      questions,
    });
  } catch (error) {
    if (error instanceof AiError) return errorState(error.message);
    console.error("Interview session failed");
    return errorState("The session could not be created. Please try again.");
  }

  refresh();
  redirect(`/interview/${sessionId}`);
}

const answerSchema = z.object({
  sessionId: uuid,
  questionId: uuid,
  answer: z
    .string()
    .trim()
    .min(1, "Write an answer first.")
    .max(MAX_ANSWER_LENGTH, `Keep your answer under ${MAX_ANSWER_LENGTH} characters.`),
});

/**
 * Each changed answer is kept as a new attempt. The answer is stored before the AI
 * is called, so a failed call never loses what the person wrote.
 */
export async function saveInterviewAnswer(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = answerSchema.safeParse({
    sessionId: formData.get("sessionId"),
    questionId: formData.get("questionId"),
    answer: formData.get("answer"),
  });
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check your answer.");
  const { sessionId, questionId, answer } = parsed.data;
  const user = await signedInUser(`/interview/${sessionId}`);

  const supabase = await createClient();
  const detail = await getSessionDetail(supabase, sessionId);
  const question = detail?.questions.find((item) => item.id === questionId);
  if (!detail || !question) return errorState("This question could not be found.");
  if (detail.session.status === "completed") return errorState("This session has finished.");

  const answerHash = contentHash(answer);
  const previous = detail.answers.findLast(
    (item) => item.question_id === questionId && item.answer_hash === answerHash,
  );
  const wantsFeedback = formData.get("intent") === "feedback" && detail.session.mode === "practice";

  if (previous?.feedback) return successState("This answer already has feedback.");

  let answerId: string;
  try {
    answerId =
      previous?.id ??
      (await saveAnswer({ userId: user.id, sessionId, questionId, answer, answerHash }));
  } catch {
    console.error("Saving an interview answer failed");
    return errorState("Your answer could not be saved. Please try again.");
  }

  if (!wantsFeedback) {
    refresh(sessionId);
    return successState("Answer saved.");
  }

  try {
    if (isTooShort(answer)) {
      await saveFeedback(user.id, answerId, tooShortFeedback(), null);
    } else {
      if (!isAiConfigured()) {
        refresh(sessionId);
        return errorState("Your answer was saved. AI feedback is not set up on this server yet.");
      }
      const { items, model } = await reviewAnswers(user.id, detail.session.role_title, [
        { index: 0, question: question.question, answer },
      ]);
      if (!items[0]) throw new AiError("invalid_output");
      await saveFeedback(user.id, answerId, buildFeedback(items[0], answer, question.question), model);
    }
  } catch (error) {
    refresh(sessionId);
    const reason =
      error instanceof AiError ? error.message : "The feedback failed. Please try again.";
    return errorState(`Your answer was saved. ${reason}`);
  }

  refresh(sessionId);
  return successState("Feedback is ready.");
}

/** Marks every written answer in one AI call, then closes the mock interview. */
export async function finishMockInterview(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("sessionId"));
  if (!id.success) return errorState("This session could not be found.");
  const user = await signedInUser(`/interview/${id.data}`);

  const supabase = await createClient();
  const detail = await getSessionDetail(supabase, id.data);
  if (!detail || detail.session.mode !== "mock") return errorState("This session could not be found.");
  if (detail.session.status === "completed") return successState("This session has finished.");

  const latest = latestByQuestion(detail.answers);
  if (latest.size === 0) return errorState("Answer at least one question first.");

  const pending = detail.questions.flatMap((question) => {
    const attempt = latest.get(question.id);
    return attempt && !attempt.feedback ? [{ question, attempt }] : [];
  });
  const tooShort = pending.filter(({ attempt }) => isTooShort(attempt.answer));
  const toReview = pending.filter(({ attempt }) => !isTooShort(attempt.answer));

  if (toReview.length > 0 && !isAiConfigured()) {
    return errorState("AI feedback is not set up on this server yet.");
  }

  try {
    for (const { attempt } of tooShort) {
      await saveFeedback(user.id, attempt.id, tooShortFeedback(), null);
    }
    if (toReview.length > 0) {
      const { items, model } = await reviewAnswers(
        user.id,
        detail.session.role_title,
        toReview.map(({ question, attempt }, index) => ({
          index,
          question: question.question,
          answer: attempt.answer,
        })),
      );
      for (const item of items) {
        const reviewed = toReview[item.question_index];
        if (!reviewed) continue;
        const { question, attempt } = reviewed;
        await saveFeedback(
          user.id,
          attempt.id,
          buildFeedback(item, attempt.answer, question.question),
          model,
        );
      }
    }
    await completeSession(user.id, id.data);
  } catch (error) {
    if (error instanceof AiError) return errorState(`Your answers are saved. ${error.message}`);
    console.error("Finishing a mock interview failed");
    return errorState("Your answers are saved, but the feedback failed. Please try again.");
  }

  refresh(id.data);
  return successState("Your feedback is ready.");
}

export async function deleteInterviewSession(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("sessionId"));
  if (!id.success) return errorState("This session could not be found.");
  await signedInUser(`/interview/${id.data}`);

  const supabase = await createClient();
  const { error } = await supabase.from("interview_sessions").delete().eq("id", id.data);
  if (error) return errorState("This session could not be deleted. Please try again.");

  refresh();
  redirect("/interview");
}
