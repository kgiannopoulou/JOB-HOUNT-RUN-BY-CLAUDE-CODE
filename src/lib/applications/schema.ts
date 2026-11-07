import { z } from "zod";

import { applicationStatuses } from "@/lib/applications/status";

const text = (max: number) => z.string().trim().max(max);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isRealDate = (value: string) => {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const date = z.string().trim().refine(isRealDate, "Enter a valid date.");
const optionalDate = z.union([z.literal(""), date]);

/** Only web links, because this value is shown as a link. */
const webUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Enter a full web address, starting with https://.");

const company = text(200).min(1, "Enter the company.");
const roleTitle = text(200).min(1, "Enter the position.");

export const newApplicationSchema = z.object({
  company,
  role_title: roleTitle,
  status: z.enum(applicationStatuses),
  applied_at: optionalDate,
  job_url: webUrl,
  notes: text(20_000),
});

export const applicationDetailsSchema = z.object({
  company,
  role_title: roleTitle,
  applied_at: optionalDate,
  job_url: webUrl,
  notes: text(20_000),
  recruiter_name: text(200),
  recruiter_email: z.union([
    z.literal(""),
    z.string().trim().max(320).pipe(z.email("Enter a valid recruiter email.")),
  ]),
  recruiter_phone: text(50),
  offer_details: text(4000),
  offer_deadline: optionalDate,
  rejection_reason: text(4000),
  resume_id: z.union([z.literal(""), z.uuid()]),
  cover_letter_id: z.union([z.literal(""), z.uuid()]),
});

export const interviewKinds = ["phone", "video", "onsite", "technical", "other"] as const;

export const interviewKindLabels: Record<(typeof interviewKinds)[number], string> = {
  phone: "Phone",
  video: "Video",
  onsite: "On site",
  technical: "Technical",
  other: "Other",
};

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export const interviewSchema = z.object({
  scheduled_at: z
    .string()
    .trim()
    .refine(
      (value) => LOCAL_DATE_TIME.test(value) && isRealDate(value.slice(0, 10)),
      "Enter the interview date and time.",
    ),
  kind: z.enum(interviewKinds),
  location: text(500),
  interviewer: text(200),
  notes: text(4000),
});

export const reminderSchema = z.object({
  title: text(200).min(1, "Say what the reminder is for."),
  due_on: date,
});

type Named = { company: string; role_title: string };

const sameText = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** The same company and position, ignoring case. */
export const isDuplicateApplication = (existing: Named[], company: string, roleTitle: string) =>
  existing.some(
    (application) =>
      sameText(application.company, company) && sameText(application.role_title, roleTitle),
  );

export const firstIssue = (error: z.ZodError) =>
  error.issues[0]?.message ?? "Check the details and try again.";

/** A date as a person reads it. Stored dates have no time zone, so none is applied. */
export function formatDay(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function formatDayAndTime(value: string): string {
  return `${formatDay(value)}, ${value.slice(11, 16)}`;
}
