import "server-only";

import {
  NEW_JOB_WINDOW_DAYS,
  planNotifications,
  type NotificationDraft,
} from "@/lib/notifications/rules";
import { safeTimeZone } from "@/lib/time";
import { createAdminClient } from "@/server/supabase/admin";

const DAY = 86_400_000;

/**
 * Users cannot write notifications, so the server stores them. The unique key on
 * (user_id, dedupe_key) is what prevents duplicates: it holds even if two runs
 * overlap, and it still applies to notifications the user has dismissed.
 */
export async function storeNotifications(
  userId: string,
  drafts: NotificationDraft[],
): Promise<number> {
  if (drafts.length === 0) return 0;
  const { data, error } = await createAdminClient()
    .from("notifications")
    .upsert(
      drafts.map((draft) => ({ ...draft, user_id: userId })),
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`Saving notifications failed: ${error.code}`);
  return data.length;
}

/** Works out one user's notifications. The user id must come from a verified source. */
export async function deliverNotifications(userId: string, now = new Date()): Promise<number> {
  const admin = createAdminClient();
  const yesterday = new Date(now.getTime() - DAY).toISOString().slice(0, 10);
  const oldestJob = new Date(now.getTime() - NEW_JOB_WINDOW_DAYS * DAY).toISOString();

  const [preferences, reminders, applications, interviews, saved, jobs] = await Promise.all([
    admin.from("user_preferences").select("*").eq("user_id", userId).single(),
    admin
      .from("application_reminders")
      .select("id, application_id, title, due_on, applications (company)")
      .eq("user_id", userId)
      .is("completed_at", null),
    admin
      .from("applications")
      .select("id, company, role_title, status, applied_at, job_id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1000),
    admin
      .from("application_interviews")
      .select("id, application_id, scheduled_at, applications (company, role_title)")
      .eq("user_id", userId)
      .gte("scheduled_at", yesterday),
    admin
      .from("saved_jobs")
      .select("job_id, jobs (title, company, is_active)")
      .eq("user_id", userId),
    admin
      .from("jobs")
      .select("id, title, company, location_raw, remote_policy, first_seen_at")
      .is("created_by", null)
      .eq("is_active", true)
      .gte("first_seen_at", oldestJob)
      .limit(500),
  ]);
  const failed =
    preferences.error ??
    reminders.error ??
    applications.error ??
    interviews.error ??
    saved.error ??
    jobs.error;
  if (failed || !preferences.data) throw new Error(`Notification lookup failed: ${failed?.code}`);

  const settings = preferences.data;
  const drafts = planNotifications({
    now,
    timeZone: safeTimeZone(settings.timezone),
    preferences: settings,
    desiredTitles: settings.desired_titles,
    desiredLocations: settings.desired_locations,
    reminders: (reminders.data ?? []).map(({ applications: parent, ...reminder }) => ({
      ...reminder,
      company: parent?.company ?? "this employer",
    })),
    applications: applications.data ?? [],
    interviews: (interviews.data ?? []).map(({ applications: parent, ...interview }) => ({
      ...interview,
      company: parent?.company ?? "this employer",
      role_title: parent?.role_title ?? "this role",
    })),
    savedJobs: (saved.data ?? []).flatMap(({ job_id, jobs: job }) =>
      job ? [{ job_id, ...job }] : [],
    ),
    newJobs: jobs.data ?? [],
  });

  const created = await storeNotifications(userId, drafts);

  const { error } = await admin
    .from("user_preferences")
    .update({ notifications_checked_at: now.toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(`Saving the check time failed: ${error.code}`);
  return created;
}
