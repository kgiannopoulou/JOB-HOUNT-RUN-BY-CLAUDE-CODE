"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeRedirectPath } from "@/lib/routes";
import { getCurrentUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";

const schema = z.object({
  jobId: z.uuid(),
  saved: z.enum(["true", "false"]),
});

export async function toggleSavedJob(formData: FormData) {
  const returnTo = safeRedirectPath(formData.get("returnTo"), "/jobs");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);

  const parsed = schema.safeParse({
    jobId: formData.get("jobId"),
    saved: formData.get("saved"),
  });
  if (!parsed.success) throw new Error("Invalid job");

  const supabase = await createClient();
  const { jobId, saved } = parsed.data;
  const { error } =
    saved === "true"
      ? await supabase
          .from("saved_jobs")
          .delete()
          .eq("user_id", user.id)
          .eq("job_id", jobId)
      : await supabase
          .from("saved_jobs")
          .upsert(
            { user_id: user.id, job_id: jobId },
            { onConflict: "user_id,job_id", ignoreDuplicates: true },
          );
  if (error) throw new Error("The job could not be updated.");

  revalidatePath("/jobs", "layout");
  revalidatePath("/dashboard");
}
