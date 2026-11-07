"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/action-state";

/**
 * React clears a form once its action finishes, even if the action failed, which
 * would throw away what the person typed. Submitting this way keeps the fields.
 */
export function submitKeepingFields(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The submitter carries the name and value of the button that was pressed.
    const { submitter } = event.nativeEvent as SubmitEvent;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
}

type ActionFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel: string;
  /** Clears the fields after a success, for forms that add an item to a list. */
  resetOnSuccess?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** A form that runs a server action and shows its result above the button. */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  resetOnSuccess,
  disabled,
  className = "space-y-4",
  children,
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") form.current?.reset();
  }, [resetOnSuccess, state]);

  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={submitKeepingFields(formAction)}
      className={className}
    >
      {children}
      <div aria-live="polite">{!pending && <FormMessage state={state} />}</div>
      <Button type="submit" size="lg" disabled={pending || disabled}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
