begin;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role() in ('admin', 'super_admin'), false)
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role() = 'super_admin', false)
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.students s
  join public.profiles p on p.id = s.auth_user_id
  where s.auth_user_id = auth.uid()
    and s.status = 'active'
    and p.status = 'active'
    and p.role = 'student'
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger students_set_updated_at before update on public.students
for each row execute function public.set_updated_at();
create trigger exams_set_updated_at before update on public.exams
for each row execute function public.set_updated_at();
create trigger exam_versions_set_updated_at before update on public.exam_versions
for each row execute function public.set_updated_at();
create trigger questions_set_updated_at before update on public.questions
for each row execute function public.set_updated_at();
create trigger question_options_set_updated_at before update on public.question_options
for each row execute function public.set_updated_at();
create trigger question_option_keys_set_updated_at before update on public.question_option_keys
for each row execute function public.set_updated_at();
create trigger attempts_set_updated_at before update on public.attempts
for each row execute function public.set_updated_at();
create trigger answers_set_updated_at before update on public.answers
for each row execute function public.set_updated_at();
create trigger attempt_question_results_set_updated_at before update on public.attempt_question_results
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, username, display_name)
  values (
    new.id,
    'student',
    nullif(btrim(new.raw_user_meta_data ->> 'username'), '')::extensions.citext,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Pengguna'
    )
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.validate_target_grades()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_grade smallint;
begin
  if new.target_level is null then
    if cardinality(new.target_grades) <> 0 then
      raise exception using errcode = '23514', message = 'Ujian umum tidak boleh memiliki target kelas.';
    end if;
    return new;
  end if;

  foreach v_grade in array new.target_grades loop
    if not public.grade_matches_level(new.target_level, v_grade) then
      raise exception using errcode = '23514', message = format('Kelas %s tidak sesuai jenjang %s.', v_grade, new.target_level);
    end if;
  end loop;
  new.target_grades := array(select distinct unnest(new.target_grades) order by 1);
  return new;
end
$$;

create trigger exams_validate_target before insert or update of target_level, target_grades on public.exams
for each row execute function public.validate_target_grades();
create trigger exam_versions_validate_target before insert or update of target_level, target_grades on public.exam_versions
for each row execute function public.validate_target_grades();

create or replace function public.create_initial_exam_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.exam_versions (
    exam_id, version, name, description_doc, duration_seconds, target_level,
    target_grades, grading_mode, shuffle_questions, created_by
  ) values (
    new.id, 1, new.name, new.description_doc, new.duration_seconds, new.target_level,
    new.target_grades, new.grading_mode, new.shuffle_questions, new.created_by
  );
  return new;
end
$$;

create trigger exams_create_initial_draft
after insert on public.exams
for each row execute function public.create_initial_exam_draft();

create or replace function public.sync_exam_metadata_to_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.exam_versions
  set name = new.name,
      description_doc = new.description_doc,
      duration_seconds = new.duration_seconds,
      target_level = new.target_level,
      target_grades = new.target_grades,
      grading_mode = new.grading_mode,
      shuffle_questions = new.shuffle_questions
  where exam_id = new.id and status = 'draft';

  if not found then
    raise exception using
      errcode = '55000',
      message = 'Ujian published harus dibuatkan draft versi baru sebelum diedit.';
  end if;
  return new;
end
$$;

create trigger exams_sync_metadata_to_draft
after update of name, description_doc, duration_seconds, target_level, target_grades, grading_mode, shuffle_questions
on public.exams
for each row execute function public.sync_exam_metadata_to_draft();

create or replace function public.protect_published_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' and tg_op = 'UPDATE' and new.status = 'superseded'
    and (to_jsonb(new) - array['status','updated_at']) = (to_jsonb(old) - array['status','updated_at']) then
    return new;
  end if;
  if old.status <> 'draft' then
    raise exception using errcode = '55000', message = 'Versi ujian yang telah dipublish bersifat immutable.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create trigger exam_versions_protect_published
before update or delete on public.exam_versions
for each row execute function public.protect_published_version();

create or replace function public.protect_published_version_child()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_status public.exam_version_status;
begin
  if tg_table_name = 'questions' then
    v_version_id := coalesce(new.exam_version_id, old.exam_version_id);
  elsif tg_table_name = 'question_options' then
    select q.exam_version_id into v_version_id
    from public.questions q where q.id = coalesce(new.question_id, old.question_id);
  elsif tg_table_name = 'question_option_keys' then
    select q.exam_version_id into v_version_id
    from public.questions q where q.id = coalesce(new.question_id, old.question_id);
  elsif tg_table_name = 'accepted_answers' then
    select q.exam_version_id into v_version_id
    from public.questions q where q.id = coalesce(new.question_id, old.question_id);
  elsif tg_table_name = 'media_assets' then
    v_version_id := coalesce(new.exam_version_id, old.exam_version_id);
  end if;

  select ev.status into v_status from public.exam_versions ev where ev.id = v_version_id;
  if v_status <> 'draft' then
    raise exception using errcode = '55000', message = 'Konten versi ujian yang telah dipublish bersifat immutable.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create trigger questions_protect_published before insert or update or delete on public.questions
for each row execute function public.protect_published_version_child();
create trigger question_options_protect_published before insert or update or delete on public.question_options
for each row execute function public.protect_published_version_child();
create trigger question_option_keys_protect_published before insert or update or delete on public.question_option_keys
for each row execute function public.protect_published_version_child();
create trigger accepted_answers_protect_published before insert or update or delete on public.accepted_answers
for each row execute function public.protect_published_version_child();
create trigger media_assets_protect_published before insert or update or delete on public.media_assets
for each row execute function public.protect_published_version_child();

-- Declared before the validation trigger that calls them; full definitions are
-- repeated below with CREATE OR REPLACE for readability by domain section.
create or replace function public.normalize_short_answer(p_value text)
returns text language sql immutable set search_path = ''
as $$ select lower(regexp_replace(btrim(normalize(p_value, NFC)), '\s+', ' ', 'g')) $$;

create or replace function public.normalize_numeric_answer(p_value text)
returns text language plpgsql immutable set search_path = ''
as $$ begin return (replace(replace(btrim(p_value), ' ', ''), ',', '.'))::numeric::text; end $$;

create or replace function public.validate_question_shape()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type public.question_type;
begin
  if tg_table_name = 'questions' then
    if new.type = 'long_text' and exists (
      select 1 from public.exam_versions ev
      where ev.id = new.exam_version_id and ev.grading_mode = 'instant_result'
    ) then
      raise exception using errcode = '23514', message = 'Isian panjang hanya tersedia pada mode koreksi admin.';
    end if;
  elsif tg_table_name = 'question_options' then
    select q.type into v_type from public.questions q where q.id = new.question_id;
    if v_type <> 'multiple_choice' then
      raise exception using errcode = '23514', message = 'Opsi hanya boleh dimiliki soal pilihan ganda.';
    end if;
    if (select count(*) from public.question_options qo where qo.question_id = new.question_id and qo.id <> new.id) >= 8 then
      raise exception using errcode = '23514', message = 'Pilihan ganda maksimal memiliki 8 opsi.';
    end if;
  elsif tg_table_name = 'accepted_answers' then
    select q.type into v_type from public.questions q where q.id = new.question_id;
    if (v_type = 'numeric' and new.answer_type <> 'numeric')
      or (v_type = 'short_text' and new.answer_type <> 'short_text')
      or v_type not in ('numeric', 'short_text') then
      raise exception using errcode = '23514', message = 'Tipe accepted answer tidak sesuai tipe soal.';
    end if;
    new.normalized_answer := case new.answer_type
      when 'numeric' then public.normalize_numeric_answer(new.raw_answer)
      when 'short_text' then public.normalize_short_answer(new.raw_answer)
    end;
  end if;
  return new;
end
$$;

create trigger questions_validate_shape before insert or update of type, exam_version_id on public.questions
for each row execute function public.validate_question_shape();
create trigger question_options_validate_shape before insert or update on public.question_options
for each row execute function public.validate_question_shape();
create trigger accepted_answers_validate_shape before insert or update on public.accepted_answers
for each row execute function public.validate_question_shape();

create or replace function public.prevent_started_assignment_revoke()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revoked_at is null and new.revoked_at is not null and exists (
    select 1 from public.attempts a where a.assignment_id = old.id
  ) then
    raise exception using errcode = '55000', message = 'Assignment yang sudah memiliki attempt tidak dapat dicabut.';
  end if;
  return new;
end
$$;

create trigger assignments_prevent_started_revoke
before update of revoked_at on public.exam_assignments
for each row execute function public.prevent_started_assignment_revoke();

create or replace function public.sync_student_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_role public.app_role;
begin
  select role into v_role from public.profiles where id = new.auth_user_id;
  if v_role is distinct from 'student' then
    raise exception using errcode = '23514', message = 'Auth user peserta harus memiliki role student.';
  end if;
  update public.profiles
  set display_name = new.name, status = new.status
  where id = new.auth_user_id;
  return new;
end
$$;

create trigger students_sync_auth_profile
after insert or update of name, status on public.students
for each row execute function public.sync_student_auth_profile();

create or replace function public.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after)
$$;

create or replace function public.audit_admin_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id text;
begin
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'question_id', v_old ->> 'question_id');
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id, v_old, v_new);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create trigger students_audit after insert or update or delete on public.students
for each row execute function public.audit_admin_row_change();
create trigger exams_audit after insert or update or delete on public.exams
for each row execute function public.audit_admin_row_change();
create trigger assignments_audit after insert or update or delete on public.exam_assignments
for each row execute function public.audit_admin_row_change();
create trigger exam_versions_audit after insert or update or delete on public.exam_versions
for each row execute function public.audit_admin_row_change();
create trigger questions_audit after insert or update or delete on public.questions
for each row execute function public.audit_admin_row_change();
create trigger question_options_audit after insert or update or delete on public.question_options
for each row execute function public.audit_admin_row_change();
create trigger question_option_keys_audit after insert or update or delete on public.question_option_keys
for each row execute function public.audit_admin_row_change();
create trigger accepted_answers_audit after insert or update or delete on public.accepted_answers
for each row execute function public.audit_admin_row_change();
create trigger media_assets_audit after insert or update or delete on public.media_assets
for each row execute function public.audit_admin_row_change();

create or replace function public.normalize_short_answer(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(normalize(p_value, NFC)), '\s+', ' ', 'g'))
$$;

create or replace function public.normalize_numeric_answer(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := regexp_replace(btrim(p_value), '\s+', '', 'g');
  v_last_comma integer;
  v_last_dot integer;
begin
  if v !~ '^-?[0-9.,]+$' then
    raise exception using errcode = '22P02', message = 'Jawaban bukan angka yang valid.';
  end if;

  v_last_comma := length(v) - strpos(reverse(v), ',') + 1;
  v_last_dot := length(v) - strpos(reverse(v), '.') + 1;

  if v like '%,%' and v like '%.%' then
    if v_last_comma > v_last_dot then
      v := replace(replace(v, '.', ''), ',', '.');
    else
      v := replace(v, ',', '');
    end if;
  elsif v like '%,%' then
    if length(v) - length(replace(v, ',', '')) > 1 then
      raise exception using errcode = '22P02', message = 'Pemisah desimal tidak valid.';
    end if;
    v := replace(v, ',', '.');
  elsif v like '%.%' then
    if length(v) - length(replace(v, '.', '')) > 1 then
      v := replace(v, '.', '');
    elsif length(split_part(v, '.', 2)) = 3 and length(split_part(replace(v, '-', ''), '.', 1)) between 1 and 3 then
      v := replace(v, '.', '');
    end if;
  end if;

  return (v::numeric)::text;
exception when numeric_value_out_of_range or invalid_text_representation then
  raise exception using errcode = '22P02', message = 'Jawaban bukan angka yang valid.';
end
$$;

create or replace function public.create_exam_draft(p_exam_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
  v_source public.exam_versions%rowtype;
  v_new_version_id uuid;
  v_new_version integer;
  v_question record;
  v_new_question_id uuid;
  v_correct_position smallint;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  select * into v_exam from public.exams where id = p_exam_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Ujian tidak ditemukan.'; end if;
  if exists (select 1 from public.exam_versions where exam_id = p_exam_id and status = 'draft') then
    raise exception using errcode = '23505', message = 'Draft aktif sudah tersedia.';
  end if;
  select * into v_source from public.exam_versions
  where exam_id = p_exam_id and status = 'published';
  if not found then raise exception using errcode = '55000', message = 'Belum ada versi published untuk disalin.'; end if;

  v_new_version := v_exam.current_version + 1;
  insert into public.exam_versions (
    exam_id, version, name, description_doc, duration_seconds, target_level,
    target_grades, grading_mode, shuffle_questions, created_by
  ) values (
    p_exam_id, v_new_version, v_source.name, v_source.description_doc,
    v_source.duration_seconds, v_source.target_level, v_source.target_grades,
    v_source.grading_mode, v_source.shuffle_questions, auth.uid()
  ) returning id into v_new_version_id;

  for v_question in select * from public.questions where exam_version_id = v_source.id order by position loop
    insert into public.questions(exam_version_id, type, content_doc, weight, position, shuffle_options)
    values (v_new_version_id, v_question.type, v_question.content_doc, v_question.weight, v_question.position, v_question.shuffle_options)
    returning id into v_new_question_id;

    insert into public.question_options(question_id, content_doc, position)
    select v_new_question_id, qo.content_doc, qo.position
    from public.question_options qo where qo.question_id = v_question.id;

    select qo.position into v_correct_position
    from public.question_option_keys qok
    join public.question_options qo on qo.id = qok.correct_option_id
    where qok.question_id = v_question.id;
    if v_correct_position is not null then
      insert into public.question_option_keys(question_id, correct_option_id)
      select v_new_question_id, qo.id from public.question_options qo
      where qo.question_id = v_new_question_id and qo.position = v_correct_position;
    end if;
    v_correct_position := null;

    insert into public.accepted_answers(question_id, answer_type, raw_answer, normalized_answer)
    select v_new_question_id, aa.answer_type, aa.raw_answer, aa.normalized_answer
    from public.accepted_answers aa where aa.question_id = v_question.id;
  end loop;

  perform public.write_audit('create_draft', 'exam', p_exam_id::text, null, jsonb_build_object('version', v_new_version));
  return v_new_version_id;
end
$$;

create or replace function public.publish_exam(p_exam_id uuid)
returns public.exam_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
  v_version public.exam_versions%rowtype;
  v_error text;
  v_hash text;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  select * into v_exam from public.exams where id = p_exam_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Ujian tidak ditemukan.'; end if;
  select * into v_version from public.exam_versions
  where exam_id = p_exam_id and status = 'draft' for update;
  if not found then raise exception using errcode = '55000', message = 'Draft ujian tidak ditemukan.'; end if;

  if not exists (select 1 from public.questions where exam_version_id = v_version.id) then
    raise exception using errcode = '23514', message = 'Ujian harus memiliki minimal satu soal.';
  end if;

  select string_agg(
    format('Soal %s: %s', validation.position, validation.problem),
    E'\n' order by validation.position
  )
  into v_error
  from (
    select q.position,
      case
        when q.type = 'multiple_choice' and (select count(*) from public.question_options qo where qo.question_id = q.id) not between 2 and 8
          then 'pilihan ganda harus memiliki 2-8 opsi'
        when q.type = 'multiple_choice' and not exists (select 1 from public.question_option_keys k where k.question_id = q.id)
          then 'kunci pilihan ganda belum dipilih'
        when q.type in ('numeric', 'short_text') and v_version.grading_mode = 'instant_result'
          and not exists (select 1 from public.accepted_answers aa where aa.question_id = q.id)
          then 'accepted answer wajib diisi untuk mode nilai langsung'
        when q.type = 'long_text' and v_version.grading_mode = 'instant_result'
          then 'isian panjang tidak diizinkan pada mode nilai langsung'
      end as problem
    from public.questions q where q.exam_version_id = v_version.id
  ) validation where validation.problem is not null;
  if v_error is not null then raise exception using errcode = '23514', message = v_error; end if;

  select encode(extensions.digest(convert_to(jsonb_build_object(
    'version', to_jsonb(v_version) - array['snapshot_hash','updated_at'],
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'question', to_jsonb(q),
          'options', coalesce((select jsonb_agg(to_jsonb(qo) order by qo.position) from public.question_options qo where qo.question_id = q.id), '[]'::jsonb),
          'option_key', (select to_jsonb(k) from public.question_option_keys k where k.question_id = q.id),
          'accepted_answers', coalesce((select jsonb_agg(to_jsonb(aa) order by aa.id) from public.accepted_answers aa where aa.question_id = q.id), '[]'::jsonb)
        ) order by q.position
      ) from public.questions q where q.exam_version_id = v_version.id
    ), '[]'::jsonb)
  )::text, 'UTF8'), 'sha256'), 'hex') into v_hash;

  update public.exam_versions
  set status = 'superseded'
  where exam_id = p_exam_id and status = 'published' and id <> v_version.id;

  update public.exam_versions
  set status = 'published', published_by = auth.uid(), published_at = now(), snapshot_hash = v_hash
  where id = v_version.id returning * into v_version;

  update public.exams
  set status = 'published', current_version = v_version.version
  where id = p_exam_id;

  perform public.write_audit('publish', 'exam', p_exam_id::text, null, jsonb_build_object('version', v_version.version, 'snapshot_hash', v_hash));
  return v_version;
end
$$;

create or replace function public.student_owns_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attempts a
    join public.exam_assignments ea on ea.id = a.assignment_id
    where a.id = p_attempt_id and ea.student_id = public.current_student_id()
  )
$$;

create or replace function public.start_exam_attempt(
  p_exam_id uuid,
  p_idempotency_key uuid,
  p_controller_session_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := public.current_student_id();
  v_assignment public.exam_assignments%rowtype;
  v_version public.exam_versions%rowtype;
  v_attempt_id uuid;
  v_attempt_no integer;
begin
  if v_student_id is null then raise exception using errcode = '42501', message = 'Akses peserta ditolak.'; end if;
  select * into v_assignment from public.exam_assignments
  where exam_id = p_exam_id and student_id = v_student_id and revoked_at is null for update;
  if not found then raise exception using errcode = '42501', message = 'Peserta tidak memiliki assignment ujian ini.'; end if;

  select a.id into v_attempt_id from public.attempts a
  where a.assignment_id = v_assignment.id and (a.is_current or a.idempotency_key = p_idempotency_key)
  order by a.attempt_no desc limit 1;
  if v_attempt_id is not null then return v_attempt_id; end if;

  select ev.* into v_version from public.exam_versions ev
  join public.exams e on e.id = ev.exam_id
  where ev.exam_id = p_exam_id and ev.status = 'published' and e.status = 'published';
  if not found then raise exception using errcode = '55000', message = 'Ujian belum tersedia.'; end if;

  select coalesce(max(attempt_no), 0) + 1 into v_attempt_no
  from public.attempts where assignment_id = v_assignment.id;
  insert into public.attempts(
    assignment_id, exam_version_id, attempt_no, idempotency_key, duration_seconds,
    resumed_at, last_heartbeat_at, controller_session_id
  ) values (
    v_assignment.id, v_version.id, v_attempt_no, p_idempotency_key, v_version.duration_seconds,
    now(), now(), p_controller_session_id
  ) returning id into v_attempt_id;

  insert into public.attempt_questions(attempt_id, question_id, display_order, option_order)
  select v_attempt_id, shuffled.id, row_number() over (order by shuffled.sort_key, shuffled.position)::integer,
    case when shuffled.shuffle_options then
      coalesce((select array_agg(o.id order by gen_random_uuid()) from public.question_options o where o.question_id = shuffled.id), '{}'::uuid[])
    else
      coalesce((select array_agg(o.id order by o.position) from public.question_options o where o.question_id = shuffled.id), '{}'::uuid[])
    end
  from (
    select q.*, case when v_version.shuffle_questions then gen_random_uuid() end as sort_key
    from public.questions q where q.exam_version_id = v_version.id
  ) shuffled;

  insert into public.attempt_question_results(attempt_id, question_id, weight)
  select v_attempt_id, aq.question_id, q.weight
  from public.attempt_questions aq join public.questions q on q.id = aq.question_id
  where aq.attempt_id = v_attempt_id;

  update public.exam_assignments set started_at = coalesce(started_at, now()) where id = v_assignment.id;
  insert into public.attempt_events(attempt_id, type, actor_id, controller_session_id)
  values (v_attempt_id, 'started', auth.uid(), p_controller_session_id);
  return v_attempt_id;
end
$$;

create or replace function public.reconcile_attempt_clock(p_attempt_id uuid)
returns public.attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.attempts%rowtype;
  v_now timestamptz := clock_timestamp();
  v_increment integer;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Attempt tidak ditemukan.'; end if;
  if v_attempt.status = 'in_progress' and v_attempt.resumed_at is not null then
    v_increment := greatest(0, floor(extract(epoch from (v_now - v_attempt.resumed_at)))::integer);
    v_attempt.active_elapsed_seconds := least(v_attempt.duration_seconds, v_attempt.active_elapsed_seconds + v_increment);
    update public.attempts set active_elapsed_seconds = v_attempt.active_elapsed_seconds, resumed_at = v_now where id = p_attempt_id;
  end if;
  select * into v_attempt from public.attempts where id = p_attempt_id;
  return v_attempt;
end
$$;

-- Forward declaration; replaced by the full implementation below. This keeps
-- heartbeat/save functions valid when migrations run with check_function_bodies on.
create or replace function public.finalize_attempt(
  p_attempt_id uuid,
  p_terminal_status public.attempt_status
)
returns public.attempts
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'finalize_attempt belum siap.';
end
$$;

create or replace function public.heartbeat_attempt(
  p_attempt_id uuid,
  p_controller_session_id uuid,
  p_client_seq bigint,
  p_visibility text default 'visible'
)
returns table (
  status public.attempt_status,
  remaining_seconds integer,
  connection_state public.connection_state,
  server_time timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.attempts%rowtype;
  v_now timestamptz := clock_timestamp();
  v_gap integer;
  v_takeover integer := 45;
  v_timeout integer := 30;
begin
  if not public.student_owns_attempt(p_attempt_id) then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  select coalesce((value #>> '{}')::integer, 45) into v_takeover from public.system_settings where key = 'attempt.controller_takeover_seconds';
  select coalesce((value #>> '{}')::integer, 30) into v_timeout from public.system_settings where key = 'attempt.heartbeat_timeout_seconds';
  select * into v_attempt from public.attempts where id = p_attempt_id for update;
  if v_attempt.status not in ('in_progress', 'paused_disconnected') then
    return query select v_attempt.status, greatest(0, v_attempt.duration_seconds - v_attempt.active_elapsed_seconds), v_attempt.connection_state, v_now;
    return;
  end if;

  if v_attempt.controller_session_id is distinct from p_controller_session_id
    and v_attempt.last_heartbeat_at is not null
    and extract(epoch from (v_now - v_attempt.last_heartbeat_at)) < v_takeover then
    raise exception using errcode = '40001', message = 'Attempt sedang dikendalikan perangkat lain.';
  end if;

  if v_attempt.controller_session_id is distinct from p_controller_session_id then
    insert into public.attempt_events(attempt_id, type, actor_id, controller_session_id, metadata)
    values (p_attempt_id, 'controller_takeover', auth.uid(), p_controller_session_id,
      jsonb_build_object('previous_controller', v_attempt.controller_session_id));
  end if;

  if v_attempt.status = 'paused_disconnected' then
    update public.attempts set
      status = 'in_progress', connection_state = 'connected', resumed_at = v_now,
      total_paused_seconds = total_paused_seconds + greatest(0, floor(extract(epoch from (v_now - pause_started_at)))::integer),
      pause_started_at = null, last_heartbeat_at = v_now,
      controller_session_id = p_controller_session_id, controller_client_seq = greatest(controller_client_seq, p_client_seq)
    where id = p_attempt_id;
    insert into public.attempt_events(attempt_id, type, actor_id, controller_session_id, client_seq)
    values (p_attempt_id, 'reconnected', auth.uid(), p_controller_session_id, p_client_seq);
  else
    v_gap := greatest(0, floor(extract(epoch from (v_now - v_attempt.last_heartbeat_at)))::integer);
    if v_gap > v_timeout then
      update public.attempts set
        active_elapsed_seconds = least(duration_seconds, active_elapsed_seconds + greatest(0, floor(extract(epoch from (last_heartbeat_at - resumed_at)))::integer)),
        total_paused_seconds = total_paused_seconds + v_gap,
        disconnect_count = disconnect_count + 1,
        resumed_at = v_now, last_heartbeat_at = v_now, connection_state = 'connected',
        controller_session_id = p_controller_session_id,
        controller_client_seq = greatest(controller_client_seq, p_client_seq)
      where id = p_attempt_id;
      insert into public.attempt_events(attempt_id, type, actor_id, controller_session_id, metadata)
      values (p_attempt_id, 'disconnected', auth.uid(), p_controller_session_id, jsonb_build_object('detected_gap_seconds', v_gap));
      insert into public.attempt_events(attempt_id, type, actor_id, controller_session_id, client_seq)
      values (p_attempt_id, 'reconnected', auth.uid(), p_controller_session_id, p_client_seq);
    else
      v_attempt := public.reconcile_attempt_clock(p_attempt_id);
      update public.attempts set
        last_heartbeat_at = v_now, connection_state = 'connected',
        controller_session_id = p_controller_session_id,
        controller_client_seq = greatest(controller_client_seq, p_client_seq)
      where id = p_attempt_id;
    end if;
    if p_visibility = 'visible' then
      insert into public.attempt_events(attempt_id, type, actor_id, controller_session_id, client_seq)
      values (p_attempt_id, 'heartbeat', auth.uid(), p_controller_session_id, p_client_seq);
    end if;
  end if;

  select * into v_attempt from public.attempts where id = p_attempt_id;
  if v_attempt.active_elapsed_seconds >= v_attempt.duration_seconds then
    perform public.finalize_attempt(p_attempt_id, 'time_expired');
    select * into v_attempt from public.attempts where id = p_attempt_id;
  end if;
  return query select v_attempt.status, greatest(0, v_attempt.duration_seconds - v_attempt.active_elapsed_seconds), v_attempt.connection_state, v_now;
end
$$;

create or replace function public.pause_stale_attempts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timeout integer := 30;
  v_count integer;
  v_expired_id uuid;
begin
  select coalesce((value #>> '{}')::integer, 30) into v_timeout from public.system_settings where key = 'attempt.heartbeat_timeout_seconds';
  with stale as (
    update public.attempts
    set active_elapsed_seconds = least(duration_seconds, active_elapsed_seconds + greatest(0, floor(extract(epoch from (last_heartbeat_at - resumed_at)))::integer)),
        status = 'paused_disconnected', connection_state = 'disconnected', resumed_at = null,
        pause_started_at = last_heartbeat_at, disconnect_count = disconnect_count + 1
    where status = 'in_progress' and last_heartbeat_at < clock_timestamp() - make_interval(secs => v_timeout)
    returning id
  ), logged as (
    insert into public.attempt_events(attempt_id, type)
    select id, 'disconnected' from stale returning 1
  ) select count(*) into v_count from logged;
  for v_expired_id in
    select id from public.attempts
    where status = 'paused_disconnected' and active_elapsed_seconds >= duration_seconds
  loop
    perform public.finalize_attempt(v_expired_id, 'time_expired');
  end loop;
  return v_count;
end
$$;

create or replace function public.save_attempt_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_option_id uuid,
  p_text_raw text,
  p_expected_version integer,
  p_controller_session_id uuid
)
returns public.answers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.attempts%rowtype;
  v_question public.questions%rowtype;
  v_answer public.answers%rowtype;
  v_normalized text;
begin
  if not public.student_owns_attempt(p_attempt_id) then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  v_attempt := public.reconcile_attempt_clock(p_attempt_id);
  if v_attempt.controller_session_id is distinct from p_controller_session_id then
    raise exception using errcode = '40001', message = 'Tab ini bukan controller aktif untuk attempt.';
  end if;
  if v_attempt.active_elapsed_seconds >= v_attempt.duration_seconds then
    perform public.finalize_attempt(p_attempt_id, 'time_expired');
    -- Returning NULL lets the gateway emit a 409 without rolling back the
    -- time-expiry finalization performed in this transaction.
    return null;
  end if;
  if v_attempt.status <> 'in_progress' then raise exception using errcode = '55000', message = 'Attempt tidak menerima jawaban.'; end if;
  select q.* into v_question from public.questions q
  join public.attempt_questions aq on aq.question_id = q.id
  where aq.attempt_id = p_attempt_id and q.id = p_question_id;
  if not found then raise exception using errcode = '42501', message = 'Soal bukan bagian dari attempt.'; end if;

  if v_question.type = 'multiple_choice' then
    if p_text_raw is not null or (p_selected_option_id is not null and not exists (
      select 1 from public.question_options where id = p_selected_option_id and question_id = p_question_id
    )) then raise exception using errcode = '23514', message = 'Jawaban pilihan tidak valid.'; end if;
  else
    if p_selected_option_id is not null then raise exception using errcode = '23514', message = 'Soal isian tidak menerima option ID.'; end if;
    if v_question.type = 'numeric' and p_text_raw is not null then v_normalized := public.normalize_numeric_answer(p_text_raw);
    elsif v_question.type = 'short_text' and p_text_raw is not null then v_normalized := public.normalize_short_answer(p_text_raw);
    else v_normalized := p_text_raw;
    end if;
  end if;

  select * into v_answer from public.answers where attempt_id = p_attempt_id and question_id = p_question_id for update;
  if found then
    if v_answer.version <> p_expected_version then raise exception using errcode = '40001', message = 'Versi jawaban konflik; muat ulang jawaban terbaru.'; end if;
    update public.answers set selected_option_id = p_selected_option_id, text_raw = p_text_raw,
      normalized_value = v_normalized, version = version + 1, saved_at = now()
    where id = v_answer.id returning * into v_answer;
  else
    if p_expected_version <> 0 then raise exception using errcode = '40001', message = 'Versi jawaban konflik; jawaban belum ada di server.'; end if;
    insert into public.answers(attempt_id, question_id, selected_option_id, text_raw, normalized_value)
    values (p_attempt_id, p_question_id, p_selected_option_id, p_text_raw, v_normalized)
    returning * into v_answer;
  end if;
  return v_answer;
end
$$;

create or replace function public.finalize_attempt(
  p_attempt_id uuid,
  p_terminal_status public.attempt_status
)
returns public.attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.attempts%rowtype;
  v_mode public.grading_mode;
  v_total numeric;
  v_correct numeric;
  v_correct_count integer;
  v_incorrect_count integer;
  v_unanswered_count integer;
begin
  if p_terminal_status not in ('submitted', 'time_expired') then
    raise exception using errcode = '22023', message = 'Status finalisasi tidak valid.';
  end if;
  select * into v_attempt from public.attempts where id = p_attempt_id for update;
  if v_attempt.status not in ('in_progress', 'paused_disconnected') then return v_attempt; end if;
  select grading_mode into v_mode from public.exam_versions where id = v_attempt.exam_version_id;

  update public.attempt_question_results r
  set answered = a.id is not null and (a.selected_option_id is not null or nullif(btrim(a.text_raw), '') is not null),
      suggested_verdict = case
        when q.type = 'multiple_choice' then
          case when a.selected_option_id = k.correct_option_id then 'correct'::public.answer_verdict else 'incorrect'::public.answer_verdict end
        when q.type in ('numeric', 'short_text') then
          case when exists (select 1 from public.accepted_answers aa where aa.question_id = q.id and aa.normalized_answer = a.normalized_value)
            then 'correct'::public.answer_verdict else 'incorrect'::public.answer_verdict end
        else null
      end,
      final_verdict = case when v_mode = 'instant_result' then
        case
          when q.type = 'multiple_choice' and a.selected_option_id = k.correct_option_id then 'correct'::public.answer_verdict
          when q.type in ('numeric', 'short_text') and exists (select 1 from public.accepted_answers aa where aa.question_id = q.id and aa.normalized_answer = a.normalized_value) then 'correct'::public.answer_verdict
          else 'incorrect'::public.answer_verdict
        end
        else null end,
      verdict_source = case when v_mode = 'instant_result' then 'automatic'::public.verdict_source else null end,
      decided_at = case when v_mode = 'instant_result' then now() else null end,
      decided_by = null
  from public.questions q
  left join public.answers a on a.attempt_id = p_attempt_id and a.question_id = q.id
  left join public.question_option_keys k on k.question_id = q.id
  where r.attempt_id = p_attempt_id and q.id = r.question_id;

  if v_mode = 'instant_result' then
    select sum(weight), sum(weight) filter (where final_verdict = 'correct'),
      count(*) filter (where final_verdict = 'correct'),
      count(*) filter (where final_verdict = 'incorrect' and answered),
      count(*) filter (where not answered)
    into v_total, v_correct, v_correct_count, v_incorrect_count, v_unanswered_count
    from public.attempt_question_results where attempt_id = p_attempt_id;
    update public.attempts set status = p_terminal_status, grading_status = 'auto_scored',
      active_elapsed_seconds = case when p_terminal_status = 'time_expired' then duration_seconds else active_elapsed_seconds end,
      resumed_at = null, submitted_at = now(), terminal_at = now(), connection_state = 'disconnected',
      score = round(coalesce(v_correct, 0) / nullif(v_total, 0) * 100, 2),
      correct_count = v_correct_count, incorrect_count = v_incorrect_count,
      unanswered_count = v_unanswered_count
    where id = p_attempt_id returning * into v_attempt;
  else
    update public.attempts set status = p_terminal_status, grading_status = 'pending_review',
      active_elapsed_seconds = case when p_terminal_status = 'time_expired' then duration_seconds else active_elapsed_seconds end,
      resumed_at = null, submitted_at = now(), terminal_at = now(), connection_state = 'disconnected'
    where id = p_attempt_id returning * into v_attempt;
  end if;
  insert into public.attempt_events(attempt_id, type, actor_id)
  values (p_attempt_id, case when p_terminal_status = 'submitted' then 'submitted' else 'time_expired' end, auth.uid());
  return v_attempt;
end
$$;

create or replace function public.submit_attempt(p_attempt_id uuid)
returns public.attempts
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt public.attempts%rowtype;
begin
  if not public.student_owns_attempt(p_attempt_id) then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  select * into v_attempt from public.attempts where id = p_attempt_id;
  if v_attempt.status not in ('in_progress', 'paused_disconnected') then return v_attempt; end if;
  if v_attempt.status = 'in_progress' then v_attempt := public.reconcile_attempt_clock(p_attempt_id); end if;
  return public.finalize_attempt(p_attempt_id,
    case when v_attempt.active_elapsed_seconds >= v_attempt.duration_seconds then 'time_expired' else 'submitted' end);
end
$$;

create or replace function public.review_attempt_question(
  p_attempt_id uuid,
  p_question_id uuid,
  p_verdict public.answer_verdict,
  p_expected_revision integer,
  p_note text default null
)
returns public.attempt_question_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.attempt_question_results%rowtype;
  v_answer_id uuid;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  select * into v_result from public.attempt_question_results
  where attempt_id = p_attempt_id and question_id = p_question_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Soal attempt tidak ditemukan.'; end if;
  if v_result.review_revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'Koreksi telah diubah admin lain; muat ulang data terbaru.';
  end if;
  if not exists (
    select 1 from public.attempts a join public.exam_versions ev on ev.id = a.exam_version_id
    where a.id = p_attempt_id and a.status in ('submitted','time_expired')
      and a.grading_status in ('pending_review','in_review','reviewed') and ev.grading_mode = 'manual_review'
  ) then raise exception using errcode = '55000', message = 'Attempt tidak dapat dikoreksi.'; end if;

  select id into v_answer_id from public.answers where attempt_id = p_attempt_id and question_id = p_question_id;
  insert into public.answer_reviews(attempt_id, question_id, answer_id, verdict, reviewer_id, revision, note)
  values (p_attempt_id, p_question_id, v_answer_id, p_verdict, auth.uid(), p_expected_revision + 1, p_note);
  update public.attempt_question_results set final_verdict = p_verdict, verdict_source = 'admin',
    review_revision = review_revision + 1, decided_at = now(), decided_by = auth.uid()
  where attempt_id = p_attempt_id and question_id = p_question_id returning * into v_result;
  update public.attempts set grading_status = case
    when not exists (select 1 from public.attempt_question_results where attempt_id = p_attempt_id and final_verdict is null)
      then 'reviewed'::public.grading_status else 'in_review'::public.grading_status end
  where id = p_attempt_id;
  perform public.write_audit('review_answer', 'attempt_question', p_attempt_id::text || ':' || p_question_id::text,
    null, jsonb_build_object('verdict', p_verdict, 'revision', p_expected_revision + 1));
  return v_result;
end
$$;

create or replace function public.release_attempt_result(p_attempt_id uuid)
returns public.attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.attempts%rowtype;
  v_total numeric;
  v_correct numeric;
  v_correct_count integer;
  v_incorrect_count integer;
  v_unanswered_count integer;
  v_score numeric(5,2);
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  select * into v_attempt from public.attempts where id = p_attempt_id for update;
  if v_attempt.grading_status = 'released' then return v_attempt; end if;
  if v_attempt.grading_status <> 'reviewed' or exists (
    select 1 from public.attempt_question_results where attempt_id = p_attempt_id and final_verdict is null
  ) then raise exception using errcode = '55000', message = 'Seluruh soal harus dikoreksi sebelum nilai diterbitkan.'; end if;
  select sum(weight), sum(weight) filter (where final_verdict = 'correct'),
    count(*) filter (where final_verdict = 'correct'), count(*) filter (where final_verdict = 'incorrect' and answered),
    count(*) filter (where not answered)
  into v_total, v_correct, v_correct_count, v_incorrect_count, v_unanswered_count
  from public.attempt_question_results where attempt_id = p_attempt_id;
  v_score := round(coalesce(v_correct, 0) / nullif(v_total, 0) * 100, 2);
  update public.attempts set grading_status = 'released', score = v_score,
    correct_count = v_correct_count, incorrect_count = v_incorrect_count,
    unanswered_count = v_unanswered_count, released_at = now()
  where id = p_attempt_id returning * into v_attempt;
  insert into public.result_releases(attempt_id, released_by, score_snapshot, correct_count, incorrect_count, unanswered_count)
  values (p_attempt_id, auth.uid(), v_score, v_correct_count, v_incorrect_count, v_unanswered_count);
  perform public.write_audit('release_result', 'attempt', p_attempt_id::text, null, jsonb_build_object('score', v_score));
  return v_attempt;
end
$$;

create or replace function public.release_exam_results(p_exam_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt_id uuid;
  v_released uuid[] := '{}'::uuid[];
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  for v_attempt_id in
    select a.id
    from public.attempts a
    join public.exam_assignments ea on ea.id = a.assignment_id
    where ea.exam_id = p_exam_id and a.is_current and a.grading_status = 'reviewed'
    order by a.submitted_at, a.id
  loop
    perform public.release_attempt_result(v_attempt_id);
    v_released := array_append(v_released, v_attempt_id);
  end loop;
  return v_released;
end
$$;

create or replace function public.disqualify_attempt(p_attempt_id uuid, p_reason text)
returns public.attempts
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt public.attempts%rowtype;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception using errcode = '23514', message = 'Alasan diskualifikasi wajib diisi.'; end if;
  select * into v_attempt from public.attempts where id = p_attempt_id for update;
  if v_attempt.status not in ('in_progress', 'paused_disconnected') then
    raise exception using errcode = '55000', message = 'Attempt terminal tidak dapat didiskualifikasi.';
  end if;
  if v_attempt.status = 'in_progress' then v_attempt := public.reconcile_attempt_clock(p_attempt_id); end if;
  update public.attempts set status = 'disqualified', terminal_at = now(), resumed_at = null,
    connection_state = 'disconnected', disqualification_reason = btrim(p_reason), disqualified_by = auth.uid()
  where id = p_attempt_id returning * into v_attempt;
  insert into public.attempt_events(attempt_id, type, actor_id, metadata)
  values (p_attempt_id, 'disqualified', auth.uid(), jsonb_build_object('reason', btrim(p_reason)));
  perform public.write_audit('disqualify', 'attempt', p_attempt_id::text, null, jsonb_build_object('reason', btrim(p_reason)));
  return v_attempt;
end
$$;

create or replace function public.authorize_retake(p_assignment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt public.attempts%rowtype;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception using errcode = '23514', message = 'Alasan retake wajib diisi.'; end if;
  select * into v_attempt from public.attempts
  where assignment_id = p_assignment_id and is_current for update;
  if not found or v_attempt.status in ('in_progress', 'paused_disconnected') then
    raise exception using errcode = '55000', message = 'Attempt berjalan harus diselesaikan atau dibatalkan sebelum retake.';
  end if;
  update public.attempts set is_current = false where id = v_attempt.id;
  perform public.write_audit('authorize_retake', 'assignment', p_assignment_id::text,
    jsonb_build_object('previous_attempt_id', v_attempt.id), jsonb_build_object('reason', btrim(p_reason)));
end
$$;

create or replace function public.cancel_attempt(p_attempt_id uuid, p_reason text)
returns public.attempts
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt public.attempts%rowtype;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception using errcode = '23514', message = 'Alasan pembatalan wajib diisi.'; end if;
  select * into v_attempt from public.attempts where id = p_attempt_id for update;
  if v_attempt.status not in ('in_progress', 'paused_disconnected') then
    raise exception using errcode = '55000', message = 'Hanya attempt aktif yang dapat dibatalkan.';
  end if;
  if v_attempt.status = 'in_progress' then v_attempt := public.reconcile_attempt_clock(p_attempt_id); end if;
  update public.attempts set status = 'cancelled', terminal_at = now(), resumed_at = null,
    connection_state = 'disconnected', cancelled_reason = btrim(p_reason), cancelled_by = auth.uid()
  where id = p_attempt_id returning * into v_attempt;
  insert into public.attempt_events(attempt_id, type, actor_id, metadata)
  values (p_attempt_id, 'cancelled', auth.uid(), jsonb_build_object('reason', btrim(p_reason)));
  perform public.write_audit('cancel_attempt', 'attempt', p_attempt_id::text, null, jsonb_build_object('reason', btrim(p_reason)));
  return v_attempt;
end
$$;

create or replace function public.generate_leaderboard(
  p_exam_id uuid,
  p_segment_type public.leaderboard_segment,
  p_segment_value text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_version integer;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'Akses ditolak.'; end if;
  if (p_segment_type = 'all' and p_segment_value is not null)
    or (p_segment_type <> 'all' and nullif(btrim(p_segment_value), '') is null) then
    raise exception using errcode = '22023', message = 'Nilai segmentasi tidak valid.';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.leaderboards
  where exam_id = p_exam_id and segment_type = p_segment_type and segment_value is not distinct from p_segment_value;
  insert into public.leaderboards(exam_id, segment_type, segment_value, version, generated_by)
  values (p_exam_id, p_segment_type, p_segment_value, v_version, auth.uid()) returning id into v_id;

  insert into public.leaderboard_entries(
    leaderboard_id, attempt_id, student_id, student_name_snapshot, rank,
    score, active_duration_seconds, submitted_at
  )
  select v_id, ranked.attempt_id, ranked.student_id, ranked.name,
    rank() over (order by ranked.score desc, ranked.active_elapsed_seconds asc, ranked.submitted_at asc)::integer,
    ranked.score, ranked.active_elapsed_seconds, ranked.submitted_at
  from (
    select a.id attempt_id, s.id student_id, s.name, a.score, a.active_elapsed_seconds, a.submitted_at
    from public.attempts a
    join public.exam_assignments ea on ea.id = a.assignment_id
    join public.students s on s.id = ea.student_id
    join public.exam_versions ev on ev.id = a.exam_version_id
    where ea.exam_id = p_exam_id and a.is_current
      and a.status in ('submitted', 'time_expired')
      and ((ev.grading_mode = 'instant_result' and a.grading_status = 'auto_scored')
        or (ev.grading_mode = 'manual_review' and a.grading_status = 'released'))
      and a.score is not null and a.submitted_at is not null
      and (p_segment_type = 'all'
        or (p_segment_type = 'level' and s.level::text = p_segment_value)
        or (p_segment_type = 'phase' and s.phase::text = p_segment_value)
        or (p_segment_type = 'grade' and s.grade::text = p_segment_value))
  ) ranked;
  perform public.write_audit('generate_leaderboard', 'leaderboard', v_id::text, null,
    jsonb_build_object('exam_id', p_exam_id, 'segment_type', p_segment_type, 'segment_value', p_segment_value, 'version', v_version));
  return v_id;
end
$$;

create or replace function public.manage_admin_account(
  p_user_id uuid,
  p_role public.app_role,
  p_status public.account_status,
  p_username text,
  p_display_name text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare v_profile public.profiles%rowtype;
begin
  if not public.is_super_admin() then raise exception using errcode = '42501', message = 'Akses super admin diperlukan.'; end if;
  if p_role not in ('admin', 'super_admin') then raise exception using errcode = '22023', message = 'Role akun admin tidak valid.'; end if;
  if p_user_id = auth.uid() and (p_role <> 'super_admin' or p_status <> 'active') then
    raise exception using errcode = '55000', message = 'Super admin tidak dapat menonaktifkan atau menurunkan role dirinya sendiri.';
  end if;
  if exists (select 1 from public.students where auth_user_id = p_user_id) then
    raise exception using errcode = '55000', message = 'Akun peserta tidak dapat dipromosikan menjadi admin.';
  end if;
  update public.profiles
  set role = p_role, status = p_status, username = nullif(btrim(p_username), '')::extensions.citext,
      display_name = btrim(p_display_name)
  where id = p_user_id returning * into v_profile;
  if not found then raise exception using errcode = 'P0002', message = 'Profile user tidak ditemukan.'; end if;
  perform public.write_audit('manage_admin', 'profile', p_user_id::text, null,
    jsonb_build_object('role', p_role, 'status', p_status, 'username', p_username));
  return v_profile;
end
$$;

create or replace function public.generate_student_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i integer;
begin
  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, (get_byte(extensions.gen_random_bytes(1), 0) % length(v_alphabet)) + 1, 1);
    end loop;
    exit when not exists (
      select 1 from public.student_credentials sc
      where sc.code_lookup = extensions.digest(convert_to(v_code, 'UTF8'), 'sha256') and sc.revoked_at is null
    );
  end loop;
  return v_code;
end
$$;

create or replace function public.rotate_student_code(p_student_id uuid, p_actor_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_code text;
begin
  if not exists (
    select 1 from public.profiles where id = p_actor_id and role in ('admin','super_admin') and status = 'active'
  ) then raise exception using errcode = '42501', message = 'Aktor admin tidak valid.'; end if;
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception using errcode = 'P0002', message = 'Peserta tidak ditemukan.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text, 0));
  v_code := public.generate_student_code();
  update public.student_credentials set revoked_at = now(), revoked_by = p_actor_id
  where student_id = p_student_id and revoked_at is null;
  insert into public.student_credentials(student_id, code_lookup, code_hash, code_hint, created_by)
  values (
    p_student_id,
    extensions.digest(convert_to(v_code, 'UTF8'), 'sha256'),
    extensions.crypt(v_code, extensions.gen_salt('bf', 12)),
    right(v_code, 2),
    p_actor_id
  );
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
  values (p_actor_id, 'rotate_code', 'student', p_student_id::text, jsonb_build_object('code_hint', right(v_code, 2)));
  return v_code;
end
$$;

create or replace function public.verify_student_code(p_code text)
returns table(student_id uuid, auth_user_id uuid, student_name text)
language sql
security definer
set search_path = ''
as $$
  select s.id, s.auth_user_id, s.name
  from public.student_credentials sc
  join public.students s on s.id = sc.student_id
  join public.profiles p on p.id = s.auth_user_id
  where sc.code_lookup = extensions.digest(convert_to(upper(btrim(p_code)), 'UTF8'), 'sha256')
    and extensions.crypt(upper(btrim(p_code)), sc.code_hash) = sc.code_hash
    and sc.revoked_at is null and sc.active_at <= now()
    and (sc.expires_at is null or sc.expires_at > now())
    and s.status = 'active' and p.status = 'active'
  limit 1
$$;

create or replace function public.student_login_is_rate_limited(p_code text, p_ip_hash bytea)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select coalesce((select (value #>> '{}')::integer from public.system_settings where key = 'student_login.max_attempts_per_15_minutes'), 10) max_attempts
  )
  select (
    select count(*) from public.student_login_attempts attempts
    where attempts.attempted_at >= now() - interval '15 minutes'
      and not attempts.succeeded
      and (
        attempts.ip_hash = p_ip_hash
        or attempts.code_lookup = extensions.digest(convert_to(upper(btrim(p_code)), 'UTF8'), 'sha256')
      )
  ) >= settings.max_attempts
  from settings
$$;

-- Helpers used by storage policies; invalid path components safely return NULL.
create or replace function public.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin return p_value::uuid; exception when invalid_text_representation then return null; end
$$;

revoke all on function public.current_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.current_student_id() from public;
revoke all on function public.student_owns_attempt(uuid) from public;
revoke all on function public.reconcile_attempt_clock(uuid) from public;
revoke all on function public.finalize_attempt(uuid, public.attempt_status) from public;
revoke all on function public.pause_stale_attempts() from public;
revoke all on function public.write_audit(text,text,text,jsonb,jsonb) from public;
revoke all on function public.create_exam_draft(uuid) from public;
revoke all on function public.publish_exam(uuid) from public;
revoke all on function public.start_exam_attempt(uuid,uuid,uuid) from public;
revoke all on function public.heartbeat_attempt(uuid,uuid,bigint,text) from public;
revoke all on function public.save_attempt_answer(uuid,uuid,uuid,text,integer,uuid) from public;
revoke all on function public.submit_attempt(uuid) from public;
revoke all on function public.review_attempt_question(uuid,uuid,public.answer_verdict,integer,text) from public;
revoke all on function public.release_attempt_result(uuid) from public;
revoke all on function public.release_exam_results(uuid) from public;
revoke all on function public.disqualify_attempt(uuid,text) from public;
revoke all on function public.authorize_retake(uuid,text) from public;
revoke all on function public.cancel_attempt(uuid,text) from public;
revoke all on function public.generate_leaderboard(uuid,public.leaderboard_segment,text) from public;
revoke all on function public.manage_admin_account(uuid,public.app_role,public.account_status,text,text) from public;
revoke all on function public.generate_student_code() from public;
revoke all on function public.rotate_student_code(uuid,uuid) from public;
revoke all on function public.verify_student_code(text) from public;
revoke all on function public.student_login_is_rate_limited(text,bytea) from public;

grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.student_owns_attempt(uuid) to authenticated;
grant execute on function public.create_exam_draft(uuid) to authenticated;
grant execute on function public.publish_exam(uuid) to authenticated;
grant execute on function public.start_exam_attempt(uuid,uuid,uuid) to authenticated;
grant execute on function public.heartbeat_attempt(uuid,uuid,bigint,text) to authenticated;
grant execute on function public.save_attempt_answer(uuid,uuid,uuid,text,integer,uuid) to authenticated;
grant execute on function public.submit_attempt(uuid) to authenticated;
grant execute on function public.review_attempt_question(uuid,uuid,public.answer_verdict,integer,text) to authenticated;
grant execute on function public.release_attempt_result(uuid) to authenticated;
grant execute on function public.release_exam_results(uuid) to authenticated;
grant execute on function public.disqualify_attempt(uuid,text) to authenticated;
grant execute on function public.authorize_retake(uuid,text) to authenticated;
grant execute on function public.cancel_attempt(uuid,text) to authenticated;
grant execute on function public.generate_leaderboard(uuid,public.leaderboard_segment,text) to authenticated;
grant execute on function public.manage_admin_account(uuid,public.app_role,public.account_status,text,text) to authenticated;
grant execute on function public.normalize_short_answer(text) to authenticated, service_role;
grant execute on function public.normalize_numeric_answer(text) to authenticated, service_role;
grant execute on function public.try_uuid(text) to authenticated;
grant execute on function public.pause_stale_attempts() to service_role;
grant execute on function public.rotate_student_code(uuid,uuid) to service_role;
grant execute on function public.verify_student_code(text) to service_role;
grant execute on function public.student_login_is_rate_limited(text,bytea) to service_role;

commit;
