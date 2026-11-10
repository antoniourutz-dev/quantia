create or replace function app.get_challenge_question_energy(p_question_ids text[])
returns table (question_id text, attempts integer, correct integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with requested as (
    select distinct id
    from unnest(p_question_ids) as q(id)
    where id is not null and cardinality(p_question_ids) <= 500
  ),
  saved as materialized (
    select e.question_id, e.session_id::text as session_id, e.answered_at,
           e.is_correct, 's:' || e.id::text as event_key
    from app.question_attempt_events e
    join requested q on q.id = e.question_id
    where e.user_id = (select auth.uid())
      and e.answered_at is not null and e.is_correct is not null
  ),
  answers as (
    select question_id, answered_at, is_correct, event_key from saved
    union all
    select a.question_id, a.answered_at, a.is_correct, 'a:' || a.event_id
    from public.user_question_activity a
    join requested q on q.id = a.question_id
    where a.user_id = (select auth.uid())
      and a.answered_at is not null and a.is_correct is not null
      and not exists (
        select 1 from saved s
        where s.session_id = a.session_id and s.question_id = a.question_id
      )
  ),
  ranked as (
    select question_id, is_correct,
           row_number() over (partition by question_id order by answered_at desc, event_key desc) as rank
    from answers
  )
  select question_id, count(*)::integer as attempts, count(*) filter (where is_correct)::integer as correct
  from ranked
  where rank <= 3
  group by question_id;
$$;

revoke all on function app.get_challenge_question_energy(text[]) from public, anon;
grant execute on function app.get_challenge_question_energy(text[]) to authenticated;
