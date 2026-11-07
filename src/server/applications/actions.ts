"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { errorState, successState, type ActionState } from "@/lib/action-state";
import {
  applicationDetailsSchema,
  firstIssue,
  isDuplicateApplication,
  interviewSchema,
  isRealDate,
  newApplicationSchema,
  reminderSchema,
} from "@/lib/applications/schema";
import {
  appliedDateAfterMove,
  applicationStatuses,
  canMove,
  statusLabels,
} from "@/lib/applications/status";
import { listApplications } from "@/server/applications/queries";
import { getCurrentUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";

const uuid = z.uuid();
const status = z.enum(applicationStatuses);

const today = () => new Date().toISOString().slice(0, 10);

async function signedInUser(next = "/applications") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

function refresh(id?: string) {
  revalidatePath("/applications", "layout");
  if (id) revalidatePath(`/applications/${id}`);
  revalidatePath("/dashboard");
}

const fields = (formData: FormData, names: string[]) =>
  Object.fromEntries(names.map((name) => [name, formData.get(name) ?? ""]));

export async function createApplication(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await signedInUser("/applications/new");

  const parsed = newApplicationSchema.safeParse(
    fields(formData, ["company", "role_title", "status", "applied_at", "job_url", "notes"]),
  );
  if (!parsed.success) return errorState(firstIssue(parsed.error));
  const { applied_at, job_url, ...rest } = parsed.data;

  const supabase = await createClient();
  if (formData.get("allowDuplicate") !== "on") {
    const existing = await listApplications(supabase);
    if (isDuplicateApplication(existing, rest.company, rest.role_title)) {
      return errorState(
        `You already track ${rest.role_title} at ${rest.company}. Tick "Add it anyway" if this is a different application.`,
      );
    }
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      ...rest,
      user_id: user.id,
      job_url: job_url || null,
      applied_at: appliedDateAfterMove(rest.status, null, today(), applied_at),
    })
    .select("id")
    .single();
  if (error) return errorState("The application could not be saved. Please try again.");

  refresh();
  redirect(`/applications/${data.id}`);
}

export async function updateApplication(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("applicationId"));
  if (!id.success) return errorState("This application could not be found.");
  await signedInUser(`/applications/${id.data}`);

  const parsed = applicationDetailsSchema.safeParse(
    fields(formData, [
      "company",
      "role_title",
      "applied_at",
      "job_url",
      "notes",
      "recruiter_name",
      "recruiter_email",
      "recruiter_phone",
      "offer_details",
      "offer_deadline",
      "rejection_reason",
      "resume_id",
      "cover_letter_id",
    ]),
  );
  if (!parsed.success) return errorState(firstIssue(parsed.error));
  const details = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("applications")
    .select("status")
    .eq("id", id.data)
    .maybeSingle();
  if (!current) return errorState("This application could not be found.");
  if (current.status !== "saved" && !details.applied_at) {
    return errorState("Enter the date you applied.");
  }

  const { error } = await supabase
    .from("applications")
    .update({
      ...details,
      applied_at: details.applied_at || null,
      job_url: details.job_url || null,
      offer_deadline: details.offer_deadline || null,
      resume_id: details.resume_id || null,
      cover_letter_id: details.cover_letter_id || null,
    })
    .eq("id", id.data);
  // The foreign keys reject a document that belongs to someone else.
  if (error) return errorState("These details could not be saved. Please try again.");

  refresh(id.data);
  return successState("Details saved.");
}

const moveSchema = z.object({
  applicationId: uuid,
  from: status,
  to: status,
  appliedAt: z.string().refine((value) => value === "" || isRealDate(value)),
});

/**
 * Moves a card or changes a status. Updating only if the status is still the one
 * the page showed means a stale tab cannot overwrite a newer change.
 */
export async function moveApplication(_: ActionState, formData: FormData): Promise<ActionState> {
  await signedInUser();

  const parsed = moveSchema.safeParse({
    applicationId: formData.get("applicationId"),
    from: formData.get("from"),
    to: formData.get("to"),
    appliedAt: formData.get("appliedAt") ?? "",
  });
  if (!parsed.success) return errorState("This status could not be changed.");
  const { applicationId, from, to, appliedAt } = parsed.data;

  if (!canMove(from, to)) {
    return errorState(`An application cannot move from ${statusLabels[from]} to ${statusLabels[to]}.`);
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("applications")
    .select("applied_at")
    .eq("id", applicationId)
    .maybeSingle();
  if (!current) return errorState("This application could not be found.");

  const { data, error } = await supabase
    .from("applications")
    .update({
      status: to,
      applied_at: appliedDateAfterMove(to, current.applied_at, today(), appliedAt),
    })
    .eq("id", applicationId)
    .eq("status", from)
    .select("id");
  if (error) return errorState("This status could not be changed. Please try again.");
  if (data.length === 0) {
    refresh(applicationId);
    return errorState("This application has changed. Refresh and try again.");
  }

  refresh(applicationId);
  return successState(`Moved to ${statusLabels[to]}.`);
}

export async function deleteApplication(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("applicationId"));
  if (!id.success) return errorState("This application could not be found.");
  await signedInUser(`/applications/${id.data}`);

  const supabase = await createClient();
  const { error } = await supabase.from("applications").delete().eq("id", id.data);
  if (error) return errorState("This application could not be deleted. Please try again.");

  refresh();
  redirect("/applications");
}

export async function addInterview(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("applicationId"));
  if (!id.success) return errorState("This application could not be found.");
  const user = await signedInUser(`/applications/${id.data}`);

  const parsed = interviewSchema.safeParse(
    fields(formData, ["scheduled_at", "kind", "location", "interviewer", "notes"]),
  );
  if (!parsed.success) return errorState(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("application_interviews")
    .insert({ ...parsed.data, user_id: user.id, application_id: id.data });
  if (error) return errorState("The interview could not be saved. Please try again.");

  refresh(id.data);
  return successState("Interview added.");
}

export async function deleteInterview(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("interviewId"));
  const applicationId = uuid.safeParse(formData.get("applicationId"));
  if (!id.success || !applicationId.success) return errorState("This interview could not be found.");
  await signedInUser(`/applications/${applicationId.data}`);

  const supabase = await createClient();
  const { error } = await supabase.from("application_interviews").delete().eq("id", id.data);
  if (error) return errorState("This interview could not be removed. Please try again.");

  refresh(applicationId.data);
  return successState("Interview removed.");
}

export async function addReminder(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("applicationId"));
  if (!id.success) return errorState("This application could not be found.");
  const user = await signedInUser(`/applications/${id.data}`);

  const parsed = reminderSchema.safeParse(fields(formData, ["title", "due_on"]));
  if (!parsed.success) return errorState(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("application_reminders")
    .insert({ ...parsed.data, user_id: user.id, application_id: id.data });
  if (error) return errorState("The reminder could not be saved. Please try again.");

  refresh(id.data);
  return successState("Reminder added.");
}

export async function setReminderDone(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("reminderId"));
  const applicationId = uuid.safeParse(formData.get("applicationId"));
  if (!id.success || !applicationId.success) return errorState("This reminder could not be found.");
  await signedInUser(`/applications/${applicationId.data}`);

  const done = formData.get("done") === "true";
  const supabase = await createClient();
  const { error } = await supabase
    .from("application_reminders")
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq("id", id.data);
  if (error) return errorState("This reminder could not be updated. Please try again.");

  refresh(applicationId.data);
  return successState(done ? "Reminder done." : "Reminder reopened.");
}

export async function deleteReminder(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("reminderId"));
  const applicationId = uuid.safeParse(formData.get("applicationId"));
  if (!id.success || !applicationId.success) return errorState("This reminder could not be found.");
  await signedInUser(`/applications/${applicationId.data}`);

  const supabase = await createClient();
  const { error } = await supabase.from("application_reminders").delete().eq("id", id.data);
  if (error) return errorState("This reminder could not be removed. Please try again.");

  refresh(applicationId.data);
  return successState("Reminder removed.");
}
