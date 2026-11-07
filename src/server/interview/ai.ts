import "server-only";

import { profileWithoutContact, type CvProfile } from "@/lib/cv/profile";
import { feedbackOutputSchema } from "@/lib/interview/feedback";
import {
  checkQuestions,
  questionOutputSchema,
  type SessionFocus,
  type SessionMode,
} from "@/lib/interview/questions";
import { generateStructured, untrusted } from "@/server/ai/gateway";

const QUESTIONS_SYSTEM = `You prepare candidates for job interviews by writing practice questions from their verified CV and one job posting.

Rules:
- The job text is the only verified information about the employer. Never state or imply anything about the company, its products, history, culture, size, customers, news or values that the job text does not say.
- Do not use anything you may know about the company from elsewhere.
- category "technical": skills and problems the role calls for. These may be general questions about the field.
- category "behavioural": past behaviour, such as "Tell me about a time when". Base them on what the role needs and the candidate's real experience. Never assume the candidate did something the profile does not state.
- category "company": questions a candidate could face about this employer's own stated work. Each must come directly from the job text. If the job text gives nothing to work from, write none.
- job_quote must be words copied exactly from the job text, in one unbroken run. It is required for "company" questions. Use it for others where one applies, or leave it empty.
- why_it_may_come_up explains briefly why this is worth practising. Never say a question will be asked. Use words like "may" and "could".
- structure_name and structure_steps suggest how to organise an answer, such as STAR for behavioural questions. Give the steps as short instructions. Never write a sample answer, and never supply facts, names or figures for the candidate to use.
- Write in the language of the job text, or of the profile if there is no job text.
- Return 4 technical, 4 behavioural and up to 2 company questions, best first.`;

type QuestionRequest = {
  userId: string;
  profile: CvProfile;
  company: string;
  roleTitle: string;
  jobText: string;
  focus: SessionFocus;
  mode: SessionMode;
};

export async function generateQuestions(request: QuestionRequest) {
  const { userId, profile, company, roleTitle, jobText, focus, mode } = request;
  const { output, model } = await generateStructured({
    feature: "interview_questions",
    userId,
    system: QUESTIONS_SYSTEM,
    parts: [
      {
        text: untrusted("verified-profile", JSON.stringify(profileWithoutContact(profile))),
        cache: true,
      },
      {
        text: untrusted(
          "job-description",
          `Company: ${company}\nPosition: ${roleTitle}\n${jobText || "No job posting is available."}`,
        ),
      },
    ],
    schema: questionOutputSchema,
    effort: "medium",
  });
  return {
    ...checkQuestions({ output, profile, jobText, company, roleTitle, focus, mode }),
    model,
  };
}

const FEEDBACK_SYSTEM = `You review written answers to practice interview questions. You are honest, specific and kind.

Rules:
- Assess each answer on four criteria: relevance (does it answer the question), structure (is it easy to follow), specificity (does it give concrete detail), impact (does it show a result).
- Rate each criterion strong, adequate or weak. Most answers are not strong on everything.
- answer_quote must be words copied exactly from the answer, in one unbroken run. A strong rating needs one. A strength needs one.
- weaknesses says what is missing or unclear.
- improvements says what to do next, as instructions. Tell the person to add their own real detail. Never write a replacement answer. Never supply an example figure, name or achievement, because it could be repeated as if it were true.
- Judge the answer only. Do not predict how an interview will go or whether the person will get the job.
- Give at most 3 strengths, 3 weaknesses and 3 improvements for each answer, and a one or two sentence summary.
- Write in the language of the answer.
- Return one item for each question, using its question_index.`;

export type AnswerToReview = { index: number; question: string; answer: string };

export async function reviewAnswers(userId: string, roleTitle: string, answers: AnswerToReview[]) {
  const { output, model } = await generateStructured({
    feature: "interview_feedback",
    userId,
    system: FEEDBACK_SYSTEM,
    parts: [
      {
        text: `The candidate is preparing for this position: ${roleTitle}.\n\n${answers
          .map(
            ({ index, question, answer }) =>
              `Question ${index}: ${question}\n${untrusted("candidate-answer", answer)}`,
          )
          .join("\n\n")}`,
      },
    ],
    schema: feedbackOutputSchema,
    effort: "medium",
  });
  return { items: output.items, model };
}
