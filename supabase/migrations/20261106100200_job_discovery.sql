-- Job discovery: saved jobs, sync history and search.

create table public.saved_jobs (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index saved_jobs_job_id_idx on public.saved_jobs (job_id);
create index saved_jobs_user_created_idx on public.saved_jobs (user_id, created_at desc);

alter table public.saved_jobs enable row level security;
revoke all on public.saved_jobs from anon;
revoke update on public.saved_jobs from authenticated;

create policy "Users read their own saved jobs" on public.saved_jobs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users save jobs for themselves" on public.saved_jobs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users remove their own saved jobs" on public.saved_jobs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Every attempt to call a provider is recorded here, whether or not it succeeded.
-- This is what enforces each provider's request limit across deployments.
create table public.job_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  duplicate_count integer not null default 0,
  skipped_count integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index job_sync_runs_provider_idx on public.job_sync_runs (provider, started_at desc);

-- Two overlapping syncs must not both call a provider.
create unique index job_sync_runs_one_running_idx
  on public.job_sync_runs (provider) where status = 'running';

-- Service role only: row level security is on and no policy exists.
alter table public.job_sync_runs enable row level security;
revoke all on public.job_sync_runs from anon, authenticated;

-- Runs as the caller, so row level security on jobs still applies.
create function public.search_jobs(
  p_title text default null,
  p_keywords text default null,
  p_company text default null,
  p_locations text[] default null,
  p_city text default null,
  p_remote_policies public.remote_policy[] default null,
  p_employment_types public.employment_type[] default null,
  p_experience_levels public.experience_level[] default null,
  p_min_salary numeric default null,
  p_sort text default 'date',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  provider text,
  title text,
  company text,
  description text,
  source_url text,
  location_raw text,
  remote_policy public.remote_policy,
  employment_type public.employment_type,
  experience_level public.experience_level,
  category text,
  tags text[],
  salary_text text,
  posted_at timestamptz,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with query as (
    select
      case when nullif(trim(p_keywords), '') is not null
        then websearch_to_tsquery('english', p_keywords)
      end as ts,
      '%' || regexp_replace(trim(p_title), '([\\%_])', '\\\1', 'g') || '%' as title_like,
      '%' || regexp_replace(trim(p_company), '([\\%_])', '\\\1', 'g') || '%' as company_like,
      '%' || regexp_replace(trim(p_city), '([\\%_])', '\\\1', 'g') || '%' as city_like
  )
  select
    j.id, j.provider, j.title, j.company, left(j.description, 400), j.source_url,
    j.location_raw, j.remote_policy, j.employment_type, j.experience_level,
    j.category, j.tags, j.salary_text, j.posted_at,
    count(*) over () as total_count
  from public.jobs j, query q
  where j.is_active
    and (q.ts is null or j.search_vector @@ q.ts)
    and (nullif(trim(p_title), '') is null or j.title ilike q.title_like)
    and (nullif(trim(p_company), '') is null or j.company ilike q.company_like)
    and (p_locations is null or j.locations && p_locations)
    and (nullif(trim(p_city), '') is null
      or j.city ilike q.city_like or j.location_raw ilike q.city_like)
    and (p_remote_policies is null or j.remote_policy = any (p_remote_policies))
    and (p_employment_types is null or j.employment_type = any (p_employment_types))
    and (p_experience_levels is null or j.experience_level = any (p_experience_levels))
    and (p_min_salary is null
      or coalesce(j.salary_annual_max, j.salary_annual_min) >= p_min_salary)
  order by
    case when p_sort = 'relevance' and q.ts is not null
      then ts_rank(j.search_vector, q.ts) end desc nulls last,
    j.posted_at desc nulls last,
    j.id
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.search_jobs from public;
grant execute on function public.search_jobs to anon, authenticated;

-- Real values for the location filter, so it never offers a place with no jobs.
create function public.job_location_options()
returns table (location text, job_count bigint)
language sql
stable
set search_path = ''
as $$
  select l.location, count(*)
  from public.jobs j, unnest(j.locations) as l (location)
  where j.is_active
  group by l.location
  order by count(*) desc, l.location;
$$;

revoke execute on function public.job_location_options from public;
grant execute on function public.job_location_options to anon, authenticated;
