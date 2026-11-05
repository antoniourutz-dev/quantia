create or replace function app.get_standard_practice_batch(p_curriculum text default 'general', p_batch_start_index integer default 0, p_batch_size integer default 20, p_question_scope text default 'all')
returns table(payload jsonb) language plpgsql security definer set search_path to 'app','public','auth' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  return query
  select to_jsonb(p) from app.assignment_scoped_questions p
  where coalesce(to_jsonb(p)->>'id','') <> ''
    and app.question_matches_scope(to_jsonb(p),p_question_scope)
    and app.pregunta_row_matches_practice_curriculum(p,p_curriculum)
  order by case when trim(coalesce(to_jsonb(p)->>'numero','')) ~ '^-?\d+$' then (to_jsonb(p)->>'numero')::integer end asc nulls last,
    coalesce(to_jsonb(p)->>'id','')
  offset greatest(coalesce(p_batch_start_index,0),0)
  limit greatest(1,least(coalesce(p_batch_size,20),100));
end $$;
