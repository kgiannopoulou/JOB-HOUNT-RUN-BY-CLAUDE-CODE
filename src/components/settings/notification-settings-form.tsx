"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SelectField } from "@/components/shared/form-fields";
import { FOLLOW_UP_AFTER_DAYS, INTERVIEW_NOTICE_HOURS } from "@/lib/notifications/rules";
import { updateNotificationPreferences } from "@/server/profile/actions";

const options = [
  {
    name: "notify_follow_ups",
    label: "Follow-ups",
    hint: `Reminders that are due, and applications with no reply after ${FOLLOW_UP_AFTER_DAYS} days.`,
  },
  {
    name: "notify_interviews",
    label: "Upcoming interviews",
    hint: `Sent ${INTERVIEW_NOTICE_HOURS} hours before an interview you have recorded.`,
  },
  {
    name: "notify_saved_jobs",
    label: "Saved job updates",
    hint: "When a job you saved is no longer listed by its source.",
  },
  {
    name: "notify_job_matches",
    label: "New jobs",
    hint: "New listings whose title fits the target titles in your job preferences.",
  },
] as const;

type NotificationSettingsFormProps = {
  preferences: Record<(typeof options)[number]["name"], boolean> & { timezone: string | null };
  timeZones: string[];
};

export function NotificationSettingsForm({ preferences, timeZones }: NotificationSettingsFormProps) {
  return (
    <ActionForm
      action={updateNotificationPreferences}
      submitLabel="Save notification settings"
      pendingLabel="Saving…"
    >
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Tell me about</legend>
        {options.map((option) => (
          <label key={option.name} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name={option.name}
              defaultChecked={preferences[option.name]}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              {option.label}
              <span className="block text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">
        Important messages about your account, such as a password change, are always sent.
        Notifications appear in the app. Email is not available yet.
      </p>
      <div className="max-w-sm space-y-1">
        <SelectField
          label="Time zone"
          name="timezone"
          defaultValue={preferences.timezone ?? "UTC"}
          options={timeZones.map((value) => ({ value, label: value.replaceAll("_", " ") }))}
        />
        <p className="text-xs text-muted-foreground">
          Decides when a day starts for reminders, interviews and weekly charts.
        </p>
      </div>
    </ActionForm>
  );
}
