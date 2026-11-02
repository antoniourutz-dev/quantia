-- Ejecutar tras la migración en staging y, solo tras aprobación, producción.
-- No consulta filas de preguntas ni datos de alumnos.
do $assert$
begin
  if not (select relrowsecurity from pg_class where oid='public.preguntas'::regclass) then
    raise exception 'FAIL RLS deshabilitada';
  end if;
  if has_table_privilege('anon','public.preguntas','SELECT') then
    raise exception 'FAIL SELECT anon';
  end if;
  if not has_table_privilege('authenticated','public.preguntas','SELECT') then
    raise exception 'FAIL SELECT alumno';
  end if;
  if exists (select 1 from pg_policies
             where schemaname='public' and tablename='preguntas'
               and policyname='Enable read access for all users') then
    raise exception 'FAIL política histórica';
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='preguntas'
                   and policyname='preguntas_select_all' and cmd='SELECT'
                   and 'authenticated'::name=any(roles)) then
    raise exception 'FAIL política SELECT alumno';
  end if;
  if to_regprocedure('app.get_public_guest_practice_batch(text,integer,text)') is not null
     and has_function_privilege('anon','app.get_public_guest_practice_batch(text,integer,text)','EXECUTE') then
    raise exception 'FAIL RPC guest anónimo';
  end if;
  raise notice 'OK controles estructurales QUANTIA001';
end
$assert$;

-- Son OBLIGATORIOS también ensayos REALES por API/JWT:
-- anon, alumno, revisor restringido, administrador, otras apps compartidas.
-- Auditar los RPC SECURITY DEFINER restantes: no heredan restricciones RLS.
