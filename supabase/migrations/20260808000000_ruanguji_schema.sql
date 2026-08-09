-- RuangUji schema v1.1
-- Derived from PRD_Platform_Ujian_Online.md (8 August 2026).

begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.app_role as enum ('student', 'admin', 'super_admin');
create type public.account_status as enum ('active', 'inactive');
create type public.academic_level as enum ('SD', 'SMP', 'SMA');
create type public.academic_phase as enum ('A', 'B', 'C', 'D', 'E', 'F');
create type public.exam_status as enum ('draft', 'published', 'archived');
create type public.exam_version_status as enum ('draft', 'published', 'superseded');
create type public.grading_mode as enum ('instant_result', 'manual_review');
create type public.question_type as enum ('multiple_choice', 'numeric', 'short_text', 'long_text');
create type public.accepted_answer_type as enum ('numeric', 'short_text');
create type public.attempt_status as enum (
  'in_progress', 'paused_disconnected', 'submitted', 'time_expired',
  'disqualified', 'cancelled'
);
create type public.grading_status as enum (
  'auto_scored', 'pending_review', 'in_review', 'reviewed', 'released'
);
create type public.answer_verdict as enum ('correct', 'incorrect');
create type public.verdict_source as enum ('automatic', 'admin');
create type public.connection_state as enum ('connected', 'disconnected', 'reconnecting');
create type public.attempt_event_type as enum (
  'started', 'heartbeat', 'disconnected', 'reconnected', 'focus_lost',
  'focus_gained', 'controller_takeover', 'submitted', 'time_expired',
  'disqualified', 'cancelled'
);
create type public.leaderboard_segment as enum ('all', 'level', 'phase', 'grade');
create type public.export_kind as enum ('assignment_codes', 'exam_results');
create type public.job_status as enum ('queued', 'processing', 'completed', 'failed');

create or replace function public.phase_for_grade(
  p_level public.academic_level,
  p_grade smallint
)
returns public.academic_phase
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when p_level = 'SD' and p_grade between 1 and 2 then 'A'::public.academic_phase
    when p_level = 'SD' and p_grade between 3 and 4 then 'B'::public.academic_phase
    when p_level = 'SD' and p_grade between 5 and 6 then 'C'::public.academic_phase
    when p_level = 'SMP' and p_grade between 7 and 9 then 'D'::public.academic_phase
    when p_level = 'SMA' and p_grade = 10 then 'E'::public.academic_phase
    when p_level = 'SMA' and p_grade between 11 and 12 then 'F'::public.academic_phase
  end
$$;

create or replace function public.grade_matches_level(
  p_level public.academic_level,
  p_grade smallint
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select case p_level
    when 'SD' then p_grade between 1 and 6
    when 'SMP' then p_grade between 7 and 9
    when 'SMA' then p_grade between 10 and 12
  end
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  username extensions.citext unique,
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  status public.account_status not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_check check (username is null or username ~ '^[a-zA-Z0-9._-]{3,64}$')
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 160),
  birth_place text check (birth_place is null or length(btrim(birth_place)) <= 160),
  birth_date date check (birth_date is null or birth_date <= current_date),
  level public.academic_level not null,
  grade smallint not null,
  phase public.academic_phase generated always as (public.phase_for_grade(level, grade)) stored,
  notes text check (notes is null or length(notes) <= 4000),
  status public.account_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_level_grade_check check (public.grade_matches_level(level, grade))
);

comment on column public.students.phase is 'Generated from level and grade using the Kurikulum Merdeka mapping.';

create table public.student_credentials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  code_lookup bytea not null,
  code_hash text not null,
  code_hint char(2) not null,
  active_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint student_credentials_expiry_check check (expires_at is null or expires_at > active_at),
  constraint student_credentials_hash_check check (length(code_hash) >= 20)
);

comment on column public.student_credentials.code_lookup is 'SHA-256 lookup digest; raw six-character code is never stored.';
comment on column public.student_credentials.code_hash is 'Slow password hash used for final verification by the Edge Function.';

create unique index student_credentials_one_active_per_student
  on public.student_credentials(student_id) where revoked_at is null;
create unique index student_credentials_unique_active_code
  on public.student_credentials(code_lookup) where revoked_at is null;

create table public.student_login_attempts (
  id bigint generated always as identity primary key,
  code_lookup bytea,
  ip_hash bytea,
  succeeded boolean not null,
  failure_reason text,
  attempted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint student_login_attempts_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 240),
  description_doc jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  duration_seconds integer not null check (duration_seconds > 0 and duration_seconds <= 86400),
  target_level public.academic_level,
  target_grades smallint[] not null default '{}'::smallint[],
  grading_mode public.grading_mode not null,
  shuffle_questions boolean not null default true,
  allow_reattempt boolean not null default false,
  status public.exam_status not null default 'draft',
  current_version integer not null default 0 check (current_version >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exams_description_object check (jsonb_typeof(description_doc) = 'object'),
  constraint exams_target_consistency check (
    (target_level is null and cardinality(target_grades) = 0)
    or
    (target_level is not null and cardinality(target_grades) >= 0)
  )
);

create table public.exam_versions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  version integer not null check (version > 0),
  status public.exam_version_status not null default 'draft',
  name text not null check (length(btrim(name)) between 1 and 240),
  description_doc jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  duration_seconds integer not null check (duration_seconds > 0 and duration_seconds <= 86400),
  target_level public.academic_level,
  target_grades smallint[] not null default '{}'::smallint[],
  grading_mode public.grading_mode not null,
  shuffle_questions boolean not null default true,
  snapshot_hash text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, version),
  constraint exam_versions_description_object check (jsonb_typeof(description_doc) = 'object'),
  constraint exam_versions_publish_fields check (
    (status = 'draft' and published_at is null and published_by is null)
    or
    (status <> 'draft' and published_at is not null and published_by is not null)
  )
);

create unique index exam_versions_one_draft
  on public.exam_versions(exam_id) where status = 'draft';
create unique index exam_versions_one_published
  on public.exam_versions(exam_id) where status = 'published';

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_version_id uuid not null references public.exam_versions(id) on delete cascade,
  type public.question_type not null,
  content_doc jsonb not null,
  weight numeric(10, 4) not null default 1 check (weight > 0),
  position integer not null check (position > 0),
  shuffle_options boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_version_id, position),
  unique (id, exam_version_id),
  constraint questions_content_object check (jsonb_typeof(content_doc) = 'object'),
  constraint questions_shuffle_check check (type = 'multiple_choice' or not shuffle_options)
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  content_doc jsonb not null,
  position smallint not null check (position between 1 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, position),
  unique (id, question_id),
  constraint question_options_content_object check (jsonb_typeof(content_doc) = 'object')
);

-- Kept separate from question_options so participant SELECT access can never leak keys.
create table public.question_option_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_option_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (correct_option_id, question_id)
    references public.question_options(id, question_id) on delete cascade
);

create table public.accepted_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_type public.accepted_answer_type not null,
  raw_answer text not null check (length(raw_answer) between 1 and 2000),
  normalized_answer text not null check (length(normalized_answer) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (question_id, answer_type, normalized_answer)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  exam_version_id uuid not null references public.exam_versions(id) on delete cascade,
  bucket_id text not null default 'question-media',
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 2621440),
  alt_text text not null check (length(btrim(alt_text)) between 1 and 500),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.exam_assignments (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  started_at timestamptz,
  constraint exam_assignments_revoke_fields check (
    (revoked_at is null and revoked_by is null) or
    (revoked_at is not null and revoked_by is not null)
  )
);

create unique index exam_assignments_one_active
  on public.exam_assignments(exam_id, student_id) where revoked_at is null;

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.exam_assignments(id) on delete restrict,
  exam_version_id uuid not null references public.exam_versions(id) on delete restrict,
  attempt_no integer not null default 1 check (attempt_no > 0),
  is_current boolean not null default true,
  idempotency_key uuid not null,
  status public.attempt_status not null default 'in_progress',
  grading_status public.grading_status,
  connection_state public.connection_state not null default 'connected',
  active_elapsed_seconds integer not null default 0 check (active_elapsed_seconds >= 0),
  duration_seconds integer not null check (duration_seconds > 0),
  resumed_at timestamptz,
  last_heartbeat_at timestamptz,
  pause_started_at timestamptz,
  total_paused_seconds integer not null default 0 check (total_paused_seconds >= 0),
  disconnect_count integer not null default 0 check (disconnect_count >= 0),
  controller_session_id uuid,
  controller_client_seq bigint not null default 0 check (controller_client_seq >= 0),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  terminal_at timestamptz,
  score numeric(5, 2) check (score is null or score between 0 and 100),
  correct_count integer check (correct_count is null or correct_count >= 0),
  incorrect_count integer check (incorrect_count is null or incorrect_count >= 0),
  unanswered_count integer check (unanswered_count is null or unanswered_count >= 0),
  disqualification_reason text,
  disqualified_by uuid references public.profiles(id) on delete restrict,
  cancelled_reason text,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, attempt_no),
  unique (assignment_id, idempotency_key),
  constraint attempts_timer_check check (active_elapsed_seconds <= duration_seconds),
  constraint attempts_terminal_fields check (
    (status in ('in_progress', 'paused_disconnected') and terminal_at is null)
    or
    (status not in ('in_progress', 'paused_disconnected') and terminal_at is not null)
  ),
  constraint attempts_disqualification_check check (
    status <> 'disqualified'
    or (coalesce(length(btrim(disqualification_reason)), 0) > 0 and disqualified_by is not null)
  ),
  constraint attempts_cancel_check check (
    status <> 'cancelled'
    or (coalesce(length(btrim(cancelled_reason)), 0) > 0 and cancelled_by is not null)
  )
);

create unique index attempts_one_current
  on public.attempts(assignment_id) where is_current;

create table public.attempt_questions (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  display_order integer not null check (display_order > 0),
  option_order uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  primary key (attempt_id, question_id),
  unique (attempt_id, display_order)
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  question_id uuid not null,
  selected_option_id uuid,
  text_raw text check (text_raw is null or length(text_raw) <= 20000),
  normalized_value text,
  version integer not null default 1 check (version > 0),
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id),
  foreign key (attempt_id, question_id)
    references public.attempt_questions(attempt_id, question_id) on delete cascade,
  foreign key (selected_option_id, question_id)
    references public.question_options(id, question_id) on delete restrict,
  constraint answers_one_value check (
    num_nonnulls(selected_option_id, text_raw) <= 1
  )
);

create table public.attempt_question_results (
  attempt_id uuid not null,
  question_id uuid not null,
  answered boolean not null default false,
  suggested_verdict public.answer_verdict,
  final_verdict public.answer_verdict,
  verdict_source public.verdict_source,
  weight numeric(10, 4) not null check (weight > 0),
  review_revision integer not null default 0 check (review_revision >= 0),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id),
  foreign key (attempt_id, question_id)
    references public.attempt_questions(attempt_id, question_id) on delete cascade,
  constraint attempt_question_results_decision_check check (
    (final_verdict is null and verdict_source is null and decided_at is null and decided_by is null)
    or
    (final_verdict is not null and verdict_source is not null and decided_at is not null)
  )
);

create table public.answer_reviews (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  question_id uuid not null,
  answer_id uuid references public.answers(id) on delete restrict,
  verdict public.answer_verdict not null,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  revision integer not null check (revision > 0),
  reviewed_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 4000),
  unique (attempt_id, question_id, revision),
  foreign key (attempt_id, question_id)
    references public.attempt_questions(attempt_id, question_id) on delete restrict
);

create table public.result_releases (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts(id) on delete restrict,
  released_by uuid not null references public.profiles(id) on delete restrict,
  released_at timestamptz not null default now(),
  score_snapshot numeric(5, 2) not null check (score_snapshot between 0 and 100),
  correct_count integer not null check (correct_count >= 0),
  incorrect_count integer not null check (incorrect_count >= 0),
  unanswered_count integer not null check (unanswered_count >= 0)
);

create table public.attempt_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  type public.attempt_event_type not null,
  actor_id uuid references public.profiles(id) on delete set null,
  controller_session_id uuid,
  client_seq bigint,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint attempt_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.leaderboards (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete restrict,
  segment_type public.leaderboard_segment not null,
  segment_value text,
  rules_json jsonb not null default '{"order":["score_desc","duration_asc","submitted_at_asc"]}'::jsonb,
  version integer not null check (version > 0),
  generated_by uuid not null references public.profiles(id) on delete restrict,
  generated_at timestamptz not null default now(),
  unique (exam_id, segment_type, segment_value, version),
  constraint leaderboards_segment_value_check check (
    (segment_type = 'all' and segment_value is null)
    or (segment_type <> 'all' and coalesce(length(btrim(segment_value)), 0) > 0)
  ),
  constraint leaderboards_rules_object check (jsonb_typeof(rules_json) = 'object')
);

create table public.leaderboard_entries (
  leaderboard_id uuid not null references public.leaderboards(id) on delete cascade,
  attempt_id uuid not null references public.attempts(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  student_name_snapshot text not null,
  rank integer not null check (rank > 0),
  score numeric(5, 2) not null check (score between 0 and 100),
  active_duration_seconds integer not null check (active_duration_seconds >= 0),
  submitted_at timestamptz not null,
  primary key (leaderboard_id, student_id),
  unique (leaderboard_id, attempt_id)
);

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  kind public.export_kind not null,
  exam_id uuid not null references public.exams(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  filters jsonb not null default '{}'::jsonb,
  status public.job_status not null default 'queued',
  bucket_id text,
  object_path text,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  constraint export_jobs_filters_object check (jsonb_typeof(filters) = 'object'),
  constraint export_jobs_output_check check (
    status <> 'completed' or (bucket_id is not null and object_path is not null and completed_at is not null)
  )
);

create table public.idempotency_records (
  scope text not null,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key uuid not null,
  request_hash text not null,
  response_code integer,
  response_body jsonb,
  locked_until timestamptz not null default (now() + interval '2 minutes'),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  primary key (scope, actor_id, idempotency_key)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  request_id uuid,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip_hash bytea,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  description text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings (key, value, description) values
  ('attempt.heartbeat_timeout_seconds', '30', 'Seconds without heartbeat before an attempt is paused.'),
  ('attempt.controller_takeover_seconds', '45', 'Seconds before another controller may take over an attempt.'),
  ('student_login.max_attempts_per_15_minutes', '10', 'Edge Function rate-limit threshold per IP/code digest.'),
  ('student_login.cooldown_seconds', '900', 'Cooldown after exceeding the login-attempt threshold.');

create index students_filters_idx on public.students(status, level, phase, grade, name);
create index student_login_attempts_rate_idx on public.student_login_attempts(code_lookup, attempted_at desc);
create index student_login_attempts_ip_idx on public.student_login_attempts(ip_hash, attempted_at desc);
create index exams_status_idx on public.exams(status, updated_at desc);
create index exam_versions_exam_idx on public.exam_versions(exam_id, version desc);
create index questions_version_idx on public.questions(exam_version_id, position);
create index question_options_question_idx on public.question_options(question_id, position);
create index accepted_answers_question_idx on public.accepted_answers(question_id);
create index assignments_student_idx on public.exam_assignments(student_id, revoked_at, assigned_at desc);
create index assignments_exam_idx on public.exam_assignments(exam_id, revoked_at, assigned_at desc);
create index attempts_monitoring_idx on public.attempts(exam_version_id, status, updated_at desc);
create index attempts_assignment_idx on public.attempts(assignment_id, attempt_no desc);
create index answers_attempt_idx on public.answers(attempt_id, saved_at desc);
create index reviews_attempt_idx on public.answer_reviews(attempt_id, question_id, revision desc);
create index attempt_events_attempt_idx on public.attempt_events(attempt_id, occurred_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id, occurred_at desc);
create index export_jobs_queue_idx on public.export_jobs(status, requested_at);

commit;
