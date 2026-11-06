import { beforeEach, describe, expect, it, vi } from "vitest";

import { idleState } from "@/lib/action-state";
import { authErrorMessage, linkErrorMessage } from "@/lib/auth-errors";

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
};

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({ auth }),
}));

// redirect() ends the action by throwing, so the mock does the same.
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

const { requestPasswordReset, signIn, signUp, updatePassword } = await import(
  "@/server/auth/actions"
);

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const credentials = { email: "a@example.com", password: "password123" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test");
});

describe("signIn", () => {
  it("redirects to the requested page", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(
      signIn(idleState, form({ ...credentials, next: "/jobs/saved" })),
    ).rejects.toThrow("REDIRECT:/jobs/saved");
  });

  it("never redirects to another site", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(
      signIn(idleState, form({ ...credentials, next: "//evil.example" })),
    ).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("shows a clear message for wrong credentials", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials" },
    });
    await expect(signIn(idleState, form(credentials))).resolves.toEqual({
      status: "error",
      message: "That email or password is not right.",
    });
  });

  it("validates before calling Supabase", async () => {
    const result = await signIn(
      idleState,
      form({ email: "nope", password: "x" }),
    );
    expect(result.status).toBe("error");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("signUp", () => {
  const details = { ...credentials, fullName: "Test User" };

  it("asks the user to confirm their email", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await signUp(idleState, form(details));
    expect(result.status).toBe("success");
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          data: { full_name: "Test User" },
          emailRedirectTo: "http://localhost:3000/auth/confirm",
        },
      }),
    );
  });

  it("gives the same reply for an existing email", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const newUser = await signUp(idleState, form(details));

    auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { code: "user_already_exists" },
    });
    expect(await signUp(idleState, form(details))).toEqual(newUser);
  });

  it("rejects a short password", async () => {
    const result = await signUp(
      idleState,
      form({ ...details, password: "short" }),
    );
    expect(result).toEqual({
      status: "error",
      message: "Use at least 8 characters.",
    });
  });
});

describe("requestPasswordReset", () => {
  it("gives the same reply whether or not the account exists", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    const known = await requestPasswordReset(
      idleState,
      form({ email: "a@example.com" }),
    );
    auth.resetPasswordForEmail.mockResolvedValue({
      error: { code: "user_not_found" },
    });
    const unknown = await requestPasswordReset(
      idleState,
      form({ email: "b@example.com" }),
    );
    expect(known).toEqual(unknown);
  });

  it("builds the link from configuration, not the request", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    await requestPasswordReset(idleState, form({ email: "a@example.com" }));
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("a@example.com", {
      redirectTo: "http://localhost:3000/auth/confirm?next=/reset-password",
    });
  });

  it("reports rate limits", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      error: { code: "over_email_send_rate_limit" },
    });
    const result = await requestPasswordReset(
      idleState,
      form({ email: "a@example.com" }),
    );
    expect(result.status).toBe("error");
  });
});

describe("updatePassword", () => {
  const passwords = { password: "newpassword1", confirmPassword: "newpassword1" };

  it("rejects passwords that differ", async () => {
    const result = await updatePassword(
      idleState,
      form({ ...passwords, confirmPassword: "different1" }),
    );
    expect(result.message).toBe("The passwords do not match.");
  });

  it("needs the session from the reset link", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: {} });
    const result = await updatePassword(idleState, form(passwords));
    expect(result.status).toBe("error");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe("error messages", () => {
  it("never shows raw error text", () => {
    expect(authErrorMessage({ code: "unexpected_failure" })).toBe(
      "Something went wrong. Please try again.",
    );
    expect(authErrorMessage(null)).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("only recognises known link errors", () => {
    expect(linkErrorMessage("link_invalid")).toContain("expired");
    expect(linkErrorMessage("<script>")).toBeUndefined();
  });
});
