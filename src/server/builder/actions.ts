"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { errorState, successState, type ActionState } from "@/lib/action-state";
import {
  cvLayoutSchema,
  cvTemplates,
  defaultLayout,
  MAX_CUSTOM_SECTIONS,
  normalizeLayout,
} from "@/lib/cv/document";
import {
  cvProfileSchema,
  MAX_PROFILE_LENGTH,
  normalizeProfile,
  profileIssues,
} from "@/lib/cv/profile";
import {
  CV_TAILOR_PROMPT_VERSION,
  MAX_VERSIONS_PER_USER,
  type Tailoring,
} from "@/lib/cv/tailor";
import { AiError, isAiConfigured } from "@/server/ai/gateway";
import { getCurrentUser } from "@/server/auth/user";
import { tailorProfile } from "@/server/builder/ai";
import { getVerifiedCv, getVersion } from "@/server/builder/queries";
import { loadJobForAi } from "@/server/jobs/choices";
import { createClient } from "@/server/supabase/server";
import type { Json } from "@/types/database";

const uuid = z.uuid();

const newVersionSchema = z.object({
  resumeId: uuid,
  jobId: z.union([z.literal(""), uuid]),
  template: z.enum(cvTemplates),
});

async function signedInUser(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

function refresh(id?: string) {
  revalidatePath("/cv");
  if (id) revalidatePath(`/cv/versions/${id}`);
}

const asJson = (value: unknown) => value as NonNullable<Json>;

/**
 * Makes a new row and leaves the source as it was. Without a job it is a plain
 * copy of details the user has confirmed. With a job the AI proposes wording, and
 * the version stays unconfirmed until the user has reviewed it.
 */
export async function createCvVersion(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await signedInUser("/cv");

  const parsed = newVersionSchema.safeParse({
    resumeId: formData.get("resumeId"),
    jobId: formData.get("jobId") ?? "",
    template: formData.get("template"),
  });
  if (!parsed.success) return errorState("Choose a CV and a template.");
  const { resumeId, jobId, template } = parsed.data;

  const supabase = await createClient();
  const source = await getVerifiedCv(supabase, resumeId);
  if (!source) return errorState("Confirm this CV's details first.");

  const { count, error: countError } = await supabase
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .eq("kind", "version");
  if (countError) return errorState("The version could not be created. Please try again.");
  if ((count ?? 0) >= MAX_VERSIONS_PER_USER) {
    return errorState(`You can keep up to ${MAX_VERSIONS_PER_USER} versions. Delete one first.`);
  }

  const shared = {
    user_id: user.id,
    kind: "version",
    template,
    layout: asJson(defaultLayout()),
    parent_resume_id: source.id,
  };

  let row;
  if (!jobId) {
    row = {
      ...shared,
      title: `${source.title} (copy)`.slice(0, 200),
      content: asJson(source.profile),
      parse_status: "ready" as const,
      verified_at: new Date().toISOString(),
    };
  } else {
    if (!isAiConfigured()) return errorState("AI features are not set up on this server yet.");
    const loaded = await loadJobForAi(supabase, jobId);
    if ("problem" in loaded) return errorState(loaded.problem);
    const { job } = loaded;

    try {
      const { result, model } = await tailorProfile(user.id, source.profile, job);
      const { profile, ...report } = result;
      const tailoring: Tailoring = {
        ...report,
        prompt_version: CV_TAILOR_PROMPT_VERSION,
        model,
        job_title: job.title,
        company: job.company,
      };
      row = {
        ...shared,
        title: `${job.title} at ${job.company}`.slice(0, 200),
        content: asJson(profile),
        target_job_id: job.id,
        tailoring: asJson(tailoring),
        parse_status: "needs_review" as const,
      };
    } catch (error) {
      if (error instanceof AiError) return errorState(error.message);
      console.error("CV tailoring failed");
      return errorState("The version could not be created. Please try again.");
    }
  }

  const { data, error } = await supabase.from("resumes").insert(row).select("id").single();
  if (error) return errorState("The version could not be saved. Please try again.");

  refresh();
  redirect(`/cv/versions/${data.id}`);
}

/** Saving is the review: the details are confirmed by the person who read them. */
export async function saveVersionProfile(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("resumeId"));
  if (!id.success) return errorState("This version could not be found.");
  await signedInUser(`/cv/versions/${id.data}`);

  if (formData.get("confirmed") !== "on") {
    return errorState("Confirm that you have checked this version.");
  }

  const raw = formData.get("profile");
  if (typeof raw !== "string" || raw.length > MAX_PROFILE_LENGTH * 2) {
    return errorState("This version could not be saved.");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return errorState("This version could not be saved.");
  }
  const parsed = cvProfileSchema.safeParse(json);
  if (!parsed.success) return errorState("This version could not be saved.");

  const profile = normalizeProfile(parsed.data);
  const issues = profileIssues(profile);
  if (issues.length > 0) return errorState(issues.join(" "));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumes")
    .update({
      content: asJson(profile),
      parse_status: "ready",
      verified_at: new Date().toISOString(),
    })
    .eq("id", id.data)
    .eq("kind", "version")
    .select("id");
  if (error || data.length === 0) return errorState("This version could not be saved.");

  refresh(id.data);
  redirect(`/cv/versions/${id.data}`);
}

const layoutFormSchema = z.object({
  title: z.string().trim().min(1, "Give this version a name.").max(200),
  template: z.enum(cvTemplates),
});

export async function saveVersionLayout(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("resumeId"));
  if (!id.success) return errorState("This version could not be found.");
  await signedInUser(`/cv/versions/${id.data}`);

  const form = layoutFormSchema.safeParse({
    title: formData.get("title"),
    template: formData.get("template"),
  });
  if (!form.success) {
    return errorState(form.error.issues[0]?.message ?? "This layout could not be saved.");
  }

  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("layout")));
  } catch {
    return errorState("This layout could not be saved.");
  }
  const layout = cvLayoutSchema.safeParse(json);
  if (!layout.success) return errorState("This layout could not be saved.");

  const normalized = normalizeLayout(layout.data);
  const custom = normalized.sections.filter((section) => section.kind === "custom");
  if (custom.length > MAX_CUSTOM_SECTIONS) {
    return errorState(`You can add up to ${MAX_CUSTOM_SECTIONS} sections of your own.`);
  }
  if (custom.some((section) => !section.heading)) {
    return errorState("Give each section of your own a heading.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumes")
    .update({ ...form.data, layout: asJson(normalized) })
    .eq("id", id.data)
    .eq("kind", "version")
    .select("id");
  if (error || data.length === 0) return errorState("This layout could not be saved.");

  refresh(id.data);
  return successState("Layout saved.");
}

export async function deleteCvVersion(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("resumeId"));
  if (!id.success) return errorState("This version could not be found.");
  await signedInUser(`/cv/versions/${id.data}`);

  const supabase = await createClient();
  const version = await getVersion(supabase, id.data);
  if (!version) return errorState("This version could not be found.");

  const { error } = await supabase.from("resumes").delete().eq("id", id.data);
  if (error) return errorState("This version could not be deleted. Please try again.");

  refresh();
  redirect("/cv");
}
