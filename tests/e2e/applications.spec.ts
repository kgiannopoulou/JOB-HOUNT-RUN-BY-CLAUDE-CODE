import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { admin, createConfirmedUser, signIn } from "./helpers";

const password = "correct-horse-battery";
const provider = "test-e2e-tracker";
const token = randomUUID().slice(0, 8);
const jobTitle = `Tracker Analyst ${token}`;
const userIds: string[] = [];

async function newUser(page: Page, next = "/applications") {
  const user = await createConfirmedUser(password);
  userIds.push(user.id);
  await page.goto(`/login?next=${next}`);
  await signIn(page, user.email, password);
  await page.waitForURL((url) => url.pathname === next);
  return user;
}

async function addApplication(page: Page, company: string, role: string, status = "applied") {
  await page.goto("/applications/new");
  await page.getByLabel("Company").fill(company);
  await page.getByLabel("Position").fill(role);
  await page.getByLabel("Status").selectOption(status);
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page).toHaveURL(/\/applications\/[\w-]{36}$/);
  return page.url();
}

const column = (page: Page, status: string) => page.getByTestId(`column-${status}`);

test.beforeAll(async () => {
  const { error } = await admin.from("jobs").insert({
    provider,
    provider_job_id: randomUUID(),
    fingerprint: randomUUID(),
    title: jobTitle,
    company: "Saved Company",
    description: "A job.",
    source_url: "https://example.com/job",
    posted_at: new Date().toISOString(),
  });
  if (error) throw error;
});

test.afterAll(async () => {
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  await admin.from("jobs").delete().eq("provider", provider);
});

test("the board shows the six stages", async ({ page }) => {
  await newUser(page);
  for (const name of ["Saved", "Applied", "Assessment", "Interview", "Offer", "Rejected"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
});

test("saving a job puts it on the board, and unsaving an untouched one removes it", async ({ page }) => {
  await newUser(page);
  await page.goto(`/jobs?title=${encodeURIComponent(jobTitle)}`);
  await page.getByRole("button", { name: `Save ${jobTitle}` }).click();
  await expect(page.getByRole("button", { name: `Remove ${jobTitle}` })).toBeVisible();

  await page.goto("/applications");
  await expect(column(page, "saved")).toContainText(jobTitle);
  await expect(column(page, "saved")).toContainText("Saved Company");

  await page.goto(`/jobs?title=${encodeURIComponent(jobTitle)}`);
  await page.getByRole("button", { name: `Remove ${jobTitle}` }).click();
  await expect(page.getByRole("button", { name: `Save ${jobTitle}` })).toBeVisible();
  await page.goto("/applications");
  await expect(column(page, "saved")).not.toContainText(jobTitle);
});

test("unsaving a job keeps a card with progress on it", async ({ page }) => {
  const user = await newUser(page);
  await page.goto(`/jobs?title=${encodeURIComponent(jobTitle)}`);
  await page.getByRole("button", { name: `Save ${jobTitle}` }).click();
  await expect(page.getByRole("button", { name: `Remove ${jobTitle}` })).toBeVisible();

  await page.goto("/applications");
  await page
    .getByRole("combobox", { name: `Move ${jobTitle} at Saved Company` })
    .selectOption("applied");
  await expect(column(page, "applied")).toContainText(jobTitle);
  // The card moves on screen before the save finishes, so wait for the record itself.
  await expect
    .poll(async () => {
      const { data } = await admin.from("applications").select("status").eq("user_id", user.id).single();
      return data?.status;
    })
    .toBe("applied");

  await page.goto(`/jobs?title=${encodeURIComponent(jobTitle)}`);
  await page.getByRole("button", { name: `Remove ${jobTitle}` }).click();
  await expect(page.getByRole("button", { name: `Save ${jobTitle}` })).toBeVisible();
  await page.goto("/applications");
  await expect(column(page, "applied")).toContainText(jobTitle);
});

test("a card moves by dragging and by its menu, and only to allowed stages", async ({ page }) => {
  const user = await newUser(page);
  await addApplication(page, "Drag Co", "Drag Role", "saved");
  await page.goto("/applications");

  const stored = async () => {
    const { data } = await admin
      .from("applications")
      .select("status, applied_at")
      .eq("user_id", user.id)
      .single();
    return data;
  };

  // A saved job was never sent, so Rejected is not offered.
  const menu = page.getByRole("combobox", { name: "Move Drag Role at Drag Co" });
  await expect(menu.getByRole("option", { name: "Move to Rejected" })).toHaveCount(0);

  await page.getByRole("link", { name: "Drag Role" }).dragTo(column(page, "assessment"));
  await expect(column(page, "assessment")).toContainText("Drag Role");
  await expect.poll(async () => (await stored())?.status).toBe("assessment");
  // Moving out of Saved records the application date.
  expect((await stored())?.applied_at).not.toBeNull();
  await page.reload();
  await expect(column(page, "assessment")).toContainText("Drag Role");

  await menu.selectOption("rejected");
  await expect(column(page, "rejected")).toContainText("Drag Role");
  await expect.poll(async () => (await stored())?.status).toBe("rejected");
  await page.reload();
  await expect(column(page, "rejected")).toContainText("Drag Role");
});

test("a full application record is kept, with its history", async ({ page }) => {
  await newUser(page);
  const url = await addApplication(page, "Record Co", "Record Role");

  await page.getByRole("textbox", { name: "Notes", exact: true }).fill("Referred by a former colleague");
  await page.getByLabel("Recruiter name").fill("Sam Recruiter");
  await page.getByLabel("Recruiter email").fill("sam@example.com");
  await page.getByLabel("Recruiter phone").fill("+30 210 000 0001");
  await page.getByLabel("Offer details").fill("To be discussed");
  await page.getByLabel("Offer deadline").fill("2030-01-15");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Details saved.")).toBeVisible();

  await page.getByLabel("Date and time").fill("2030-01-10T10:30");
  await page.getByLabel("Interviewer").fill("Jo Manager");
  await page.getByRole("button", { name: "Add interview" }).click();
  await expect(page.getByText("10 Jan 2030, 10:30")).toBeVisible();
  await expect(page.getByText("Phone with Jo Manager")).toBeVisible();

  await page.getByLabel("Remind me to").fill("Send thank-you note");
  await page.getByLabel("Due date").fill("2030-01-11");
  await page.getByRole("button", { name: "Add reminder" }).click();
  await expect(page.getByText("Send thank-you note", { exact: true })).toBeVisible();

  await page.getByLabel("Move to").selectOption("interview");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Moved from Applied to Interview")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Recruiter name")).toHaveValue("Sam Recruiter");
  const history = page.getByRole("list", { name: "Application history" });
  await expect(history).toContainText("Added to Applied");
  await expect(history).toContainText("Interview added");

  await page.getByRole("button", { name: "Mark done: Send thank-you note" }).click();
  await expect(page.getByRole("button", { name: "Reopen: Send thank-you note" })).toBeVisible();

  await page.goto("/applications/calendar?month=2030-01");
  await expect(page.getByRole("table").getByRole("link", { name: /Interview: Record Co/ })).toBeVisible();
  await expect(page.getByRole("table").getByRole("link", { name: /Offer deadline: Record Co/ })).toBeVisible();

  await page.goto(url);
  await page.getByRole("button", { name: "Delete application" }).click();
  await page.getByRole("button", { name: "Yes, delete this application" }).click();
  await expect(page).toHaveURL(/\/applications$/);
  await expect(page.getByRole("heading", { name: "Saved", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Record Role" })).toHaveCount(0);
});

test("bad input is refused with a clear message", async ({ page }) => {
  await newUser(page);
  await page.goto("/applications/new");
  await page.getByLabel("Company").fill("Acme");
  await page.getByLabel("Position").fill("Analyst");
  await page.locator('input[name="job_url"]').evaluate((input) => {
    (input as HTMLInputElement).type = "text";
    (input as HTMLInputElement).value = "javascript:alert(1)";
  });
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page.getByText("Enter a full web address")).toBeVisible();
});

test("adding the same company and position twice needs a second look", async ({ page }) => {
  await newUser(page);
  await addApplication(page, "Twice Co", "Twice Role");

  await page.goto("/applications/new");
  await page.getByLabel("Company").fill("twice co");
  await page.getByLabel("Position").fill("TWICE ROLE");
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page.getByText("You already track TWICE ROLE at twice co.")).toBeVisible();
  // An error must not throw away what was typed.
  await expect(page.getByLabel("Company")).toHaveValue("twice co");

  await page.getByRole("checkbox", { name: /Add it anyway/ }).check();
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page).toHaveURL(/\/applications\/[\w-]{36}$/);
});

test("search and filters narrow the board and the list", async ({ page }) => {
  await newUser(page);
  await addApplication(page, "Alpha Ltd", "Data Engineer");
  await addApplication(page, "Beta Ltd", "Sales Lead", "offer");

  await page.goto("/applications");
  await page.getByLabel("Search").fill("alpha");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Showing 1 of 2 applications.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Data Engineer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sales Lead" })).toHaveCount(0);

  await page.goto("/applications/list");
  await page.getByLabel("Status").selectOption("offer");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/status=offer/);
  await expect(page.getByRole("link", { name: /Sales Lead/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Data Engineer/ })).toHaveCount(0);
});

test("statistics and the dashboard use real records", async ({ page }) => {
  await newUser(page);
  await page.goto("/applications/stats");
  await expect(page.getByText("No statistics yet")).toBeVisible();

  await addApplication(page, "One", "First Role");
  await addApplication(page, "Two", "Second Role", "interview");

  await page.goto("/applications/stats");
  await expect(page.getByText("1 of 2 applications got a reply")).toBeVisible();
  await expect(page.getByText("50%").first()).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("1 of 2 applications got a reply")).toBeVisible();
});

test("a due reminder shows on the board and the dashboard", async ({ page }) => {
  await newUser(page);
  await addApplication(page, "Reminder Co", "Reminder Role");
  await page.getByLabel("Remind me to").fill("Chase the recruiter");
  await page.getByLabel("Due date").fill("2020-01-01");
  await page.getByRole("button", { name: "Add reminder" }).click();
  await expect(page.getByText("Reminder added.")).toBeVisible();

  await page.goto("/applications");
  const due = page.getByRole("list", { name: "Coming up" });
  await expect(due).toContainText("Chase the recruiter");
  await expect(due).toContainText("Overdue");

  await page.goto("/dashboard");
  await expect(page.getByRole("list", { name: "Coming up" })).toContainText("Chase the recruiter");
});

test("one user's applications are invisible to another", async ({ page, browser }) => {
  await newUser(page);
  const url = await addApplication(page, "Private Co", "Private Role");

  const context = await browser.newContext();
  const other = await context.newPage();
  await newUser(other);
  await expect(other.getByText("Private Role")).toHaveCount(0);
  await other.goto(url);
  await expect(other.getByText("Private Role")).toHaveCount(0);
  await context.close();
});

test("the board has no sideways page scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await newUser(page);
  const detail = await addApplication(page, "Phone Co", "Phone Role");
  const pages = [
    { path: "/applications", content: "Phone Role" },
    { path: "/applications/list", content: "Phone Role" },
    { path: "/applications/calendar", content: "Applied: Phone Co" },
    { path: "/applications/stats", content: "How far applications got" },
    { path: detail, content: "Recruiter phone" },
    { path: "/applications/new", content: "Date applied" },
  ];
  for (const { path, content } of pages) {
    await page.goto(path);
    // Measured on the real page: the loading skeleton always fits.
    await expect(page.getByText(content).filter({ visible: true }).first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
