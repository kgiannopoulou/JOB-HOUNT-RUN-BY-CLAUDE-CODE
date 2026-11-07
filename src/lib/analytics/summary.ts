import { applicationStats, weekStart, type ApplicationStats } from "@/lib/applications/stats";
import type { ApplicationStatus } from "@/lib/applications/status";
import { addDays } from "@/lib/applications/calendar";
import { dateInZone } from "@/lib/time";

export const WEEKS_SHOWN = 8;

export type WeeklyActivity = {
  week: string;
  saved: number;
  applied: number;
  interviews: number;
  practice: number;
};

export type AnalyticsSummary = {
  jobsDiscovered: number;
  savedJobs: number;
  applicationsSubmitted: number;
  /** Applications with an interview, counted once however many rounds there were. */
  interviewsReceived: number;
  offersReceived: number;
  rejections: number;
  /** Null when nothing has been sent, which is different from a rate of zero. */
  responseRate: number | null;
  responded: number;
  byStatus: ApplicationStats["byStatus"];
  weekly: WeeklyActivity[];
  hasActivity: boolean;
};

type AnalyticsInput = {
  jobsDiscovered: number;
  savedJobs: { created_at: string }[];
  applications: { id: string; status: ApplicationStatus; applied_at: string | null }[];
  events: {
    application_id: string;
    kind: string;
    to_status: ApplicationStatus | null;
    created_at: string;
  }[];
  interviews: { application_id: string; scheduled_at: string }[];
  practiceSessions: { created_at: string }[];
  now: Date;
  timeZone: string;
};

/**
 * Every figure is counted from the records passed in. Instants are placed in the
 * user's own weeks, so something done late on Sunday in Athens is not counted in
 * the next week. Dates the user entered have no time zone and are used as they are.
 */
export function buildAnalytics(input: AnalyticsInput): AnalyticsSummary {
  const { now, timeZone } = input;
  const today = dateInZone(now, timeZone);
  const stats = applicationStats(input.applications, input.events, today);

  const thisWeek = weekStart(today);
  const weekly: WeeklyActivity[] = Array.from({ length: WEEKS_SHOWN }, (_, index) => ({
    week: addDays(thisWeek, (index - WEEKS_SHOWN + 1) * 7),
    saved: 0,
    applied: 0,
    interviews: 0,
    practice: 0,
  }));
  const byWeek = new Map(weekly.map((week) => [week.week, week]));

  const add = (day: string, field: "saved" | "applied" | "interviews" | "practice") => {
    const week = byWeek.get(weekStart(day));
    if (week) week[field] += 1;
  };

  for (const item of input.savedJobs) add(dateInZone(new Date(item.created_at), timeZone), "saved");
  for (const item of input.practiceSessions) {
    add(dateInZone(new Date(item.created_at), timeZone), "practice");
  }
  for (const item of input.applications) {
    if (item.status !== "saved" && item.applied_at) add(item.applied_at, "applied");
  }
  for (const item of input.interviews) add(item.scheduled_at.slice(0, 10), "interviews");

  const sent = new Set(
    input.applications.filter((item) => item.status !== "saved").map((item) => item.id),
  );
  const interviewed = new Set(
    input.interviews.map((item) => item.application_id).filter((id) => sent.has(id)),
  );
  for (const item of input.applications) {
    if (item.status === "interview") interviewed.add(item.id);
  }
  for (const event of input.events) {
    if (event.to_status === "interview" && sent.has(event.application_id)) {
      interviewed.add(event.application_id);
    }
  }

  return {
    jobsDiscovered: input.jobsDiscovered,
    savedJobs: input.savedJobs.length,
    applicationsSubmitted: stats.applied,
    interviewsReceived: interviewed.size,
    offersReceived: stats.offers,
    rejections: stats.rejected,
    responseRate: stats.responseRate,
    responded: stats.responded,
    byStatus: stats.byStatus,
    weekly,
    hasActivity: input.applications.length > 0 || input.savedJobs.length > 0,
  };
}
