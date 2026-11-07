-- CV builder and cover letters: saved CV versions, layouts and generated letters.
-- See docs/03-database-design.md.

-- CV versions ----------------------------------------------------------------

-- A version is a separate row, so the original CV is never touched. "kind" is
-- what marks it: parent_resume_id goes null if the source CV is deleted, and a
-- version that was sent to an employer should outlive its source.
alter table public.resumes
  add column kind text not null default 'original'
    check (kind in ('original', 'version')),
  add column template text not null default 'classic'
    check (template in ('classic', 'modern', 'compact')),
  add column layout jsonb,
  -- What the AI changed, kept or rejected. Written once when a version is made.
  add column tailoring jsonb,
  add constraint resumes_version_has_no_file
    check (kind = 'original' or (storage_path is null and not is_primary));

create index resumes_user_kind_idx on public.resumes (user_id, kind, created_at desc);

grant update (template, layout) on public.resumes to authenticated;

-- Cover letters --------------------------------------------------------------

-- No code has written to this table yet, so the new required columns need no default.
alter table public.cover_letters
  -- Copied from the job, so a letter still makes sense if the job is removed.
  add column company text not null check (char_length(company) between 1 and 200),
  add column role_title text not null check (char_length(role_title) between 1 and 200),
  -- The AI's text, kept as written, so the user's edits never lose it.
  add column generated_content text not null,
  -- Sentences taken out because they mentioned something the CV does not.
  add column removed_sentences jsonb not null default '[]',
  add column reviewed_at timestamptz,
  add column prompt_version text not null,
  add column model text not null,
  add constraint cover_letters_tone_check
    check (tone in ('professional', 'warm', 'confident', 'concise')),
  add constraint cover_letters_content_length check (char_length(content) <= 8000);

create index cover_letters_user_created_idx
  on public.cover_letters (user_id, created_at desc);

-- A letter is written once by the server. After that only the text and its
-- review state can change, so what the AI produced stays on record.
revoke update on public.cover_letters from authenticated;
grant update (content, is_edited, reviewed_at) on public.cover_letters to authenticated;

-- AI budget ------------------------------------------------------------------

alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('cv_extract', 'cv_analysis', 'job_match', 'cv_tailor', 'cover_letter'));
