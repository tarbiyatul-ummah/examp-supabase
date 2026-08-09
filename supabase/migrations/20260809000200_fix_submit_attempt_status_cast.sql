-- PostgreSQL resolves a CASE made from string literals as text. Cast the
-- terminal status explicitly so finalize_attempt(uuid, attempt_status) is
-- selected instead of the nonexistent finalize_attempt(uuid, text).
create or replace function public.submit_attempt(p_attempt_id uuid)
returns public.attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.attempts%rowtype;
begin
  if not public.student_owns_attempt(p_attempt_id) then
    raise exception using errcode = '42501', message = 'Akses ditolak.';
  end if;

  select * into v_attempt
  from public.attempts
  where id = p_attempt_id;

  if v_attempt.status not in ('in_progress', 'paused_disconnected') then
    return v_attempt;
  end if;

  if v_attempt.status = 'in_progress' then
    v_attempt := public.reconcile_attempt_clock(p_attempt_id);
  end if;

  return public.finalize_attempt(
    p_attempt_id,
    (case
      when v_attempt.active_elapsed_seconds >= v_attempt.duration_seconds
        then 'time_expired'
      else 'submitted'
    end)::public.attempt_status
  );
end
$$;

revoke all on function public.submit_attempt(uuid) from public;
grant execute on function public.submit_attempt(uuid) to authenticated;
