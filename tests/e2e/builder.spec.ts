import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { extractText, getDocumentProxy } from "unpdf";

import { makePdf, sampleCvLines } from "../fixtures/documents";
import { admin, createConfirmedUser, signIn } from "./helpers";

const password = "correct-horse-battery";
const provider = "test-e2e-builder";
const token = randomUUID().slice(0, 8);
const title = `Reporting Analyst ${token}`;
const userIds: string[] = [];

async function pdfText(page: Page, href: string) {
  const response = await page.request.get(href);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  const pdf = await getDocumentProxy(new Uint8Array(await response.body()));
  return (await extractText(pdf, { mergePages: true })).text;
}

/** Signs in, confirms a CV and saves the test job. */
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
}

test.beforeAll(async () => {
  const { error } = await admin.from("jobs").insert({
    provider,
    provider_job_id: randomUUID(),
    fingerprint: randomUUID(),
    title,
    company: "Example Company",
    description: "You must have strong SQL skills. Python is required. dbt is a plus.",
    source_url: "https://example.com/job",
    posted_at: new Date().toISOString(),
  });
  if (error) throw error;
});

test.afterAll(async () => {
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  await admin.from("jobs").delete().eq("provider", provider);
});

test("a tailored CV is checked, reviewed, customised and exported", async ({ page }) => {
  await ready(page);
  await page.goto("/cv");
  const original = await admin.from("resumes").select("id, content").eq("user_id", userIds.at(-1)!).single();

  await page.getByLabel("Tailor for").selectOption({ label: `${title}, Example Company` });
  await page.getByRole("button", { name: "Create version" }).click();
  await expect(page).toHaveURL(/\/cv\/versions\/[\w-]+$/);
  const url = page.url();

  // The test double invents Google and 40%, and suggests Rust and dbt.
  await expect(page.getByText("AI wording that was thrown away")).toBeVisible();
  await expect(page.getByText("Not in your CV: Google, 40")).toBeVisible();
  const preview = page.getByRole("article", { name: "CV preview" });
  await expect(preview).not.toContainText("Google");
  await expect(preview).not.toContainText("Rust");
  await expect(preview).not.toContainText("dbt");
  await expect(preview).toContainText("Data analyst who builds SQL reporting for product teams.");

  // Nothing can be exported before a person has reviewed it.
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveCount(0);
  const blocked = await page.request.get(`${url}/pdf`);
  expect(blocked.status()).toBe(409);

  await page.getByRole("checkbox", { name: /everything in it is true/ }).check();
  await page.getByRole("button", { name: "Confirm details" }).click();
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();

  // Sections can be reordered, hidden and added, and the preview follows.
  await page.getByRole("combobox", { name: "Template" }).selectOption("modern");
  await page.getByRole("button", { name: "Hide Languages" }).click();
  await expect(preview).not.toContainText("Greek");
  await page.getByRole("button", { name: "Add a section" }).click();
  await page.getByLabel("Section heading").fill("Projects");
  await page.getByLabel("Section text").fill("Built a public reporting site.");
  await page.getByRole("button", { name: "Save layout" }).click();
  await expect(page.getByText("Layout saved.")).toBeVisible();

  const text = await pdfText(page, `${url}/pdf`);
  expect(text).toContain("Alex Example");
  expect(text).toContain("Built a public reporting site.");
  expect(text).not.toContain("Google");
  expect(text).not.toContain("Greek");

  // The original is exactly as it was.
  const after = await admin.from("resumes").select("content").eq("id", original.data!.id).single();
  expect(after.data?.content).toEqual(original.data?.content);
  await expect(async () => {
    await page.goto("/cv");
    await expect(page.getByRole("link", { name: /Example Company/ })).toHaveCount(1);
  }).toPass();
});

test("a plain copy needs no AI and can be edited on its own", async ({ page }) => {
  await ready(page);
  await page.goto("/cv");
  await page.getByRole("button", { name: "Create version" }).click();
  await expect(page).toHaveURL(/\/cv\/versions\/[\w-]+$/);
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();

  await page.getByRole("link", { name: "Edit this version" }).click();
  await page.getByLabel("Skills (one per line)").fill("SQL\nKubernetes");
  await page.getByRole("checkbox", { name: /everything in it is true/ }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("article", { name: "CV preview" })).toContainText("Kubernetes");

  await page.getByRole("link", { name: "Edit this version" }).click();
  await expect(page.getByRole("note")).toContainText("Skills: Kubernetes");
});

test("a cover letter is generated without false claims, edited and exported", async ({ page }) => {
  await ready(page);
  await page.goto("/cover-letters");

  await page.getByLabel("Tone").selectOption("confident");
  await page.getByRole("button", { name: "Generate letter" }).click();
  await expect(page).toHaveURL(/\/cover-letters\/[\w-]+$/);
  const url = page.url();

  const box = page.getByLabel("Letter", { exact: true });
  await expect(box).toHaveValue(/I build weekly SQL reports/);
  await expect(box).toHaveValue(/Alex Example$/);
  await expect(box).not.toHaveValue(/Google|dbt/);
  await expect(page.getByText("Sentences removed")).toBeVisible();

  expect((await page.request.get(`${url}/pdf`)).status()).toBe(409);

  // A failed save keeps the text, so nothing typed is lost.
  await box.fill("   ");
  await box.evaluate((element) => element.removeAttribute("required"));
  await page.getByRole("button", { name: "Save letter" }).click();
  await expect(page.getByText("The letter cannot be empty.")).toBeVisible();
  await expect(box).toHaveValue("   ");

  await box.fill("Dear Hiring Team,\n\nI build reports for Example Company as a Reporting Analyst.\n\nKind regards,\nAlex Example");
  await page.getByRole("button", { name: "Save letter" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  expect((await page.request.get(`${url}/pdf`)).status()).toBe(409);

  await page.getByRole("checkbox", { name: /everything in it is true/ }).check();
  await page.getByRole("button", { name: "Save letter" }).click();
  await expect(page.getByText("Letter saved and ready to export.")).toBeVisible();

  const text = await pdfText(page, `${url}/pdf`);
  expect(text).toContain(`Application for ${title} at Example Company`);
  expect(text).toContain("I build reports for Example Company");
  expect(text).toContain("alex@example.com");

  // The AI's own text is kept, and a second generation is a separate letter.
  await page.getByRole("button", { name: "Restore generated text" }).click();
  await page.getByRole("button", { name: "Yes, replace my edits" }).click();
  await expect(box).toHaveValue(/I build weekly SQL reports/);
  expect((await page.request.get(`${url}/pdf`)).status()).toBe(409);

  await page.goto("/cover-letters");
  await page.getByRole("button", { name: "Generate letter" }).click();
  await expect(page).not.toHaveURL(url);
  await expect(page).toHaveURL(/\/cover-letters\/[\w-]+$/);
  await page.goto("/cover-letters");
  await expect(page.getByRole("link", { name: /Example Company/ })).toHaveCount(2);
});

test("the builder and letter pages have no sideways page scroll on a phone", async ({ page }) => {
  await ready(page);
  await page.goto("/cv");
  await page.getByRole("button", { name: "Create version" }).click();
  await expect(page).toHaveURL(/\/cv\/versions\/[\w-]+$/);
  const version = page.url();
  await page.goto("/cover-letters");
  await page.getByRole("button", { name: "Generate letter" }).click();
  await expect(page).toHaveURL(/\/cover-letters\/[\w-]+$/);
  const letter = page.url();

  await page.setViewportSize({ width: 375, height: 800 });
  const pages = [
    { path: "/cv", content: "New version" },
    { path: version, content: "Template and sections" },
    { path: "/cover-letters", content: "New cover letter" },
    { path: letter, content: "Your letter" },
  ];
  for (const { path, content } of pages) {
    await page.goto(path);
    await expect(page.getByText(content).filter({ visible: true }).first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("exports are private to their owner", async ({ page, browser }) => {
  await ready(page);
  await page.goto("/cv");
  await page.getByRole("button", { name: "Create version" }).click();
  await expect(page).toHaveURL(/\/cv\/versions\/[\w-]+$/);
  const url = page.url();

  const stranger = await createConfirmedUser(password);
  userIds.push(stranger.id);
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto("/login?next=/dashboard");
  await signIn(other, stranger.email, password);
  await other.waitForURL((address) => address.pathname === "/dashboard");

  expect((await other.request.get(`${url}/pdf`)).status()).toBe(404);
  await context.close();

  const anonymous = await browser.newContext();
  const response = await anonymous.request.get(`${url}/pdf`, { maxRedirects: 0 });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  await anonymous.close();
});
