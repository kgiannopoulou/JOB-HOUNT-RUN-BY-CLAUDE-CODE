"use client";

import { startTransition, useEffect, useState } from "react";
import { Timer } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { ActionButton } from "@/components/shared/action-button";
import { TextAreaField } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { idleState, type ActionState } from "@/lib/action-state";
import { MAX_ANSWER_LENGTH } from "@/lib/interview/feedback";
import { finishMockInterview, saveInterviewAnswer } from "@/server/interview/actions";

/** A guide only. Nothing happens when it passes, as in a real conversation. */
const SUGGESTED_SECONDS = 180;

function Clock({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <p role="timer" aria-live="off" className="flex items-center gap-1.5 text-sm tabular-nums">
      <Timer className="size-4 text-muted-foreground" aria-hidden />
      {clock}
      <span className="text-muted-foreground">
        {seconds > SUGGESTED_SECONDS ? "Try to wrap up" : "of about 3:00"}
      </span>
    </p>
  );
}

type MockRunnerProps = {
  sessionId: string;
  questions: { id: string; question: string }[];
  answeredIds: string[];
};

export function MockRunner({ sessionId, questions, answeredIds }: MockRunnerProps) {
  const firstOpen = questions.findIndex((question) => !answeredIds.includes(question.id));
  const [index, setIndex] = useState(firstOpen === -1 ? questions.length : firstOpen);
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<ActionState>(idleState);
  const [saving, setSaving] = useState(false);

  const question = questions[index];

  const next = () => {
    setAnswer("");
    setState(idleState);
    setIndex((value) => value + 1);
  };

  const save = () => {
    if (!question) return;
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("questionId", question.id);
    formData.set("answer", answer);
    formData.set("intent", "save");
    setSaving(true);
    startTransition(async () => {
      const result = await saveInterviewAnswer(idleState, formData);
      setSaving(false);
      if (result.status === "error") setState(result);
      else next();
    });
  };

  if (!question) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>That was the last question</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionButton
            action={finishMockInterview}
            fields={{ sessionId }}
            pendingLabel="Reviewing your answers…"
          >
            Finish and get feedback
          </ActionButton>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Question {index + 1} of {questions.length}
          </p>
          <Clock key={question.id} running />
        </div>
        <CardTitle className="text-lg leading-snug">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <TextAreaField
          label="Your answer"
          rows={9}
          maxLength={MAX_ANSWER_LENGTH}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        />
        <div aria-live="polite">
          <FormMessage state={state} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="lg" disabled={saving || !answer.trim()} onClick={save}>
            {saving ? "Saving…" : "Save and continue"}
          </Button>
          <Button type="button" size="lg" variant="outline" disabled={saving} onClick={next}>
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
