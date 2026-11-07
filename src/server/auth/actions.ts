"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  errorState,
  successState,
  type ActionState,
} from "@/lib/action-state";
import { passwordChangedNotification } from "@/lib/notifications/rules";
import { storeNotifications } from "@/server/notifications/deliver";
import { authErrorMessage } from "@/lib/auth-errors";
import { safeRedirectPath } from "@/lib/routes";
import { getCurrentUser } from "@/server/auth/user";
import { appEnv } from "@/server/env";
import { createClient } from "@/server/supabase/server";

const email = z.email("Enter a valid email address.").max(320);
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.");

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
const registerSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(200),
  email,
  password: newPassword,
});
const resetSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "The passwords do not match.",
  });

const firstIssue = (error: z.ZodError) => errorState(error.issues[0].message);

const checkEmail =
  "Check your email for a link to finish creating your account.";

export async function signIn(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return errorState(authErrorMessage(error));

  redirect(safeRedirectPath(formData.get("next")));
}

export async function signUp(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${appEnv().SITE_URL}/auth/confirm`,
    },
  });

  // An existing address gets the same reply, so this form cannot reveal who has an account.
  if (error?.code === "user_already_exists" || error?.code === "email_exists") {
    return successState(checkEmail);
  }
  if (error) return errorState(authErrorMessage(error));

  // A session is returned only when the project does not require email confirmation.
  if (data.session) redirect("/dashboard");
  return successState(checkEmail);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${appEnv().SITE_URL}/auth/confirm?next=/reset-password`,
  });

  if (error?.code?.startsWith("over_")) {
    return errorState(authErrorMessage(error));
  }
  // The same reply either way, so this form cannot reveal who has an account.
  return successState(
    "If that address has an account, a reset link is on its way.",
  );
}

export async function updatePassword(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const user = await getCurrentUser();
  if (!user) {
    return errorState(
      "Your reset link has expired. Please request a new one.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return errorState(authErrorMessage(error));

  try {
    await storeNotifications(user.id, [passwordChangedNotification(new Date())]);
  } catch {
    // The password has changed. A missing notice is no reason to report a failure.
    console.error("Saving the password notification failed");
  }

  redirect("/dashboard");
}
