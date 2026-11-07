import { z } from "zod";

import type { CvProfile } from "@/lib/cv/profile";

/**
 * What a finished CV contains, independent of how it is drawn. The on-screen
 * preview and the PDF both render this, so they cannot show different content.
 */

export const cvTemplates = ["classic", "modern", "compact"] as const;
export type CvTemplate = (typeof cvTemplates)[number];

export const templateDetails: Record<CvTemplate, { label: string; hint: string }> = {
  classic: { label: "Classic", hint: "Serif type with ruled headings. Suits most roles." },
  modern: { label: "Modern", hint: "Clean sans-serif with coloured headings." },
  compact: { label: "Compact", hint: "Smaller type and spacing for a longer history." },
};

const builtInSections = [
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
  "languages",
] as const;

type BuiltInSection = (typeof builtInSections)[number];

const defaultHeadings: Record<BuiltInSection, string> = {
  summary: "Professional summary",
  experience: "Work experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  languages: "Languages",
};

export const MAX_CUSTOM_SECTIONS = 4;

export const cvLayoutSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        kind: z.enum([...builtInSections, "custom"]),
        heading: z.string().max(60),
        visible: z.boolean(),
        /** Only custom sections have their own text. */
        body: z.string().max(4000),
      }),
    )
    .max(builtInSections.length + MAX_CUSTOM_SECTIONS),
});

export type CvLayout = z.infer<typeof cvLayoutSchema>;
export type CvLayoutSection = CvLayout["sections"][number];

export const defaultLayout = (): CvLayout => ({
  sections: builtInSections.map((kind) => ({
    id: kind,
    kind,
    heading: defaultHeadings[kind],
    visible: true,
    body: "",
  })),
});

/** Reads a stored layout. Each built-in section appears exactly once, whatever was saved. */
export function normalizeLayout(value: unknown): CvLayout {
  const parsed = cvLayoutSchema.safeParse(value);
  if (!parsed.success) return defaultLayout();

  const seen = new Set<string>();
  const sections = parsed.data.sections.flatMap((section) => {
    const key = section.kind === "custom" ? section.id : section.kind;
    if (seen.has(key)) return [];
    seen.add(key);
    return section.kind === "custom"
      ? [{ ...section, heading: section.heading.trim(), body: section.body.trim() }]
      : [
          {
            ...section,
            id: section.kind,
            heading: section.heading.trim() || defaultHeadings[section.kind],
            body: "",
          },
        ];
  });

  for (const kind of builtInSections) {
    if (!seen.has(kind)) {
      sections.push({ id: kind, kind, heading: defaultHeadings[kind], visible: true, body: "" });
    }
  }
  return { sections };
}

export type CvBlock = {
  title: string;
  subtitle: string;
  dates: string;
  lines: string[];
};

export type CvDocumentSection = {
  id: string;
  heading: string;
  blocks: CvBlock[];
};

export type CvDocument = {
  name: string;
  contact: string[];
  sections: CvDocumentSection[];
};

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

function formatDate(value: string): string {
  const [year, month] = value.split("-");
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : (year ?? "");
}

export function formatDateRange(start: string, end: string, isCurrent = false): string {
  const to = isCurrent ? "Present" : formatDate(end);
  return [formatDate(start), to].filter(Boolean).join(" – ");
}

const textLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const textBlock = (lines: string[]): CvBlock[] =>
  lines.length ? [{ title: "", subtitle: "", dates: "", lines }] : [];

function sectionBlocks(section: CvLayoutSection, profile: CvProfile): CvBlock[] {
  switch (section.kind) {
    case "summary":
      return textBlock(textLines(profile.summary));
    case "experience":
      return profile.experience.map((role) => ({
        title: role.title,
        subtitle: [role.company, role.location].filter(Boolean).join(", "),
        dates: formatDateRange(role.start_date, role.end_date, role.is_current),
        lines: textLines(role.description),
      }));
    case "education":
      return profile.education.map((entry) => ({
        title: [entry.qualification, entry.field].filter(Boolean).join(", "),
        subtitle: entry.institution,
        dates: formatDateRange(entry.start_date, entry.end_date),
        lines: [],
      }));
    case "skills":
      return textBlock(profile.skills.length ? [profile.skills.join(" · ")] : []);
    case "certifications":
      return profile.certifications.map((entry) => ({
        title: entry.name,
        subtitle: entry.issuer,
        dates: entry.date,
        lines: [],
      }));
    case "languages":
      return textBlock(
        profile.languages.length
          ? [
              profile.languages
                .map(({ name, level }) => (level ? `${name} (${level})` : name))
                .join(" · "),
            ]
          : [],
      );
    case "custom":
      return textBlock(textLines(section.body));
  }
}

/** Hidden sections and sections with nothing in them are left out. */
export function buildCvDocument(profile: CvProfile, layout: CvLayout): CvDocument {
  const { full_name, email, phone, location, links } = profile.contact;
  return {
    name: full_name,
    contact: [email, phone, location, ...links].filter(Boolean),
    sections: layout.sections.flatMap((section) => {
      if (!section.visible) return [];
      const blocks = sectionBlocks(section, profile);
      return blocks.length ? [{ id: section.id, heading: section.heading, blocks }] : [];
    }),
  };
}

export function documentText(document: CvDocument): string {
  return [
    document.name,
    ...document.contact,
    ...document.sections.flatMap((section) => [
      section.heading,
      ...section.blocks.flatMap((block) => [
        block.title,
        block.subtitle,
        block.dates,
        ...block.lines,
      ]),
    ]),
  ].join("\n");
}

/**
 * The PDF fonts cover Latin, Greek and Cyrillic. Anything else would print as an
 * empty box, so it is found before export rather than silently lost.
 */
export function unsupportedCharacters(text: string): string[] {
  const outside =
    /[^\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]|\p{Extended_Pictographic}/gu;
  // Marks such as © count as pictographic, but the fonts have them.
  const found = [...text.matchAll(outside)]
    .map((match) => match[0])
    .filter((character) => !/^[\p{ASCII}©®™]$/u.test(character));
  return [...new Set(found)];
}

/** A name for the downloaded file, safe in a header on any system. */
export function pdfFileName(title: string, fallback: string): string {
  const name = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${name || fallback}.pdf`;
}
