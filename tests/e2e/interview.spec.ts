import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { makePdf, sampleCvLines } from "../fixtures/documents";
import { admin, createConfirmedUser, signIn } from "./helpers";

const password = "correct-horse-battery";
const provider = "test-e2e-interview";
const title = `Reporting Analyst ${randomUUID().slice(0, 8)}`;
const fakeAnthropic = "http://127.0.0.1:3199/__requests";
const userIds: string[] = [];

const goodAnswer =
  "I would read the query plan first, then add indexes to the slowest tables and rewrite the joins, and finally check the report still returns the same totals.";

type FakeRequest = { system: { text: string }[]; messages: { content: { text: string }[] }[] };

const aiRequests = async () => (await (await fetch(fakeAnthropic)).json()) as FakeRequest[];
const feedbackCalls = async () =>
  (await aiRequests()).filter((request) =>
    request.system.some((block) => block.text.includes("review written answers")),
  ).length;

/** Signs in, confirms a CV and saves the test job, which adds it to the board. */
async function ready(page: Page) {
  const user = await createConfirmedUser(password);
  userIds.push(user.id);
  await page.goto("/login?next=/cv");
  await signIn(page, user.email, password);
  await page.waitForURL((url) => url.pathname === "/cv");
  await page.getByLabel("CV file").setInputFiles({
    name: "alex-cv.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(makePdf(sampleCvLines)),
  });
  await page.getByRole("button", { name: "Upload CV" }).click();
  await expect(page).toHaveURL(/\/cv\/[\w-]+$/);
  await page.getByRole("button", { name: "Read my CV" }).click();
  await expect(page.getByRole("heading", { name: "Check your details" })).toBeVisible();
  await page.getByLabel("Skills (one per line)").fill("SQL\nPython\nExcel\nPower BI\nTableau");
  await page.getByRole("checkbox", { name: /I have checked these details/ }).check();
  await page.getByRole("button", { name: "Confirm details" }).click();
  await expect(page.getByText("Details confirmed")).toBeVisible();

  await page.goto(`/jobs?title=${encodeURIComponent(title)}`);
  await page.getByRole("button", { name: `Save ${title}` }).click();
  await expect(page.getByRole("button", { name: `Remove ${title}` })).toBeVisible();
  return user;
}

async function startSession(page: Page, mode: "practice" | "mock") {
  await page.goto("/interview");
  await page.getByRole("combobox", { name: "Format" }).selectOption(mode);
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/interview\/[\w-]{36}$/);
}

test.beforeAll(async () => {
  const { error } = await admin.from("jobs").insert({
    provider,
    provider_job_id: randomUUID(),
    fingerprint: randomUUID(),
    title,
    company: "Example Company",
    description: "You must have strong SQL skills. Build reports for product teams.",
    source_url: "https://example.com/job",
    posted_at: new Date().toISOString(),
  });
  if (error) throw error;
});

test.afterAll(async () => {
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  await admin.from("jobs").delete().eq("provider", provider);
});

test("a practice session keeps invented facts out and gives checked feedback", async ({ page }) => {
  await ready(page);
  await startSession(page, "practice");

  await expect(page.getByRole("note")).toContainText("not a prediction");
  await expect(page.getByText("How would you speed up a slow SQL report?")).toBeVisible();
  await expect(page.getByText("Tell me about a time you built a report")).toBeVisible();

  // The double invents an employer, a merger and a promise. None may appear.
  await expect(page.getByText(/Google/)).toHaveCount(0);
  await expect(page.getByText(/Globex/)).toHaveCount(0);
  await expect(page.getByText(/definitely/)).toHaveCount(0);
  await expect(page.getByText("From the job posting: “Build reports for product teams”")).toBeVisible();

  await page.getByText("Suggested structure: STAR").click();
  await expect(page.getByText("Situation", { exact: true })).toBeVisible();

  // A very short answer gets an honest reply without using the AI.
  const before = await feedbackCalls();
  const box = page.getByLabel("Your answer to question 1");
  await box.fill("Add an index.");
  await page.getByRole("button", { name: "Get feedback" }).first().click();
  await expect(page.getByText("This answer is too short to assess.")).toBeVisible();
  expect(await feedbackCalls()).toBe(before);

  await page.getByLabel("Your answer to question 1").fill(goodAnswer);
  await page.getByRole("button", { name: "Get feedback" }).first().click();
  await expect(page.getByText("A reasonable start that needs a result.")).toBeVisible();
  await expect(page.getByText("You named a concrete technique.")).toBeVisible();
  await expect(page.getByText("Add the result you really achieved.")).toBeVisible();
  // Praise with no quote and advice with an invented figure are removed.
  await expect(page.getByText("Invented praise.")).toHaveCount(0);
  await expect(page.getByText(/80%/)).toHaveCount(0);
  expect(await feedbackCalls()).toBe(before + 1);

  // The same answer again costs nothing, and the earlier attempt is kept.
  await page.getByRole("button", { name: "Get feedback" }).first().click();
  await expect(page.getByText("This answer already has feedback.")).toBeVisible();
  expect(await feedbackCalls()).toBe(before + 1);
  await expect(page.getByText("Earlier attempts (1)")).toBeVisible();

  // History survives a new visit.
  await page.goto("/interview");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toContainText("1 of");
});

test("contact details are not sent with interview requests", async ({ page }) => {
  await ready(page);
  await startSession(page, "practice");
  const requests = await aiRequests();
  const last = requests.findLast((request) =>
    request.system.some((block) => block.text.includes("prepare candidates")),
  );
  const text = JSON.stringify(last?.messages);
  expect(text).not.toContain("alex@example.com");
  expect(text).not.toContain("+30 210");
});

test("a mock interview hides hints, then reviews every answer in one call", async ({ page }) => {
  await ready(page);
  await startSession(page, "mock");

  await expect(page.getByText("Question 1 of 3")).toBeVisible();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByText("Suggested structure")).toHaveCount(0);
  await expect(page.getByText("A reasonable start")).toHaveCount(0);

  await page.getByLabel("Your answer").fill(goodAnswer);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Question 2 of 3")).toBeVisible();

  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("Question 3 of 3")).toBeVisible();
  await page.getByLabel("Your answer").fill("Too short.");
  await page.getByRole("button", { name: "Save and continue" }).click();

  const before = await feedbackCalls();
  await page.getByRole("button", { name: "Finish and get feedback" }).click();
  await expect(page.getByText("A reasonable start that needs a result.")).toBeVisible();
  expect(await feedbackCalls()).toBe(before + 1);

  await expect(page.getByLabel("Session summary")).toContainText("2 of 3 answered");
  await expect(page.getByLabel("Session summary")).toContainText("1 to work on");
  await expect(page.getByText("You skipped this one.")).toBeVisible();
  await expect(page.getByText("Suggested structure").first()).toBeVisible();
  await expect(page.getByLabel(/Your answer to question/)).toHaveCount(0);

  await page.goto("/interview");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toContainText("1 to work on");
});

test("an application tracked by hand gets no company questions", async ({ page }) => {
  await ready(page);
  await page.goto("/applications/new");
  await page.getByLabel("Company").fill("Handmade Ltd");
  await page.getByLabel("Position").fill("Handmade Role");
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page).toHaveURL(/\/applications\/[\w-]{36}$/);
  await page.getByRole("link", { name: "Prepare for the interview" }).click();
  await expect(page.getByRole("combobox", { name: "Application" })).toHaveValue(/.+/);
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/interview\/[\w-]{36}$/);
  await expect(page.getByRole("note")).toContainText("no questions about the employer");
  await expect(page.getByText("About this employer")).toHaveCount(0);
});

test("a session can be deleted, and is private", async ({ page, browser }) => {
  await ready(page);
  await startSession(page, "practice");
  const url = page.url();

  const stranger = await createConfirmedUser(password);
  userIds.push(stranger.id);
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto("/login?next=/dashboard");
  await signIn(other, stranger.email, password);
  await other.waitForURL((address) => address.pathname === "/dashboard");
  await other.goto(url);
  await expect(other.getByText("How would you speed up")).toHaveCount(0);
  await context.close();

  await page.getByRole("button", { name: "Delete session" }).click();
  await page.getByRole("button", { name: "Yes, delete this session" }).click();
  await expect(page).toHaveURL(/\/interview$/);
  await expect(page.getByText("No practice sessions yet")).toBeVisible();
});

test("the interview pages have no sideways scroll on a phone", async ({ page }) => {
  await ready(page);
  await startSession(page, "practice");
  const url = page.url();
  await page.setViewportSize({ width: 375, height: 800 });
  for (const { path, content } of [
    { path: "/interview", content: "New session" },
    { path: url, content: "How would you speed up" },
  ]) {
    await page.goto(path);
    await expect(page.getByText(content).filter({ visible: true }).first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
