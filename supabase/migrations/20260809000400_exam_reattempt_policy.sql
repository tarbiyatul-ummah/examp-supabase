-- Per-exam policy for allowing a student to start a new attempt after a
-- normally completed attempt. Previous attempts remain available as history.
alter table public.exams
  add column if not exists allow_reattempt boolean not null default false;

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
  v_current_attempt public.attempts%rowtype;
  v_allow_reattempt boolean;
begin
  if v_student_id is null then
    raise exception using errcode = '42501', message = 'Akses peserta ditolak.';
  end if;

  select * into v_assignment
  from public.exam_assignments
  where exam_id = p_exam_id
    and student_id = v_student_id
    and revoked_at is null
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Peserta tidak memiliki assignment ujian ini.';
  end if;

  -- A retried HTTP request must always resolve to the attempt created by the
  -- original request, even after that attempt is no longer current.
  select a.id into v_attempt_id
  from public.attempts a
  where a.assignment_id = v_assignment.id
    and a.idempotency_key = p_idempotency_key;
  if v_attempt_id is not null then
    return v_attempt_id;
  end if;

  select * into v_current_attempt
  from public.attempts
  where assignment_id = v_assignment.id
    and is_current
  for update;

  if found then
    select allow_reattempt into v_allow_reattempt
    from public.exams
    where id = p_exam_id;

    if coalesce(v_allow_reattempt, false)
      and v_current_attempt.status in ('submitted', 'time_expired') then
      update public.attempts
      set is_current = false
      where id = v_current_attempt.id;
    else
      return v_current_attempt.id;
    end if;
  end if;

  select ev.* into v_version
  from public.exam_versions ev
  join public.exams e on e.id = ev.exam_id
  where ev.exam_id = p_exam_id
    and ev.status = 'published'
    and e.status = 'published';
  if not found then
    raise exception using errcode = '55000', message = 'Ujian belum tersedia.';
  end if;

  select coalesce(max(attempt_no), 0) + 1 into v_attempt_no
  from public.attempts
  where assignment_id = v_assignment.id;

  insert into public.attempts(
    assignment_id,
    exam_version_id,
    attempt_no,
    idempotency_key,
    duration_seconds,
    resumed_at,
    last_heartbeat_at,
    controller_session_id
  ) values (
    v_assignment.id,
    v_version.id,
    v_attempt_no,
    p_idempotency_key,
    v_version.duration_seconds,
    now(),
    now(),
    p_controller_session_id
  )
  returning id into v_attempt_id;

  insert into public.attempt_questions(
    attempt_id,
    question_id,
    display_order,
    option_order
  )
  select
    v_attempt_id,
    shuffled.id,
    row_number() over (order by shuffled.sort_key, shuffled.position)::integer,
    case when shuffled.shuffle_options then
      coalesce((
        select array_agg(o.id order by gen_random_uuid())
        from public.question_options o
        where o.question_id = shuffled.id
      ), '{}'::uuid[])
    else
      coalesce((
        select array_agg(o.id order by o.position)
        from public.question_options o
        where o.question_id = shuffled.id
      ), '{}'::uuid[])
    end
  from (
    select
      q.*,
      case when v_version.shuffle_questions then gen_random_uuid() end as sort_key
    from public.questions q
    where q.exam_version_id = v_version.id
  ) shuffled;

  insert into public.attempt_question_results(attempt_id, question_id, weight)
  select v_attempt_id, aq.question_id, q.weight
  from public.attempt_questions aq
  join public.questions q on q.id = aq.question_id
  where aq.attempt_id = v_attempt_id;

  update public.exam_assignments
  set started_at = coalesce(started_at, now())
  where id = v_assignment.id;

  insert into public.attempt_events(
    attempt_id,
    type,
    actor_id,
    controller_session_id
  )
  values (v_attempt_id, 'started', auth.uid(), p_controller_session_id);

  return v_attempt_id;
end
$$;

revoke all on function public.start_exam_attempt(uuid, uuid, uuid) from public;
grant execute on function public.start_exam_attempt(uuid, uuid, uuid) to authenticated;
