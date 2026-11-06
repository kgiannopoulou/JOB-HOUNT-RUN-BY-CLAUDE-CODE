const messages: Record<string, string> = {
  invalid_credentials: "That email or password is not right.",
  email_not_confirmed:
    "Please confirm your email first. Check your inbox for the link.",
  weak_password: "Choose a stronger password with at least 8 characters.",
  same_password: "Your new password must be different from your current one.",
  over_email_send_rate_limit:
    "Too many emails were sent. Please wait a few minutes and try again.",
  over_request_rate_limit:
    "Too many attempts. Please wait a few minutes and try again.",
  user_banned: "This account has been disabled.",
  signup_disabled: "New accounts are not available right now.",
  validation_failed: "Please check your details and try again.",
};

const fallback = "Something went wrong. Please try again.";

/** Turns a Supabase Auth error into text that is safe and useful to show. */
export function authErrorMessage(error: { code?: string } | null | undefined) {
  return (error?.code && messages[error.code]) || fallback;
}

const linkErrors: Record<string, string> = {
  link_invalid:
    "That link has expired or was opened in a different browser. Try signing in, or request a new link.",
};

export function linkErrorMessage(code: unknown) {
  return typeof code === "string" ? linkErrors[code] : undefined;
}
