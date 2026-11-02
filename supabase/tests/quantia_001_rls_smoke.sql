-- QUANTIA 001 integration test: disposable PostgreSQL 16.
-- No connection to Supabase or production; builds a representative role/RLS fixture.

create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema app;
grant usage on schema auth to authenticated;
grant usage on schema app to anon, authenticated;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function public.is_restricted_question_bank_viewer()
returns boolean language sql stable as $$
  select coalesce(current_setting('request.jwt.claim.app_role', true), '') = 'restricted_question_bank_viewer';
$$;
create function public.canonicalize_access_key(value text)
returns text language sql immutable as $$
  select lower(regexp_replace(replace(replace(coalesce(value, ''), '_', '-'), ' ', '-'), '-+', '-', 'g'));
$$;

create table public.preguntas (
  id integer primary key, curriculum_key text, curriculum text
);
create table public.restricted_question_bank_access (
  user_id uuid primary key, role text not null,
  allowed_curriculum_keys text[] not null
);
insert into public.preguntas values
  (1,'administrativo','administrativo'),
  (2,'electromedicina','electromedicina');
insert into public.restricted_question_bank_access values
  ('11111111-1111-4111-8111-111111111111','restricted_question_bank_viewer',array['administrativo']);

grant select on public.preguntas to anon, authenticated;
grant select on public.restricted_question_bank_access to authenticated;
alter table public.preguntas enable row level security;
alter table public.restricted_question_bank_access enable row level security;
create policy "Enable read access for all users"
  on public.preguntas for select to public using (true);
create policy restricted_question_bank_access_select
  on public.restricted_question_bank_access for select to authenticated
  using (auth.uid() = user_id);
create policy preguntas_select_all
  on public.preguntas for select to public
  using (
    auth.uid() is not null
    and (
      not public.is_restricted_question_bank_viewer()
      or exists (
        select 1 from public.restricted_question_bank_access a
        where a.user_id = auth.uid()
          and a.role='restricted_question_bank_viewer'
          and public.canonicalize_access_key(coalesce(preguntas.curriculum_key,preguntas.curriculum,'')) = any (
            select public.canonicalize_access_key(value)
            from unnest(a.allowed_curriculum_keys) as value(value)
          )
      )
    )
  );

create function app.get_public_guest_practice_batch(
  p_curriculum text default 'general',
  p_batch_size integer default 20,
  p_question_scope text default 'common'
)
returns table(payload jsonb) language sql security definer as $$
  select to_jsonb(p) from public.preguntas p limit 20;
$$;
grant execute on function app.get_public_guest_practice_batch(text,integer,text)
  to anon, authenticated;

-- Reproduce the original problem without copying rows out of the test database.
set role anon;
do $$
begin
  if (select count(*) from public.preguntas) <> 2 then
    raise exception 'Fixture must expose both rows before migration';
  end if;
end
$$;
reset role;

-- Test the same SQL file that is reviewed in the PR.
\ir ../migrations/20261102152700_quantia_secure_question_access.sql

do $$
begin
  if has_table_privilege('anon','public.preguntas','SELECT') then
    raise exception 'Anonymous table read remains enabled';
  end if;
  if has_function_privilege('anon','app.get_public_guest_practice_batch(text,integer,text)','EXECUTE') then
    raise exception 'Anonymous privileged guest RPC remains enabled';
  end if;
end
$$;

-- Verify actual visible rows for the student and restricted-reviewer roles.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
set request.jwt.claim.app_role = '';
do $$
begin
  if (select count(*) from public.preguntas) <> 2 then
    raise exception 'Normal student cannot read their question bank';
  end if;
end
$$;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set request.jwt.claim.app_role = 'restricted_question_bank_viewer';
do $$
begin
  if (select count(*) from public.preguntas) <> 1 then
    raise exception 'Restricted reviewer can read another curriculum';
  end if;
  if not exists (select 1 from public.preguntas where curriculum_key='administrativo') then
    raise exception 'Restricted reviewer cannot read allowed curriculum';
  end if;
end
$$;
reset role;

-- Also run the independent production-safe metadata assertions.
\ir quantia_001_security_checks.sql

select 'QUANTIA AUDIT 001: RLS role smoke tests passed' as result;
