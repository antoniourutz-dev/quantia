create table if not exists public.login_usernames (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint login_usernames_normalized check (username = lower(btrim(username)) and length(username) between 1 and 254)
);

alter table public.login_usernames enable row level security;
revoke all on table public.login_usernames from anon, authenticated;
grant select, insert, update, delete on table public.login_usernames to service_role;

create or replace function public.sync_login_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  candidate := lower(btrim(coalesce(
    nullif(new.raw_user_meta_data ->> 'current_username', ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    nullif(new.raw_app_meta_data ->> 'current_username', ''),
    nullif(new.raw_app_meta_data ->> 'username', ''),
    nullif(new.raw_app_meta_data ->> 'preferred_username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  )));

  delete from public.login_usernames where user_id = new.id;

  if candidate is not null and length(candidate) between 1 and 254 then
    insert into public.login_usernames (user_id, username)
    values (new.id, candidate)
    on conflict (username) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_login_username() from public, anon, authenticated;

with candidates as (
  select
    id as user_id,
    lower(btrim(coalesce(
      nullif(raw_user_meta_data ->> 'current_username', ''),
      nullif(raw_user_meta_data ->> 'username', ''),
      nullif(raw_user_meta_data ->> 'preferred_username', ''),
      nullif(raw_app_meta_data ->> 'current_username', ''),
      nullif(raw_app_meta_data ->> 'username', ''),
      nullif(raw_app_meta_data ->> 'preferred_username', ''),
      nullif(split_part(coalesce(email, ''), '@', 1), '')
    ))) as username,
    created_at
  from auth.users
), ranked as (
  select *, row_number() over (partition by username order by created_at, user_id) as position
  from candidates
  where username is not null and length(username) between 1 and 254
)
insert into public.login_usernames (user_id, username)
select user_id, username
from ranked
where position = 1
on conflict do nothing;

drop trigger if exists sync_login_username_on_auth_user on auth.users;
create trigger sync_login_username_on_auth_user
after insert or update of email, raw_user_meta_data, raw_app_meta_data on auth.users
for each row execute function public.sync_login_username();

create table if not exists public.login_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 1 check (attempt_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.login_rate_limits enable row level security;
revoke all on table public.login_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.login_rate_limits to service_role;

create or replace function public.consume_login_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
  cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
begin
  if p_key_hash is null or p_key_hash = '' or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  insert into public.login_rate_limits as limits (
    key_hash,
    window_started_at,
    attempt_count,
    updated_at
  )
  values (p_key_hash, now(), 1, now())
  on conflict (key_hash) do update
  set
    window_started_at = case
      when limits.window_started_at <= cutoff then now()
      else limits.window_started_at
    end,
    attempt_count = case
      when limits.window_started_at <= cutoff then 1
      else limits.attempt_count + 1
    end,
    updated_at = now()
  returning attempt_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_login_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_login_rate_limit(text, integer, integer) to service_role;
