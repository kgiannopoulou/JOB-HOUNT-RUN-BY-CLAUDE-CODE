"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorState, idleState, type ActionState } from "@/lib/action-state";

export type AuthField = {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete: string;
  minLength?: number;
  hint?: string;
};

type AuthFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: AuthField[];
  submitLabel: string;
  /** Hidden redirect target, checked again on the server. */
  next?: string;
  /** Message shown before the form is submitted, such as an expired link. */
  initialError?: string;
};

export function AuthForm({
  action,
  fields,
  submitLabel,
  next,
  initialError,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialError ? errorState(initialError) : idleState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      {next && <input type="hidden" name="next" value={next} />}
      {fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            name={field.name}
            type={field.type ?? "text"}
            autoComplete={field.autoComplete}
            minLength={field.minLength}
            aria-describedby={field.hint ? `${field.name}-hint` : undefined}
            className="h-10"
            required
          />
          {field.hint && (
            <p
              id={`${field.name}-hint`}
              className="text-xs text-muted-foreground"
            >
              {field.hint}
            </p>
          )}
        </div>
      ))}
      <Button
        type="submit"
        size="lg"
        className="h-10 w-full"
        disabled={pending}
      >
        {pending ? "Please wait…" : submitLabel}
      </Button>
    </form>
  );
}
