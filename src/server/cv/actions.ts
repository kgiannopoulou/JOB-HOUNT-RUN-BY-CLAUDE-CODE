"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { errorState, successState, type ActionState } from "@/lib/action-state";
import { CV_ANALYSIS_PROMPT_VERSION } from "@/lib/cv/analysis";
import {
  cvProfileSchema,
  emptyProfile,
  MAX_PROFILE_LENGTH,
  normalizeProfile,
  profileIssues,
} from "@/lib/cv/profile";
import {
  cvMimeTypes,
  cvTitle,
  detectFileType,
  fileTypeFromName,
  MAX_CV_BYTES,
  MAX_CVS_PER_USER,
  safeFileName,
} from "@/lib/cv/upload";
import { AiError, isAiConfigured } from "@/server/ai/gateway";
import { contentHash } from "@/server/ai/hash";
import { getCurrentUser } from "@/server/auth/user";
import { analyseProfile, extractProfile } from "@/server/cv/ai";
import { DocumentError, extractCvText } from "@/server/cv/extract-text";
import { getResume, parseProfile } from "@/server/cv/queries";
import { saveCvAnalysis } from "@/server/cv/store";
import { createClient } from "@/server/supabase/server";

const STALE_PARSE_MS = 5 * 60 * 1000;

const resumeId = z.uuid();

async function signedInUser(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

function refresh(id?: string) {
  revalidatePath("/cv");
  if (id) revalidatePath(`/cv/${id}`);
  revalidatePath("/dashboard");
}

export async function uploadCv(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await signedInUser("/cv");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return errorState("Choose a PDF or DOCX file.");
  }
  if (file.size > MAX_CV_BYTES) return errorState("The file must be 4 MB or smaller.");

  const claimedType = fileTypeFromName(file.name);
  if (!claimedType) return errorState("Only PDF and DOCX files can be uploaded.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (detectFileType(bytes) !== claimedType) {
    return errorState(`This file is not a real ${claimedType.toUpperCase()} document.`);
  }

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .is("parent_resume_id", null);
  if (countError) return errorState("The upload failed. Please try again.");
  if ((count ?? 0) >= MAX_CVS_PER_USER) {
    return errorState(`You can keep up to ${MAX_CVS_PER_USER} CVs. Delete one first.`);
  }

  let text: string;
  try {
    text = await extractCvText(bytes, claimedType);
  } catch (error) {
    if (error instanceof DocumentError) return errorState(error.message);
    throw error;
  }

  const id = randomUUID();
  const path = `${user.id}/${id}/${safeFileName(file.name, claimedType)}`;
  const { error: storageError } = await supabase.storage
    .from("cvs")
    .upload(path, bytes, { contentType: cvMimeTypes[claimedType], upsert: false });
  if (storageError) return errorState("The upload failed. Please try again.");

  const { error: insertError } = await supabase.from("resumes").insert({
    id,
    user_id: user.id,
    title: cvTitle(file.name),
    storage_path: path,
    file_name: file.name.slice(0, 255),
    file_type: claimedType,
    file_size: file.size,
    extracted_text: text,
    is_primary: count === 0,
  });
  if (insertError) {
    await supabase.storage.from("cvs").remove([path]);
    return errorState("The upload failed. Please try again.");
  }

  refresh();
  redirect(`/cv/${id}`);
}

export async function extractCvDetails(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsedId = resumeId.safeParse(formData.get("resumeId"));
  if (!parsedId.success) return errorState("This CV could not be found.");
  const id = parsedId.data;
  const user = await signedInUser(`/cv/${id}`);

  if (!isAiConfigured()) {
    return errorState("AI features are not set up on this server yet.");
  }

  const supabase = await createClient();
  const resume = await getResume(supabase, id);
  if (!resume?.extracted_text) return errorState("This CV could not be found.");

  // Claiming the row stops a double click from paying for two calls.
  const staleBefore = new Date(Date.now() - STALE_PARSE_MS).toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("resumes")
    .update({ parse_status: "parsing", parse_error: null })
    .eq("id", id)
    .or(
      `parse_status.in.(pending,failed),and(parse_status.eq.parsing,updated_at.lt.${staleBefore})`,
    )
    .select("id");
  if (claimError) return errorState("This CV could not be read. Please try again.");
  if (claimed.length === 0) return errorState("This CV is already being read.");

  try {
    const content = await extractProfile(user.id, resume.extracted_text);
    const { error } = await supabase
      .from("resumes")
      .update({ content, parse_status: "needs_review", parse_error: null })
      .eq("id", id);
    if (error) throw new Error(`Saving failed: ${error.code}`);
  } catch (error) {
    const message =
      error instanceof AiError ? error.message : "This CV could not be read. Please try again.";
    await supabase
      .from("resumes")
      .update({ parse_status: "failed", parse_error: message })
      .eq("id", id);
    refresh(id);
    return errorState(message);
  }

  refresh(id);
  return successState("Your details are ready to review.");
}

/** Lets someone continue without AI, for example if the service is down. */
export async function enterDetailsManually(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsedId = resumeId.safeParse(formData.get("resumeId"));
  if (!parsedId.success) return errorState("This CV could not be found.");
  const id = parsedId.data;
  await signedInUser(`/cv/${id}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("resumes")
    .update({ content: emptyProfile, parse_status: "needs_review", parse_error: null })
    .eq("id", id)
    .in("parse_status", ["pending", "failed"]);
  if (error) return errorState("This CV could not be updated. Please try again.");

  refresh(id);
  return successState("You can enter your details below.");
}

export async function saveVerifiedProfile(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsedId = resumeId.safeParse(formData.get("resumeId"));
  if (!parsedId.success) return errorState("This CV could not be found.");
  const id = parsedId.data;
  await signedInUser(`/cv/${id}`);

  if (formData.get("confirmed") !== "on") {
    return errorState("Confirm that you have checked these details.");
  }

  const raw = formData.get("profile");
  if (typeof raw !== "string" || raw.length > MAX_PROFILE_LENGTH * 2) {
    return errorState("These details could not be saved.");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return errorState("These details could not be saved.");
  }
  const parsed = cvProfileSchema.safeParse(json);
  if (!parsed.success) return errorState("These details could not be saved.");

  const profile = normalizeProfile(parsed.data);
  const issues = profileIssues(profile);
  if (issues.length > 0) return errorState(issues.join(" "));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumes")
    .update({
      content: profile,
      parse_status: "ready",
      parse_error: null,
      verified_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return errorState("These details could not be saved.");

  refresh(id);
  revalidatePath("/matches");
  redirect(`/cv/${id}`);
}

export async function analyzeCv(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = resumeId.safeParse(formData.get("resumeId"));
  if (!parsedId.success) return errorState("This CV could not be found.");
  const id = parsedId.data;
  const user = await signedInUser(`/cv/${id}`);

  const supabase = await createClient();
  const resume = await getResume(supabase, id);
  const profile = resume && parseProfile(resume.content);
  if (!resume || !profile) return errorState("This CV could not be found.");
  if (!resume.verified_at || resume.parse_status !== "ready") {
    return errorState("Check and confirm your details before analysing this CV.");
  }

  const profileHash = contentHash(profile);
  const { data: existing } = await supabase
    .from("cv_analyses")
    .select("id")
    .eq("resume_id", id)
    .eq("profile_hash", profileHash)
    .eq("prompt_version", CV_ANALYSIS_PROMPT_VERSION)
    .maybeSingle();
  if (existing) return successState("This analysis is already up to date.");

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("desired_titles")
    .eq("user_id", user.id)
    .maybeSingle();

  try {
    const { result, model } = await analyseProfile(
      user.id,
      profile,
      preferences?.desired_titles ?? [],
    );
    await saveCvAnalysis({
      userId: user.id,
      resumeId: id,
      profileHash,
      promptVersion: CV_ANALYSIS_PROMPT_VERSION,
      model,
      result,
    });
  } catch (error) {
    if (error instanceof AiError) return errorState(error.message);
    console.error("CV analysis failed");
    return errorState("The analysis failed. Please try again.");
  }

  refresh(id);
  return successState("Your analysis is ready.");
}

export async function setPrimaryCv(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = resumeId.safeParse(formData.get("resumeId"));
  if (!parsedId.success) return errorState("This CV could not be found.");
  const id = parsedId.data;
  const user = await signedInUser(`/cv/${id}`);

  const supabase = await createClient();
  const cleared = await supabase
    .from("resumes")
    .update({ is_primary: false })
    .eq("user_id", user.id)
    .eq("is_primary", true);
  const updated = await supabase.from("resumes").update({ is_primary: true }).eq("id", id);
  if (cleared.error || updated.error) return errorState("This CV could not be updated.");

  refresh(id);
  return successState("This is now your main CV.");
}

export async function deleteCv(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = resumeId.safeParse(formData.get("resumeId"));
  if (!parsedId.success) return errorState("This CV could not be found.");
  const id = parsedId.data;
  await signedInUser(`/cv/${id}`);

  const supabase = await createClient();
  const resume = await getResume(supabase, id);
  if (!resume) return errorState("This CV could not be found.");

  if (resume.storage_path) {
    const { error } = await supabase.storage.from("cvs").remove([resume.storage_path]);
    if (error) return errorState("This CV could not be deleted. Please try again.");
  }
  // Its analyses and match results are removed with it by the foreign keys.
  const { error } = await supabase.from("resumes").delete().eq("id", id);
  if (error) return errorState("This CV could not be deleted. Please try again.");

  refresh();
  revalidatePath("/matches");
  redirect("/cv");
}
