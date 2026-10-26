create table if not exists public.user_question_activity (
  event_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  curriculum text not null,
  session_id text not null,
  surface text not null,
  mode text null,
  question_id text not null,
  question_number integer null,
  question_scope text not null check (question_scope in ('common', 'specific')),
  viewed_at timestamptz not null,
  answered_at timestamptz null,
  is_correct boolean null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_question_activity_user_curriculum_viewed_idx
  on public.user_question_activity (user_id, curriculum, viewed_at desc);

create index if not exists user_question_activity_user_curriculum_question_idx
  on public.user_question_activity (user_id, curriculum, question_scope, question_number, question_id);

create index if not exists user_question_activity_session_idx
  on public.user_question_activity (user_id, session_id);

create or replace function public.preserve_question_activity_answer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_correct is not null and new.is_correct is null then
    new.is_correct := old.is_correct;
    new.answered_at := old.answered_at;
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_question_activity_preserve_answer on public.user_question_activity;
create trigger user_question_activity_preserve_answer
before update on public.user_question_activity
for each row execute function public.preserve_question_activity_answer();

alter table public.user_question_activity enable row level security;

drop policy if exists user_question_activity_select_own on public.user_question_activity;
create policy user_question_activity_select_own
  on public.user_question_activity
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists user_question_activity_insert_own on public.user_question_activity;
create policy user_question_activity_insert_own
  on public.user_question_activity
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists user_question_activity_update_own on public.user_question_activity;
create policy user_question_activity_update_own
  on public.user_question_activity
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists user_question_activity_delete_own on public.user_question_activity;
create policy user_question_activity_delete_own
  on public.user_question_activity
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.user_question_activity from anon;
grant select, insert, update on public.user_question_activity to authenticated;

create or replace function public.get_my_seen_question_ids(p_curriculum text)
returns table(question_id text)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct activity.question_id
  from public.user_question_activity as activity
  where activity.user_id = auth.uid()
    and activity.curriculum = p_curriculum;
$$;

revoke all on function public.get_my_seen_question_ids(text) from public, anon;
grant execute on function public.get_my_seen_question_ids(text) to authenticated;
