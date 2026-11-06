import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { updatePassword } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/user";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">
          This link has expired
        </h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Reset links work once and only for a limited time.
        </p>
        <Link
          href="/forgot-password"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Choose a new password
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        You will stay signed in after saving it.
      </p>
      <AuthForm
        action={updatePassword}
        submitLabel="Save new password"
        fields={[
          {
            name: "password",
            label: "New password",
            type: "password",
            autoComplete: "new-password",
            minLength: 8,
            hint: "Use at least 8 characters.",
          },
          {
            name: "confirmPassword",
            label: "Confirm new password",
            type: "password",
            autoComplete: "new-password",
            minLength: 8,
          },
        ]}
      />
    </>
  );
}
