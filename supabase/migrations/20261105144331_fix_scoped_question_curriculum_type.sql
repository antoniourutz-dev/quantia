create function app.pregunta_row_matches_practice_curriculum(p app.assignment_scoped_questions, v_curriculum text)
returns boolean language sql stable security invoker set search_path = '' as $$
 select app.pregunta_row_matches_practice_curriculum(row(p.*)::public.preguntas, v_curriculum)
$$;
revoke all on function app.pregunta_row_matches_practice_curriculum(app.assignment_scoped_questions,text) from public,anon,authenticated;
