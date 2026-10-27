do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(p.oid)
    into function_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'get_pressure_dashboard_v2';

  if function_definition is null then
    raise exception 'app.get_pressure_dashboard_v2 was not found';
  end if;

  function_definition := replace(
    function_definition,
    'avg(case when se.rn <= ceil(se.total_in_session / 2.0) and se.is_correct then 1 else 0 end)',
    'avg(case when se.rn <= ceil(se.total_in_session / 2.0) then case when se.is_correct then 1 else 0 end end)'
  );
  function_definition := replace(
    function_definition,
    'avg(case when se.rn > ceil(se.total_in_session / 2.0) and se.is_correct then 1 else 0 end)',
    'avg(case when se.rn > ceil(se.total_in_session / 2.0) then case when se.is_correct then 1 else 0 end end)'
  );
  function_definition := replace(
    function_definition,
    'count(*) filter (where not se.is_correct and se.response_time_ms is not null and se.response_time_ms <= 2500) +
        count(*) filter (where not se.is_correct and se.changed_answer)',
    'count(*) filter (where not se.is_correct and ((se.response_time_ms is not null and se.response_time_ms <= 2500) or se.changed_answer))'
  );

  execute function_definition;
end;
$migration$;
