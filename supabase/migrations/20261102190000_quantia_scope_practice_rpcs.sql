-- QUANTIA AUDIT 001 / ITERACION 003: cohort isolation and private analytics.
-- Staged only. DO NOT deploy before validating the shared Supabase consumers.
-- Original function signatures, result types, ordering and modes preserved.
-- Function bodies baselined from linked production catalog on 2026-11-02.
begin;

-- One server-side gate for privileged practice/readiness RPCs.
-- Restricted viewers use the RLS-filtered question bank, not SECURITY DEFINER RPCs.
create or replace function app.assert_full_practice_access(p_target_user uuid default null)
returns void
language plpgsql
stable
security invoker
set search_path to 'app', 'public', 'auth'
as $guard$
declare
  v_caller uuid := auth.uid();
begin
  -- Supabase Edge sync-practice-session invokes readiness RPCs with a
  -- server-only service_role JWT after persisting the student's attempts.
  -- Never block that trusted backend path or force a frontend user token.
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return;
  end if;
  if v_caller is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if public.is_restricted_question_bank_viewer() then
    raise exception 'restricted_viewer_cannot_use_practice_rpc' using errcode = '42501';
  end if;
  if p_target_user is not null
    and p_target_user <> v_caller
    and not app.is_admin() then
    raise exception 'cannot_access_another_students_progress' using errcode = '42501';
  end if;
end;
$guard$;
revoke execute on function app.assert_full_practice_access(uuid) from public, anon, authenticated;
grant execute on function app.assert_full_practice_access(uuid) to service_role;

-- get_anti_trap_batch
CREATE OR REPLACE FUNCTION app.get_anti_trap_batch(p_curriculum text DEFAULT 'general'::text, p_limit integer DEFAULT 20, p_question_scope text DEFAULT 'all'::text)
 RETURNS TABLE(payload jsonb, source_bucket text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
begin
  perform app.assert_full_practice_access();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  with risky_states as (
    select
      qs.question_id,
      'state'::text as source_bucket,
      row_number() over (
        order by qs.exam_retention_probability asc, qs.p_correct_estimated asc, qs.next_review_at asc nulls last
      ) as rn
    from app.user_question_state qs
    join public.preguntas p
      on coalesce(to_jsonb(p)->>'id', '') = qs.question_id
    where qs.user_id = v_user_id
      and qs.curriculum = v_curriculum
      and app.question_matches_scope(to_jsonb(p), p_question_scope)
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
      and (
        qs.dominant_error_type in (
          'plazo',
          'excepcion',
          'negacion',
          'literalidad',
          'distractor_cercano',
          'organo_competente',
          'confusion_entre_normas',
          'lectura_rapida',
          'sobreconfianza'
        )
        or (
          qs.mastery_level <= 1
          and app.is_anti_trap_question(to_jsonb(p))
        )
      )
  ),
  heuristic_questions as (
    select
      coalesce(to_jsonb(p)->>'id', '') as question_id,
      'heuristic'::text as source_bucket,
      row_number() over (
        order by
          case
            when trim(coalesce(to_jsonb(p)->>'numero', '')) ~ '^-?\d+$'
              then (to_jsonb(p)->>'numero')::integer
            else null
          end asc nulls last,
          coalesce(to_jsonb(p)->>'id', '')
      ) as rn
    from public.preguntas p
    where coalesce(to_jsonb(p)->>'id', '') <> ''
      and app.question_matches_scope(to_jsonb(p), p_question_scope)
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
      and app.is_anti_trap_question(to_jsonb(p))
  ),
  seed as (
    select rs.question_id, rs.source_bucket, rs.rn
    from risky_states rs
    where rs.rn <= ceil(v_limit * 0.7)::integer
    union all
    select hq.question_id, hq.source_bucket, 1000 + hq.rn
    from heuristic_questions hq
    where not exists (
      select 1
      from risky_states rs
      where rs.question_id = hq.question_id
    )
  )
  select
    to_jsonb(p) as payload,
    seed.source_bucket
  from seed
  join public.preguntas p
    on coalesce(to_jsonb(p)->>'id', '') = seed.question_id
  where app.question_matches_scope(to_jsonb(p), p_question_scope)
  order by seed.rn
  limit v_limit;
end;
$function$;

revoke execute on function app.get_anti_trap_batch(p_curriculum text, p_limit integer, p_question_scope text) from public, anon;
grant execute on function app.get_anti_trap_batch(p_curriculum text, p_limit integer, p_question_scope text) to authenticated, service_role;

-- get_category_risk_dashboard
CREATE OR REPLACE FUNCTION app.get_category_risk_dashboard(p_curriculum text DEFAULT 'general'::text, p_limit integer DEFAULT 5, p_question_scope text DEFAULT 'all'::text)
 RETURNS TABLE(category text, attempts bigint, incorrect_attempts bigint, raw_fail_rate numeric, smoothed_fail_rate numeric, baseline_fail_rate numeric, excess_risk numeric, sample_ok boolean, confidence_flag text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 12));
  v_question_scope text := coalesce(nullif(trim(p_question_scope), ''), 'all');
begin
  perform app.assert_full_practice_access();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  with visible_stats as (
    select
      coalesce(
        nullif(trim(qs.category), ''),
        nullif(trim(coalesce(
          to_jsonb(p)->>'category',
          to_jsonb(p)->>'tema',
          to_jsonb(p)->>'topic',
          to_jsonb(p)->>'subject',
          to_jsonb(p)->>'materia',
          to_jsonb(p)->>'subtema'
        )), ''),
        'Sin grupo'
      ) as category,
      qs.attempts::numeric as attempts,
      qs.incorrect_attempts::numeric as incorrect_attempts
    from app.practice_question_stats qs
    join public.preguntas p
      on coalesce(to_jsonb(p)->>'id', '') = qs.question_id
    where qs.user_id = v_user_id
      and qs.curriculum = v_curriculum
      and qs.attempts > 0
      and app.question_matches_scope(to_jsonb(p), v_question_scope)
  ),
  category_rollup as (
    select
      vs.category,
      sum(vs.attempts)::bigint as attempts,
      sum(vs.incorrect_attempts)::bigint as incorrect_attempts
    from visible_stats vs
    group by vs.category
  ),
  baseline as (
    select
      coalesce(
        sum(cr.incorrect_attempts)::numeric / nullif(sum(cr.attempts)::numeric, 0),
        0.25::numeric
      ) as baseline_fail_rate
    from category_rollup cr
  ),
  smoothing as (
    select
      b.baseline_fail_rate,
      greatest(1::numeric, b.baseline_fail_rate * 12.0) as alpha,
      greatest(1::numeric, (1 - b.baseline_fail_rate) * 12.0) as beta
    from baseline b
  )
  select
    cr.category,
    cr.attempts,
    cr.incorrect_attempts,
    round(
      coalesce(cr.incorrect_attempts::numeric / nullif(cr.attempts::numeric, 0), 0::numeric),
      4
    ) as raw_fail_rate,
    round(
      app.beta_smoothed_rate(
        cr.incorrect_attempts::numeric,
        cr.attempts::numeric,
        s.alpha,
        s.beta
      ),
      4
    ) as smoothed_fail_rate,
    round(s.baseline_fail_rate, 4) as baseline_fail_rate,
    round(
      app.beta_smoothed_rate(
        cr.incorrect_attempts::numeric,
        cr.attempts::numeric,
        s.alpha,
        s.beta
      ) - s.baseline_fail_rate,
      4
    ) as excess_risk,
    (cr.attempts >= 8) as sample_ok,
    app.resolve_confidence_flag(cr.attempts::integer, 8, 20) as confidence_flag
  from category_rollup cr
  cross join smoothing s
  order by excess_risk desc nulls last, attempts desc, category asc
  limit v_limit;
end;
$function$;

revoke execute on function app.get_category_risk_dashboard(p_curriculum text, p_limit integer, p_question_scope text) from public, anon;
grant execute on function app.get_category_risk_dashboard(p_curriculum text, p_limit integer, p_question_scope text) to authenticated, service_role;

-- get_law_practice_batch
CREATE OR REPLACE FUNCTION app.get_law_practice_batch(p_law text, p_curriculum text DEFAULT 'general'::text, p_batch_size integer DEFAULT 20)
 RETURNS TABLE(payload jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_batch_size, 20), 100));
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
begin
  perform app.assert_full_practice_access();
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  select to_jsonb(p) as payload
  from public.preguntas p
  where coalesce(to_jsonb(p)->>'id', '') <> ''
    and to_jsonb(p)->>'ley_referencia' = p_law
    and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
  order by random()
  limit v_limit;
end;
$function$;

revoke execute on function app.get_law_practice_batch(p_law text, p_curriculum text, p_batch_size integer) from public, anon;
grant execute on function app.get_law_practice_batch(p_law text, p_curriculum text, p_batch_size integer) to authenticated, service_role;

-- get_mixed_practice_batch
CREATE OR REPLACE FUNCTION app.get_mixed_practice_batch(p_curriculum text DEFAULT 'general'::text, p_batch_size integer DEFAULT 20, p_question_scope text DEFAULT 'all'::text)
 RETURNS TABLE(payload jsonb, source_bucket text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
  v_limit integer := greatest(1, least(coalesce(p_batch_size, 20), 100));
  v_target_overdue integer := ceil(v_limit * 0.5)::integer;
  v_target_fragile integer := floor(v_limit * 0.2)::integer;
  v_target_new integer := floor(v_limit * 0.2)::integer;
  v_target_maintenance integer := greatest(0, v_limit - v_target_overdue - v_target_fragile - v_target_new);
begin
  perform app.assert_full_practice_access();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  with overdue as (
    select
      qs.question_id,
      'overdue'::text as bucket,
      1 as bucket_priority,
      row_number() over (
        order by qs.next_review_at asc nulls last, qs.exam_retention_probability asc, qs.p_correct_estimated asc
      ) as rn
    from app.user_question_state qs
    join public.preguntas p
      on coalesce(to_jsonb(p)->>'id', '') = qs.question_id
    where qs.user_id = v_user_id
      and qs.curriculum = v_curriculum
      and qs.next_review_at is not null
      and qs.next_review_at <= timezone('utc', now())
      and app.question_matches_scope(to_jsonb(p), p_question_scope)
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
  ),
  fragile as (
    select
      qs.question_id,
      'fragile'::text as bucket,
      2 as bucket_priority,
      row_number() over (
        order by qs.p_correct_estimated asc, qs.exam_retention_probability asc, qs.next_review_at asc nulls last
      ) as rn
    from app.user_question_state qs
    join public.preguntas p
      on coalesce(to_jsonb(p)->>'id', '') = qs.question_id
    where qs.user_id = v_user_id
      and qs.curriculum = v_curriculum
      and qs.mastery_level <= 1
      and app.question_matches_scope(to_jsonb(p), p_question_scope)
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
      and not exists (
        select 1
        from overdue o
        where o.question_id = qs.question_id
      )
  ),
  new_questions as (
    select
      coalesce(to_jsonb(p)->>'id', '') as question_id,
      'new'::text as bucket,
      3 as bucket_priority,
      row_number() over (
        order by
          case
            when trim(coalesce(to_jsonb(p)->>'numero', '')) ~ '^-?\d+$'
              then (to_jsonb(p)->>'numero')::integer
            else null
          end asc nulls last,
          coalesce(to_jsonb(p)->>'id', '')
      ) as rn
    from public.preguntas p
    where coalesce(to_jsonb(p)->>'id', '') <> ''
      and app.question_matches_scope(to_jsonb(p), p_question_scope)
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
      and not exists (
        select 1
        from app.user_question_state qs
        where qs.user_id = v_user_id
          and qs.curriculum = v_curriculum
          and qs.question_id = coalesce(to_jsonb(p)->>'id', '')
      )
  ),
  maintenance as (
    select
      qs.question_id,
      'maintenance'::text as bucket,
      4 as bucket_priority,
      row_number() over (
        order by qs.exam_retention_probability asc, qs.p_correct_estimated asc, qs.next_review_at asc nulls last
      ) as rn
    from app.user_question_state qs
    join public.preguntas p
      on coalesce(to_jsonb(p)->>'id', '') = qs.question_id
    where qs.user_id = v_user_id
      and qs.curriculum = v_curriculum
      and qs.mastery_level >= 2
      and app.question_matches_scope(to_jsonb(p), p_question_scope)
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
      and not exists (
        select 1
        from overdue o
        where o.question_id = qs.question_id
      )
      and not exists (
        select 1
        from fragile f
        where f.question_id = qs.question_id
      )
  ),
  seed as (
    select question_id, bucket, bucket_priority, rn
    from overdue
    where rn <= v_target_overdue
    union all
    select question_id, bucket, bucket_priority, rn
    from fragile
    where rn <= v_target_fragile
    union all
    select question_id, bucket, bucket_priority, rn
    from new_questions
    where rn <= v_target_new
    union all
    select question_id, bucket, bucket_priority, rn
    from maintenance
    where rn <= v_target_maintenance
  ),
  all_candidates as (
    select question_id, bucket, bucket_priority, rn from overdue
    union all
    select question_id, bucket, bucket_priority, rn from fragile
    union all
    select question_id, bucket, bucket_priority, rn from new_questions
    union all
    select question_id, bucket, bucket_priority, rn from maintenance
  ),
  fill as (
    select
      ac.question_id,
      ac.bucket,
      ac.bucket_priority,
      row_number() over (order by ac.bucket_priority asc, ac.rn asc) as fill_rn
    from all_candidates ac
    where not exists (
      select 1
      from seed s
      where s.question_id = ac.question_id
    )
  ),
  final_selection as (
    select
      s.question_id,
      s.bucket,
      s.bucket_priority,
      s.rn as ordering
    from seed s
    union all
    select
      f.question_id,
      f.bucket,
      f.bucket_priority,
      1000 + f.fill_rn as ordering
    from fill f
    where f.fill_rn <= greatest(v_limit - (select count(*) from seed), 0)
  )
  select
    to_jsonb(p) as payload,
    fs.bucket as source_bucket
  from final_selection fs
  join public.preguntas p
    on coalesce(to_jsonb(p)->>'id', '') = fs.question_id
  where app.question_matches_scope(to_jsonb(p), p_question_scope)
    and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
  order by fs.ordering
  limit v_limit;
end;
$function$;

revoke execute on function app.get_mixed_practice_batch(p_curriculum text, p_batch_size integer, p_question_scope text) from public, anon;
grant execute on function app.get_mixed_practice_batch(p_curriculum text, p_batch_size integer, p_question_scope text) to authenticated, service_role;

-- get_practice_catalog_summary
CREATE OR REPLACE FUNCTION app.get_practice_catalog_summary(p_curriculum text DEFAULT 'general'::text, p_question_scope text DEFAULT 'all'::text)
 RETURNS TABLE(total_questions bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
begin
  perform app.assert_full_practice_access();
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  select count(*)::bigint as total_questions
  from public.preguntas p
  where coalesce(to_jsonb(p)->>'id', '') <> ''
    and app.question_matches_scope(to_jsonb(p), p_question_scope)
    and app.pregunta_row_matches_practice_curriculum(p, v_curriculum);
end;
$function$;

revoke execute on function app.get_practice_catalog_summary(p_curriculum text, p_question_scope text) from public, anon;
grant execute on function app.get_practice_catalog_summary(p_curriculum text, p_question_scope text) to authenticated, service_role;

-- get_random_practice_batch
CREATE OR REPLACE FUNCTION app.get_random_practice_batch(p_curriculum text DEFAULT 'general'::text, p_batch_size integer DEFAULT 20, p_question_scope text DEFAULT 'all'::text)
 RETURNS TABLE(payload jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_batch_size, 20), 100));
  v_seed text := md5(clock_timestamp()::text || random()::text || coalesce(p_curriculum, 'general') || ':' || coalesce(p_question_scope, 'all'));
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
begin
  perform app.assert_full_practice_access();
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  select to_jsonb(p) as payload
  from public.preguntas p
  where coalesce(to_jsonb(p)->>'id', '') <> ''
    and app.question_matches_scope(to_jsonb(p), p_question_scope)
    and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
  order by md5(to_jsonb(p)::text || ':' || v_seed)
  limit v_limit;
end;
$function$;

revoke execute on function app.get_random_practice_batch(p_curriculum text, p_batch_size integer, p_question_scope text) from public, anon;
grant execute on function app.get_random_practice_batch(p_curriculum text, p_batch_size integer, p_question_scope text) to authenticated, service_role;

-- get_readiness_dashboard
CREATE OR REPLACE FUNCTION app.get_readiness_dashboard(p_curriculum text DEFAULT 'general'::text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(total_questions integer, seen_questions integer, readiness numeric, readiness_lower numeric, readiness_upper numeric, projected_readiness numeric, overdue_count integer, backlog_count integer, fragile_count integer, consolidating_count integer, solid_count integer, mastered_count integer, new_count integer, recommended_review_count integer, recommended_new_count integer, recommended_today_count integer, recommended_mode text, focus_message text, daily_review_capacity integer, daily_new_capacity integer, exam_date date, risk_breakdown jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
begin
  perform app.assert_full_practice_access(p_user_id);
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  perform app.ensure_exam_target(v_user_id, v_curriculum);

  return query
  with target as (
    select
      et.exam_date,
      et.daily_review_capacity,
      et.daily_new_capacity,
      case
        when et.exam_date is null then null::numeric
        else greatest(0, (et.exam_date - timezone('utc', now())::date))::numeric
      end as days_to_exam
    from app.exam_targets et
    where et.user_id = v_user_id
      and et.curriculum = v_curriculum
    limit 1
  ),
  catalog as (
    select count(*)::integer as total_questions
    from public.preguntas p
    where coalesce(to_jsonb(p)->>'id', '') <> ''
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
  ),
  state_metrics as (
    select
      count(*)::integer as seen_questions,
      count(*) filter (
        where qs.next_review_at is not null
          and qs.next_review_at <= timezone('utc', now())
      )::integer as overdue_count,
      count(*) filter (where qs.mastery_level <= 1)::integer as fragile_count,
      count(*) filter (where qs.mastery_level = 2)::integer as consolidating_count,
      count(*) filter (where qs.mastery_level = 3)::integer as solid_count,
      count(*) filter (where qs.mastery_level >= 4)::integer as mastered_count,
      coalesce(
        sum(
          app.project_exam_retention_probability(
            qs.p_correct_estimated,
            qs.stability_score,
            target.days_to_exam
          )
        ),
        0::numeric
      ) as readiness_sum
    from app.user_question_state qs
    cross join target
    where qs.user_id = v_user_id
      and qs.curriculum = v_curriculum
  ),
  risk_summary as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'error_type', risk.error_type,
          'label',
            case risk.error_type
              when 'plazo' then 'Plazos'
              when 'excepcion' then 'Excepciones'
              when 'negacion' then 'Negaciones'
              when 'literalidad' then 'Literalidad'
              when 'organo_competente' then 'Organos'
              when 'distractor_cercano' then 'Distractores'
              when 'sobreconfianza' then 'Sobreconfianza'
              when 'lectura_rapida' then 'Lectura rapida'
              when 'confusion_entre_normas' then 'Normas'
              when 'procedimiento' then 'Procedimiento'
              when 'concepto' then 'Conceptos'
              when 'memoria_fragil' then 'Memoria fragil'
              else initcap(replace(risk.error_type, '_', ' '))
            end,
          'count', risk.risk_count
        )
        order by risk.risk_count desc, risk.error_type
      ),
      '[]'::jsonb
    ) as risk_breakdown
    from (
      select
        qs.dominant_error_type as error_type,
        count(*)::integer as risk_count
      from app.user_question_state qs
      where qs.user_id = v_user_id
        and qs.curriculum = v_curriculum
        and qs.dominant_error_type is not null
        and qs.mastery_level <= 2
      group by qs.dominant_error_type
      order by risk_count desc, qs.dominant_error_type
      limit 3
    ) risk
  ),
  composed as (
    select
      catalog.total_questions,
      state_metrics.seen_questions,
      greatest(catalog.total_questions - state_metrics.seen_questions, 0) as new_count,
      state_metrics.overdue_count,
      state_metrics.fragile_count,
      state_metrics.consolidating_count,
      state_metrics.solid_count,
      state_metrics.mastered_count,
      target.daily_review_capacity,
      target.daily_new_capacity,
      target.exam_date,
      risk_summary.risk_breakdown,
      case
        when catalog.total_questions <= 0 then 0.25::numeric
        else (
          state_metrics.readiness_sum +
          (greatest(catalog.total_questions - state_metrics.seen_questions, 0)::numeric * 0.25::numeric)
        ) / catalog.total_questions::numeric
      end as readiness_value
    from catalog
    cross join state_metrics
    cross join target
    cross join risk_summary
  )
  select
    composed.total_questions,
    composed.seen_questions,
    round(composed.readiness_value, 4) as readiness,
    case
      when composed.total_questions >= 5
        then round(greatest(0::numeric, composed.readiness_value - least(0.08::numeric, 0.22::numeric / sqrt(composed.total_questions::numeric))), 4)
      else null
    end as readiness_lower,
    case
      when composed.total_questions >= 5
        then round(least(1::numeric, composed.readiness_value + least(0.08::numeric, 0.22::numeric / sqrt(composed.total_questions::numeric))), 4)
      else null
    end as readiness_upper,
    round(composed.readiness_value, 4) as projected_readiness,
    composed.overdue_count,
    composed.overdue_count as backlog_count,
    composed.fragile_count,
    composed.consolidating_count,
    composed.solid_count,
    composed.mastered_count,
    composed.new_count,
    case
      when composed.overdue_count > 0
        then least(composed.daily_review_capacity, composed.overdue_count)
      when composed.fragile_count > 0
        then least(composed.daily_review_capacity, composed.fragile_count)
      else 0
    end as recommended_review_count,
    case
      when composed.overdue_count >= composed.daily_review_capacity then 0
      else least(composed.daily_new_capacity, composed.new_count)
    end as recommended_new_count,
    (
      case
        when composed.overdue_count > 0
          then least(composed.daily_review_capacity, composed.overdue_count)
        when composed.fragile_count > 0
          then least(composed.daily_review_capacity, composed.fragile_count)
        else 0
      end
      +
      case
        when composed.overdue_count >= composed.daily_review_capacity then 0
        else least(composed.daily_new_capacity, composed.new_count)
      end
    ) as recommended_today_count,
    case
      when composed.overdue_count > 0 then 'mixed'
      when composed.fragile_count >= greatest(4, composed.daily_review_capacity / 2) then 'mixed'
      when composed.new_count > 0 then 'standard'
      else 'random'
    end as recommended_mode,
    case
      when composed.overdue_count > 0 then format(
        'Tienes %s preguntas urgentes. Hoy conviene priorizar %s.',
        composed.overdue_count,
        least(composed.daily_review_capacity, composed.overdue_count)
      )
      when composed.fragile_count > 0 then format(
        'Hoy conviene consolidar %s preguntas fragiles y abrir %s nuevas.',
        least(composed.daily_review_capacity, composed.fragile_count),
        least(composed.daily_new_capacity, composed.new_count)
      )
      when composed.new_count > 0 then format(
        'Puedes avanzar con %s nuevas sin perder el ritmo.',
        least(composed.daily_new_capacity, composed.new_count)
      )
      else 'Tu sistema esta estable. Puedes medirte con mezcla libre.'
    end as focus_message,
    composed.daily_review_capacity,
    composed.daily_new_capacity,
    composed.exam_date,
    composed.risk_breakdown
  from composed;
end;
$function$;

revoke execute on function app.get_readiness_dashboard(p_curriculum text, p_user_id uuid) from public, anon;
grant execute on function app.get_readiness_dashboard(p_curriculum text, p_user_id uuid) to authenticated, service_role;

-- get_readiness_dashboard_v2
CREATE OR REPLACE FUNCTION app.get_readiness_dashboard_v2(p_curriculum text DEFAULT 'general'::text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(total_questions integer, seen_questions integer, coverage_rate numeric, observed_accuracy_rate numeric, observed_accuracy_n integer, observed_accuracy_ci_low numeric, observed_accuracy_ci_high numeric, observed_accuracy_sample_ok boolean, retention_seen_rate numeric, retention_seen_n integer, retention_seen_confidence_flag text, unseen_prior_rate numeric, exam_readiness_rate numeric, exam_readiness_ci_low numeric, exam_readiness_ci_high numeric, exam_readiness_confidence_flag text, backlog_overdue_count integer, fragile_count integer, consolidating_count integer, solid_count integer, mastered_count integer, recommended_review_count integer, recommended_new_count integer, recommended_today_count integer, recommended_mode text, focus_message text, law_breakdown jsonb, topic_breakdown jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_user_id uuid;
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
  v_unseen_prior numeric := 0.25;
begin
  perform app.assert_full_practice_access(p_user_id);
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    raise exception 'No user';
  end if;

  return query
  with
  target as (
    select
      et.exam_date::date as exam_date,
      coalesce(et.daily_review_capacity, 35)::integer as daily_review_capacity,
      coalesce(et.daily_new_capacity, 10)::integer as daily_new_capacity,
      greatest(
        0,
        coalesce(et.exam_date::date - timezone('utc', now())::date, 0)
      )::integer as days_to_exam
    from app.exam_targets et
    where et.user_id = v_user_id
      and et.curriculum = v_curriculum
    limit 1
  ),
  catalog as (
    select count(*)::integer as total_questions
    from public.preguntas p
    where coalesce(to_jsonb(p)->>'id', '') <> ''
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
  ),
  state_metrics as (
    select
      count(*)::integer as seen_questions,
      coalesce(sum(qs.attempts), 0)::integer as observed_accuracy_n,
      coalesce(sum(qs.correct_attempts), 0)::integer as observed_accuracy_successes,
      count(*) filter (
        where qs.next_review_at is not null
          and qs.next_review_at <= timezone('utc', now())
      )::integer as overdue_count,
      count(*) filter (where qs.mastery_level <= 1)::integer as fragile_count,
      count(*) filter (where qs.mastery_level = 2)::integer as consolidating_count,
      count(*) filter (where qs.mastery_level = 3)::integer as solid_count,
      count(*) filter (where qs.mastery_level >= 4)::integer as mastered_count,
      coalesce(
        sum(
          app.project_exam_retention_probability(
            qs.p_correct_estimated,
            qs.stability_score,
            (select coalesce(t.days_to_exam, 0) from target t limit 1)
          )
        ),
        0::numeric
      ) as retention_sum
    from app.user_question_state qs
    where qs.user_id = v_user_id
      and qs.curriculum = v_curriculum
  ),
  law_breakdown_data as (
    select
      to_jsonb(p)->>'ley_referencia' as ley_referencia,
      min(
        coalesce(
          to_jsonb(p)->>'grupo',
          to_jsonb(p)->>'question_scope',
          to_jsonb(p)->>'scope',
          to_jsonb(p)->>'temario_tipo',
          to_jsonb(p)->>'tipo_temario'
        )
      ) as raw_scope,
      count(distinct coalesce(to_jsonb(p)->>'id', ''))::integer as question_count,
      count(
        distinct case
          when qs.mastery_level >= 3 then coalesce(to_jsonb(p)->>'id', '')
          else null
        end
      )::integer as consolidated_count,
      coalesce(sum(qs.attempts), 0)::integer as attempts,
      coalesce(sum(qs.correct_attempts), 0)::integer as correct_attempts,
      case
        when coalesce(sum(qs.attempts), 0) = 0 then 0::numeric
        else round(
          coalesce(sum(qs.correct_attempts), 0)::numeric /
          coalesce(sum(qs.attempts), 1)::numeric,
          4
        )
      end as accuracy_rate
    from public.preguntas p
    left join app.user_question_state qs
      on qs.question_id = coalesce(to_jsonb(p)->>'id', '')
      and qs.user_id = v_user_id
      and qs.curriculum = v_curriculum
    where coalesce(to_jsonb(p)->>'id', '') <> ''
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
      and coalesce(to_jsonb(p)->>'ley_referencia', '') <> ''
    group by 1
  ),
  topic_breakdown_data as (
    select
      btrim(to_jsonb(p)->>'temario_pregunta') as topic_label,
      coalesce(
        to_jsonb(p)->>'grupo',
        to_jsonb(p)->>'question_scope',
        to_jsonb(p)->>'scope',
        to_jsonb(p)->>'temario_tipo',
        to_jsonb(p)->>'tipo_temario'
      ) as raw_scope,
      count(distinct coalesce(to_jsonb(p)->>'id', ''))::integer as question_count,
      count(
        distinct case
          when qs.mastery_level >= 3 then coalesce(to_jsonb(p)->>'id', '')
          else null
        end
      )::integer as consolidated_count,
      count(
        distinct case
          when qs.question_id is null then coalesce(to_jsonb(p)->>'id', '')
          else null
        end
      )::integer as unseen_count,
      count(
        distinct case
          when qs.question_id is not null and coalesce(qs.mastery_level, 0) <= 1
            then coalesce(to_jsonb(p)->>'id', '')
          else null
        end
      )::integer as fragile_count,
      count(
        distinct case
          when qs.mastery_level = 2 then coalesce(to_jsonb(p)->>'id', '')
          else null
        end
      )::integer as consolidating_count,
      count(
        distinct case
          when qs.mastery_level = 3 then coalesce(to_jsonb(p)->>'id', '')
          else null
        end
      )::integer as solid_count,
      count(
        distinct case
          when qs.mastery_level >= 4 then coalesce(to_jsonb(p)->>'id', '')
          else null
        end
      )::integer as mastered_count,
      coalesce(sum(qs.attempts), 0)::integer as attempts,
      coalesce(sum(qs.correct_attempts), 0)::integer as correct_attempts,
      case
        when coalesce(sum(qs.attempts), 0) = 0 then 0::numeric
        else round(
          coalesce(sum(qs.correct_attempts), 0)::numeric /
          coalesce(sum(qs.attempts), 1)::numeric,
          4
        )
      end as accuracy_rate
    from public.preguntas p
    left join app.user_question_state qs
      on qs.question_id = coalesce(to_jsonb(p)->>'id', '')
      and qs.user_id = v_user_id
      and qs.curriculum = v_curriculum
    where coalesce(to_jsonb(p)->>'id', '') <> ''
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
      and coalesce(btrim(to_jsonb(p)->>'temario_pregunta'), '') <> ''
    group by 1, 2
  ),
  composed as (
    select
      catalog.total_questions,
      state_metrics.seen_questions,
      state_metrics.observed_accuracy_n,
      state_metrics.observed_accuracy_successes,
      state_metrics.overdue_count,
      state_metrics.fragile_count,
      state_metrics.consolidating_count,
      state_metrics.solid_count,
      state_metrics.mastered_count,
      coalesce((select t.daily_review_capacity from target t limit 1), 35)::integer as daily_review_capacity,
      coalesce((select t.daily_new_capacity from target t limit 1), 10)::integer as daily_new_capacity,
      greatest(catalog.total_questions - state_metrics.seen_questions, 0) as unseen_questions,
      case
        when catalog.total_questions <= 0 then 0::numeric
        else round(
          state_metrics.seen_questions::numeric / catalog.total_questions::numeric,
          4
        )
      end as coverage_rate_value,
      case
        when state_metrics.observed_accuracy_n <= 0 then 0::numeric
        else round(
          state_metrics.observed_accuracy_successes::numeric /
          state_metrics.observed_accuracy_n::numeric,
          4
        )
      end as observed_accuracy_rate_value,
      case
        when state_metrics.seen_questions <= 0 then null::numeric
        else round(
          state_metrics.retention_sum / state_metrics.seen_questions::numeric,
          4
        )
      end as retention_seen_rate_value,
      case
        when catalog.total_questions <= 0 then v_unseen_prior
        else round(
          (
            state_metrics.retention_sum +
            (greatest(catalog.total_questions - state_metrics.seen_questions, 0)::numeric * v_unseen_prior)
          ) / catalog.total_questions::numeric,
          4
        )
      end as exam_readiness_rate_value
    from catalog
    cross join state_metrics
  )
  select
    composed.total_questions,
    composed.seen_questions,
    composed.coverage_rate_value,
    composed.observed_accuracy_rate_value,
    composed.observed_accuracy_n,
    round(app.wilson_interval_low(composed.observed_accuracy_successes, composed.observed_accuracy_n), 4) as observed_accuracy_ci_low,
    round(app.wilson_interval_high(composed.observed_accuracy_successes, composed.observed_accuracy_n), 4) as observed_accuracy_ci_high,
    composed.observed_accuracy_n >= 30 as observed_accuracy_sample_ok,
    composed.retention_seen_rate_value,
    composed.seen_questions as retention_seen_n,
    app.resolve_confidence_flag(composed.seen_questions, 20, 80) as retention_seen_confidence_flag,
    v_unseen_prior as unseen_prior_rate,
    composed.exam_readiness_rate_value,
    case
      when composed.seen_questions < 5 then null::numeric
      else round(
        greatest(
          0::numeric,
          composed.exam_readiness_rate_value -
          least(0.12::numeric, 0.35::numeric / sqrt(composed.seen_questions::numeric))
        ),
        4
      )
    end as exam_readiness_ci_low,
    case
      when composed.seen_questions < 5 then null::numeric
      else round(
        least(
          1::numeric,
          composed.exam_readiness_rate_value +
          least(0.12::numeric, 0.35::numeric / sqrt(composed.seen_questions::numeric))
        ),
        4
      )
    end as exam_readiness_ci_high,
    app.resolve_confidence_flag(composed.seen_questions, 20, 80) as exam_readiness_confidence_flag,
    composed.overdue_count as backlog_overdue_count,
    composed.fragile_count,
    composed.consolidating_count,
    composed.solid_count,
    composed.mastered_count,
    case
      when composed.overdue_count > 0 then least(composed.daily_review_capacity, composed.overdue_count)
      when composed.fragile_count > 0 then least(composed.daily_review_capacity, composed.fragile_count)
      else 0
    end as recommended_review_count,
    case
      when composed.overdue_count >= composed.daily_review_capacity then 0
      else least(composed.daily_new_capacity, composed.unseen_questions)
    end as recommended_new_count,
    (
      case
        when composed.overdue_count > 0 then least(composed.daily_review_capacity, composed.overdue_count)
        when composed.fragile_count > 0 then least(composed.daily_review_capacity, composed.fragile_count)
        else 0
      end
      +
      case
        when composed.overdue_count >= composed.daily_review_capacity then 0
        else least(composed.daily_new_capacity, composed.unseen_questions)
      end
    ) as recommended_today_count,
    case
      when composed.overdue_count > 0 then 'mixed'
      when composed.fragile_count >= greatest(4, composed.daily_review_capacity / 2) then 'mixed'
      when composed.unseen_questions > 0 then 'standard'
      else 'random'
    end as recommended_mode,
    case
      when composed.seen_questions < 20 then format(
        'La muestra aun es corta. Has visto %s preguntas y conviene seguir consolidando antes de leer demasiado la prediccion.',
        composed.seen_questions
      )
      when composed.overdue_count > 0 then format(
        'Tienes %s preguntas vencidas. Hoy conviene priorizar %s y dejar que la prediccion respire sobre una base mas limpia.',
        composed.overdue_count,
        least(composed.daily_review_capacity, composed.overdue_count)
      )
      when composed.fragile_count > 0 then format(
        'La preparacion compuesta mejora si consolidas %s fragiles y abres %s nuevas con control.',
        least(composed.daily_review_capacity, composed.fragile_count),
        least(composed.daily_new_capacity, composed.unseen_questions)
      )
      when composed.unseen_questions > 0 then format(
        'La cobertura ya permite avanzar con %s nuevas sin distorsionar demasiado la lectura global.',
        least(composed.daily_new_capacity, composed.unseen_questions)
      )
      else 'La cobertura esta practicamente cerrada. La lectura de preparacion depende sobre todo de mantenimiento y transferencia.'
    end as focus_message,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'ley_referencia', lbd.ley_referencia,
            'raw_scope', lbd.raw_scope,
            'question_count', lbd.question_count,
            'consolidated_count', lbd.consolidated_count,
            'attempts', lbd.attempts,
            'correct_attempts', lbd.correct_attempts,
            'accuracy_rate', lbd.accuracy_rate
          )
          order by lbd.attempts desc, lbd.ley_referencia
        ),
        '[]'::jsonb
      )
      from law_breakdown_data lbd
    ) as law_breakdown,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'topic_label', tbd.topic_label,
            'raw_scope', tbd.raw_scope,
            'question_count', tbd.question_count,
            'consolidated_count', tbd.consolidated_count,
            'unseen_count', tbd.unseen_count,
            'fragile_count', tbd.fragile_count,
            'consolidating_count', tbd.consolidating_count,
            'solid_count', tbd.solid_count,
            'mastered_count', tbd.mastered_count,
            'attempts', tbd.attempts,
            'correct_attempts', tbd.correct_attempts,
            'accuracy_rate', tbd.accuracy_rate
          )
          order by tbd.topic_label
        ),
        '[]'::jsonb
      )
      from topic_breakdown_data tbd
    ) as topic_breakdown
  from composed;
end;
$function$;

revoke execute on function app.get_readiness_dashboard_v2(p_curriculum text, p_user_id uuid) from public, anon;
grant execute on function app.get_readiness_dashboard_v2(p_curriculum text, p_user_id uuid) to authenticated, service_role;

-- get_simulacro_batch
CREATE OR REPLACE FUNCTION app.get_simulacro_batch(p_curriculum text DEFAULT 'general'::text, p_limit integer DEFAULT 60, p_question_scope text DEFAULT 'all'::text)
 RETURNS TABLE(payload jsonb, source_bucket text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
  v_limit integer := greatest(20, least(coalesce(p_limit, 60), 120));
  v_seen_limit integer := ceil(v_limit * 0.8)::integer;
begin
  perform app.assert_full_practice_access();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  with seen_pool as (
    select
      qs.question_id,
      'seen'::text as source_bucket,
      row_number() over (
        order by qs.exam_retention_probability asc, qs.mastery_level asc, qs.p_correct_estimated asc, random()
      ) as rn
    from app.user_question_state qs
    join public.preguntas p
      on coalesce(to_jsonb(p)->>'id', '') = qs.question_id
    where qs.user_id = v_user_id
      and qs.curriculum = v_curriculum
      and app.question_matches_scope(to_jsonb(p), p_question_scope)
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
  ),
  unseen_pool as (
    select
      coalesce(to_jsonb(p)->>'id', '') as question_id,
      'new'::text as source_bucket,
      row_number() over (
        order by random()
      ) as rn
    from public.preguntas p
    where coalesce(to_jsonb(p)->>'id', '') <> ''
      and app.question_matches_scope(to_jsonb(p), p_question_scope)
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
      and not exists (
        select 1
        from app.user_question_state qs
        where qs.user_id = v_user_id
          and qs.curriculum = v_curriculum
          and qs.question_id = coalesce(to_jsonb(p)->>'id', '')
      )
  ),
  seed as (
    select sp.question_id, sp.source_bucket, sp.rn
    from seen_pool sp
    where sp.rn <= v_seen_limit
    union all
    select up.question_id, up.source_bucket, 1000 + up.rn
    from unseen_pool up
  ),
  deduped as (
    select distinct on (s.question_id)
      s.question_id,
      s.source_bucket,
      s.rn
    from seed s
    order by s.question_id, s.rn
  )
  select
    to_jsonb(p) as payload,
    d.source_bucket
  from deduped d
  join public.preguntas p
    on coalesce(to_jsonb(p)->>'id', '') = d.question_id
  where app.question_matches_scope(to_jsonb(p), p_question_scope)
  order by d.rn
  limit v_limit;
end;
$function$;

revoke execute on function app.get_simulacro_batch(p_curriculum text, p_limit integer, p_question_scope text) from public, anon;
grant execute on function app.get_simulacro_batch(p_curriculum text, p_limit integer, p_question_scope text) to authenticated, service_role;

-- get_standard_practice_batch
CREATE OR REPLACE FUNCTION app.get_standard_practice_batch(p_curriculum text DEFAULT 'general'::text, p_batch_start_index integer DEFAULT 0, p_batch_size integer DEFAULT 20, p_question_scope text DEFAULT 'all'::text)
 RETURNS TABLE(payload jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_start integer := greatest(coalesce(p_batch_start_index, 0), 0);
  v_limit integer := greatest(1, least(coalesce(p_batch_size, 20), 100));
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
begin
  perform app.assert_full_practice_access();
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  select to_jsonb(p) as payload
  from public.preguntas p
  where coalesce(to_jsonb(p)->>'id', '') <> ''
    and app.question_matches_scope(to_jsonb(p), p_question_scope)
    and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
  order by
    case
      when trim(coalesce(to_jsonb(p)->>'numero', '')) ~ '^-?\d+$'
        then (to_jsonb(p)->>'numero')::integer
      else null
    end asc nulls last,
    coalesce(to_jsonb(p)->>'id', '')
  offset v_start
  limit v_limit;
end;
$function$;

revoke execute on function app.get_standard_practice_batch(p_curriculum text, p_batch_start_index integer, p_batch_size integer, p_question_scope text) from public, anon;
grant execute on function app.get_standard_practice_batch(p_curriculum text, p_batch_start_index integer, p_batch_size integer, p_question_scope text) to authenticated, service_role;

-- get_topic_practice_batch
CREATE OR REPLACE FUNCTION app.get_topic_practice_batch(p_topic text, p_curriculum text DEFAULT 'general'::text, p_batch_size integer DEFAULT 20)
 RETURNS TABLE(payload jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_batch_size, 20), 100));
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
begin
  perform app.assert_full_practice_access();
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  select to_jsonb(p) as payload
  from public.preguntas p
  where coalesce(to_jsonb(p)->>'id', '') <> ''
    and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
    and btrim(coalesce(to_jsonb(p)->>'temario_pregunta', '')) = btrim(coalesce(p_topic, ''))
  order by random()
  limit v_limit;
end;
$function$;

revoke execute on function app.get_topic_practice_batch(p_topic text, p_curriculum text, p_batch_size integer) from public, anon;
grant execute on function app.get_topic_practice_batch(p_topic text, p_curriculum text, p_batch_size integer) to authenticated, service_role;

-- get_weak_category_summary
CREATE OR REPLACE FUNCTION app.get_weak_category_summary(p_curriculum text DEFAULT 'general'::text, p_limit integer DEFAULT 5, p_question_scope text DEFAULT 'all'::text)
 RETURNS TABLE(category text, incorrect_attempts bigint, attempts bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 12));
begin
  perform app.assert_full_practice_access();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  select
    coalesce(
      nullif(trim(qs.category), ''),
      nullif(trim(coalesce(
        to_jsonb(p)->>'category',
        to_jsonb(p)->>'tema',
        to_jsonb(p)->>'topic',
        to_jsonb(p)->>'subject',
        to_jsonb(p)->>'materia',
        to_jsonb(p)->>'subtema'
      )), ''),
      'Sin grupo'
    ) as category,
    sum(qs.incorrect_attempts)::bigint as incorrect_attempts,
    sum(qs.attempts)::bigint as attempts
  from app.practice_question_stats qs
  join public.preguntas p
    on coalesce(to_jsonb(p)->>'id', '') = qs.question_id
  where qs.user_id = v_user_id
    and qs.curriculum = v_curriculum
    and qs.incorrect_attempts > 0
    and app.question_matches_scope(to_jsonb(p), p_question_scope)
      and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
  group by 1
  order by incorrect_attempts desc, attempts desc, category asc
  limit v_limit;
end;
$function$;

revoke execute on function app.get_weak_category_summary(p_curriculum text, p_limit integer, p_question_scope text) from public, anon;
grant execute on function app.get_weak_category_summary(p_curriculum text, p_limit integer, p_question_scope text) to authenticated, service_role;

-- get_weak_practice_batch
CREATE OR REPLACE FUNCTION app.get_weak_practice_batch(p_curriculum text DEFAULT 'general'::text, p_limit integer DEFAULT 5, p_question_scope text DEFAULT 'all'::text)
 RETURNS TABLE(payload jsonb, attempts integer, correct_attempts integer, incorrect_attempts integer, last_answered_at timestamp with time zone, last_incorrect_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'auth'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_curriculum text := coalesce(nullif(trim(p_curriculum), ''), 'general');
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 50));
begin
  perform app.assert_full_practice_access();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query
  select
    to_jsonb(p) as payload,
    qs.attempts,
    qs.correct_attempts,
    qs.incorrect_attempts,
    qs.last_seen_at as last_answered_at,
    case
      when qs.last_result = 'incorrect' then qs.last_seen_at
      else null
    end as last_incorrect_at
  from app.user_question_state qs
  join public.preguntas p
    on coalesce(to_jsonb(p)->>'id', '') = qs.question_id
  where qs.user_id = v_user_id
    and qs.curriculum = v_curriculum
    and qs.attempts > 0
    and qs.incorrect_attempts > 0
    and app.question_matches_scope(to_jsonb(p), p_question_scope)
    and app.pregunta_row_matches_practice_curriculum(p, v_curriculum)
  order by
    case when qs.last_result = 'incorrect' then 0 else 1 end,
    qs.mastery_level asc,
    qs.p_correct_estimated asc,
    (qs.incorrect_attempts::numeric / greatest(qs.attempts, 1)) desc,
    qs.incorrect_attempts desc,
    qs.last_seen_at desc nulls last
  limit v_limit;
end;
$function$;

revoke execute on function app.get_weak_practice_batch(p_curriculum text, p_limit integer, p_question_scope text) from public, anon;
grant execute on function app.get_weak_practice_batch(p_curriculum text, p_limit integer, p_question_scope text) to authenticated, service_role;

commit;
