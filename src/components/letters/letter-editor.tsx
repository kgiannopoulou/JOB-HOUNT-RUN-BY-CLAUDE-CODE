"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { submitKeepingFields } from "@/components/shared/action-form";
import { TextAreaField } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/action-state";
import { MAX_LETTER_LENGTH } from "@/lib/letters/letter";
import { saveCoverLetter } from "@/server/letters/actions";

type LetterEditorProps = {
  letterId: string;
  content: string;
  reviewed: boolean;
};

export function LetterEditor({ letterId, content, reviewed }: LetterEditorProps) {
  const [state, action, pending] = useActionState(saveCoverLetter, idleState);

  return (
    // The key resets the box when the saved text changes, such as after a restore.
    <form
      key={content}
      action={action}
      onSubmit={submitKeepingFields(action)}
      className="space-y-4"
    >
      <input type="hidden" name="letterId" value={letterId} />
      <TextAreaField
        label="Letter"
        name="content"
        defaultValue={content}
        rows={18}
        maxLength={MAX_LETTER_LENGTH}
        required
      />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirmed" defaultChecked={reviewed} className="mt-0.5 size-4" />
        I have read this letter and everything in it is true. Leave this unticked to save a
        draft, which cannot be exported.
      </label>
      <div aria-live="polite">{!pending && <FormMessage state={state} />}</div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save letter"}
      </Button>
    </form>
  );
}
