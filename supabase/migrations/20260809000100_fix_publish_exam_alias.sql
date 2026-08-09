-- Perbaiki alias validasi pada publish_exam untuk database yang sudah berjalan.
-- Sebelumnya query luar mereferensikan q.position, padahal alias q hanya
-- tersedia di dalam subquery.
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
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Akses ditolak.';
  end if;

  select * into v_exam
  from public.exams
  where id = p_exam_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Ujian tidak ditemukan.';
  end if;

  select * into v_version
  from public.exam_versions
  where exam_id = p_exam_id and status = 'draft'
  for update;
  if not found then
    raise exception using errcode = '55000', message = 'Draft ujian tidak ditemukan.';
  end if;

  if not exists (
    select 1
    from public.questions
    where exam_version_id = v_version.id
  ) then
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
        when q.type = 'multiple_choice'
          and (
            select count(*)
            from public.question_options qo
            where qo.question_id = q.id
          ) not between 2 and 8
          then 'pilihan ganda harus memiliki 2-8 opsi'
        when q.type = 'multiple_choice'
          and not exists (
            select 1
            from public.question_option_keys k
            where k.question_id = q.id
          )
          then 'kunci pilihan ganda belum dipilih'
        when q.type in ('numeric', 'short_text')
          and v_version.grading_mode = 'instant_result'
          and not exists (
            select 1
            from public.accepted_answers aa
            where aa.question_id = q.id
          )
          then 'accepted answer wajib diisi untuk mode nilai langsung'
        when q.type = 'long_text'
          and v_version.grading_mode = 'instant_result'
          then 'isian panjang tidak diizinkan pada mode nilai langsung'
      end as problem
    from public.questions q
    where q.exam_version_id = v_version.id
  ) validation
  where validation.problem is not null;

  if v_error is not null then
    raise exception using errcode = '23514', message = v_error;
  end if;

  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'version', to_jsonb(v_version) - array['snapshot_hash', 'updated_at'],
          'questions', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'question', to_jsonb(q),
                'options', coalesce((
                  select jsonb_agg(to_jsonb(qo) order by qo.position)
                  from public.question_options qo
                  where qo.question_id = q.id
                ), '[]'::jsonb),
                'option_key', (
                  select to_jsonb(k)
                  from public.question_option_keys k
                  where k.question_id = q.id
                ),
                'accepted_answers', coalesce((
                  select jsonb_agg(to_jsonb(aa) order by aa.id)
                  from public.accepted_answers aa
                  where aa.question_id = q.id
                ), '[]'::jsonb)
              )
              order by q.position
            )
            from public.questions q
            where q.exam_version_id = v_version.id
          ), '[]'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into v_hash;

  update public.exam_versions
  set status = 'superseded'
  where exam_id = p_exam_id
    and status = 'published'
    and id <> v_version.id;

  update public.exam_versions
  set status = 'published',
      published_by = auth.uid(),
      published_at = now(),
      snapshot_hash = v_hash
  where id = v_version.id
  returning * into v_version;

  update public.exams
  set status = 'published', current_version = v_version.version
  where id = p_exam_id;

  perform public.write_audit(
    'publish',
    'exam',
    p_exam_id::text,
    null,
    jsonb_build_object(
      'version', v_version.version,
      'snapshot_hash', v_hash
    )
  );
  return v_version;
end
$$;
