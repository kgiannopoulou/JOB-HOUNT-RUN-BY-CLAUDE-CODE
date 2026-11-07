import { z } from "zod";

/**
 * The structured CV. An empty string or list means the CV does not state it.
 * Used as the AI output schema and to validate what the user saves, so it holds
 * only the types structured outputs support. Business rules live in profileIssues.
 */
export const cvProfileSchema = z.object({
  contact: z.object({
    full_name: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    links: z.array(z.string()),
  }),
  summary: z.string(),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string(),
      start_date: z.string().describe("YYYY-MM or YYYY. Empty if not stated."),
      end_date: z.string().describe("YYYY-MM or YYYY. Empty if current or not stated."),
      is_current: z.boolean(),
      description: z.string(),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      qualification: z.string(),
      field: z.string(),
      start_date: z.string().describe("YYYY-MM or YYYY. Empty if not stated."),
      end_date: z.string().describe("YYYY-MM or YYYY. Empty if not stated."),
    }),
  ),
  skills: z.array(z.string()),
  certifications: z.array(
    z.object({ name: z.string(), issuer: z.string(), date: z.string() }),
  ),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
});

export type CvProfile = z.infer<typeof cvProfileSchema>;
export type CvExperience = CvProfile["experience"][number];

export const emptyProfile: CvProfile = {
  contact: { full_name: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  languages: [],
};

export const MAX_PROFILE_LENGTH = 100_000;

const DATE = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

export const isValidCvDate = (value: string) => value === "" || DATE.test(value);

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const cleanBlock = (value: string) =>
  value.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.map(clean).filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const hasText = (entry: Record<string, unknown>) =>
  Object.values(entry).some((value) => typeof value === "string" && value !== "");

/** Tidies a profile without changing what it says. Empty entries are removed. */
export function normalizeProfile(profile: CvProfile): CvProfile {
  return {
    contact: {
      full_name: clean(profile.contact.full_name),
      email: clean(profile.contact.email),
      phone: clean(profile.contact.phone),
      location: clean(profile.contact.location),
      links: unique(profile.contact.links),
    },
    summary: cleanBlock(profile.summary),
    experience: profile.experience
      .map((entry) => ({
        title: clean(entry.title),
        company: clean(entry.company),
        location: clean(entry.location),
        start_date: clean(entry.start_date),
        end_date: entry.is_current ? "" : clean(entry.end_date),
        is_current: entry.is_current,
        description: cleanBlock(entry.description),
      }))
      .filter(hasText),
    education: profile.education
      .map((entry) => ({
        institution: clean(entry.institution),
        qualification: clean(entry.qualification),
        field: clean(entry.field),
        start_date: clean(entry.start_date),
        end_date: clean(entry.end_date),
      }))
      .filter(hasText),
    skills: unique(profile.skills),
    certifications: profile.certifications
      .map((entry) => ({
        name: clean(entry.name),
        issuer: clean(entry.issuer),
        date: clean(entry.date),
      }))
      .filter((entry) => entry.name),
    languages: profile.languages
      .map((entry) => ({ name: clean(entry.name), level: clean(entry.level) }))
      .filter((entry) => entry.name),
  };
}

/** A model may return a date in another format. The review screen asks for it again. */
export function dropInvalidDates(profile: CvProfile): CvProfile {
  const date = (value: string) => (isValidCvDate(value) ? value : "");
  return {
    ...profile,
    experience: profile.experience.map((entry) => ({
      ...entry,
      start_date: date(entry.start_date),
      end_date: date(entry.end_date),
    })),
    education: profile.education.map((entry) => ({
      ...entry,
      start_date: date(entry.start_date),
      end_date: date(entry.end_date),
    })),
  };
}

/** Problems that stop a profile being verified. */
export function profileIssues(profile: CvProfile): string[] {
  const issues: string[] = [];
  if (!profile.contact.full_name) issues.push("Enter your full name.");

  profile.experience.forEach((entry, index) => {
    const name = entry.title || entry.company || `Role ${index + 1}`;
    if (!entry.title || !entry.company) {
      issues.push(`${name}: enter both a job title and a company.`);
    }
    if (!isValidCvDate(entry.start_date) || !isValidCvDate(entry.end_date)) {
      issues.push(`${name}: write dates as YYYY-MM or YYYY.`);
    } else if (
      entry.start_date &&
      entry.end_date &&
      entry.end_date.slice(0, entry.start_date.length) < entry.start_date.slice(0, entry.end_date.length)
    ) {
      issues.push(`${name}: the end date is before the start date.`);
    }
  });

  profile.education.forEach((entry, index) => {
    const name = entry.institution || entry.qualification || `Education ${index + 1}`;
    if (!isValidCvDate(entry.start_date) || !isValidCvDate(entry.end_date)) {
      issues.push(`${name}: write dates as YYYY-MM or YYYY.`);
    }
  });

  if (JSON.stringify(profile).length > MAX_PROFILE_LENGTH) {
    issues.push("This CV is too long to save. Shorten the descriptions.");
  }
  return issues;
}

/** Contact details are left out of analysis and matching, which do not need them. */
export function profileWithoutContact(profile: CvProfile) {
  const { contact, ...rest } = profile;
  return {
    ...rest,
    contact_details_present: {
      email: Boolean(contact.email),
      phone: Boolean(contact.phone),
      location: Boolean(contact.location),
      links: contact.links.length > 0,
    },
  };
}

type YearMonth = { year: number; month: number };

function parseDate(value: string): YearMonth | null {
  if (!value || !DATE.test(value)) return null;
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7) || 1) };
}

const monthIndex = ({ year, month }: YearMonth) => year * 12 + month - 1;

/**
 * Months of dated work, counted once where roles overlap. Roles without a start
 * date, or without an end date that are not current, cannot be counted.
 */
export function experienceMonths(profile: CvProfile, now: Date): number {
  const nowIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const ranges = profile.experience
    .flatMap((entry) => {
      const start = parseDate(entry.start_date);
      const end = entry.is_current
        ? nowIndex
        : parseDate(entry.end_date) && monthIndex(parseDate(entry.end_date)!) + 1;
      if (!start || !end) return [];
      const from = monthIndex(start);
      return end > from ? [[from, Math.min(end, nowIndex)] as const] : [];
    })
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let reached = -Infinity;
  for (const [from, to] of ranges) {
    const start = Math.max(from, reached);
    if (to > start) {
      total += to - start;
      reached = to;
    }
  }
  return total;
}

export type ProfileCheck = { label: string; passed: boolean; hint: string };

/** Fixed rules, so the same CV always gets the same completeness result. */
export function profileChecks(profile: CvProfile): ProfileCheck[] {
  const roles = profile.experience;
  return [
    { label: "Email address", passed: Boolean(profile.contact.email), hint: "Employers need a way to reach you." },
    { label: "Phone number", passed: Boolean(profile.contact.phone), hint: "Many recruiters call first." },
    { label: "Location", passed: Boolean(profile.contact.location), hint: "A city and country help with location filters." },
    { label: "Professional summary", passed: Boolean(profile.summary), hint: "Add two or three lines at the top." },
    { label: "Work experience", passed: roles.length > 0, hint: "List roles, placements or relevant projects." },
    {
      label: "Dates on every role",
      passed: roles.length > 0 && roles.every((r) => r.start_date && (r.end_date || r.is_current)),
      hint: "Missing dates raise questions and block experience calculations.",
    },
    {
      label: "Description on every role",
      passed: roles.length > 0 && roles.every((r) => r.description),
      hint: "Say what you did and what changed because of it.",
    },
    { label: "Education", passed: profile.education.length > 0, hint: "Add your highest qualification." },
    { label: "At least five skills", passed: profile.skills.length >= 5, hint: "List the tools and methods you actually use." },
    { label: "Languages", passed: profile.languages.length > 0, hint: "State each language and your level." },
  ];
}

export function completeness(checks: ProfileCheck[]): number {
  if (checks.length === 0) return 0;
  return Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);
}
