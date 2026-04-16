create or replace function public.admin_set_active_opposition_context(p_user_id uuid, p_opposition_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and (auth.jwt() ->> 'email') <> 'admin@oposik.app' then
    raise exception 'forbidden';
  end if;

  update public.user_opposition_profiles
  set is_active_context = false,
      updated_at = now()
  where user_id = p_user_id
    and is_active_context = true;

  update public.user_opposition_profiles
  set is_active_context = true,
      updated_at = now()
  where user_id = p_user_id
    and opposition_id = p_opposition_id;

  if not found then
    begin
      insert into public.user_opposition_profiles (
        user_id,
        opposition_id,
        is_primary,
        is_active_context,
        onboarding_completed
      ) values (
        p_user_id,
        p_opposition_id,
        false,
        true,
        false
      );
    exception when unique_violation then
      update public.user_opposition_profiles
      set is_active_context = true,
          updated_at = now()
      where user_id = p_user_id
        and opposition_id = p_opposition_id;
    end;
  end if;
end;
$$;
