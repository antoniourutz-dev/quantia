-- Run in a transaction against a migrated test database. Always roll back.
begin;
insert into auth.users(id) values ('10000000-abcd-4012-8567-000000000001');
select set_config('test.manager',(select id::text from auth.users where email='ardura@oposik.app'),true);
select set_config('test.opposition',(select id::text from public.oppositions where slug='osakidetza-admin'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
select public.set_student_oppositions('10000000-abcd-4012-8567-000000000001',array[current_setting('test.opposition')::uuid],'{}');
select set_config('request.jwt.claim.sub','10000000-abcd-4012-8567-000000000001',true);
do $$
begin
 if (select count(*) from public.oppositions)<>1 or not exists(select 1 from public.preguntas) or exists(select 1 from public.preguntas where opposition_id<>current_setting('test.opposition')::uuid) then raise exception 'scope failed'; end if;
 begin
 perform public.set_student_oppositions(auth.uid(),'{}',array[current_setting('test.opposition')::uuid]); raise exception 'self grant possible';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
select public.set_student_oppositions('10000000-abcd-4012-8567-000000000001','{}',array[current_setting('test.opposition')::uuid]);
select set_config('request.jwt.claim.sub','10000000-abcd-4012-8567-000000000001',true);
do $$
begin
 if exists(select 1 from public.oppositions) or exists(select 1 from public.preguntas) then raise exception 'revocation failed'; end if;
end $$;
select 'grant, reads, self-grant denial and revocation passed' result;
rollback;
