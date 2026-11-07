// @vitest-environment node
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";

import { buildCvDocument, cvTemplates, defaultLayout } from "@/lib/cv/document";
import type { CvProfile } from "@/lib/cv/profile";
import { renderCvPdf, renderLetterPdf } from "@/server/export/pdf";

import { sampleProfile } from "../fixtures/profile";

async function readPdf(buffer: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text, totalPages };
}

describe("CV PDF", () => {
  it.each(cvTemplates)("renders the %s template as real text", async (template) => {
    const document = buildCvDocument(sampleProfile, defaultLayout());
    const buffer = await renderCvPdf(document, template, "Test CV");
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");

    const { text } = await readPdf(buffer);
    expect(text).toContain("Alex Example");
    expect(text).toContain("Example Analytics");
    expect(text).toContain("Power BI");
  });

  it("keeps Greek text readable and selectable", async () => {
    const greek: CvProfile = {
      ...sampleProfile,
      contact: { ...sampleProfile.contact, full_name: "Αλέξης Παράδειγμα" },
      summary: "Αναλυτής δεδομένων με εμπειρία σε αναφορές.",
    };
    const buffer = await renderCvPdf(buildCvDocument(greek, defaultLayout()), "classic", "CV");
    const { text } = await readPdf(buffer);
    expect(text).toContain("Αλέξης Παράδειγμα");
    expect(text).toContain("Αναλυτής δεδομένων");
  });

  it("leaves out hidden sections", async () => {
    const layout = defaultLayout();
    layout.sections = layout.sections.map((section) =>
      section.kind === "skills" ? { ...section, visible: false } : section,
    );
    const buffer = await renderCvPdf(buildCvDocument(sampleProfile, layout), "modern", "CV");
    expect((await readPdf(buffer)).text).not.toContain("Tableau");
  });

  it("flows a long history onto more pages without losing it", async () => {
    const role = sampleProfile.experience[0];
    const long: CvProfile = {
      ...sampleProfile,
      experience: Array.from({ length: 30 }, (_, index) => ({
        ...role,
        company: `Company ${index}`,
        description: "Built reports.\n".repeat(5),
      })),
    };
    const buffer = await renderCvPdf(buildCvDocument(long, defaultLayout()), "classic", "CV");
    const { text, totalPages } = await readPdf(buffer);
    expect(totalPages).toBeGreaterThan(1);
    expect(text).toContain("Company 29");
  });
}, 60_000);

describe("cover letter PDF", () => {
  it("includes the details, the position and the company", async () => {
    const buffer = await renderLetterPdf(
      {
        name: "Alex Example",
        contact: ["alex@example.com"],
        date: "7 November 2026",
        subject: "Application for Reporting Analyst at Acme Data",
        paragraphs: ["Dear Hiring Team,", "Φτιάχνω αναφορές.", "Kind regards,\nAlex Example"],
      },
      "Letter",
    );
    const { text } = await readPdf(buffer);
    expect(text).toContain("Application for Reporting Analyst at Acme Data");
    expect(text).toContain("Φτιάχνω αναφορές.");
    expect(text).toContain("7 November 2026");
  });

  it("works when the source CV is gone and there is no contact block", async () => {
    const buffer = await renderLetterPdf(
      { name: "", contact: [], date: "1 May 2026", subject: "Subject", paragraphs: ["Body"] },
      "Letter",
    );
    expect((await readPdf(buffer)).text).toContain("Body");
  });
}, 60_000);
