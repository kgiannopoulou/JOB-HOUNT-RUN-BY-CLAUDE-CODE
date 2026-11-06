import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { admin, createConfirmedUser, signIn } from "./helpers";

const password = "correct-horse-battery";
const provider = "test-e2e";
const token = randomUUID().slice(0, 8);
const company = `Playwright ${token}`;
const title = `Analyst ${token}`;
const sourceUrl = `https://example.com/original/${token}`;
const userIds: string[] = [];

test.beforeAll(async () => {
  const { error } = await admin.from("jobs").insert({
    provider,
    provider_job_id: token,
    fingerprint: token,
    title,
    company,
    description: "Analyse product data with SQL.",
    source_url: sourceUrl,
    location_raw: "Worldwide",
    locations: ["Worldwide"],
    remote_policy: "remote",
    employment_type: "full_time",
    salary_text: "$60k - $70k",
    salary_annual_min: 60000,
    salary_annual_max: 70000,
    posted_at: new Date().toISOString(),
  });
  if (error) throw error;
});

test.afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  await admin.from("jobs").delete().eq("provider", provider);
});

test("anyone can search without an account", async ({ page }) => {
  await page.goto("/jobs");
  await page.getByLabel("Job title").fill(title);
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/title=Analyst/);
  await expect(page.getByRole("status").first()).toContainText("1 job found");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("$60k - $70k")).toBeVisible();
});

test("every filter can be used through the page on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/jobs");

  await page.getByLabel("Job title").fill(title);
  await page.getByLabel("Company").fill(company);
  await page.getByLabel("City").fill("");
  await page.getByRole("checkbox", { name: "Remote" }).check();
  await page.getByRole("checkbox", { name: "Full-time" }).check();
  await page.getByLabel("Minimum yearly salary").fill("65000");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/remote=remote/);
  await expect(page).toHaveURL(/type=full_time/);
  await expect(page).toHaveURL(/minSalary=65000/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.getByRole("checkbox", { name: "Senior" }).check();
  await page.getByRole("button", { name: "Search" }).click();
  await expect(
    page.getByRole("heading", { name: "No jobs match your search" }),
  ).toBeVisible();
});

test("extra filters collapse on phones, and open when in use", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/jobs");
  const company = page.getByLabel("Company");
  await expect(company).toBeHidden();

  await page.getByRole("button", { name: "More filters" }).click();
  await expect(company).toBeVisible();

  await page.goto("/jobs?company=acme");
  await expect(page.getByLabel("Company")).toBeVisible();
});

test("names the source and links to the original advert", async ({ page }) => {
  await page.goto(`/jobs?title=${encodeURIComponent(title)}`);
  const link = page.getByRole("link", { name: /View on/ });
  await expect(link).toHaveAttribute("href", sourceUrl);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("link", { name: "Remotive" })).toHaveAttribute(
    "href",
    "https://remotive.com",
  );
});

test("filters come from the URL and can be cleared", async ({ page }) => {
  await page.goto(`/jobs?title=${encodeURIComponent(title)}&remote=onsite`);
  await expect(
    page.getByRole("heading", { name: "No jobs match your search" }),
  ).toBeVisible();
  await expect(page.getByText("lists remote jobs only")).toBeVisible();

  await page.getByRole("link", { name: "Clear all filters" }).click();
  await expect(page).toHaveURL("/jobs");
});

test("saving needs an account, then returns to the search", async ({ page }) => {
  const user = await createConfirmedUser(password);
  userIds.push(user.id);
  const search = `/jobs?title=${encodeURIComponent(title)}`;

  await page.goto(search);
  await page.getByRole("button", { name: `Save ${title}` }).click();
  await expect(page).toHaveURL(/\/login\?next=/);

  await signIn(page, user.email, password);
  await expect(page).toHaveURL(/\/jobs\?title=/);

  await page.getByRole("button", { name: `Save ${title}` }).click();
  await expect(
    page.getByRole("button", { name: `Remove ${title}` }),
  ).toBeVisible();

  await page.goto("/jobs/saved");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("Saved jobs").locator("../..")).toContainText("1");

  await page.goto("/jobs/saved");
  await page.getByRole("button", { name: `Remove ${title}` }).click();
  await expect(
    page.getByRole("heading", { name: "No saved jobs yet" }),
  ).toBeVisible();
});

test("saved jobs are private to each user", async ({ browser }) => {
  const [first, second] = await Promise.all([
    createConfirmedUser(password),
    createConfirmedUser(password),
  ]);
  userIds.push(first.id, second.id);

  const firstPage = await (await browser.newContext()).newPage();
  await firstPage.goto(`/login?next=${encodeURIComponent(`/jobs?title=${title}`)}`);
  await signIn(firstPage, first.email, password);
  await firstPage.getByRole("button", { name: `Save ${title}` }).click();
  await expect(
    firstPage.getByRole("button", { name: `Remove ${title}` }),
  ).toBeVisible();

  const secondPage = await (await browser.newContext()).newPage();
  await secondPage.goto("/login?next=/jobs/saved");
  await signIn(secondPage, second.email, password);
  await expect(
    secondPage.getByRole("heading", { name: "No saved jobs yet" }),
  ).toBeVisible();
});

test("the sync endpoint refuses requests without the secret", async ({ request }) => {
  const missing = await request.get("/api/internal/cron/sync-jobs");
  expect(missing.status()).toBe(401);

  const wrong = await request.get("/api/internal/cron/sync-jobs", {
    headers: { Authorization: "Bearer wrong" },
  });
  expect(wrong.status()).toBe(401);
});
