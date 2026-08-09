-- A CASE expression made from string literals resolves to text. Cast the
-- emitted terminal event explicitly to attempt_event_type.
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

  select * into v_attempt
  from public.attempts
  where id = p_attempt_id
  for update;

  if v_attempt.status not in ('in_progress', 'paused_disconnected') then
    return v_attempt;
  end if;

  select grading_mode into v_mode
  from public.exam_versions
  where id = v_attempt.exam_version_id;

  update public.attempt_question_results r
  set answered = a.id is not null and (a.selected_option_id is not null or nullif(btrim(a.text_raw), '') is not null),
      suggested_verdict = case
        when q.type = 'multiple_choice' then
          case when a.selected_option_id = k.correct_option_id then 'correct'::public.answer_verdict else 'incorrect'::public.answer_verdict end
        when q.type in ('numeric', 'short_text') then
          case when exists (
            select 1
            from public.accepted_answers aa
            where aa.question_id = q.id
              and aa.normalized_answer = a.normalized_value
          ) then 'correct'::public.answer_verdict else 'incorrect'::public.answer_verdict end
        else null
      end,
      final_verdict = case when v_mode = 'instant_result' then
        case
          when q.type = 'multiple_choice' and a.selected_option_id = k.correct_option_id then 'correct'::public.answer_verdict
          when q.type in ('numeric', 'short_text') and exists (
            select 1
            from public.accepted_answers aa
            where aa.question_id = q.id
              and aa.normalized_answer = a.normalized_value
          ) then 'correct'::public.answer_verdict
          else 'incorrect'::public.answer_verdict
        end
        else null
      end,
      verdict_source = case when v_mode = 'instant_result' then 'automatic'::public.verdict_source else null end,
      decided_at = case when v_mode = 'instant_result' then now() else null end,
      decided_by = null
  from public.questions q
  left join public.answers a
    on a.attempt_id = p_attempt_id
   and a.question_id = q.id
  left join public.question_option_keys k
    on k.question_id = q.id
  where r.attempt_id = p_attempt_id
    and q.id = r.question_id;

  if v_mode = 'instant_result' then
    select
      sum(weight),
      sum(weight) filter (where final_verdict = 'correct'),
      count(*) filter (where final_verdict = 'correct'),
      count(*) filter (where final_verdict = 'incorrect' and answered),
      count(*) filter (where not answered)
    into v_total, v_correct, v_correct_count, v_incorrect_count, v_unanswered_count
    from public.attempt_question_results
    where attempt_id = p_attempt_id;

    update public.attempts
    set status = p_terminal_status,
        grading_status = 'auto_scored',
        active_elapsed_seconds = case when p_terminal_status = 'time_expired' then duration_seconds else active_elapsed_seconds end,
        resumed_at = null,
        submitted_at = now(),
        terminal_at = now(),
        connection_state = 'disconnected',
        score = round(coalesce(v_correct, 0) / nullif(v_total, 0) * 100, 2),
        correct_count = v_correct_count,
        incorrect_count = v_incorrect_count,
        unanswered_count = v_unanswered_count
    where id = p_attempt_id
    returning * into v_attempt;
  else
    update public.attempts
    set status = p_terminal_status,
        grading_status = 'pending_review',
        active_elapsed_seconds = case when p_terminal_status = 'time_expired' then duration_seconds else active_elapsed_seconds end,
        resumed_at = null,
        submitted_at = now(),
        terminal_at = now(),
        connection_state = 'disconnected'
    where id = p_attempt_id
    returning * into v_attempt;
  end if;

  insert into public.attempt_events(attempt_id, type, actor_id)
  values (
    p_attempt_id,
    (case
      when p_terminal_status = 'submitted' then 'submitted'
      else 'time_expired'
    end)::public.attempt_event_type,
    auth.uid()
  );

  return v_attempt;
end
$$;

revoke all on function public.finalize_attempt(uuid, public.attempt_status) from public;
grant execute on function public.finalize_attempt(uuid, public.attempt_status) to authenticated;
