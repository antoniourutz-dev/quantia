-- QUANTIA: scoped management permissions, independent of email or mutable user metadata.
create table if not exists public.quantia_admin_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in (
    'questions.manage','catalogs.manage','users.manage','statistics.read','quality.manage'
  )),
  granted_at timestamptz not null default now(),
  primary key (user_id, permission)
);
alter table public.quantia_admin_permissions enable row level security;
revoke all on public.quantia_admin_permissions from anon, authenticated;
grant select on public.quantia_admin_permissions to service_role;

create or replace function public.has_quantia_permission(p_permission text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.admin_users a
      join app.user_roles r on r.user_id = a.user_id and r.role = 'admin'
      where a.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.quantia_admin_permissions p
      where p.user_id = (select auth.uid()) and p.permission = p_permission
    )
  );
$$;
revoke all on function public.has_quantia_permission(text) from public, anon;
grant execute on function public.has_quantia_permission(text) to authenticated, service_role;

-- A former full administrator becomes a specifically scoped manager. Lookup by
-- immutable auth user identity at migration time, not JWT email on every request.
do $$
declare manager_id uuid;
begin
  select id into manager_id from auth.users
  where lower(email) = 'ardura@oposik.app' and email_confirmed_at is not null;
  if manager_id is null then raise exception 'Confirmed Quantia manager account not found'; end if;

  insert into public.quantia_admin_permissions (user_id, permission)
  select manager_id, unnest(array[
    'questions.manage','catalogs.manage','users.manage','statistics.read','quality.manage'
  ]) on conflict (user_id,permission) do nothing;

  delete from app.user_roles where user_id = manager_id and role = 'admin';
  delete from public.admin_users where user_id = manager_id;
end $$;

-- Guard privileged identities even against direct PostgREST table requests.
create or replace function public.quantia_is_owner()
returns boolean language sql stable security definer set search_path = ''
as $
  select exists (
    select 1 from public.admin_users a
    join app.user_roles r on r.user_id = a.user_id and r.role = 'admin'
    where a.user_id = (select auth.uid())
  );
$;
create or replace function public.quantia_is_protected_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $
  select exists(select 1 from public.admin_users where user_id = p_user_id)
    or exists(select 1 from app.user_roles where user_id = p_user_id and role = 'admin')
    or exists(select 1 from public.quantia_admin_permissions where user_id = p_user_id);
$;
revoke all on function public.quantia_is_owner() from public, anon;
revoke all on function public.quantia_is_protected_user(uuid) from public, anon;
grant execute on function public.quantia_is_owner() to authenticated;
grant execute on function public.quantia_is_protected_user(uuid) to authenticated;

-- Question bank: remove hardcoded email from existing privileged policies.
drop policy if exists preguntas_insert_admin on public.preguntas;
create policy preguntas_insert_admin on public.preguntas for insert to authenticated
  with check ((select public.has_quantia_permission('questions.manage')));
drop policy if exists preguntas_update_admin on public.preguntas;
create policy preguntas_update_admin on public.preguntas for update to authenticated
  using ((select public.has_quantia_permission('questions.manage')))
  with check ((select public.has_quantia_permission('questions.manage')));

-- Restricted curriculum assignments: only user-management permission.
drop policy if exists restricted_question_bank_access_select on public.restricted_question_bank_access;
create policy restricted_question_bank_access_select on public.restricted_question_bank_access for select to authenticated
  using (user_id = (select auth.uid()) or
    ((select public.has_quantia_permission('users.manage')) and
      ((select public.quantia_is_owner()) or not public.quantia_is_protected_user(user_id))));
drop policy if exists restricted_question_bank_access_insert_admin on public.restricted_question_bank_access;
create policy restricted_question_bank_access_insert_admin on public.restricted_question_bank_access for insert to authenticated
  with check ((select public.has_quantia_permission('users.manage')) and
    ((select public.quantia_is_owner()) or not public.quantia_is_protected_user(user_id)));
drop policy if exists restricted_question_bank_access_update_admin on public.restricted_question_bank_access;
create policy restricted_question_bank_access_update_admin on public.restricted_question_bank_access for update to authenticated
  using ((select public.has_quantia_permission('users.manage')) and
    ((select public.quantia_is_owner()) or not public.quantia_is_protected_user(user_id)))
  with check ((select public.has_quantia_permission('users.manage')) and
    ((select public.quantia_is_owner()) or not public.quantia_is_protected_user(user_id)));
drop policy if exists restricted_question_bank_access_delete_admin on public.restricted_question_bank_access;
create policy restricted_question_bank_access_delete_admin on public.restricted_question_bank_access for delete to authenticated
  using ((select public.has_quantia_permission('users.manage')) and
    ((select public.quantia_is_owner()) or not public.quantia_is_protected_user(user_id)));

-- Editable opposition catalogs: both authenticated grants and row policies required.
do $$
declare t text;
begin
  foreach t in array array['oppositions','opposition_configs','subjects','question_scopes'] loop
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('create policy quantia_catalog_read on public.%I for select to authenticated using ((select public.has_quantia_permission(''catalogs.manage'')))',t);
    execute format('create policy quantia_catalog_insert on public.%I for insert to authenticated with check ((select public.has_quantia_permission(''catalogs.manage'')))',t);
    execute format('create policy quantia_catalog_update on public.%I for update to authenticated using ((select public.has_quantia_permission(''catalogs.manage''))) with check ((select public.has_quantia_permission(''catalogs.manage'')))',t);
  end loop;
end $$;

-- The existing admin UI can inspect/modify user opposition contexts.
create policy quantia_context_read on public.user_opposition_profiles for select to authenticated
  using ((select public.has_quantia_permission('users.manage')) and
    ((select public.quantia_is_owner()) or not public.quantia_is_protected_user(user_id)));

create policy quantia_context_insert on public.user_opposition_profiles for insert to authenticated
  with check ((select public.has_quantia_permission('users.manage')) and
    ((select public.quantia_is_owner()) or not public.quantia_is_protected_user(user_id)));

create policy quantia_context_update on public.user_opposition_profiles for update to authenticated
  using ((select public.has_quantia_permission('users.manage')) and
    ((select public.quantia_is_owner()) or not public.quantia_is_protected_user(user_id)))
  with check ((select public.has_quantia_permission('users.manage')) and
    ((select public.quantia_is_owner()) or not public.quantia_is_protected_user(user_id)));


-- General-law catalogs live in a separate schema.
grant usage on schema app to authenticated;
grant select, insert, update on app.general_laws, app.general_law_blocks to authenticated;
create policy quantia_laws_insert on app.general_laws for insert to authenticated
  with check ((select public.has_quantia_permission('catalogs.manage')));
create policy quantia_laws_update on app.general_laws for update to authenticated
  using ((select public.has_quantia_permission('catalogs.manage')))
  with check ((select public.has_quantia_permission('catalogs.manage')));
create policy quantia_blocks_insert on app.general_law_blocks for insert to authenticated
  with check ((select public.has_quantia_permission('catalogs.manage')));
create policy quantia_blocks_update on app.general_law_blocks for update to authenticated
  using ((select public.has_quantia_permission('catalogs.manage')))
  with check ((select public.has_quantia_permission('catalogs.manage')));

-- Quality control: the audit record is restricted to users with quality permission.
grant select, insert, update on app.osa_question_audit to authenticated;
create policy quantia_audit_read on app.osa_question_audit for select to authenticated
  using ((select public.has_quantia_permission('quality.manage')));
create policy quantia_audit_insert on app.osa_question_audit for insert to authenticated
  with check ((select public.has_quantia_permission('quality.manage')));
create policy quantia_audit_update on app.osa_question_audit for update to authenticated
  using ((select public.has_quantia_permission('quality.manage')))
  with check ((select public.has_quantia_permission('quality.manage')));


-- Non-destructive analytics access: administrators can see all session totals,
-- without gaining rights to alter any learner's practice history.
grant select on app.practice_sessions to authenticated;
create policy quantia_statistics_sessions_read on app.practice_sessions for select to authenticated
  using ((select public.has_quantia_permission('statistics.read')));

-- Allow editorial highlight adjustments for the approved question/quality scopes.
create policy quantia_highlight_insert on public.question_highlight_overrides for insert to authenticated
  with check (((select public.has_quantia_permission('quality.manage')) or
               (select public.has_quantia_permission('questions.manage')))
              and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy quantia_highlight_update on public.question_highlight_overrides for update to authenticated
  using ((select public.has_quantia_permission('quality.manage')) or
         (select public.has_quantia_permission('questions.manage')))
  with check (((select public.has_quantia_permission('quality.manage')) or
               (select public.has_quantia_permission('questions.manage')))
              and updated_by = (select auth.uid()));

-- Catalog metadata helper must be usable by managers, without exposing any
-- unrestricted information_schema permissions to the client.
-- Both catalog browser RPCs were absent from the linked Supabase schema.
-- Explicit allowlist blocks introspection of unrelated or sensitive tables.
create or replace function public.admin_list_tables_v2(p_schema text, p_tables text[])
returns table(table_name text)
language sql stable security definer set search_path = ''
as $
  select t.table_name::text
  from information_schema.tables t
  where public.has_quantia_permission('catalogs.manage')
    and ((p_schema = 'public' and t.table_name in
           ('oppositions','opposition_configs','subjects','question_scopes','user_opposition_profiles'))
      or (p_schema = 'app' and t.table_name in ('general_laws','general_law_blocks')))
    and t.table_schema = p_schema
    and t.table_name = any(p_tables);
$;
revoke all on function public.admin_list_tables_v2(text,text[]) from public, anon;
grant execute on function public.admin_list_tables_v2(text,text[]) to authenticated;

create or replace function public.admin_get_table_columns_v2(p_schema text, p_table text)
returns table(
  ordinal_position integer,
  column_name text,
  data_type text,
  is_nullable boolean,
  column_default text,
  udt_name text
)
language sql stable security definer set search_path = ''
as $
  select c.ordinal_position::integer, c.column_name::text, c.data_type::text,
         (c.is_nullable = 'YES')::boolean, c.column_default::text, c.udt_name::text
  from information_schema.columns c
  where public.has_quantia_permission('catalogs.manage')
    and ((p_schema = 'public' and p_table in
           ('oppositions','opposition_configs','subjects','question_scopes','user_opposition_profiles'))
      or (p_schema = 'app' and p_table in ('general_laws','general_law_blocks')))
    and c.table_schema = p_schema and c.table_name = p_table
  order by c.ordinal_position;
$;
revoke all on function public.admin_get_table_columns_v2(text,text) from public, anon;
grant execute on function public.admin_get_table_columns_v2(text,text) to authenticated;

-- Privilege helper is callable by clients, but it cannot add or remove permissions.
comment on function public.has_quantia_permission(text)
  is 'Current authenticated user only: owner or explicitly granted Quantia manager permission.';
