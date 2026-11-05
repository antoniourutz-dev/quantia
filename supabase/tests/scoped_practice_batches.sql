-- Run after student_opposition_assignments.sql. A transient learner exercises both practice RPCs.
begin;
insert into auth.users(id) values ('10000000-abcd-4012-8567-000000000009');
insert into public.student_opposition_access select '10000000-abcd-4012-8567-000000000009',id from public.oppositions where slug in ('osakidetza-electromedicina','osakidetza-admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-abcd-4012-8567-000000000009',true);
do $$
declare batch record;
begin
 for batch in select 'standard' mode,count(*) n,count(*) filter(where payload->>'curriculum'='osakidetza_electromedicina' and payload->>'question_scope_key'='specific') valid from app.get_standard_practice_batch('osakidetza_electromedicina',0,10,'specific')
 union all select 'random',count(*),count(*) filter(where payload->>'curriculum'='osakidetza_electromedicina' and payload->>'question_scope_key'='specific') from app.get_random_practice_batch('osakidetza_electromedicina',10,'specific')
 loop if batch.n<>10 or batch.valid<>10 then raise exception 'Invalid % batch',batch.mode; end if; end loop;
 if exists(select 1 from app.get_random_practice_batch('goi_teknikaria',10,'specific')) then raise exception 'Unauthorized curriculum'; end if;
end $$;
select 'passed' result;
rollback;
