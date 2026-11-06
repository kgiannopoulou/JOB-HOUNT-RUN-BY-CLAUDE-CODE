-- Row level security. Every table is closed by default and opened per role.
-- auth.uid() is wrapped in a select so Postgres evaluates it once per query.

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.jobs enable row level security;
alter table public.resumes enable row level security;
alter table public.job_matches enable row level security;
alter table public.cover_letters enable row level security;
alter table public.applications enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_questions enable row level security;
alter table public.notifications enable row level security;

-- Signed-out visitors have no route to private tables, even if a policy is wrong.
revoke all on
  public.profiles, public.user_preferences, public.resumes, public.job_matches,
  public.cover_letters, public.applications, public.interview_sessions,
  public.interview_questions, public.notifications
from anon;

-- Profiles and preferences are created by the signup trigger and removed with the account.
revoke insert, delete on public.profiles, public.user_preferences from authenticated;

create policy "Users read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Users read their own preferences" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users update their own preferences" on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Public listings can be read by anyone. Private ones only by their creator.
-- There are no write policies, so only the service role can change jobs.
revoke insert, update, delete on public.jobs from anon, authenticated;

create policy "Anyone reads public jobs" on public.jobs
  for select to anon, authenticated
  using (created_by is null or created_by = (select auth.uid()));

create policy "Users manage their own resumes" on public.resumes
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users manage their own cover letters" on public.cover_letters
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users manage their own applications" on public.applications
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users manage their own interview sessions" on public.interview_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users manage their own interview questions" on public.interview_questions
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Match scores are produced by the server, so users can read and remove them only.
revoke insert, update on public.job_matches from authenticated;

create policy "Users read their own matches" on public.job_matches
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users delete their own matches" on public.job_matches
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Notifications are created by the server. Users can only mark them read or delete them.
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Users read their own notifications" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users mark their own notifications read" on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own notifications" on public.notifications
  for delete to authenticated using ((select auth.uid()) = user_id);
