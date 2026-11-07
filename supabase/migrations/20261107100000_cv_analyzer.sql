-- CV analyzer: private file storage, the text read from each file, AI analysis
-- results and the per-user AI budget. See docs/03-database-design.md.

-- Original files -------------------------------------------------------------

-- 4 MiB keeps an upload under the request size limit on Vercel.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs',
  'cvs',
  false,
  4194304,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
);

-- There is no update policy, so a stored original can be deleted but never replaced.
create policy "Users read their own CV files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users upload their own CV files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users delete their own CV files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Resumes --------------------------------------------------------------------

alter table public.resumes
  add column file_name text check (char_length(file_name) <= 255),
  add column file_type text check (file_type in ('pdf', 'docx')),
  add column file_size integer check (file_size > 0),
  add column extracted_text text,
  add column parse_error text,
  add column verified_at timestamptz;

-- The file details and the text read from the file are fixed once stored. Only
-- the structured copy, which the user reviews and corrects, can change.
revoke update on public.resumes from authenticated;
grant update (title, content, parse_status, parse_error, verified_at, is_primary)
  on public.resumes to authenticated;

-- CV analysis ----------------------------------------------------------------

create table public.cv_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid not null,
  -- Hash of the verified profile, so a result can be reused or marked out of date.
  profile_hash text not null,
  result jsonb not null,
  prompt_version text not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (resume_id, profile_hash, prompt_version),
  foreign key (resume_id, user_id)
    references public.resumes (id, user_id) on delete cascade
);

create index cv_analyses_user_idx on public.cv_analyses (user_id);
create index cv_analyses_resume_idx on public.cv_analyses (resume_id, user_id, created_at desc);

alter table public.cv_analyses enable row level security;
revoke all on public.cv_analyses from anon;

-- Analyses are produced by the server, so users can read and remove them only.
revoke insert, update on public.cv_analyses from authenticated;

create policy "Users read their own CV analyses" on public.cv_analyses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users delete their own CV analyses" on public.cv_analyses
  for delete to authenticated using ((select auth.uid()) = user_id);

-- AI budget ------------------------------------------------------------------

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('cv_extract', 'cv_analysis', 'job_match')),
  status text not null default 'reserved'
    check (status in ('reserved', 'succeeded', 'failed')),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon;
revoke insert, update, delete on public.ai_usage from authenticated;

create policy "Users read their own AI usage" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- Counts and records a call in one step. The lock stops parallel requests from
-- all passing the check. Failed calls count, because they can still be billed.
-- Returns null when the user has reached the limit.
create function public.reserve_ai_call(
  p_user_id uuid,
  p_feature text,
  p_model text,
  p_daily_limit integer
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  used integer;
  reservation uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*) into used
  from public.ai_usage
  where user_id = p_user_id and created_at > now() - interval '24 hours';

  if used >= p_daily_limit then
    return null;
  end if;

  insert into public.ai_usage (user_id, feature, model)
  values (p_user_id, p_feature, p_model)
  returning id into reservation;

  return reservation;
end;
$$;

revoke execute on function public.reserve_ai_call(uuid, text, text, integer)
  from public, anon, authenticated;
