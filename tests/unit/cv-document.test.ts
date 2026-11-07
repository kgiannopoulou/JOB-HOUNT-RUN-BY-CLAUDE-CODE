import { describe, expect, it } from "vitest";

import {
  buildCvDocument,
  cvLayoutSchema,
  defaultLayout,
  documentText,
  formatDateRange,
  normalizeLayout,
  pdfFileName,
  unsupportedCharacters,
  type CvLayout,
} from "@/lib/cv/document";
import { emptyProfile } from "@/lib/cv/profile";

import { sampleProfile } from "../fixtures/profile";

const headings = (layout: CvLayout) =>
  buildCvDocument(sampleProfile, layout).sections.map((section) => section.heading);

describe("buildCvDocument", () => {
  it("includes every section with content, in order", () => {
    expect(headings(defaultLayout())).toEqual([
      "Professional summary",
      "Work experience",
      "Education",
      "Skills",
      "Languages",
    ]);
  });

  it("leaves out empty sections", () => {
    const document = buildCvDocument(emptyProfile, defaultLayout());
    expect(document.sections).toEqual([]);
  });

  it("honours order, hiding and renamed headings", () => {
    const [summary, experience, ...rest] = defaultLayout().sections;
    const layout = {
      sections: [
        { ...experience, heading: "Career" },
        { ...summary, visible: false },
        ...rest,
      ],
    };
    expect(headings(layout).slice(0, 2)).toEqual(["Career", "Education"]);
  });

  it("includes a custom section's own text", () => {
    const layout = defaultLayout();
    layout.sections.push({
      id: "custom-1",
      kind: "custom",
      heading: "Projects",
      visible: true,
      body: "First project\n\nSecond project",
    });
    const section = buildCvDocument(sampleProfile, layout).sections.at(-1);
    expect(section?.heading).toBe("Projects");
    expect(section?.blocks[0].lines).toEqual(["First project", "Second project"]);
  });

  it("shows every skill and the role's facts", () => {
    const text = documentText(buildCvDocument(sampleProfile, defaultLayout()));
    for (const skill of sampleProfile.skills) expect(text).toContain(skill);
    expect(text).toContain("Example Analytics");
    expect(text).toContain("Jan 2021 – Present");
  });
});

describe("formatDateRange", () => {
  it.each([
    ["2021-01", "2022-03", false, "Jan 2021 – Mar 2022"],
    ["2017", "2020", false, "2017 – 2020"],
    ["2021-12", "", true, "Dec 2021 – Present"],
    ["", "2020", false, "2020"],
    ["", "", false, ""],
  ])("formats %s to %s", (start, end, current, expected) => {
    expect(formatDateRange(start, end, current)).toBe(expected);
  });
});

describe("normalizeLayout", () => {
  it("falls back to the default for anything unreadable", () => {
    expect(normalizeLayout(null)).toEqual(defaultLayout());
    expect(normalizeLayout({ sections: "no" })).toEqual(defaultLayout());
  });

  it("restores missing sections, so content cannot be lost by accident", () => {
    const layout = normalizeLayout({ sections: [defaultLayout().sections[1]] });
    expect(layout.sections.map((section) => section.kind)).toEqual([
      "experience",
      "summary",
      "education",
      "skills",
      "certifications",
      "languages",
    ]);
  });

  it("removes repeated sections", () => {
    const [summary] = defaultLayout().sections;
    const layout = normalizeLayout({ sections: [summary, { ...summary, id: "other" }] });
    expect(layout.sections.filter((section) => section.kind === "summary")).toHaveLength(1);
  });

  it("restores a blank heading, and drops text from built-in sections", () => {
    const [summary] = defaultLayout().sections;
    const [result] = normalizeLayout({
      sections: [{ ...summary, heading: "  ", body: "Injected" }],
    }).sections;
    expect(result.heading).toBe("Professional summary");
    expect(result.body).toBe("");
  });

  it("limits the number of sections", () => {
    const custom = Array.from({ length: 20 }, (_, index) => ({
      id: `custom-${index}`,
      kind: "custom",
      heading: "x",
      visible: true,
      body: "",
    }));
    expect(cvLayoutSchema.safeParse({ sections: custom }).success).toBe(false);
  });
});

describe("unsupportedCharacters", () => {
  it("accepts Latin, Greek, Cyrillic and common punctuation", () => {
    expect(unsupportedCharacters("Müller Κωνσταντίνα Привет – 100% © #1 (C++)")).toEqual([]);
  });

  it("finds scripts and emoji the fonts lack, once each", () => {
    expect(unsupportedCharacters("漢字漢 🚀")).toEqual(["漢", "字", "🚀"]);
  });
});

describe("pdfFileName", () => {
  it("makes a header-safe name", () => {
    expect(pdfFileName('Analyst at "Acme"\r\nX: y', "cv")).toBe("Analyst-at-Acme-X-y.pdf");
    expect(pdfFileName("Müller", "cv")).toBe("Muller.pdf");
  });

  it("falls back when nothing is left", () => {
    expect(pdfFileName("Αναλυτής", "cv")).toBe("cv.pdf");
  });
});
