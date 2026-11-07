"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  errorState,
  successState,
  type ActionState,
} from "@/lib/action-state";
import { remoteOptions } from "@/lib/job-filters";
import { isValidTimeZone } from "@/lib/time";
import { requireUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";

const shortText = z.string().trim().max(200, "Use 200 characters or fewer.");

const profileSchema = z.object({
  full_name: shortText,
  headline: shortText,
  location: shortText,
  linkedin_url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === "" || /^https:\/\/([\w-]+\.)?linkedin\.com\//i.test(value),
      "Enter a LinkedIn link that starts with https://",
    ),
});

const list = z
  .string()
  .max(1000)
  .transform((value) =>
    [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))],
  );

const remoteValues = remoteOptions.map((option) => option.value);

const preferencesSchema = z.object({
  desired_titles: list,
  desired_locations: list,
  remote_policies: z.array(z.enum(remoteValues)),
  min_salary: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine(
      (value) => value === null || (Number.isFinite(value) && value >= 0),
      "Enter a valid salary.",
    ),
  salary_currency: z.enum(["EUR", "USD", "GBP"]),
});

const notificationSchema = z.object({
  timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone."),
});

export async function updateNotificationPreferences(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/settings");
  const parsed = notificationSchema.safeParse({ timezone: formData.get("timezone") });
  if (!parsed.success) return errorState(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_preferences")
    .update({
      timezone: parsed.data.timezone,
      notify_follow_ups: formData.get("notify_follow_ups") === "on",
      notify_interviews: formData.get("notify_interviews") === "on",
      notify_saved_jobs: formData.get("notify_saved_jobs") === "on",
      notify_job_matches: formData.get("notify_job_matches") === "on",
    })
    .eq("user_id", user.id);
  if (error) return errorState("Your settings could not be saved.");

  revalidatePath("/", "layout");
  return successState("Notification settings saved.");
}

export async function updateProfile(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/settings");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id);
  if (error) return errorState("Your profile could not be saved.");

  revalidatePath("/", "layout");
  return successState("Profile saved.");
}

export async function updatePreferences(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/settings");
  const parsed = preferencesSchema.safeParse({
    desired_titles: formData.get("desired_titles"),
    desired_locations: formData.get("desired_locations"),
    remote_policies: formData.getAll("remote_policies"),
    min_salary: formData.get("min_salary"),
    salary_currency: formData.get("salary_currency"),
  });
  if (!parsed.success) return errorState(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_preferences")
    .update(parsed.data)
    .eq("user_id", user.id);
  if (error) return errorState("Your preferences could not be saved.");

  revalidatePath("/settings");
  return successState("Preferences saved.");
}
