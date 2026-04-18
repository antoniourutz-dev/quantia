create or replace function public.get_user_question_friction(
  p_user_id uuid,
  p_curriculum text,
  p_limit int default 20
)
returns table (
  question_id text,
  curriculum text,
  prompt text,
  topic text,
  attempts_total int,
  wrong_total int,
  correct_total int,
  error_rate numeric,
  wrong_streak int,
  repeat_wrong_count int,
  simulacro_wrong_count int,
  normal_wrong_count int,
  last_seen_at timestamptz,
  last_wrong_at timestamptz,
  friction_score numeric,
  primary_tag text
)
language sql
security definer
set search_path = public, app
as $$
with base_sessions as (
  select ps.*
  from app.practice_sessions ps
  where auth.uid() = p_user_id
    and coalesce(
    to_jsonb(ps)->>'user_id',
    to_jsonb(ps)->>'auth_user_id',
    to_jsonb(ps)->>'student_id',
    to_jsonb(ps)->>'uid'
  ) = p_user_id::text
    and replace(lower(trim(coalesce(
      to_jsonb(ps)->>'curriculum',
      to_jsonb(ps)->>'curriculum_key',
      to_jsonb(ps)->>'curriculum_slug',
      to_jsonb(ps)->>'opposition_key',
      to_jsonb(ps)->>'opposition'
    ))), '-', '_') = replace(lower(trim(coalesce(p_curriculum, ''))), '-', '_')
),
raw_attempts as (
  select
    coalesce(a.value->>'question_id', a.value->>'questionId', a.value->>'id') as question_id,
    coalesce(nullif(a.value->>'statement', ''), nullif(a.value->>'question_text', '')) as statement,
    nullif(a.value->>'category', '') as topic,
    coalesce(nullif(a.value->>'answered_at', '')::timestamptz, now()) as answered_at,
    coalesce((a.value->>'is_correct')::boolean, false) as is_correct,
    lower(coalesce(nullif(a.value->>'mode', ''), to_jsonb(bs)->>'mode', 'standard')) as mode
  from base_sessions bs
  cross join lateral jsonb_array_elements(
    coalesce(
      to_jsonb(bs)->'attempts',
      to_jsonb(bs)->'attempt_rows',
      to_jsonb(bs)->'attempts_json',
      to_jsonb(bs)->'answers',
      '[]'::jsonb
    )
  ) as a(value)
  where coalesce(a.value->>'question_id', a.value->>'questionId', a.value->>'id', '') <> ''
),
attempts_with_seq as (
  select
    ra.*,
    row_number() over (partition by ra.question_id order by ra.answered_at desc) as rn_desc,
    lag(ra.is_correct) over (partition by ra.question_id order by ra.answered_at) as prev_is_correct
  from raw_attempts ra
),
attempts_with_cut as (
  select
    aws.*,
    min(case when aws.is_correct then aws.rn_desc end) over (partition by aws.question_id) as first_correct_desc
  from attempts_with_seq aws
),
agg as (
  select
    awc.question_id,
    count(*)::int as attempts_total,
    count(*) filter (where not awc.is_correct)::int as wrong_total,
    count(*) filter (where awc.is_correct)::int as correct_total,
    count(*) filter (where not awc.is_correct and awc.mode = 'simulacro')::int as simulacro_wrong_count,
    count(*) filter (where not awc.is_correct and awc.mode <> 'simulacro')::int as normal_wrong_count,
    count(*) filter (where not awc.is_correct and awc.prev_is_correct = false)::int as repeat_wrong_count,
    count(*) filter (
      where not awc.is_correct and (
        awc.first_correct_desc is null or awc.rn_desc < awc.first_correct_desc
      )
    )::int as wrong_streak,
    max(awc.answered_at) as last_seen_at,
    max(awc.answered_at) filter (where not awc.is_correct) as last_wrong_at,
    max(awc.statement) filter (where awc.statement is not null) as prompt_from_attempt,
    max(awc.topic) filter (where awc.topic is not null) as topic_from_attempt
  from attempts_with_cut awc
  group by awc.question_id
),
with_question as (
  select
    a.*,
    coalesce(nullif(p.pregunta, ''), a.prompt_from_attempt, concat('Pregunta ', a.question_id)) as prompt,
    coalesce(nullif(p.temario_pregunta, ''), a.topic_from_attempt) as topic
  from agg a
  left join public.preguntas p on p.id::text = a.question_id
),
scored as (
  select
    wq.*,
    case when wq.attempts_total > 0 then (wq.wrong_total::numeric / wq.attempts_total::numeric) else 0::numeric end as error_rate,
    case
      when wq.last_wrong_at is null then 0::numeric
      when wq.last_wrong_at >= now() - interval '7 days' then 3::numeric
      when wq.last_wrong_at >= now() - interval '21 days' then 1::numeric
      else 0::numeric
    end as recency_boost
  from with_question wq
)
select
  s.question_id,
  p_curriculum as curriculum,
  s.prompt,
  s.topic,
  s.attempts_total,
  s.wrong_total,
  s.correct_total,
  round(s.error_rate, 4) as error_rate,
  s.wrong_streak,
  s.repeat_wrong_count,
  s.simulacro_wrong_count,
  s.normal_wrong_count,
  s.last_seen_at,
  s.last_wrong_at,
  round(
    (s.repeat_wrong_count * 4)::numeric
    + (s.wrong_streak * 3)::numeric
    + (s.error_rate * 10)
    + (s.simulacro_wrong_count * 2)::numeric
    + s.recency_boost,
    4
  ) as friction_score,
  (
    case
      when s.repeat_wrong_count >= 2 or s.wrong_streak >= 2 then 'repeated_error'
      when s.simulacro_wrong_count >= 2 and s.simulacro_wrong_count > s.normal_wrong_count then 'pressure_trouble'
      when s.last_wrong_at is not null and s.last_wrong_at >= now() - interval '14 days' and s.wrong_total >= 2 then 'recent_trouble'
      when s.error_rate >= 0.35 and s.attempts_total >= 3 then 'memory_fragile'
      else 'mixed'
    end
  ) as primary_tag
from scored s
where s.attempts_total >= 2
order by friction_score desc, s.last_wrong_at desc nulls last, s.question_id asc
limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

grant execute on function public.get_user_question_friction(uuid, text, int) to authenticated;
