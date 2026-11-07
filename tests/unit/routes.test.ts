import { describe, expect, it } from "vitest";

import { isAuthPage, isProtectedPath, safeRedirectPath } from "@/lib/routes";

describe("isProtectedPath", () => {
  it.each(["/dashboard", "/cv", "/applications", "/interview", "/settings", "/jobs/saved", "/cv/123", "/cover-letters", "/cover-letters/1/pdf", "/cv/versions/1/pdf"])(
    "protects %s",
    (path) => expect(isProtectedPath(path)).toBe(true),
  );

  it.each(["/", "/jobs", "/login", "/register", "/dashboards", "/cvs"])(
    "leaves %s public",
    (path) => expect(isProtectedPath(path)).toBe(false),
  );
});

describe("isAuthPage", () => {
  it("recognises pages a signed-in user does not need", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/forgot-password")).toBe(true);
    expect(isAuthPage("/reset-password")).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it.each(["/dashboard", "/jobs?title=analyst&page=2", "/jobs/saved"])(
    "allows %s",
    (path) => expect(safeRedirectPath(path)).toBe(path),
  );

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/\tevil",
    "",
    null,
    undefined,
    42,
  ])("rejects %s", (value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard");
  });

  it("uses the fallback it is given", () => {
    expect(safeRedirectPath("//evil.example", "/jobs")).toBe("/jobs");
  });
});
