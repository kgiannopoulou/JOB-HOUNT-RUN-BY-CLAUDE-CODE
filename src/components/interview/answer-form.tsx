"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { submitKeepingFields } from "@/components/shared/action-form";
import { TextAreaField } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/action-state";
import { countWords, MAX_ANSWER_LENGTH, MIN_ANSWER_WORDS } from "@/lib/interview/feedback";
import { saveInterviewAnswer } from "@/server/interview/actions";

type AnswerFormProps = {
  sessionId: string;
  questionId: string;
  label: string;
  initial: string;
};

export function AnswerForm({ sessionId, questionId, label, initial }: AnswerFormProps) {
  const [state, action, pending] = useActionState(saveInterviewAnswer, idleState);
  const [answer, setAnswer] = useState(initial);
  const words = countWords(answer);

  return (
    <form action={action} onSubmit={submitKeepingFields(action)} className="space-y-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="questionId" value={questionId} />
      <TextAreaField
        label={label}
        name="answer"
        rows={6}
        maxLength={MAX_ANSWER_LENGTH}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        {words} {words === 1 ? "word" : "words"}
        {words > 0 && words < MIN_ANSWER_WORDS && `. Feedback needs at least ${MIN_ANSWER_WORDS}.`}
      </p>
      <div aria-live="polite">{!pending && <FormMessage state={state} />}</div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" name="intent" value="feedback" disabled={pending}>
          {pending ? "Working…" : "Get feedback"}
        </Button>
        <Button
          type="submit"
          size="lg"
          variant="outline"
          name="intent"
          value="save"
          disabled={pending}
        >
          Save answer
        </Button>
      </div>
    </form>
  );
}
