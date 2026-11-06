import { expect, test } from "@playwright/test";

import {
  admin,
  createConfirmedUser,
  emailLink,
  newEmail,
  signIn,
} from "./helpers";

const password = "correct-horse-battery";
const userIds: string[] = [];

async function signOut(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
}

test.afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
});

test("register, confirm by email, sign out and sign back in", async ({ page }) => {
  const email = newEmail();

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Dana Example");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Check your email");

  await page.goto(await emailLink(email, /confirm/i));
  await expect(page).toHaveURL("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Welcome, Dana" }),
  ).toBeVisible();

  const { data } = await admin.from("profiles").select("id").eq("full_name", "Dana Example");
  userIds.push(...(data ?? []).map((row) => row.id));

  await signOut(page);

  await page.goto("/login");
  await signIn(page, email, password);
  await expect(page).toHaveURL("/dashboard");
});

test("cannot sign in before confirming the email", async ({ page }) => {
  const email = newEmail();
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Unconfirmed");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("main").getByRole("status")).toBeVisible();

  await page.goto("/login");
  await signIn(page, email, password);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("confirm your email");
  await expect(page).toHaveURL(/\/login/);
});

test("shows a clear error for a wrong password", async ({ page }) => {
  const user = await createConfirmedUser(password);
  userIds.push(user.id);

  await page.goto("/login");
  await signIn(page, user.email, "wrong-password");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("not right");
  await expect(page).toHaveURL(/\/login/);
});

test("protected pages send visitors to sign in, then back", async ({ page }) => {
  for (const path of ["/dashboard", "/cv", "/applications", "/interview", "/settings", "/jobs/saved"]) {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
  }

  const user = await createConfirmedUser(password);
  userIds.push(user.id);
  await signIn(page, user.email, password);
  await expect(page).toHaveURL("/jobs/saved");
});

test("signed-in users skip the sign-in page", async ({ page }) => {
  const user = await createConfirmedUser(password);
  userIds.push(user.id);
  await page.goto("/login");
  await signIn(page, user.email, password);
  await expect(page).toHaveURL("/dashboard");

  await page.goto("/login");
  await expect(page).toHaveURL("/dashboard");
});

test("sign-out ends access to protected pages", async ({ page }) => {
  const user = await createConfirmedUser(password);
  userIds.push(user.id);
  await page.goto("/login");
  await signIn(page, user.email, password);
  await expect(page).toHaveURL("/dashboard");

  await signOut(page);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login/);
});

test("a crafted next link cannot leave the site", async ({ page }) => {
  const user = await createConfirmedUser(password);
  userIds.push(user.id);
  await page.goto("/login?next=//evil.example");
  await signIn(page, user.email, password);
  await expect(page).toHaveURL("/dashboard");
});

test("reset a forgotten password", async ({ page }) => {
  const user = await createConfirmedUser(password);
  userIds.push(user.id);
  const newPassword = "another-long-passphrase";

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("reset link");

  await page.goto(await emailLink(user.email, /reset/i));
  await expect(page).toHaveURL("/reset-password");

  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL("/dashboard");

  await signOut(page);

  await page.goto("/login");
  await signIn(page, user.email, password);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();

  await signIn(page, user.email, newPassword);
  await expect(page).toHaveURL("/dashboard");
});

test("an invalid email link explains what happened", async ({ page }) => {
  await page.goto("/auth/confirm?code=not-a-real-code");
  await expect(page).toHaveURL("/login?error=link_invalid");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("expired");
});

test("the reset page needs a valid link", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(
    page.getByRole("heading", { name: "This link has expired" }),
  ).toBeVisible();
});

test("a user can edit their own profile and preferences", async ({ page }) => {
  const user = await createConfirmedUser(password);
  userIds.push(user.id);
  await page.goto("/login?next=/settings");
  await signIn(page, user.email, password);
  await expect(page).toHaveURL("/settings");

  await page.getByLabel("Headline").fill("Data analyst");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Profile saved");

  await page.getByRole("tab", { name: "Job preferences" }).click();
  await page.getByLabel("Target job titles").fill("Analyst, BI analyst");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Preferences saved");

  await page.reload();
  await expect(page.getByLabel("Headline")).toHaveValue("Data analyst");

  const { data } = await admin
    .from("user_preferences")
    .select("desired_titles")
    .eq("user_id", user.id)
    .single();
  expect(data?.desired_titles).toEqual(["Analyst", "BI analyst"]);
});
