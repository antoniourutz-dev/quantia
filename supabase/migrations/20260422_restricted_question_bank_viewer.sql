do $$
begin
  create or replace function public.is_restricted_question_bank_viewer()
  returns boolean
  language sql
  stable
as $fn$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role')::text, '') = 'restricted_question_bank_viewer';
$fn$;

  create or replace function public.canonicalize_access_key(value text)
  returns text
  language sql
  immutable
as $fn$
  select lower(regexp_replace(replace(replace(coalesce(value, ''), '_', '-'), ' ', '-'), '-+', '-', 'g'));
$fn$;
end
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'app') then
    execute $sql$
      create or replace function app.assert_not_restricted_question_bank_viewer()
      returns void
      language plpgsql
      security invoker
    as $fn$
    begin
      if public.is_restricted_question_bank_viewer() then
        raise exception 'Acceso denegado.';
      end if;
    end;
    $fn$;
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'restricted_question_bank_access'
      and c.relkind = 'r'
  ) then
    execute $sql$
      create table public.restricted_question_bank_access (
        user_id uuid primary key,
        role text not null default 'restricted_question_bank_viewer',
        allowed_curriculum_keys text[] not null default array[]::text[],
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  end if;

  execute 'alter table public.restricted_question_bank_access enable row level security';

  execute 'drop policy if exists restricted_question_bank_access_select on public.restricted_question_bank_access';
  execute $policy$
    create policy restricted_question_bank_access_select
    on public.restricted_question_bank_access
    for select
    using (
      auth.uid() = user_id
      or (auth.jwt() ->> 'email') = 'admin@oposik.app'
    )
  $policy$;

  execute 'drop policy if exists restricted_question_bank_access_insert_admin on public.restricted_question_bank_access';
  execute $policy$
    create policy restricted_question_bank_access_insert_admin
    on public.restricted_question_bank_access
    for insert
    with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
  $policy$;

  execute 'drop policy if exists restricted_question_bank_access_update_admin on public.restricted_question_bank_access';
  execute $policy$
    create policy restricted_question_bank_access_update_admin
    on public.restricted_question_bank_access
    for update
    using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
    with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
  $policy$;

  execute 'drop policy if exists restricted_question_bank_access_delete_admin on public.restricted_question_bank_access';
  execute $policy$
    create policy restricted_question_bank_access_delete_admin
    on public.restricted_question_bank_access
    for delete
    using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
  $policy$;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'preguntas'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.preguntas enable row level security';
    execute 'drop policy if exists preguntas_select_all on public.preguntas';
    execute $policy$
      create policy preguntas_select_all
      on public.preguntas
      for select
      using (
        not public.is_restricted_question_bank_viewer()
        or exists (
          select 1
          from public.restricted_question_bank_access a
          where a.user_id = auth.uid()
            and a.role = 'restricted_question_bank_viewer'
            and public.canonicalize_access_key(coalesce(curriculum_key, curriculum, '')) = any (
              select public.canonicalize_access_key(value) from unnest(a.allowed_curriculum_keys) as value
            )
        )
      )
    $policy$;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_notes'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.user_notes enable row level security';
    execute 'drop policy if exists user_notes_select on public.user_notes';
    execute $policy$
      create policy user_notes_select
      on public.user_notes
      for select
      using (auth.uid() = user_id and not public.is_restricted_question_bank_viewer())
    $policy$;
    execute 'drop policy if exists user_notes_insert on public.user_notes';
    execute $policy$
      create policy user_notes_insert
      on public.user_notes
      for insert
      with check (auth.uid() = user_id and not public.is_restricted_question_bank_viewer())
    $policy$;
    execute 'drop policy if exists user_notes_update on public.user_notes';
    execute $policy$
      create policy user_notes_update
      on public.user_notes
      for update
      using (auth.uid() = user_id and not public.is_restricted_question_bank_viewer())
      with check (auth.uid() = user_id and not public.is_restricted_question_bank_viewer())
    $policy$;
    execute 'drop policy if exists user_notes_delete on public.user_notes';
    execute $policy$
      create policy user_notes_delete
      on public.user_notes
      for delete
      using (auth.uid() = user_id and not public.is_restricted_question_bank_viewer())
    $policy$;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_highlights_v2'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.user_highlights_v2 enable row level security';
    execute 'drop policy if exists user_highlights_v2_select on public.user_highlights_v2';
    execute $policy$
      create policy user_highlights_v2_select
      on public.user_highlights_v2
      for select
      using (auth.uid() = user_id and not public.is_restricted_question_bank_viewer())
    $policy$;
    execute 'drop policy if exists user_highlights_v2_insert on public.user_highlights_v2';
    execute $policy$
      create policy user_highlights_v2_insert
      on public.user_highlights_v2
      for insert
      with check (auth.uid() = user_id and not public.is_restricted_question_bank_viewer())
    $policy$;
    execute 'drop policy if exists user_highlights_v2_update on public.user_highlights_v2';
    execute $policy$
      create policy user_highlights_v2_update
      on public.user_highlights_v2
      for update
      using (auth.uid() = user_id and not public.is_restricted_question_bank_viewer())
      with check (auth.uid() = user_id and not public.is_restricted_question_bank_viewer())
    $policy$;
    execute 'drop policy if exists user_highlights_v2_delete on public.user_highlights_v2';
    execute $policy$
      create policy user_highlights_v2_delete
      on public.user_highlights_v2
      for delete
      using (auth.uid() = user_id and not public.is_restricted_question_bank_viewer())
    $policy$;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_opposition_profiles'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.user_opposition_profiles enable row level security';
    execute 'drop policy if exists user_opposition_profiles_select_all on public.user_opposition_profiles';
    execute $policy$
      create policy user_opposition_profiles_select_own
      on public.user_opposition_profiles
      for select
      using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'admin@oposik.app')
    $policy$;
  end if;
end
$$;
