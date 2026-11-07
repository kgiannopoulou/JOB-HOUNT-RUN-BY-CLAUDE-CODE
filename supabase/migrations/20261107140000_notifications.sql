-- Notifications and each user's time zone. See docs/03-database-design.md.

-- Preferences ----------------------------------------------------------------

alter table public.user_preferences
  -- Null until the browser reports it or the user chooses one.
  add column timezone text check (char_length(timezone) <= 64),
  add column notify_follow_ups boolean not null default true,
  add column notify_interviews boolean not null default true,
  add column notify_saved_jobs boolean not null default true,
  add column notify_job_matches boolean not null default true,
  -- When notifications were last worked out, so page loads do not repeat the work.
  add column notifications_checked_at timestamptz;

-- Notifications --------------------------------------------------------------

-- No code has written to this table yet, so the required key needs no default.
alter table public.notifications
  -- Names the event. Unique per user, so the same event can never notify twice.
  add column dedupe_key text not null check (char_length(dedupe_key) <= 200),
  add column dismissed_at timestamptz,
  add constraint notifications_type_check
    check (type in ('follow_up', 'interview', 'saved_job', 'job_match', 'account')),
  add constraint notifications_link_is_internal
    check (link is null or (link ~ '^/' and link !~ '^//')),
  add constraint notifications_user_key unique (user_id, dedupe_key);

drop index public.notifications_user_unread_idx;
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null and dismissed_at is null;

-- A dismissed notification keeps its row: deleting it would free its key, and the
-- same event would notify again the next time notifications are worked out.
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at, dismissed_at) on public.notifications to authenticated;

drop policy if exists "Users delete their own notifications" on public.notifications;
