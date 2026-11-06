// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles("src").map((file) => ({
  file: file.replaceAll("\\", "/"),
  text: readFileSync(file, "utf8"),
}));

describe("secret handling", () => {
  it("reads the secret key only in the server env module", () => {
    const users = files.filter((f) => f.text.includes("SUPABASE_SECRET_KEY"));
    expect(users.map((f) => f.file)).toEqual(["src/server/env.ts"]);
  });

  it("uses the admin client only in the sync route", () => {
    const users = files.filter(
      (f) =>
        f.text.includes("createAdminClient") &&
        f.file !== "src/server/supabase/admin.ts",
    );
    expect(users.map((f) => f.file)).toEqual([
      "src/app/api/internal/cron/sync-jobs/route.ts",
    ]);
  });

  it("never gives a secret a browser-visible name", () => {
    for (const { text } of files) {
      expect(text).not.toMatch(/NEXT_PUBLIC_\w*(SECRET|SERVICE)/);
    }
  });

  it("marks modules holding credentials as server only", () => {
    for (const name of ["env.ts", "supabase/admin.ts", "supabase/server.ts"]) {
      const file = files.find((f) => f.file === `src/server/${name}`);
      expect(file?.text).toContain('import "server-only"');
    }
  });

  it("keeps client components away from the admin client", () => {
    const clientFiles = files.filter((f) => /^["']use client["']/.test(f.text));
    expect(clientFiles.length).toBeGreaterThan(0);
    for (const { text } of clientFiles) {
      expect(text).not.toContain("supabase/admin");
    }
  });
});
