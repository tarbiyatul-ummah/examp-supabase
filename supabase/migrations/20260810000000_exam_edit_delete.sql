-- Atomic exam editing and safe deletion.

begin;

create or replace function public.replace_exam_draft_questions(
  p_exam_id uuid,
  p_questions jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_question jsonb;
  v_option jsonb;
  v_answer jsonb;
  v_question_id uuid;
  v_option_id uuid;
  v_correct_option_id uuid;
  v_type public.question_type;
  v_position integer := 0;
  v_option_position integer;
  v_correct_count integer;
  v_raw_answer text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Akses ditolak.';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array'
    or jsonb_array_length(p_questions) = 0 then
    raise exception using errcode = '23514', message = 'Ujian harus memiliki minimal satu soal.';
  end if;

  select ev.id into v_version_id
  from public.exam_versions ev
  where ev.exam_id = p_exam_id and ev.status = 'draft'
  for update;
  if not found then
    raise exception using errcode = '55000', message = 'Draft ujian tidak ditemukan.';
  end if;

  delete from public.questions where exam_version_id = v_version_id;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    v_position := v_position + 1;
    begin
      v_type := (v_question ->> 'type')::public.question_type;
    exception when others then
      raise exception using errcode = '23514', message = format('Tipe soal %s tidak valid.', v_position);
    end;

    insert into public.questions (
      exam_version_id, type, content_doc, weight, position, shuffle_options
    ) values (
      v_version_id,
      v_type,
      coalesce(v_question -> 'contentDoc', '{"type":"doc","content":[]}'::jsonb),
      coalesce((v_question ->> 'weight')::numeric, 1),
      v_position,
      coalesce((v_question ->> 'shuffleOptions')::boolean, false)
    ) returning id into v_question_id;

    if v_type = 'multiple_choice' then
      if jsonb_typeof(coalesce(v_question -> 'options', '[]'::jsonb)) <> 'array'
        or jsonb_array_length(coalesce(v_question -> 'options', '[]'::jsonb)) not between 2 and 8 then
        raise exception using errcode = '23514', message = format('Soal %s harus memiliki 2-8 pilihan.', v_position);
      end if;
      v_option_position := 0;
      v_correct_count := 0;
      v_correct_option_id := null;
      for v_option in
        select value from jsonb_array_elements(coalesce(v_question -> 'options', '[]'::jsonb))
      loop
        v_option_position := v_option_position + 1;
        insert into public.question_options (question_id, content_doc, position)
        values (
          v_question_id,
          coalesce(v_option -> 'contentDoc', '{"type":"doc","content":[]}'::jsonb),
          v_option_position
        ) returning id into v_option_id;
        if coalesce((v_option ->> 'isCorrect')::boolean, false) then
          v_correct_count := v_correct_count + 1;
          v_correct_option_id := v_option_id;
        end if;
      end loop;
      if v_correct_count <> 1 then
        raise exception using errcode = '23514', message = format('Soal %s harus memiliki tepat satu jawaban benar.', v_position);
      end if;
      insert into public.question_option_keys (question_id, correct_option_id)
      values (v_question_id, v_correct_option_id);
    elsif v_type in ('numeric', 'short_text') then
      for v_answer in
        select value from jsonb_array_elements(coalesce(v_question -> 'acceptedAnswers', '[]'::jsonb))
      loop
        v_raw_answer := btrim(v_answer ->> 'raw');
        if coalesce(length(v_raw_answer), 0) > 0 then
          insert into public.accepted_answers (
            question_id, answer_type, raw_answer, normalized_answer
          ) values (
            v_question_id,
            case when v_type = 'numeric'
              then 'numeric'::public.accepted_answer_type
              else 'short_text'::public.accepted_answer_type end,
            v_raw_answer,
            case when v_type = 'numeric'
              then public.normalize_numeric_answer(v_raw_answer)
              else public.normalize_short_answer(v_raw_answer) end
          );
        end if;
      end loop;
    end if;
  end loop;

  perform public.write_audit(
    'replace_questions', 'exam', p_exam_id::text, null,
    jsonb_build_object('question_count', v_position)
  );
  return v_position;
end
$$;

-- Published versions remain immutable during direct deletion, but may be
-- removed as part of deleting their parent exam.
create or replace function public.protect_published_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft'
      and coalesce(current_setting('app.deleting_exam', true), '') <> old.exam_id::text then
      raise exception using errcode = '55000', message = 'Versi ujian yang telah dipublish bersifat immutable.';
    end if;
    return old;
  end if;
  if old.status = 'published' and new.status = 'superseded'
    and (to_jsonb(new) - array['status','updated_at']) = (to_jsonb(old) - array['status','updated_at']) then
    return new;
  end if;
  if old.status <> 'draft' then
    raise exception using errcode = '55000', message = 'Versi ujian yang telah dipublish bersifat immutable.';
  end if;
  return new;
end
$$;

create or replace function public.delete_exam(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_media_paths text[];
  v_export_paths text[];
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Akses ditolak.';
  end if;
  perform 1 from public.exams where id = p_exam_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Ujian tidak ditemukan.';
  end if;
  if exists (
    select 1 from public.attempts a
    join public.exam_assignments ea on ea.id = a.assignment_id
    where ea.exam_id = p_exam_id
  ) then
    raise exception using
      errcode = '55000',
      message = 'Ujian yang sudah memiliki attempt tidak dapat dihapus.';
  end if;

  select coalesce(array_agg(ma.object_path), '{}'::text[]) into v_media_paths
  from public.media_assets ma
  join public.exam_versions ev on ev.id = ma.exam_version_id
  where ev.exam_id = p_exam_id;

  select coalesce(array_agg(ej.object_path), '{}'::text[]) into v_export_paths
  from public.export_jobs ej
  where ej.exam_id = p_exam_id and ej.object_path is not null;

  perform set_config('app.deleting_exam', p_exam_id::text, true);
  delete from public.export_jobs where exam_id = p_exam_id;
  delete from public.leaderboards where exam_id = p_exam_id;
  delete from public.exams where id = p_exam_id;
  return jsonb_build_object(
    'questionMedia', to_jsonb(v_media_paths),
    'exports', to_jsonb(v_export_paths)
  );
end
$$;

create or replace function public.replace_exam_assignments(
  p_exam_id uuid,
  p_student_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_revoked integer;
  v_assigned integer;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Akses ditolak.';
  end if;
  if not exists (select 1 from public.exams where id = p_exam_id) then
    raise exception using errcode = 'P0002', message = 'Ujian tidak ditemukan.';
  end if;
  select coalesce(array_agg(distinct requested.id), '{}'::uuid[]) into v_ids
  from unnest(coalesce(p_student_ids, '{}'::uuid[])) as requested(id);
  if exists (
    select 1 from unnest(v_ids) requested(id)
    left join public.students s on s.id = requested.id and s.status = 'active'
    where s.id is null
  ) then
    raise exception using errcode = '23503', message = 'Salah satu peserta tidak ditemukan atau tidak aktif.';
  end if;

  update public.exam_assignments
  set revoked_at = now(), revoked_by = auth.uid()
  where exam_id = p_exam_id
    and revoked_at is null
    and not (student_id = any(v_ids));
  get diagnostics v_revoked = row_count;

  insert into public.exam_assignments (exam_id, student_id, assigned_by)
  select p_exam_id, requested.id, auth.uid()
  from unnest(v_ids) requested(id)
  where not exists (
    select 1 from public.exam_assignments ea
    where ea.exam_id = p_exam_id
      and ea.student_id = requested.id
      and ea.revoked_at is null
  );
  get diagnostics v_assigned = row_count;
  return jsonb_build_object('assigned', v_assigned, 'revoked', v_revoked);
end
$$;

revoke all on function public.replace_exam_draft_questions(uuid, jsonb) from public;
revoke all on function public.delete_exam(uuid) from public;
revoke all on function public.replace_exam_assignments(uuid, uuid[]) from public;
grant execute on function public.replace_exam_draft_questions(uuid, jsonb) to authenticated;
grant execute on function public.delete_exam(uuid) to authenticated;
grant execute on function public.replace_exam_assignments(uuid, uuid[]) to authenticated;

commit;
