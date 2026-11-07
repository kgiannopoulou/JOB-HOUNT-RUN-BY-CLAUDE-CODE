import { containsPhrase, normalizeForMatch } from "@/lib/cv/grounding";
import { formatDayAndTime } from "@/lib/applications/schema";
import { dateInZone, hoursBetween, wallClockInZone } from "@/lib/time";

export const notificationTypes = [
  "follow_up",
  "interview",
  "saved_job",
  "job_match",
  "account",
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export const typeLabels: Record<NotificationType, string> = {
  follow_up: "Follow-up",
  interview: "Interview",
  saved_job: "Saved job",
  job_match: "New job",
  account: "Account",
};

export type NotificationDraft = {
  type: NotificationType;
  /** Names the event, so the same event can never notify twice. */
  dedupe_key: string;
  title: string;
  body: string;
  link: string;
};

export type NotificationPreferences = {
  notify_follow_ups: boolean;
  notify_interviews: boolean;
  notify_saved_jobs: boolean;
  notify_job_matches: boolean;
};

/** How long an application can sit at Applied before a nudge to follow up. */
export const FOLLOW_UP_AFTER_DAYS = 14;
export const INTERVIEW_NOTICE_HOURS = 48;
export const NEW_JOB_WINDOW_DAYS = 7;
export const MAX_JOB_MATCHES_PER_RUN = 5;

const DAY = 86_400_000;

type NotificationInput = {
  now: Date;
  timeZone: string;
  preferences: NotificationPreferences;
  desiredTitles: string[];
  desiredLocations: string[];
  reminders: {
    id: string;
    application_id: string;
    title: string;
    due_on: string;
    company: string;
  }[];
  applications: {
    id: string;
    company: string;
    role_title: string;
    status: string;
    applied_at: string | null;
    job_id: string | null;
  }[];
  interviews: {
    id: string;
    application_id: string;
    scheduled_at: string;
    company: string;
    role_title: string;
  }[];
  savedJobs: { job_id: string; title: string; company: string; is_active: boolean }[];
  newJobs: {
    id: string;
    title: string;
    company: string;
    location_raw: string;
    remote_policy: string;
    first_seen_at: string;
  }[];
};

function isRelevant(
  job: NotificationInput["newJobs"][number],
  titles: string[],
  locations: string[],
) {
  const title = normalizeForMatch(job.title);
  if (!titles.some((desired) => containsPhrase(title, desired))) return false;
  if (locations.length === 0 || job.remote_policy === "remote") return true;
  const place = normalizeForMatch(job.location_raw);
  return locations.some((desired) => containsPhrase(place, desired));
}

/**
 * Decides what a user should be told. It reads real records and writes nothing,
 * so every rule can be tested, and it is safe to run as often as needed: keys that
 * have been used before are refused when the result is stored.
 */
export function planNotifications(input: NotificationInput): NotificationDraft[] {
  const { now, timeZone, preferences } = input;
  const today = dateInZone(now, timeZone);
  const clock = wallClockInZone(now, timeZone);
  const drafts: NotificationDraft[] = [];

  if (preferences.notify_follow_ups) {
    for (const reminder of input.reminders) {
      if (reminder.due_on > today) continue;
      drafts.push({
        type: "follow_up",
        // The date is part of the key, so moving a reminder lets it fire again.
        dedupe_key: `reminder:${reminder.id}:${reminder.due_on}`,
        title: reminder.title,
        body: `Reminder for your application to ${reminder.company}.`,
        link: `/applications/${reminder.application_id}`,
      });
    }

    const hasReminder = new Set(input.reminders.map((reminder) => reminder.application_id));
    const hasInterview = new Set(input.interviews.map((item) => item.application_id));
    const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - FOLLOW_UP_AFTER_DAYS * DAY)
      .toISOString()
      .slice(0, 10);

    for (const application of input.applications) {
      if (application.status !== "applied" || !application.applied_at) continue;
      if (application.applied_at > cutoff) continue;
      // The user already has this in hand, so a second nudge would be noise.
      if (hasReminder.has(application.id) || hasInterview.has(application.id)) continue;
      drafts.push({
        type: "follow_up",
        dedupe_key: `follow-up:${application.id}:${application.applied_at}`,
        title: `Follow up with ${application.company}?`,
        body: `You applied for ${application.role_title} at least ${FOLLOW_UP_AFTER_DAYS} days ago and have recorded no reply.`,
        link: `/applications/${application.id}`,
      });
    }
  }

  if (preferences.notify_interviews) {
    for (const interview of input.interviews) {
      const hours = hoursBetween(clock, interview.scheduled_at);
      if (hours < 0 || hours > INTERVIEW_NOTICE_HOURS) continue;
      drafts.push({
        type: "interview",
        // The time is part of the key, so a rescheduled interview notifies again.
        dedupe_key: `interview:${interview.id}:${interview.scheduled_at}`,
        title: `Interview with ${interview.company}`,
        body: `${interview.role_title}, ${formatDayAndTime(interview.scheduled_at)}.`,
        link: `/applications/${interview.application_id}`,
      });
    }
  }

  const applicationByJob = new Map(
    input.applications.flatMap((item) => (item.job_id ? [[item.job_id, item] as const] : [])),
  );

  if (preferences.notify_saved_jobs) {
    for (const job of input.savedJobs) {
      if (job.is_active) continue;
      const application = applicationByJob.get(job.job_id);
      // Once applied, a closed listing changes nothing for the user.
      if (application && application.status !== "saved") continue;
      drafts.push({
        type: "saved_job",
        dedupe_key: `job-closed:${job.job_id}`,
        title: "A saved job has closed",
        body: `${job.title} at ${job.company} is no longer listed by its source.`,
        link: application ? `/applications/${application.id}` : "/jobs/saved",
      });
    }
  }

  if (preferences.notify_job_matches && input.desiredTitles.length > 0) {
    const saved = new Set(input.savedJobs.map((job) => job.job_id));
    const oldest = now.getTime() - NEW_JOB_WINDOW_DAYS * DAY;
    const relevant = input.newJobs
      .filter(
        (job) =>
          new Date(job.first_seen_at).getTime() >= oldest &&
          !saved.has(job.id) &&
          !applicationByJob.has(job.id) &&
          isRelevant(job, input.desiredTitles, input.desiredLocations),
      )
      .toSorted((a, b) => b.first_seen_at.localeCompare(a.first_seen_at))
      .slice(0, MAX_JOB_MATCHES_PER_RUN);

    for (const job of relevant) {
      drafts.push({
        type: "job_match",
        dedupe_key: `job-match:${job.id}`,
        title: `New job: ${job.title}`,
        body: `${job.company} posted a role that fits your target titles.`,
        link: `/jobs?title=${encodeURIComponent(job.title)}`,
      });
    }
  }

  return drafts;
}

/** Important messages about the account are always sent and cannot be turned off. */
export const passwordChangedNotification = (moment: Date): NotificationDraft => ({
  type: "account",
  dedupe_key: `account:password:${moment.toISOString().slice(0, 16)}`,
  title: "Your password was changed",
  body: "If this was not you, sign out and reset your password from the sign-in page.",
  link: "/settings",
});
