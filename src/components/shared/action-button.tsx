"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/action-state";

type ActionButtonProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  pendingLabel: string;
  variant?: "default" | "outline" | "secondary" | "destructive";
  disabled?: boolean;
  /** For actions that cannot be undone: the first click asks for a second one. */
  confirmLabel?: string;
  children: React.ReactNode;
};

/** A button that runs a server action and shows its result next to it. */
export function ActionButton({
  action,
  fields,
  pendingLabel,
  variant = "default",
  disabled,
  confirmLabel,
  children,
}: ActionButtonProps) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const [armed, setArmed] = useState(false);

  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(event) => {
        if (confirmLabel && !armed) {
          event.preventDefault();
          setArmed(true);
        }
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" size="lg" variant={variant} disabled={pending || disabled}>
        {pending ? pendingLabel : armed ? confirmLabel : children}
      </Button>
      <div aria-live="polite">{!pending && <FormMessage state={state} />}</div>
    </form>
  );
}
