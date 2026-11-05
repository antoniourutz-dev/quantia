-- QUANTIA GOLD: non-destructive review of historical access before approving assignments.
-- It does NOT create or restore student permissions automatically.
create or replace function public.admin_student_oppositions(p_student uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_quantia_permission('users.manage')
    or p_student is null
    or public.quantia_is_protected_user(p_student)
  then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_student) then
    raise exception 'Alumno desconocido';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'name', o.display_name,
          'assigned', a.user_id is not null,
          'historicalSessions', (
            select count(*)
            from app.practice_sessions s
            where s.user_id = p_student
              and (
                replace(lower(s.curriculum), '-', '_') = replace(lower(o.slug), '-', '_')
                or lower(s.curriculum) = lower(c.config_json ->> 'curriculum')
              )
          ),
          'previouslySelected', exists (
            select 1
            from public.user_opposition_profiles prof
            where prof.user_id = p_student and prof.opposition_id = o.id
          )
        )
        order by o.display_name
      ),
      '[]'::jsonb
    )
    from public.oppositions o
    left join public.opposition_configs c on c.opposition_id = o.id
    left join public.student_opposition_access a
      on a.opposition_id = o.id and a.user_id = p_student
    where o.is_active or a.user_id is not null
  );
end;
$$;

revoke all on function public.admin_student_oppositions(uuid) from public, anon;
grant execute on function public.admin_student_oppositions(uuid) to authenticated;
