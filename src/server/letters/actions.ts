"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { errorState, successState, type ActionState } from "@/lib/action-state";
import {
  COVER_LETTER_PROMPT_VERSION,
  letterTones,
  MAX_LETTER_LENGTH,
  MAX_LETTERS_PER_USER,
} from "@/lib/letters/letter";
import { AiError, isAiConfigured } from "@/server/ai/gateway";
import { getCurrentUser } from "@/server/auth/user";
import { getVerifiedCv } from "@/server/builder/queries";
import { loadJobForAi } from "@/server/jobs/choices";
import { generateLetter } from "@/server/letters/ai";
import { createClient } from "@/server/supabase/server";
import type { Json } from "@/types/database";

const uuid = z.uuid();

const newLetterSchema = z.object({
  resumeId: uuid,
  jobId: uuid,
  tone: z.enum(letterTones),
});

async function signedInUser(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

function refresh(id?: string) {
  revalidatePath("/cover-letters");
  if (id) revalidatePath(`/cover-letters/${id}`);
}

/** Every generation is a new row, so an earlier letter is never replaced. */
export async function createCoverLetter(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await signedInUser("/cover-letters");

  const parsed = newLetterSchema.safeParse({
    resumeId: formData.get("resumeId"),
    jobId: formData.get("jobId"),
    tone: formData.get("tone"),
  });
  if (!parsed.success) return errorState("Choose a CV, a job and a tone.");
  const { resumeId, jobId, tone } = parsed.data;

  if (!isAiConfigured()) return errorState("AI features are not set up on this server yet.");

  const supabase = await createClient();
  const source = await getVerifiedCv(supabase, resumeId);
  if (!source) return errorState("Confirm this CV's details first.");

  const loaded = await loadJobForAi(supabase, jobId);
  if ("problem" in loaded) return errorState(loaded.problem);
  const { job } = loaded;

  const { count, error: countError } = await supabase
    .from("cover_letters")
    .select("id", { count: "exact", head: true });
  if (countError) return errorState("The letter could not be created. Please try again.");
  if ((count ?? 0) >= MAX_LETTERS_PER_USER) {
    return errorState(`You can keep up to ${MAX_LETTERS_PER_USER} letters. Delete one first.`);
  }

  let id: string;
  try {
    const { letter, model } = await generateLetter({
      userId: user.id,
      profile: source.profile,
      job,
      tone,
    });
    const { data, error } = await supabase
      .from("cover_letters")
      .insert({
        user_id: user.id,
        job_id: job.id,
        resume_id: source.id,
        company: job.company,
        role_title: job.title,
        tone,
        content: letter.content,
        generated_content: letter.content,
        removed_sentences: letter.removed as unknown as NonNullable<Json>,
        prompt_version: COVER_LETTER_PROMPT_VERSION,
        model,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Saving failed: ${error.code}`);
    id = data.id;
  } catch (error) {
    if (error instanceof AiError) return errorState(error.message);
    console.error("Cover letter failed");
    return errorState("The letter could not be created. Please try again.");
  }

  refresh();
  redirect(`/cover-letters/${id}`);
}

const contentSchema = z
  .string()
  .trim()
  .min(1, "The letter cannot be empty.")
  .max(MAX_LETTER_LENGTH, `Keep the letter under ${MAX_LETTER_LENGTH} characters.`);

/** A letter counts as reviewed only while its owner has confirmed this exact text. */
export async function saveCoverLetter(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("letterId"));
  if (!id.success) return errorState("This letter could not be found.");
  await signedInUser(`/cover-letters/${id.data}`);

  const content = contentSchema.safeParse(formData.get("content"));
  if (!content.success) {
    return errorState(content.error.issues[0]?.message ?? "This letter could not be saved.");
  }

  const supabase = await createClient();
  const { data: letter } = await supabase
    .from("cover_letters")
    .select("generated_content")
    .eq("id", id.data)
    .maybeSingle();
  if (!letter) return errorState("This letter could not be found.");

  const confirmed = formData.get("confirmed") === "on";
  const { error } = await supabase
    .from("cover_letters")
    .update({
      content: content.data,
      is_edited: content.data !== letter.generated_content,
      reviewed_at: confirmed ? new Date().toISOString() : null,
    })
    .eq("id", id.data);
  if (error) return errorState("This letter could not be saved. Please try again.");

  refresh(id.data);
  return successState(confirmed ? "Letter saved and ready to export." : "Draft saved.");
}

export async function restoreCoverLetter(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("letterId"));
  if (!id.success) return errorState("This letter could not be found.");
  await signedInUser(`/cover-letters/${id.data}`);

  const supabase = await createClient();
  const { data: letter } = await supabase
    .from("cover_letters")
    .select("generated_content")
    .eq("id", id.data)
    .maybeSingle();
  if (!letter) return errorState("This letter could not be found.");

  const { error } = await supabase
    .from("cover_letters")
    .update({ content: letter.generated_content, is_edited: false, reviewed_at: null })
    .eq("id", id.data);
  if (error) return errorState("This letter could not be restored. Please try again.");

  refresh(id.data);
  return successState("The generated text is back. Review it before exporting.");
}

export async function deleteCoverLetter(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("letterId"));
  if (!id.success) return errorState("This letter could not be found.");
  await signedInUser(`/cover-letters/${id.data}`);

  const supabase = await createClient();
  const { error } = await supabase.from("cover_letters").delete().eq("id", id.data);
  if (error) return errorState("This letter could not be deleted. Please try again.");

  refresh();
  redirect("/cover-letters");
}
