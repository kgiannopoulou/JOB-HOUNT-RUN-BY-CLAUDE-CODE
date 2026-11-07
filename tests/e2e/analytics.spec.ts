import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { admin, createConfirmedUser, signIn } from "./helpers";

const password = "correct-horse-battery";
const provider = "test-e2e-analytics";
const userIds: string[] = [];

async function newUser(page: Page, next = "/analytics") {
  const user = await createConfirmedUser(password);
  userIds.push(user.id);
  await page.goto(`/login?next=${next}`);
  await signIn(page, user.email, password);
  await page.waitForURL((url) => url.pathname === next);
  return user;
}

const today = () => new Date().toISOString().slice(0, 10);

/** The app checks by itself on load, so a test must not race that check for the result. */
async function automaticCheckFinished(userId: string) {
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("user_preferences")
        .select("notifications_checked_at")
        .eq("user_id", userId)
        .single();
      return data?.notifications_checked_at;
    })
    .not.toBeNull();
}

async function application(userId: string, status: "applied" | "interview" | "offer" | "rejected") {
  const { data, error } = await admin
    .from("applications")
    .insert({
      user_id: userId,
      company: `${status} Co`,
      role_title: `${status} Role`,
      status,
      applied_at: today(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const card = (page: Page, label: string) =>
  page.getByLabel("Key figures").locator('[data-slot="card"]').filter({ hasText: label });

test.afterAll(async () => {
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  await admin.from("jobs").delete().eq("provider", provider);
});

test("analytics are empty for a new account, with no invented figures", async ({ page }) => {
  await newUser(page);
  await expect(card(page, "Applications sent")).toContainText("0");
  await expect(card(page, "Response rate")).toContainText("–");
  await expect(card(page, "Response rate")).toContainText("Shown once you have sent");
  await expect(page.getByText("No activity yet")).toBeVisible();
});

test("analytics match the records exactly", async ({ page }) => {
  const user = await newUser(page);
  await application(user.id, "applied");
  await application(user.id, "applied");
  const interviewing = await application(user.id, "interview");
  await application(user.id, "offer");
  await application(user.id, "rejected");
  await admin.from("application_interviews").insert([
    { user_id: user.id, application_id: interviewing, scheduled_at: `${today()}T09:00:00` },
    { user_id: user.id, application_id: interviewing, scheduled_at: `${today()}T15:00:00` },
  ]);

  await page.goto("/analytics");
  await expect(card(page, "Applications sent")).toContainText("5");
  await expect(card(page, "Interviews")).toContainText("1");
  await expect(card(page, "Offers")).toContainText("1");
  await expect(card(page, "Rejections")).toContainText("1");
  await expect(card(page, "Response rate")).toContainText("60%");
  await expect(card(page, "Response rate")).toContainText("3 of 5 applications got a reply");

  const { count } = await admin.from("jobs").select("id", { count: "exact", head: true }).is("created_by", null);
  await expect(card(page, "Jobs discovered")).toContainText(String(count));

  await expect(page.getByRole("figure").filter({ hasText: "Applications sent" })).toContainText("5 in 8 weeks");
  await expect(page.getByRole("figure").filter({ hasText: "Interviews scheduled" })).toContainText("2 in 8 weeks");
  await page.getByText("Show as a table").click();
  await expect(page.getByRole("table")).toBeVisible();
});

test("the time zone comes from the browser and can be changed", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "Europe/Athens" });
  const page = await context.newPage();
  const user = await newUser(page);
  await expect
    .poll(async () => {
      const { data } = await admin.from("user_preferences").select("timezone").eq("user_id", user.id).single();
      return data?.timezone;
    })
    .toBe("Europe/Athens");

  await page.reload();
  await expect(page.getByText("Europe/Athens")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Notifications" }).click();
  await page.getByLabel("Time zone").selectOption("Asia/Tokyo");
  await page.getByRole("button", { name: "Save notification settings" }).click();
  await expect(page.getByText("Notification settings saved.")).toBeVisible();

  await page.goto("/analytics");
  await expect(page.getByText("Asia/Tokyo")).toBeVisible();
  await context.close();
});

test("a due reminder notifies once, stays gone when dismissed, and respects preferences", async ({ page }) => {
  const user = await newUser(page, "/notifications");
  await automaticCheckFinished(user.id);
  const id = await application(user.id, "applied");
  await admin.from("application_reminders").insert({
    user_id: user.id,
    application_id: id,
    title: "Chase the recruiter",
    due_on: "2026-01-01",
  });

  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page.getByText("1 new.")).toBeVisible();
  const list = page.getByRole("list", { name: "Notifications" });
  await expect(list).toContainText("Chase the recruiter");
  await expect(page.getByRole("link", { name: "Notifications, 1 unread" })).toBeVisible();

  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page.getByText("Nothing new.")).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: "Mark as read: Chase the recruiter" }).click();
  await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Dismiss: Chase the recruiter" }).click();
  await expect(page.getByText("No notifications")).toBeVisible();
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page.getByText("Nothing new.")).toBeVisible();
  await expect(page.getByText("Chase the recruiter")).toHaveCount(0);

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Notifications" }).click();
  await page.getByRole("checkbox", { name: /Follow-ups/ }).uncheck();
  await page.getByRole("button", { name: "Save notification settings" }).click();
  await expect(page.getByText("Notification settings saved.")).toBeVisible();

  await admin.from("application_reminders").insert({
    user_id: user.id,
    application_id: id,
    title: "Muted reminder",
    due_on: "2026-01-02",
  });
  await page.goto("/notifications");
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page.getByText("Nothing new.")).toBeVisible();
  await expect(page.getByText("Muted reminder")).toHaveCount(0);
});

test("finishing a reminder clears its unread notification", async ({ page }) => {
  const user = await newUser(page, "/notifications");
  const id = await application(user.id, "applied");
  await admin.from("application_reminders").insert({
    user_id: user.id,
    application_id: id,
    title: "Send portfolio",
    due_on: "2026-01-01",
  });
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page.getByRole("link", { name: "Notifications, 1 unread" })).toBeVisible();

  await page.goto(`/applications/${id}`);
  await page.getByRole("button", { name: "Mark done: Send portfolio" }).click();
  await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();
});

test("notifications appear on their own when the app loads", async ({ page }) => {
  const user = await newUser(page, "/dashboard");
  await admin.from("user_preferences").update({ desired_titles: ["Lighthouse Keeper"] }).eq("user_id", user.id);
  await admin.from("user_preferences").update({ notifications_checked_at: null }).eq("user_id", user.id);
  await admin.from("jobs").insert({
    provider,
    provider_job_id: randomUUID(),
    fingerprint: randomUUID(),
    title: "Senior Lighthouse Keeper",
    company: "Coast Co",
    source_url: "https://example.com/job",
  });

  await page.reload();
  await expect(page.getByRole("link", { name: "Notifications, 1 unread" })).toBeVisible();
  await page.getByRole("link", { name: "Notifications, 1 unread" }).click();
  await expect(page.getByRole("link", { name: "New job: Senior Lighthouse Keeper" })).toBeVisible();
});

test("the notifications cron needs its secret", async ({ request }) => {
  expect((await request.get("/api/internal/cron/notifications")).status()).toBe(401);
  const wrong = await request.get("/api/internal/cron/notifications", {
    headers: { authorization: "Bearer wrong" },
  });
  expect(wrong.status()).toBe(401);
});

test("analytics and notifications are protected", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const path of ["/analytics", "/notifications"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
  await context.close();
});

test("analytics and notifications have no sideways scroll on a phone", async ({ page }) => {
  const user = await newUser(page);
  await application(user.id, "offer");
  await page.setViewportSize({ width: 375, height: 800 });
  for (const { path, content } of [
    { path: "/analytics", content: "Weekly activity" },
    { path: "/notifications", content: "Check now" },
  ]) {
    await page.goto(path);
    await expect(page.getByText(content).filter({ visible: true }).first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
