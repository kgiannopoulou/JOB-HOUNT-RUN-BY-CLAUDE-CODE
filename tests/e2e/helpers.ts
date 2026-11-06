import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import type { Database } from "../../src/types/database";

config({ path: ".env.local", quiet: true });

const mailpit = "http://127.0.0.1:54324";

export const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export const newEmail = () => `e2e-${randomUUID()}@example.com`;

type MailSummary = { ID: string; Subject: string };

/** Waits for an email in the local mail catcher and returns the link inside it. */
export async function emailLink(to: string, subject: RegExp) {
  let message: MailSummary | undefined;
  await expect
    .poll(
      async () => {
        const query = encodeURIComponent(`to:"${to}"`);
        const response = await fetch(`${mailpit}/api/v1/search?query=${query}`);
        const body = (await response.json()) as { messages: MailSummary[] };
        message = body.messages.find((item) => subject.test(item.Subject));
        return Boolean(message);
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  const response = await fetch(`${mailpit}/api/v1/message/${message!.ID}`);
  const { HTML } = (await response.json()) as { HTML: string };
  const href = HTML.match(/href="([^"]+)"/)?.[1];
  if (!href) throw new Error("No link in email");
  return href.replaceAll("&amp;", "&");
}

export async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function createConfirmedUser(password: string, name = "Test User") {
  const email = newEmail();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) throw error;
  return { id: data.user.id, email };
}
