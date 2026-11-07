const protectedPrefixes = [
  "/dashboard",
  "/cv",
  "/matches",
  "/applications",
  "/interview",
  "/settings",
  "/jobs/saved",
];

const authPages = ["/login", "/register", "/forgot-password"];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Job search stays public: Remotive's terms forbid showing its jobs to collect signups. */
export function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => matches(pathname, prefix));
}

export function isAuthPage(pathname: string) {
  return authPages.some((page) => matches(pathname, page));
}

/** Accepts only paths on this site, so a crafted link cannot redirect to another one. */
export function safeRedirectPath(
  value: unknown,
  fallback = "/dashboard",
): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return fallback;
  try {
    const base = "http://internal.invalid";
    return new URL(value, base).origin === base ? value : fallback;
  } catch {
    return fallback;
  }
}
