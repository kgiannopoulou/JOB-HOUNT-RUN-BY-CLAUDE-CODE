"use client";

import { useActionState } from "react";
import { Gauge } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/action-state";
import { checkJobMatch } from "@/server/matching/actions";

export function CheckMatchButton({ jobId, title }: { jobId: string; title: string }) {
  const [state, action, pending] = useActionState(checkJobMatch, idleState);

  return (
    <form action={action} className="contents">
      <input type="hidden" name="jobId" value={jobId} />
      <Button
        type="submit"
        variant="outline"
        size="lg"
        disabled={pending}
        aria-label={`Check match for ${title}`}
      >
        <Gauge data-icon="inline-start" />
        {pending ? "Comparing…" : "Check match"}
      </Button>
      {!pending && state.status === "error" && (
        <div className="basis-full">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}
