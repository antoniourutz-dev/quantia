do $$
begin
  execute $fn$
    create or replace function public.admin_list_tables_v2(p_schema text, p_tables text[])
    returns table(table_name text)
    language sql
    security definer
    set search_path = public
    as $$
      select t.table_name
      from information_schema.tables t
      where t.table_schema = p_schema
        and t.table_type = 'BASE TABLE'
        and t.table_name = any(p_tables)
        and (auth.jwt() ->> 'email') = 'admin@oposik.app';
    $$;
  $fn$;

  execute $fn$
    create or replace function public.admin_get_table_columns_v2(p_schema text, p_table text)
    returns table(
      ordinal_position int,
      column_name text,
      data_type text,
      is_nullable boolean,
      column_default text,
      udt_name text
    )
    language sql
    security definer
    set search_path = public
    as $$
      select
        c.ordinal_position::int,
        c.column_name::text,
        c.data_type::text,
        (c.is_nullable = 'YES') as is_nullable,
        c.column_default::text,
        c.udt_name::text
      from information_schema.columns c
      where c.table_schema = p_schema
        and c.table_name = p_table
        and (auth.jwt() ->> 'email') = 'admin@oposik.app'
      order by c.ordinal_position;
    $$;
  $fn$;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_list_tables'
  ) then
    execute $fn$
      create function public.admin_list_tables(p_tables text[])
      returns table(table_name text)
      language sql
      security definer
      set search_path = public
      as $$
        select t.table_name
        from information_schema.tables t
        where t.table_schema = 'public'
          and t.table_type = 'BASE TABLE'
          and t.table_name = any(p_tables)
          and (auth.jwt() ->> 'email') = 'admin@oposik.app';
      $$;
    $fn$;
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_get_table_columns'
  ) then
    execute $fn$
      create function public.admin_get_table_columns(p_table text)
      returns table(
        ordinal_position int,
        column_name text,
        data_type text,
        is_nullable boolean,
        column_default text,
        udt_name text
      )
      language sql
      security definer
      set search_path = public
      as $$
        select
          c.ordinal_position::int,
          c.column_name::text,
          c.data_type::text,
          (c.is_nullable = 'YES') as is_nullable,
          c.column_default::text,
          c.udt_name::text
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = p_table
          and (auth.jwt() ->> 'email') = 'admin@oposik.app'
        order by c.ordinal_position;
      $$;
    $fn$;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'opposition_configs'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.opposition_configs enable row level security';
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'opposition_configs'
        and policyname = 'opposition_configs_select_all'
    ) then
      execute 'create policy opposition_configs_select_all on public.opposition_configs for select using (true)';
    end if;
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'opposition_configs'
        and policyname = 'opposition_configs_insert_admin'
    ) then
      execute $policy$
        create policy opposition_configs_insert_admin
        on public.opposition_configs
        for insert
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'opposition_configs'
        and policyname = 'opposition_configs_update_admin'
    ) then
      execute $policy$
        create policy opposition_configs_update_admin
        on public.opposition_configs
        for update
        using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'oppositions'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.oppositions enable row level security';
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'oppositions' and policyname = 'oppositions_select_all'
    ) then
      execute 'create policy oppositions_select_all on public.oppositions for select using (true)';
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'oppositions' and policyname = 'oppositions_insert_admin'
    ) then
      execute $policy$
        create policy oppositions_insert_admin
        on public.oppositions
        for insert
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'oppositions' and policyname = 'oppositions_update_admin'
    ) then
      execute $policy$
        create policy oppositions_update_admin
        on public.oppositions
        for update
        using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'general_laws'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.general_laws enable row level security';
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'general_laws' and policyname = 'general_laws_select_all'
    ) then
      execute 'create policy general_laws_select_all on public.general_laws for select using (true)';
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'general_laws' and policyname = 'general_laws_insert_admin'
    ) then
      execute $policy$
        create policy general_laws_insert_admin
        on public.general_laws
        for insert
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'general_laws' and policyname = 'general_laws_update_admin'
    ) then
      execute $policy$
        create policy general_laws_update_admin
        on public.general_laws
        for update
        using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'general_law_blocks'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.general_law_blocks enable row level security';
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'general_law_blocks' and policyname = 'general_law_blocks_select_all'
    ) then
      execute 'create policy general_law_blocks_select_all on public.general_law_blocks for select using (true)';
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'general_law_blocks' and policyname = 'general_law_blocks_insert_admin'
    ) then
      execute $policy$
        create policy general_law_blocks_insert_admin
        on public.general_law_blocks
        for insert
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'general_law_blocks' and policyname = 'general_law_blocks_update_admin'
    ) then
      execute $policy$
        create policy general_law_blocks_update_admin
        on public.general_law_blocks
        for update
        using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'subjects'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.subjects enable row level security';
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'subjects' and policyname = 'subjects_select_all'
    ) then
      execute 'create policy subjects_select_all on public.subjects for select using (true)';
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'subjects' and policyname = 'subjects_insert_admin'
    ) then
      execute $policy$
        create policy subjects_insert_admin
        on public.subjects
        for insert
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'subjects' and policyname = 'subjects_update_admin'
    ) then
      execute $policy$
        create policy subjects_update_admin
        on public.subjects
        for update
        using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'scopes'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.scopes enable row level security';
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'scopes' and policyname = 'scopes_select_all'
    ) then
      execute 'create policy scopes_select_all on public.scopes for select using (true)';
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'scopes' and policyname = 'scopes_insert_admin'
    ) then
      execute $policy$
        create policy scopes_insert_admin
        on public.scopes
        for insert
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'scopes' and policyname = 'scopes_update_admin'
    ) then
      execute $policy$
        create policy scopes_update_admin
        on public.scopes
        for update
        using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'question_scopes'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.question_scopes enable row level security';
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'question_scopes' and policyname = 'question_scopes_select_all'
    ) then
      execute 'create policy question_scopes_select_all on public.question_scopes for select using (true)';
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'question_scopes' and policyname = 'question_scopes_insert_admin'
    ) then
      execute $policy$
        create policy question_scopes_insert_admin
        on public.question_scopes
        for insert
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'question_scopes' and policyname = 'question_scopes_update_admin'
    ) then
      execute $policy$
        create policy question_scopes_update_admin
        on public.question_scopes
        for update
        using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_opposition_profiles'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.user_opposition_profiles enable row level security';
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'user_opposition_profiles' and policyname = 'user_opposition_profiles_select_all'
    ) then
      execute 'create policy user_opposition_profiles_select_all on public.user_opposition_profiles for select using (true)';
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'user_opposition_profiles' and policyname = 'user_opposition_profiles_insert_admin'
    ) then
      execute $policy$
        create policy user_opposition_profiles_insert_admin
        on public.user_opposition_profiles
        for insert
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'user_opposition_profiles' and policyname = 'user_opposition_profiles_update_admin'
    ) then
      execute $policy$
        create policy user_opposition_profiles_update_admin
        on public.user_opposition_profiles
        for update
        using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app'
      and c.relname = 'general_laws'
      and c.relkind = 'r'
  ) then
    execute 'alter table app.general_laws enable row level security';
    if not exists (
      select 1 from pg_policies where schemaname = 'app' and tablename = 'general_laws' and policyname = 'general_laws_select_all'
    ) then
      execute 'create policy general_laws_select_all on app.general_laws for select using (true)';
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'app' and tablename = 'general_laws' and policyname = 'general_laws_insert_admin'
    ) then
      execute $policy$
        create policy general_laws_insert_admin
        on app.general_laws
        for insert
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'app' and tablename = 'general_laws' and policyname = 'general_laws_update_admin'
    ) then
      execute $policy$
        create policy general_laws_update_admin
        on app.general_laws
        for update
        using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app'
      and c.relname = 'general_law_blocks'
      and c.relkind = 'r'
  ) then
    execute 'alter table app.general_law_blocks enable row level security';
    if not exists (
      select 1 from pg_policies where schemaname = 'app' and tablename = 'general_law_blocks' and policyname = 'general_law_blocks_select_all'
    ) then
      execute 'create policy general_law_blocks_select_all on app.general_law_blocks for select using (true)';
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'app' and tablename = 'general_law_blocks' and policyname = 'general_law_blocks_insert_admin'
    ) then
      execute $policy$
        create policy general_law_blocks_insert_admin
        on app.general_law_blocks
        for insert
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'app' and tablename = 'general_law_blocks' and policyname = 'general_law_blocks_update_admin'
    ) then
      execute $policy$
        create policy general_law_blocks_update_admin
        on app.general_law_blocks
        for update
        using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
        with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      $policy$;
    end if;
  end if;
end
$$;
