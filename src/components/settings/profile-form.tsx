"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState } from "@/lib/action-state";
import { updateProfile } from "@/server/profile/actions";

type ProfileFormProps = {
  profile: {
    full_name: string;
    headline: string;
    location: string;
    linkedin_url: string;
  };
};

const fields = [
  { name: "full_name", label: "Full name", autoComplete: "name" },
  { name: "headline", label: "Headline", autoComplete: "off" },
  { name: "location", label: "Location", autoComplete: "off" },
  { name: "linkedin_url", label: "LinkedIn URL", autoComplete: "url" },
] as const;

export function ProfileForm({ profile }: ProfileFormProps) {
  const [state, action, pending] = useActionState(updateProfile, idleState);

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              name={field.name}
              defaultValue={profile[field.name]}
              autoComplete={field.autoComplete}
              className="h-10"
            />
          </div>
        ))}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
