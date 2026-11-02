-- Preflight de SOLO LECTURA. No consulta filas ni información personal.
select schemaname, tablename, policyname, cmd, permissive, roles, qual
from pg_policies
where schemaname='public' and tablename='preguntas'
order by policyname;

select c.relname, c.relrowsecurity,
       has_table_privilege('anon',c.oid,'SELECT') anon_select,
       has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='preguntas';

select n.nspname, p.proname, p.prosecdef,
       has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='app'
  and p.proname in (
    'get_public_guest_practice_batch','get_random_practice_batch',
    'get_standard_practice_batch','get_mixed_practice_batch',
    'get_topic_practice_batch','get_law_practice_batch','get_weak_practice_batch'
  )
order by p.proname;

select c.relname, c.reloptions,
       has_table_privilege('anon',c.oid,'SELECT') anon_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v'
  and has_table_privilege('anon',c.oid,'SELECT')
order by c.relname;
