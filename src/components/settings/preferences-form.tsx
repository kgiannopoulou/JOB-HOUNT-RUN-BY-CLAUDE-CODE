"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState } from "@/lib/action-state";
import { remoteOptions } from "@/lib/job-filters";
import { updatePreferences } from "@/server/profile/actions";

type PreferencesFormProps = {
  preferences: {
    desired_titles: string[];
    desired_locations: string[];
    remote_policies: string[];
    min_salary: number | null;
    salary_currency: string;
  };
};

export function PreferencesForm({ preferences }: PreferencesFormProps) {
  const [state, action, pending] = useActionState(
    updatePreferences,
    idleState,
  );

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="desired_titles">Target job titles</Label>
          <Input
            id="desired_titles"
            name="desired_titles"
            defaultValue={preferences.desired_titles.join(", ")}
            placeholder="Data analyst, BI analyst"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desired_locations">Preferred locations</Label>
          <Input
            id="desired_locations"
            name="desired_locations"
            defaultValue={preferences.desired_locations.join(", ")}
            placeholder="Athens, Remote"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="min_salary">Minimum yearly salary</Label>
          <Input
            id="min_salary"
            name="min_salary"
            type="number"
            min={0}
            step={1000}
            defaultValue={preferences.min_salary ?? ""}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salary_currency">Currency</Label>
          <select
            id="salary_currency"
            name="salary_currency"
            defaultValue={preferences.salary_currency}
            className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Work arrangement</legend>
        {remoteOptions.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="remote_policies"
              value={option.value}
              defaultChecked={preferences.remote_policies.includes(option.value)}
              className="size-4 accent-primary"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
