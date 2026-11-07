import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

const PAGE = 1000;

/** The API returns at most 1,000 rows at a time, and a long search can pass that. */
async function allRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code: string } | null }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(`${label} failed: ${error.code}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

const LIST_COLUMNS =
  "id, company, role_title, status, applied_at, notes, recruiter_name, job_id, updated_at";

/** Row level security limits all of these reads to the signed-in user. */
export function listApplications(supabase: Client) {
  return allRows(
    (from, to) =>
      supabase
        .from("applications")
        .select(LIST_COLUMNS)
        .order("updated_at", { ascending: false })
        .order("id")
        .range(from, to),
    "Application list",
  );
}

export type ApplicationListItem = Awaited<ReturnType<typeof listApplications>>[number];

export function listApplicationEvents(supabase: Client) {
  return allRows(
    (from, to) =>
      supabase
        .from("application_events")
        .select("application_id, kind, to_status, created_at")
        .order("created_at")
        .order("id")
        .range(from, to),
    "Application history",
  );
}

export async function getApplicationDetail(supabase: Client, id: string) {
  const [application, interviews, reminders, events] = await Promise.all([
    supabase.from("applications").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("application_interviews")
      .select("*")
      .eq("application_id", id)
      .order("scheduled_at"),
    supabase
      .from("application_reminders")
      .select("*")
      .eq("application_id", id)
      .order("completed_at", { nullsFirst: true })
      .order("due_on"),
    supabase
      .from("application_events")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const failed = application.error ?? interviews.error ?? reminders.error ?? events.error;
  if (failed) throw new Error(`Application lookup failed: ${failed.code}`);
  if (!application.data) return null;
  return {
    application: application.data,
    interviews: interviews.data ?? [],
    reminders: reminders.data ?? [],
    events: events.data ?? [],
  };
}

const APPLICATION_NAME = "applications (company, role_title)";

/** Open reminders due by the given date, including any that are overdue. */
export async function listDueReminders(supabase: Client, until: string) {
  const { data, error } = await supabase
    .from("application_reminders")
    .select(`id, application_id, title, due_on, ${APPLICATION_NAME}`)
    .is("completed_at", null)
    .lte("due_on", until)
    .order("due_on");
  if (error) throw new Error(`Reminder list failed: ${error.code}`);
  return data;
}

export async function listUpcomingInterviews(supabase: Client, from: string, limit = 5) {
  const { data, error } = await supabase
    .from("application_interviews")
    .select(`id, application_id, scheduled_at, kind, ${APPLICATION_NAME}`)
    .gte("scheduled_at", from)
    .order("scheduled_at")
    .limit(limit);
  if (error) throw new Error(`Interview list failed: ${error.code}`);
  return data;
}

/** Everything with a date between start and end, for the calendar. */
export async function listCalendarItems(supabase: Client, start: string, end: string) {
  const [interviews, reminders, deadlines, applied] = await Promise.all([
    supabase
      .from("application_interviews")
      .select(`id, application_id, scheduled_at, kind, ${APPLICATION_NAME}`)
      .gte("scheduled_at", `${start}T00:00:00`)
      .lte("scheduled_at", `${end}T23:59:59`),
    supabase
      .from("application_reminders")
      .select(`id, application_id, title, due_on, ${APPLICATION_NAME}`)
      .is("completed_at", null)
      .gte("due_on", start)
      .lte("due_on", end),
    supabase
      .from("applications")
      .select("id, company, role_title, offer_deadline")
      .gte("offer_deadline", start)
      .lte("offer_deadline", end),
    supabase
      .from("applications")
      .select("id, company, role_title, applied_at")
      .gte("applied_at", start)
      .lte("applied_at", end),
  ]);
  const failed = interviews.error ?? reminders.error ?? deadlines.error ?? applied.error;
  if (failed) throw new Error(`Calendar lookup failed: ${failed.code}`);
  return {
    interviews: interviews.data ?? [],
    reminders: reminders.data ?? [],
    deadlines: deadlines.data ?? [],
    applied: applied.data ?? [],
  };
}

/** What can be linked to an application: CV versions, originals and letters. */
export async function listDocumentChoices(supabase: Client) {
  const [resumes, letters] = await Promise.all([
    supabase
      .from("resumes")
      .select("id, title, kind")
      .order("kind", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("cover_letters")
      .select("id, company, role_title, created_at")
      .order("created_at", { ascending: false }),
  ]);
  if (resumes.error || letters.error) throw new Error("Document list failed");
  return { resumes: resumes.data, letters: letters.data };
}
