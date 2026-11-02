-- QUANTIA AUDIT 001: restringir acceso directo a preguntas y RPC de invitado.
-- PENDIENTE DE DESPLIEGUE. Aplicar únicamente tras validar consumidores
-- de todas las aplicaciones que comparten el proyecto y probar en staging.
-- Migración intencionalmente limitada: no modifica datos ni otros RPC.

begin;

do $audit$
begin
  if to_regclass('public.preguntas') is null then
    raise exception 'QUANTIA001: falta public.preguntas';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='preguntas'
      and policyname='preguntas_select_all' and cmd='SELECT'
      and qual like '%auth.uid()%'
  ) then
    raise exception 'QUANTIA001: política autenticada no coincide; revisar sin aplicar';
  end if;
end
$audit$;

alter table public.preguntas enable row level security;
drop policy if exists "Enable read access for all users" on public.preguntas;
alter policy preguntas_select_all on public.preguntas to authenticated;
revoke select on table public.preguntas from public, anon;
grant select on table public.preguntas to authenticated;

-- El frontend actual exige login; no implementa una sesión de prueba pública.
-- El RPC heredado usa SECURITY DEFINER y devuelve filas completas de preguntas.
-- Validar consumidores externos antes de aplicar a la instancia compartida.
do $audit$
begin
  if to_regprocedure('app.get_public_guest_practice_batch(text,integer,text)') is not null then
    execute 'revoke execute on function app.get_public_guest_practice_batch(text,integer,text) from public, anon, authenticated';
  end if;
end
$audit$;

do $audit$
begin
  if has_table_privilege('anon','public.preguntas','SELECT') then
    raise exception 'QUANTIA001: anon conserva SELECT de preguntas';
  end if;
  if not has_table_privilege('authenticated','public.preguntas','SELECT') then
    raise exception 'QUANTIA001: alumno autenticado ha perdido SELECT';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='preguntas'
      and cmd='SELECT' and permissive='PERMISSIVE'
      and policyname='Enable read access for all users'
  ) then
    raise exception 'QUANTIA001: política antigua continúa presente';
  end if;
  if to_regprocedure('app.get_public_guest_practice_batch(text,integer,text)') is not null
     and has_function_privilege('anon','app.get_public_guest_practice_batch(text,integer,text)','EXECUTE') then
    raise exception 'QUANTIA001: anon conserva ejecución del RPC de invitado';
  end if;
end
$audit$;

commit;
