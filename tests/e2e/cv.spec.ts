import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { makeDocx, makePdf, sampleCvLines } from "../fixtures/documents";
import { admin, createConfirmedUser, signIn } from "./helpers";

const password = "correct-horse-battery";
const provider = "test-e2e-match";
const token = randomUUID().slice(0, 8);
const strongTitle = `Reporting Analyst ${token}`;
const weakTitle = `Systems Engineer ${token}`;
const fakeAnthropic = "http://127.0.0.1:3199/__requests";
const userIds: string[] = [];

type FakeRequest = {
  system: { text: string }[];
  messages: { content: { text: string }[] }[];
};

const aiRequests = async () =>
  (await (await fetch(fakeAnthropic)).json()) as FakeRequest[];

/** Next adds its own route announcer with the same role. */
const alert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

async function newUser(page: Page) {
  const user = await createConfirmedUser(password);
  userIds.push(user.id);
  await page.goto("/login?next=/cv");
  await signIn(page, user.email, password);
  // Matches the path only: the login address itself ends in "next=/cv".
  await page.waitForURL((url) => url.pathname === "/cv");
  return user;
}

const pdfFile = (lines = sampleCvLines) => ({
  name: "alex-cv.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from(makePdf(lines)),
});

async function upload(page: Page, file: Parameters<Page["setInputFiles"]>[1]) {
  await page.getByLabel("CV file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload CV" }).click();
}

async function uploadAndConfirm(page: Page) {
  await upload(page, pdfFile());
  await expect(page).toHaveURL(/\/cv\/[\w-]+$/);
  await page.getByRole("button", { name: "Read my CV" }).click();
  await expect(page.getByRole("heading", { name: "Check your details" })).toBeVisible();
  await page.getByLabel("Skills (one per line)").fill("SQL\nPython\nExcel\nPower BI\nTableau");
  await page.getByRole("checkbox", { name: /I have checked these details/ }).check();
  await page.getByRole("button", { name: "Confirm details" }).click();
  await expect(page.getByText("Details confirmed")).toBeVisible();
}

async function checkMatch(page: Page, title: string) {
  await page.goto(`/jobs?title=${encodeURIComponent(title)}`);
  await page.getByRole("button", { name: `Check match for ${title}` }).click();
  await expect(page).toHaveURL(/\/matches\/[\w-]+$/);
}

test.beforeAll(async () => {
  const job = (title: string, description: string) => ({
    provider,
    provider_job_id: randomUUID(),
    fingerprint: randomUUID(),
    title,
    company: "Example Company",
    description,
    source_url: "https://example.com/job",
    posted_at: new Date().toISOString(),
  });
  const { error } = await admin.from("jobs").insert([
    job(strongTitle, "You must have strong SQL skills. Python is required. Build reports for product teams."),
    job(weakTitle, "You must have strong SQL skills. Rust is required."),
  ]);
  if (error) throw error;
});

test.afterAll(async () => {
  for (const id of userIds) {
    const { data: folders } = await admin.storage.from("cvs").list(id);
    for (const folder of folders ?? []) {
      const { data: files } = await admin.storage.from("cvs").list(`${id}/${folder.name}`);
      await admin.storage
        .from("cvs")
        .remove((files ?? []).map((file) => `${id}/${folder.name}/${file.name}`));
    }
    await admin.auth.admin.deleteUser(id);
  }
  await admin.from("jobs").delete().eq("provider", provider);
});

test.describe.configure({ timeout: 90_000 });

test("rejects unsafe and unreadable files with a clear message", async ({ page }) => {
  await newUser(page);

  await upload(page, { name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>not a pdf</html>") });
  await expect(alert(page)).toContainText("not a real PDF");

  await upload(page, { name: "cv.exe", mimeType: "application/pdf", buffer: Buffer.from(makePdf(sampleCvLines)) });
  await expect(alert(page)).toContainText("Only PDF and DOCX");

  await upload(page, { name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from(makePdf([])) });
  await expect(alert(page)).toContainText("scanned PDF");

  await upload(page, {
    name: "broken.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from([0x50, 0x4b, 3, 4, 9, 9, 9]),
  });
  await expect(alert(page)).toContainText("damaged");

  await page.getByLabel("CV file").setInputFiles({
    name: "huge.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(5 * 1024 * 1024),
  });
  await expect(alert(page)).toContainText("4 MB");
  await expect(page.getByRole("button", { name: "Upload CV" })).toBeDisabled();

  await expect(page.getByRole("heading", { name: "No CV uploaded" })).toBeVisible();
});

test("upload, extraction, review and analysis of a PDF", async ({ page, context }) => {
  const user = await newUser(page);
  await upload(page, pdfFile());
  await expect(page).toHaveURL(/\/cv\/[\w-]+$/);
  const url = page.url();

  // Nothing reaches the AI provider until the user asks.
  const before = (await aiRequests()).length;
  await expect(page.getByRole("button", { name: "Read my CV" })).toBeVisible();
  expect((await aiRequests()).length).toBe(before);

  await page.getByRole("button", { name: "Read my CV" }).click();
  await expect(page.getByRole("heading", { name: "Check your details" })).toBeVisible();

  // The text sent is what was really read from the PDF, marked as untrusted.
  const extraction = (await aiRequests()).at(-1)!;
  expect(extraction.messages[0].content[0].text).toContain('<untrusted source="cv">');
  expect(extraction.messages[0].content[0].text).toContain("Built weekly SQL reports");

  await expect(page.getByLabel("Full name")).toHaveValue("Alex Example");
  await expect(page.getByLabel("Job title")).toHaveValue("Data Analyst");

  // The model added a skill that is not in the file.
  await expect(page.getByRole("note")).toContainText("Skills: Kubernetes");

  // Analysis must wait for the user to confirm.
  await expect(page.getByRole("button", { name: "Analyse my CV" })).toHaveCount(0);

  await page.getByLabel("Skills (one per line)").fill("SQL\nPython\nExcel\nPower BI\nTableau");
  await page.getByRole("button", { name: "Add language" }).click();
  await page.getByLabel("Language", { exact: true }).last().fill("French");
  await page.getByLabel("Level", { exact: true }).last().fill("B1");
  await page.getByRole("checkbox", { name: /I have checked these details/ }).check();
  await page.getByRole("button", { name: "Confirm details" }).click();
  await expect(page.getByText("Details confirmed")).toBeVisible();

  const id = url.split("/").pop()!;
  const { data: saved } = await admin.from("resumes").select("*").eq("id", id).single();
  expect(saved?.parse_status).toBe("ready");
  expect(saved?.verified_at).not.toBeNull();
  expect(JSON.stringify(saved?.content)).not.toContain("Kubernetes");
  expect(JSON.stringify(saved?.content)).toContain("French");

  await page.getByRole("button", { name: "Analyse my CV" }).click();
  await expect(page.getByRole("heading", { name: "Strengths" })).toBeVisible();

  // Contact details stay out of the analysis request.
  const analysis = JSON.stringify((await aiRequests()).at(-1)!.messages);
  expect(analysis).not.toContain("alex@example.com");
  expect(analysis).not.toContain("Alex Example");

  await expect(page.getByText("Regular reporting")).toBeVisible();
  await expect(page.getByText("Few results")).toBeVisible();
  await expect(page.getByText("Measured results").first()).toBeVisible();
  await expect(page.getByText("Add measured results")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Improved professional summary" })).toBeVisible();

  // An invented employer in the rewrite is called out.
  await expect(page.getByRole("note")).toContainText("Google");
  await expect(page.getByText("Not in your CV", { exact: true })).toBeVisible();
  await expect(page.getByText("In your CV", { exact: true })).toBeVisible();

  // An unchanged CV is not analysed a second time.
  await expect(page.getByRole("button", { name: "Update analysis" })).toHaveCount(0);

  // The original is preserved, byte for byte.
  const download = await context.request.get(`${url}/download`);
  expect(download.ok()).toBe(true);
  expect(Buffer.from(await download.body()).equals(pdfFile().buffer)).toBe(true);

  const { data: usage } = await admin.from("ai_usage").select("feature, status").eq("user_id", user.id);
  expect(usage).toHaveLength(2);
  expect(usage?.every((row) => row.status === "succeeded")).toBe(true);
});

test("a DOCX works too, and a refusal is handled", async ({ page }) => {
  await newUser(page);
  await upload(page, {
    name: "refused.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(makeDocx([...sampleCvLines, "REFUSE-THIS-CV"])),
  });
  await expect(page).toHaveURL(/\/cv\/[\w-]+$/);

  await page.getByRole("button", { name: "Read my CV" }).click();
  await expect(page.getByText(/declined to process/).first()).toBeVisible();

  // The user can always carry on by hand.
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("button", { name: "Enter details by hand" }).click();
  await expect(page.getByRole("heading", { name: "Check your details" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("");

  // Required details are enforced on the server.
  await page.getByRole("checkbox", { name: /I have checked these details/ }).check();
  await page.getByRole("button", { name: "Confirm details" }).click();
  await expect(alert(page)).toContainText("Enter your full name");
});

test("a CV is private to its owner", async ({ page, browser }) => {
  await newUser(page);
  await upload(page, pdfFile());
  await expect(page).toHaveURL(/\/cv\/[\w-]+$/);
  const url = page.url();

  const other = await browser.newContext({ baseURL: "http://localhost:3100" });
  const stranger = await other.newPage();
  await newUser(stranger);

  // The page streams, so the status is already sent. What matters is what is shown.
  await stranger.goto(url);
  await expect(stranger.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(stranger.getByText("alex-cv")).toHaveCount(0);
  const download = await other.request.get(`${url}/download`);
  expect(download.status()).toBe(404);
  await other.close();

  const signedOut = await browser.newContext({ baseURL: "http://localhost:3100" });
  const visitor = await signedOut.newPage();
  await visitor.goto(url);
  await expect(visitor).toHaveURL(/\/login/);
  await signedOut.close();
});

test("job matching, comparison, reuse and clean-up", async ({ page }) => {
  await newUser(page);

  // Matching needs a confirmed CV.
  await page.goto(`/jobs?title=${encodeURIComponent(strongTitle)}`);
  await page.getByRole("button", { name: `Check match for ${strongTitle}` }).click();
  await expect(alert(page)).toContainText("confirm its details first");

  await page.goto("/cv");
  await uploadAndConfirm(page);
  const cvUrl = page.url();

  await checkMatch(page, strongTitle);

  // Skills 100% at weight 35 and responsibilities 50% at weight 15 give 85%.
  await expect(page.getByText("85%", { exact: true })).toBeVisible();
  await expect(page.getByText("Strong match")).toBeVisible();
  await expect(page.getByText("It is not the probability of being hired").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mandatory requirements" })).toBeVisible();
  await expect(page.getByText("2 of 2 met")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preferred requirements" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How this score was calculated" })).toBeVisible();
  await expect(page.getByText("Mandatory requirements count three times")).toBeVisible();

  const matchRequest = JSON.stringify((await aiRequests()).at(-1)!.messages);
  expect(matchRequest).not.toContain("alex@example.com");
  expect(matchRequest).toContain('<untrusted source=\\"job-description\\">');

  await checkMatch(page, weakTitle);

  // One of two mandatory requirements is missing, so the score is capped below 50.
  await expect(page.getByText("49%", { exact: true })).toBeVisible();
  await expect(page.getByText("Limited match")).toBeVisible();
  await expect(page.getByText("Rust").first()).toBeVisible();
  await expect(page.getByText("limited to 49%").or(page.getByText("The weighted result is 50%")).first()).toBeVisible();

  // Results are saved, and the job card now links to them with no new AI call.
  const calls = (await aiRequests()).length;
  await page.goto(`/jobs?title=${encodeURIComponent(strongTitle)}`);
  await page.getByRole("link", { name: "View match: 85%" }).click();
  await expect(page).toHaveURL(/\/matches\/[\w-]+$/);
  expect((await aiRequests()).length).toBe(calls);

  // Compare both, highest first.
  await page.goto("/matches");
  await page.getByRole("checkbox", { name: `Select ${strongTitle}` }).check();
  await page.getByRole("checkbox", { name: `Select ${weakTitle}` }).check();
  await page.getByRole("button", { name: "Compare selected" }).click();
  await expect(page).toHaveURL(/\/matches\/compare\?id=/);

  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader").first()).toContainText(strongTitle);
  await expect(table.getByRole("columnheader").nth(1)).toContainText(weakTitle);
  await expect(table.getByRole("row", { name: /Compatibility score/ })).toContainText("85%");
  await expect(table.getByRole("row", { name: /Compatibility score/ })).toContainText("49%");
  await expect(table.getByRole("row", { name: /Mandatory gaps/ })).toContainText("Rust");
  await expect(table.getByRole("row", { name: /Education/ })).toContainText("Not requested");

  // Comparing a single job explains what to do.
  await page.goto("/matches/compare");
  await expect(page.getByRole("heading", { name: "Choose at least two jobs" })).toBeVisible();

  // Changing the CV marks results as out of date.
  await page.goto(`${cvUrl}?edit=1`);
  await page.getByLabel("Skills (one per line)").fill("SQL\nPython\nExcel\nPower BI\nTableau\nLooker");
  await page.getByRole("checkbox", { name: /I have checked these details/ }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Details confirmed")).toBeVisible();

  await page.goto("/matches");
  await page.getByRole("link", { name: strongTitle }).click();
  await expect(page.getByText("Your CV has changed since")).toBeVisible();

  // Deleting the CV removes the file and every result built on it.
  await page.goto(cvUrl);
  await page.getByRole("button", { name: "Delete CV" }).click();
  await expect(page).toHaveURL(cvUrl);
  await page.getByRole("button", { name: "Yes, delete this CV" }).click();
  await expect(page).toHaveURL(/\/cv$/);
  await page.goto("/matches");
  await expect(page.getByRole("heading", { name: "No matches yet" })).toBeVisible();
});

test("signed-out visitors can browse jobs but not run matches", async ({ page }) => {
  await page.goto(`/jobs?title=${encodeURIComponent(strongTitle)}`);
  await expect(page.getByRole("heading", { name: strongTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: /Check match/ })).toHaveCount(0);

  await page.goto("/matches");
  await expect(page).toHaveURL(/\/login/);
});
