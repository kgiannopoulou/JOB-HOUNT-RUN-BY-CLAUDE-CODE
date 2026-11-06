-- Core JOB HUNT schema. Row level security is added in the next migration.
-- See docs/03-database-design.md.

create extension if not exists pg_trgm with schema extensions;

-- Enumerations ---------------------------------------------------------------

create type public.remote_policy as enum ('remote', 'hybrid', 'onsite', 'unknown');
create type public.employment_type as enum
  ('full_time', 'part_time', 'contract', 'freelance', 'internship', 'unknown');
create type public.experience_level as enum
  ('intern', 'entry', 'mid', 'senior', 'lead', 'unknown');
create type public.resume_parse_status as enum
  ('pending', 'parsing', 'needs_review', 'ready', 'failed');
create type public.application_status as enum
  ('saved', 'applied', 'screening', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn');
create type public.interview_kind as enum ('behavioural', 'technical', 'mixed');

-- Shared trigger -------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Identity -------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 200),
  headline text not null default '' check (char_length(headline) <= 200),
  location text not null default '' check (char_length(location) <= 200),
  linkedin_url text not null default '' check (char_length(linkedin_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  desired_titles text[] not null default '{}',
  desired_locations text[] not null default '{}',
  remote_policies public.remote_policy[] not null default '{}',
  employment_types public.employment_type[] not null default '{}',
  experience_level public.experience_level not null default 'unknown',
  min_salary numeric check (min_salary is null or min_salary >= 0),
  salary_currency text not null default 'EUR' check (char_length(salary_currency) = 3),
  email_notifications boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A profile and preferences row exist for every account from the moment it is created.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200));

  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Jobs -----------------------------------------------------------------------

-- Shared across users. Written only by the server, using the service role.
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_job_id text not null,
  fingerprint text not null,
  title text not null,
  company text not null,
  description text not null default '',
  source_url text not null check (source_url ~ '^https?://'),
  location_raw text not null default '',
  locations text[] not null default '{}',
  city text,
  remote_policy public.remote_policy not null default 'unknown',
  employment_type public.employment_type not null default 'unknown',
  experience_level public.experience_level not null default 'unknown',
  category text,
  tags text[] not null default '{}',
  salary_text text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_annual_min numeric,
  salary_annual_max numeric,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete cascade,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', company), 'B') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('english', description), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_job_id),
  unique (fingerprint)
);

create index jobs_search_vector_idx on public.jobs using gin (search_vector);
create index jobs_title_trgm_idx on public.jobs using gin (title extensions.gin_trgm_ops);
create index jobs_company_trgm_idx on public.jobs using gin (company extensions.gin_trgm_ops);
create index jobs_locations_idx on public.jobs using gin (locations);
create index jobs_posted_at_idx on public.jobs (posted_at desc nulls last) where is_active;
create index jobs_created_by_idx on public.jobs (created_by) where created_by is not null;

-- Resumes --------------------------------------------------------------------

-- Tailored versions are resumes that point at their parent and their target job.
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  storage_path text,
  parse_status public.resume_parse_status not null default 'pending',
  content jsonb,
  is_primary boolean not null default false,
  parent_resume_id uuid,
  target_job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite foreign keys that keep references within one user.
  unique (id, user_id),
  foreign key (parent_resume_id, user_id)
    references public.resumes (id, user_id) on delete set null (parent_resume_id)
);

create index resumes_user_id_idx on public.resumes (user_id);
create index resumes_target_job_id_idx on public.resumes (target_job_id);
create index resumes_parent_idx on public.resumes (parent_resume_id, user_id);
create unique index resumes_one_primary_idx on public.resumes (user_id) where is_primary;

-- Matching -------------------------------------------------------------------

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  resume_id uuid not null,
  score smallint not null check (score between 0 and 100),
  result jsonb not null default '{}',
  prompt_version text not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (job_id, resume_id, prompt_version),
  foreign key (resume_id, user_id)
    references public.resumes (id, user_id) on delete cascade
);

create index job_matches_user_id_idx on public.job_matches (user_id, score desc);
create index job_matches_resume_idx on public.job_matches (resume_id, user_id);

-- Cover letters --------------------------------------------------------------

create table public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  resume_id uuid,
  tone text not null default 'professional',
  content text not null default '',
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (resume_id, user_id)
    references public.resumes (id, user_id) on delete set null (resume_id)
);

create index cover_letters_user_id_idx on public.cover_letters (user_id);
create index cover_letters_job_id_idx on public.cover_letters (job_id);
create index cover_letters_resume_idx on public.cover_letters (resume_id, user_id);

-- Applications ---------------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  -- Copied from the job, so history survives if the job is removed.
  company text not null check (char_length(company) between 1 and 200),
  role_title text not null check (char_length(role_title) between 1 and 200),
  status public.application_status not null default 'saved',
  applied_at timestamptz,
  resume_id uuid,
  cover_letter_id uuid,
  next_action_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (resume_id, user_id)
    references public.resumes (id, user_id) on delete set null (resume_id),
  foreign key (cover_letter_id, user_id)
    references public.cover_letters (id, user_id) on delete set null (cover_letter_id)
);

create index applications_user_status_idx on public.applications (user_id, status);
create index applications_job_id_idx on public.applications (job_id);
create index applications_resume_idx on public.applications (resume_id, user_id);
create index applications_cover_letter_idx on public.applications (cover_letter_id, user_id);
create unique index applications_one_per_job_idx
  on public.applications (user_id, job_id) where job_id is not null;

-- Interview preparation ------------------------------------------------------

create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid,
  job_id uuid references public.jobs (id) on delete set null,
  kind public.interview_kind not null default 'mixed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (application_id, user_id)
    references public.applications (id, user_id) on delete set null (application_id)
);

create index interview_sessions_user_id_idx on public.interview_sessions (user_id);
create index interview_sessions_job_id_idx on public.interview_sessions (job_id);
create index interview_sessions_application_idx
  on public.interview_sessions (application_id, user_id);

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  position smallint not null check (position >= 0),
  question text not null,
  category text,
  answer text,
  feedback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, position),
  foreign key (session_id, user_id)
    references public.interview_sessions (id, user_id) on delete cascade
);

create index interview_questions_user_id_idx on public.interview_questions (user_id);
create index interview_questions_session_idx on public.interview_questions (session_id, user_id);

-- Notifications --------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_user_id_idx on public.notifications (user_id, created_at desc);

-- updated_at triggers --------------------------------------------------------

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.resumes
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.cover_letters
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.interview_sessions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.interview_questions
  for each row execute function public.set_updated_at();
