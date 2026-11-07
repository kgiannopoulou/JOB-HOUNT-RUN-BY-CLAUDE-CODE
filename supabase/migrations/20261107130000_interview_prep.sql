-- Interview preparation: sessions tied to an application, generated questions with
-- their evidence, and every written answer with its feedback.
-- See docs/03-database-design.md.

-- Sessions -------------------------------------------------------------------

-- No code has written to these tables yet, so required columns need no default.
alter table public.interview_sessions
  -- Copied, so history still reads correctly if the application is deleted.
  add column company text not null check (char_length(company) between 1 and 200),
  add column role_title text not null check (char_length(role_title) between 1 and 200),
  add column mode text not null default 'practice' check (mode in ('practice', 'mock')),
  add column status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  add column completed_at timestamptz,
  -- False when there was no job text to base company questions on.
  add column had_job_text boolean not null default false,
  add column prompt_version text not null,
  add column model text not null;

create index interview_sessions_user_created_idx
  on public.interview_sessions (user_id, created_at desc);

-- Questions ------------------------------------------------------------------

-- Answers move to their own table, so every attempt is kept.
alter table public.interview_questions
  drop column answer,
  drop column feedback,
  alter column category set not null,
  add constraint interview_questions_category_check
    check (category in ('technical', 'behavioural', 'company')),
  add column why_it_may_come_up text not null default '',
  -- Words copied from the job posting: the evidence for a company question.
  add column job_quote text not null default '',
  add column structure_name text not null default '',
  add column structure_steps text[] not null default '{}',
  add constraint interview_questions_id_user_key unique (id, user_id);

-- Answers --------------------------------------------------------------------

create table public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  question_id uuid not null,
  answer text not null check (char_length(answer) between 1 and 6000),
  -- Lets an unchanged answer reuse its feedback instead of paying for a second call.
  answer_hash text not null,
  rating text check (rating in ('strong', 'adequate', 'weak')),
  feedback jsonb,
  prompt_version text,
  model text,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.interview_sessions (id, user_id) on delete cascade,
  foreign key (question_id, user_id)
    references public.interview_questions (id, user_id) on delete cascade
);

create index interview_answers_session_idx
  on public.interview_answers (session_id, user_id, created_at);
create index interview_answers_question_idx
  on public.interview_answers (question_id, user_id, created_at desc);
create index interview_answers_user_idx on public.interview_answers (user_id, rating);

-- Access ---------------------------------------------------------------------

alter table public.interview_answers enable row level security;
revoke all on public.interview_answers from anon;

-- Questions, ratings and feedback are produced by the server, so users can read
-- them and delete a session, but cannot write a rating of their own.
revoke insert, update on public.interview_sessions from authenticated;
revoke insert, update, delete on public.interview_questions from authenticated;
revoke insert, update, delete on public.interview_answers from authenticated;

create policy "Users read their own interview answers" on public.interview_answers
  for select to authenticated using ((select auth.uid()) = user_id);

-- AI budget ------------------------------------------------------------------

alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in (
    'cv_extract', 'cv_analysis', 'job_match', 'cv_tailor', 'cover_letter',
    'interview_questions', 'interview_feedback'
  ));
