-- Explicit grants survive independently of the learner's active study profile.
create table public.student_opposition_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  opposition_id uuid not null references public.oppositions(id) on delete cascade,
  primary key(user_id, opposition_id)
);
alter table public.student_opposition_access enable row level security;
revoke all on public.student_opposition_access from public, anon, authenticated;
grant select on public.student_opposition_access to authenticated;
create policy own_assignments on public.student_opposition_access for select to authenticated using (user_id=(select auth.uid()));

insert into public.student_opposition_access
select distinct user_id, opposition_id from public.user_opposition_profiles where opposition_id is not null and not exists (select 1 from public.restricted_question_bank_access r where r.user_id=user_opposition_profiles.user_id)
on conflict do nothing;

-- Preserve previously delegated viewer scopes by their immutable account IDs.
insert into public.student_opposition_access
select distinct r.user_id,o.id from public.restricted_question_bank_access r
cross join lateral unnest(r.allowed_curriculum_keys) k
join public.oppositions o on o.slug=replace(lower(k),'_','-')
  or (lower(k)='administrativo' and o.slug='osakidetza-admin')
on conflict do nothing;

create function public.student_access_scope() returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object('manager',public.quantia_is_protected_user(auth.uid()),'keys',
  coalesce((select jsonb_agg(distinct replace(coalesce(nullif(c.config_json->>'curriculum',''),o.slug),'-','_'))
  from public.student_opposition_access a join public.oppositions o on o.id=a.opposition_id
  left join public.opposition_configs c on c.opposition_id=o.id
  where a.user_id=auth.uid() and o.is_active), '[]'::jsonb))
$$;

create function public.admin_student_oppositions(p_student uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.has_quantia_permission('users.manage') or public.quantia_is_protected_user(p_student) then
    raise exception 'Acceso denegado' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.display_name,'assigned',a.user_id is not null) order by o.display_name),'[]'::jsonb)
    from public.oppositions o left join public.student_opposition_access a on a.opposition_id=o.id and a.user_id=p_student where o.is_active or a.user_id is not null);
end $$;

create function public.set_student_oppositions(p_student uuid,p_ids uuid[],p_expected uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare current_ids uuid[];
begin
  if not public.has_quantia_permission('users.manage') or public.quantia_is_protected_user(p_student) then
    raise exception 'Acceso denegado' using errcode='42501'; end if;
  perform 1 from auth.users where id=p_student for update;
  if not found then raise exception 'Alumno desconocido'; end if;
  select array(select opposition_id from public.student_opposition_access where user_id=p_student order by opposition_id) into current_ids;
  if p_expected is null or current_ids <> array(select distinct x from unnest(p_expected) x order by x) then raise exception 'Las asignaciones han cambiado. Vuelve a abrir la ficha.'; end if;
  if p_ids is null or exists(select 1 from unnest(p_ids) x where not exists(select 1 from public.oppositions o where o.id=x and (o.is_active or x=any(current_ids)))) then raise exception 'Oposición inválida'; end if;
  delete from public.student_opposition_access where user_id=p_student and not(opposition_id=any(p_ids));
  insert into public.student_opposition_access select p_student,x from unnest(p_ids) x on conflict do nothing;
end $$;
revoke all on function public.student_access_scope(),public.admin_student_oppositions(uuid),public.set_student_oppositions(uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.student_access_scope(),public.admin_student_oppositions(uuid),public.set_student_oppositions(uuid,uuid[],uuid[]) to authenticated;

-- Additional restrictive gates compose with existing role-specific policies.
create function public.student_allowed_opposition_ids() returns setof uuid
language sql stable security definer set search_path='' as $$
select a.opposition_id from public.student_opposition_access a join public.oppositions o on o.id=a.opposition_id where a.user_id=auth.uid() and o.is_active
$$;
revoke all on function public.student_allowed_opposition_ids() from public,anon;
grant execute on function public.student_allowed_opposition_ids() to authenticated;
-- Both learner interfaces now use the same assignment table.
alter policy preguntas_select_all on public.preguntas using (auth.uid() is not null);
create policy student_question_scope on public.preguntas as restrictive for select to authenticated using
((select public.has_quantia_permission('questions.manage') or public.has_quantia_permission('quality.manage') or public.has_quantia_permission('statistics.read')) or opposition_id in(select public.student_allowed_opposition_ids()));
create policy student_catalog_scope on public.oppositions as restrictive for select to authenticated using
((select public.quantia_is_protected_user(auth.uid())) or id in(select public.student_allowed_opposition_ids()));
create policy student_config_scope on public.opposition_configs as restrictive for select to authenticated using
((select public.quantia_is_protected_user(auth.uid())) or opposition_id in(select public.student_allowed_opposition_ids()));

-- Definer RPCs run under their owner's role and would otherwise bypass row policies.
-- This internal view has no client grants. Keep the existing anonymous guest flow.
create view app.assignment_scoped_questions with (security_barrier=true) as
select q.* from public.preguntas q where
  (select auth.role()) in ('anon','service_role')
  or (select public.has_quantia_permission('questions.manage') or public.has_quantia_permission('quality.manage') or public.has_quantia_permission('statistics.read'))
  or q.opposition_id in(select public.student_allowed_opposition_ids());
revoke all on app.assignment_scoped_questions from public,anon,authenticated;
do $$
declare f record;
begin
 for f in select pg_get_functiondef(p.oid) ddl from pg_proc p
 where p.pronamespace in ('app'::regnamespace,'public'::regnamespace) and p.prosecdef
 and has_function_privilege('authenticated',p.oid,'execute') and p.prosrc ~* '(from|join)\s+public\.preguntas\M'
 loop
   execute regexp_replace(f.ddl,'((?:from|join)\s+)public\.preguntas\M','\1app.assignment_scoped_questions','gi');
 end loop;
end $$;

-- The separately published official exam bank carries curriculum keys rather than opposition IDs.
create function public.can_read_official_curriculum(p_key text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.has_quantia_permission('questions.manage') or public.has_quantia_permission('quality.manage')
 or (public.student_access_scope()->'keys') ? replace(lower(p_key),'-','_')
$$;
revoke all on function public.can_read_official_curriculum(text) from public;
grant execute on function public.can_read_official_curriculum(text) to authenticated,anon,service_role;
alter table app.official_past_questions enable row level security;
create policy official_assignment_scope on app.official_past_questions as restrictive for select to authenticated
using(public.can_read_official_curriculum(coalesce(curriculum,curriculum_key)));
do $$
declare v text; def text;
begin
 foreach v in array array['public_official_past_questions','public_official_past_question_law_articles','public_official_past_question_article_counts']
 loop
   def := pg_get_viewdef(format('public.%I',v)::regclass,true);
   if def !~ 'app[.]official_past_questions[[:space:]]+q[[:space:]]' then raise exception 'Unexpected view definition: %',v; end if;
   execute format('create or replace view public.%I as %s',v,
     regexp_replace(def,'app[.]official_past_questions[[:space:]]+q[[:space:]]','(select * from app.official_past_questions t where public.can_read_official_curriculum(coalesce(t.curriculum,t.curriculum_key))) q '));
 end loop;
end $$;

-- Compare like-for-like periods using recorded answers, independently of session completion.
create function public.admin_student_progress(p_student uuid,p_days integer default 7)
returns table(period text,sessions bigint,answered bigint,correct bigint,active_days bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_quantia_permission('statistics.read') or
    not public.has_quantia_permission('users.manage') or public.quantia_is_protected_user(p_student)
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_days is null or p_days not in (7,30) then raise exception 'Periodo inválido'; end if;
 return query
 with windows as (
   select 'current'::text label,now()-p_days*interval '1 day' lo,now() hi,1 ord union all
   select 'previous',now()-2*p_days*interval '1 day',now()-p_days*interval '1 day',2 union all
   select 'all','-infinity'::timestamptz,now(),3
 )
 select w.label,(select count(*) from app.practice_sessions s where s.user_id=p_student and s.finished_at>=w.lo and s.finished_at<w.hi),
 count(e.id),count(e.id) filter(where e.is_correct),count(distinct (e.answered_at at time zone 'Europe/Madrid')::date)
 from windows w left join app.question_attempt_events e on e.user_id=p_student and e.answered_at>=w.lo and e.answered_at<w.hi
 group by w.label,w.lo,w.hi,w.ord order by w.ord;
end $$;
revoke all on function public.admin_student_progress(uuid,integer) from public,anon;
grant execute on function public.admin_student_progress(uuid,integer) to authenticated;
