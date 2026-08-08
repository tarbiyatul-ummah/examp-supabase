begin;

grant usage on schema public to authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant insert, update on public.students, public.exams, public.exam_versions,
  public.questions, public.question_options, public.question_option_keys,
  public.accepted_answers, public.media_assets, public.exam_assignments,
  public.export_jobs to authenticated;
grant insert on public.leaderboards, public.leaderboard_entries to authenticated;
grant update on public.system_settings to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.student_credentials enable row level security;
alter table public.student_login_attempts enable row level security;
alter table public.exams enable row level security;
alter table public.exam_versions enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_option_keys enable row level security;
alter table public.accepted_answers enable row level security;
alter table public.media_assets enable row level security;
alter table public.exam_assignments enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_questions enable row level security;
alter table public.answers enable row level security;
alter table public.attempt_question_results enable row level security;
alter table public.answer_reviews enable row level security;
alter table public.result_releases enable row level security;
alter table public.attempt_events enable row level security;
alter table public.leaderboards enable row level security;
alter table public.leaderboard_entries enable row level security;
alter table public.export_jobs enable row level security;
alter table public.idempotency_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;

create policy profiles_select_self_or_admin on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy students_select_self_or_admin on public.students
for select to authenticated
using (auth_user_id = auth.uid() or public.is_admin());
create policy students_insert_admin on public.students
for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());
create policy students_update_admin on public.students
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Credential hashes and login-attempt data are deliberately not client-readable.
-- They are accessed only by a service-role Edge Function. Admins receive raw codes
-- once, at creation/regeneration time, and the database never stores plaintext.

create policy student_login_attempts_select_admin on public.student_login_attempts
for select to authenticated using (public.is_admin());

create policy exams_admin_all on public.exams
for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy exams_student_assigned_published on public.exams
for select to authenticated
using (
  status = 'published' and exists (
    select 1 from public.exam_assignments ea
    where ea.exam_id = exams.id
      and ea.student_id = public.current_student_id()
      and ea.revoked_at is null
  )
  or exists (
    select 1 from public.attempts a
    join public.exam_assignments ea on ea.id = a.assignment_id
    where ea.exam_id = exams.id and ea.student_id = public.current_student_id()
  )
);

create policy exam_versions_admin_all on public.exam_versions
for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy exam_versions_student_assigned_or_attempt on public.exam_versions
for select to authenticated
using (
  (status = 'published' and exists (
      select 1 from public.exam_assignments ea
      where ea.exam_id = exam_versions.exam_id
        and ea.student_id = public.current_student_id() and ea.revoked_at is null
    ))
    or exists (
      select 1 from public.attempts a
      join public.exam_assignments ea on ea.id = a.assignment_id
      where a.exam_version_id = exam_versions.id and ea.student_id = public.current_student_id()
    )
);

create policy questions_admin_all on public.questions
for all to authenticated
using (public.is_admin())
with check (
  public.is_admin() and exists (
    select 1 from public.exam_versions ev where ev.id = questions.exam_version_id and ev.status = 'draft'
  )
);
create policy questions_student_own_attempt on public.questions
for select to authenticated
using (
  exists (
    select 1 from public.attempt_questions aq
    join public.attempts a on a.id = aq.attempt_id
    join public.exam_assignments ea on ea.id = a.assignment_id
    where aq.question_id = questions.id and ea.student_id = public.current_student_id()
  )
);

create policy question_options_admin_all on public.question_options
for all to authenticated
using (public.is_admin())
with check (
  public.is_admin() and exists (
    select 1 from public.questions q join public.exam_versions ev on ev.id = q.exam_version_id
    where q.id = question_options.question_id and ev.status = 'draft'
  )
);
create policy question_options_student_own_attempt on public.question_options
for select to authenticated
using (
  exists (
    select 1 from public.attempt_questions aq
    join public.attempts a on a.id = aq.attempt_id
    join public.exam_assignments ea on ea.id = a.assignment_id
    where aq.question_id = question_options.question_id and ea.student_id = public.current_student_id()
  )
);

create policy question_option_keys_admin_all on public.question_option_keys
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy accepted_answers_admin_all on public.accepted_answers
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy media_assets_admin_all on public.media_assets
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy media_assets_student_own_attempt on public.media_assets
for select to authenticated
using (
  exists (
    select 1 from public.exam_versions asset_version
    join public.exam_versions attempt_version on attempt_version.exam_id = asset_version.exam_id
    join public.attempts a on a.exam_version_id = attempt_version.id
    join public.exam_assignments ea on ea.id = a.assignment_id
    where asset_version.id = media_assets.exam_version_id and ea.student_id = public.current_student_id()
  )
);

create policy assignments_admin_all on public.exam_assignments
for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy assignments_student_own on public.exam_assignments
for select to authenticated using (student_id = public.current_student_id());

create policy attempts_admin_select on public.attempts
for select to authenticated using (public.is_admin());
create policy attempts_student_own on public.attempts
for select to authenticated
using (
  exists (
    select 1 from public.exam_assignments ea
    where ea.id = attempts.assignment_id and ea.student_id = public.current_student_id()
  )
);

create policy attempt_questions_admin_select on public.attempt_questions
for select to authenticated using (public.is_admin());
create policy attempt_questions_student_own on public.attempt_questions
for select to authenticated using (public.student_owns_attempt(attempt_id));

create policy answers_admin_select on public.answers
for select to authenticated using (public.is_admin());
create policy answers_student_own on public.answers
for select to authenticated using (public.student_owns_attempt(attempt_id));

create policy attempt_results_admin_select on public.attempt_question_results
for select to authenticated using (public.is_admin());
create policy attempt_results_student_final_only on public.attempt_question_results
for select to authenticated
using (
  public.student_owns_attempt(attempt_id) and exists (
    select 1 from public.attempts a
    where a.id = attempt_question_results.attempt_id
      and a.grading_status in ('auto_scored', 'released')
      and a.status in ('submitted', 'time_expired')
  )
);

create policy answer_reviews_admin_select on public.answer_reviews
for select to authenticated using (public.is_admin());

create policy result_releases_admin_select on public.result_releases
for select to authenticated using (public.is_admin());
create policy result_releases_student_own on public.result_releases
for select to authenticated using (public.student_owns_attempt(attempt_id));

create policy attempt_events_admin_select on public.attempt_events
for select to authenticated using (public.is_admin());
create policy attempt_events_student_own on public.attempt_events
for select to authenticated using (public.student_owns_attempt(attempt_id));

create policy leaderboards_admin_all on public.leaderboards
for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy leaderboard_entries_admin_all on public.leaderboard_entries
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy export_jobs_admin_select on public.export_jobs
for select to authenticated using (public.is_admin());
create policy export_jobs_admin_insert on public.export_jobs
for insert to authenticated with check (public.is_admin() and requested_by = auth.uid());

create policy idempotency_own_select on public.idempotency_records
for select to authenticated using (actor_id = auth.uid());

create policy audit_logs_admin_select on public.audit_logs
for select to authenticated using (public.is_admin());

create policy system_settings_admin_select on public.system_settings
for select to authenticated using (public.is_admin());
create policy system_settings_super_admin_update on public.system_settings
for update to authenticated
using (public.is_super_admin()) with check (public.is_super_admin() and updated_by = auth.uid());

-- Storage buckets are private; signed URLs should be used for exports.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('question-media', 'question-media', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('exports', 'exports', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy question_media_admin_manage on storage.objects
for all to authenticated
using (bucket_id = 'question-media' and public.is_admin())
with check (bucket_id = 'question-media' and public.is_admin());

create policy question_media_student_read_attempt on storage.objects
for select to authenticated
using (
  bucket_id = 'question-media'
  and exists (
    select 1 from public.media_assets ma
    join public.exam_versions asset_version on asset_version.id = ma.exam_version_id
    join public.exam_versions attempt_version on attempt_version.exam_id = asset_version.exam_id
    join public.attempts a on a.exam_version_id = attempt_version.id
    join public.exam_assignments ea on ea.id = a.assignment_id
    where ma.object_path = storage.objects.name
      and ea.student_id = public.current_student_id()
  )
);

create policy exports_admin_read on storage.objects
for select to authenticated using (bucket_id = 'exports' and public.is_admin());

-- Realtime honors SELECT RLS for authenticated clients.
do $$
declare v_table text;
begin
  foreach v_table in array array['attempts','answers','attempt_question_results','attempt_events'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

commit;
