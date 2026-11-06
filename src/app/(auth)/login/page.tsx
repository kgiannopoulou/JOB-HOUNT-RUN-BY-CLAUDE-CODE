import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { linkErrorMessage } from "@/lib/auth-errors";
import { safeRedirectPath } from "@/lib/routes";
import { signIn } from "@/server/auth/actions";

export const metadata: Metadata = { title: "Sign in" };

const linkClass = "font-medium text-primary underline-offset-4 hover:underline";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Sign in to continue your job search.
      </p>
      <AuthForm
        action={signIn}
        next={safeRedirectPath(next)}
        initialError={linkErrorMessage(error)}
        submitLabel="Sign in"
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
      />
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className={linkClass}>
          Forgot your password?
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        New to JOB HUNT?{" "}
        <Link href="/register" className={linkClass}>
          Create an account
        </Link>
      </p>
    </>
  );
}
