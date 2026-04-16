do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'preguntas'
      and c.relkind = 'r'
  ) then
    raise notice 'Tabla public.preguntas no encontrada; no se aplica migración.';
    return;
  end if;

  execute 'alter table public.preguntas enable row level security';

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'preguntas'
      and policyname = 'preguntas_select_all'
  ) then
    execute 'create policy preguntas_select_all on public.preguntas for select using (true)';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'preguntas'
      and policyname = 'preguntas_insert_admin'
  ) then
    execute $policy$
      create policy preguntas_insert_admin
      on public.preguntas
      for insert
      with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'preguntas'
      and policyname = 'preguntas_update_admin'
  ) then
    execute $policy$
      create policy preguntas_update_admin
      on public.preguntas
      for update
      using ((auth.jwt() ->> 'email') = 'admin@oposik.app')
      with check ((auth.jwt() ->> 'email') = 'admin@oposik.app')
    $policy$;
  end if;
end
$$;

