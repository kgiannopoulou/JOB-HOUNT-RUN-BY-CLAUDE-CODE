-- Application tracker: the six board stages, recruiter and outcome details,
-- interviews, reminders and an append-only history. See docs/03-database-design.md.

-- Status ---------------------------------------------------------------------

-- The board has six stages. Postgres cannot drop an enum value, so the type is
-- replaced. Nothing has written applications yet, but old values are mapped anyway.
alter table public.applications alter column status drop default;
alter type public.application_status rename to application_status_old;
create type public.application_status as enum
  ('saved', 'applied', 'assessment', 'interview', 'offer', 'rejected');
alter table public.applications
  alter column status type public.application_status
  using (
    case status::text
      when 'screening' then 'assessment'
      when 'accepted' then 'offer'
      when 'withdrawn' then 'rejected'
      else status::text
    end
  )::public.application_status;
alter table public.applications alter column status set default 'saved';
drop type public.application_status_old;

-- Details --------------------------------------------------------------------

-- applied_at is a calendar date: what matters is the day the user applied, and a
-- timestamp would shift to the day before or after in other time zones.
-- next_action_at is replaced by the reminders table, which allows more than one.
alter table public.applications
  alter column applied_at type date using applied_at::date,
  drop column next_action_at,
  -- Web links only, because this value is shown as a link.
  add column job_url text
    check (char_length(job_url) <= 2000 and job_url ~* '^https?://'),
  add column recruiter_name text not null default ''
    check (char_length(recruiter_name) <= 200),
  add column recruiter_email text not null default ''
    check (char_length(recruiter_email) <= 320),
  add column recruiter_phone text not null default ''
    check (char_length(recruiter_phone) <= 50),
  add column offer_details text not null default ''
    check (char_length(offer_details) <= 4000),
  add column offer_deadline date,
  add column rejection_reason text not null default ''
    check (char_length(rejection_reason) <= 4000),
  add constraint applications_notes_length check (char_length(notes) <= 20000),
  add constraint applications_applied_needs_date
    check (status = 'saved' or applied_at is not null);

create index applications_user_updated_idx
  on public.applications (user_id, updated_at desc);

-- Interviews -----------------------------------------------------------------

create table public.application_interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null,
  -- The time as the user entered it, with no time zone: an interview at 10:00
  -- should read 10:00 wherever the page is rendered.
  scheduled_at timestamp not null,
  kind text not null default 'video'
    check (kind in ('phone', 'video', 'onsite', 'technical', 'other')),
  location text not null default '' check (char_length(location) <= 500),
  interviewer text not null default '' check (char_length(interviewer) <= 200),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id, user_id)
    references public.applications (id, user_id) on delete cascade
);

create index application_interviews_user_idx
  on public.application_interviews (user_id, scheduled_at);
create index application_interviews_application_idx
  on public.application_interviews (application_id, user_id);

create trigger set_updated_at before update on public.application_interviews
  for each row execute function public.set_updated_at();

-- Reminders ------------------------------------------------------------------

create table public.application_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  due_on date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id, user_id)
    references public.applications (id, user_id) on delete cascade
);

create index application_reminders_open_idx
  on public.application_reminders (user_id, due_on) where completed_at is null;
create index application_reminders_application_idx
  on public.application_reminders (application_id, user_id);

create trigger set_updated_at before update on public.application_reminders
  for each row execute function public.set_updated_at();

-- History --------------------------------------------------------------------

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null,
  kind text not null check (kind in ('created', 'status_changed', 'interview_added')),
  from_status public.application_status,
  to_status public.application_status,
  created_at timestamptz not null default now(),
  foreign key (application_id, user_id)
    references public.applications (id, user_id) on delete cascade
);

create index application_events_application_idx
  on public.application_events (application_id, user_id, created_at);
create index application_events_user_idx on public.application_events (user_id, created_at);

-- Access ---------------------------------------------------------------------

alter table public.application_interviews enable row level security;
alter table public.application_reminders enable row level security;
alter table public.application_events enable row level security;

revoke all on
  public.application_interviews, public.application_reminders, public.application_events
from anon;

create policy "Users manage their own interviews" on public.application_interviews
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users manage their own reminders" on public.application_reminders
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The history is written by triggers, so users can read it but never alter it.
revoke insert, update, delete on public.application_events from authenticated;

create policy "Users read their own application history" on public.application_events
  for select to authenticated using ((select auth.uid()) = user_id);

-- Status rules ---------------------------------------------------------------

-- Keep in step with allowedMoves in src/lib/applications/status.ts. A test
-- compares every pair of statuses against both.
create function public.application_move_allowed(
  p_from public.application_status,
  p_to public.application_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'saved' then p_to in ('applied', 'assessment', 'interview', 'offer')
    when 'applied' then p_to in ('saved', 'assessment', 'interview', 'offer', 'rejected')
    when 'assessment' then p_to in ('applied', 'interview', 'offer', 'rejected')
    when 'interview' then p_to in ('applied', 'assessment', 'offer', 'rejected')
    when 'offer' then p_to in ('interview', 'rejected')
    when 'rejected' then p_to in ('applied', 'assessment', 'interview', 'offer')
  end;
$$;

create function public.check_application_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
    and not public.application_move_allowed(old.status, new.status) then
    raise exception 'An application cannot move from % to %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger check_move before update of status on public.applications
  for each row execute function public.check_application_move();

-- Definer rights: these write to a table users cannot write to themselves.
create function public.record_application_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (user_id, application_id, kind, to_status)
    values (new.user_id, new.id, 'created', new.status);
  elsif new.status is distinct from old.status then
    insert into public.application_events
      (user_id, application_id, kind, from_status, to_status)
    values (new.user_id, new.id, 'status_changed', old.status, new.status);
  end if;
  return null;
end;
$$;

create trigger record_event after insert or update of status on public.applications
  for each row execute function public.record_application_event();

create function public.record_interview_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.application_events (user_id, application_id, kind)
  values (new.user_id, new.application_id, 'interview_added');
  return null;
end;
$$;

create trigger record_event after insert on public.application_interviews
  for each row execute function public.record_interview_event();

revoke execute on function public.record_application_event() from public, anon, authenticated;
revoke execute on function public.record_interview_event() from public, anon, authenticated;

-- Saved jobs -----------------------------------------------------------------

-- From now on saving a job also adds it to the board. Earlier saves catch up here.
insert into public.applications (user_id, job_id, company, role_title)
select saved.user_id, saved.job_id, jobs.company, jobs.title
from public.saved_jobs saved
join public.jobs on jobs.id = saved.job_id
on conflict do nothing;
