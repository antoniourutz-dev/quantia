create extension if not exists pgcrypto;

create table if not exists public.user_highlights_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  question_id text not null,
  content_type text not null,
  answer_index integer not null default -1,
  category text null,
  spans jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_highlights_v2_unique
  on public.user_highlights_v2 (user_id, question_id, content_type, answer_index);

alter table public.user_highlights_v2 enable row level security;

drop policy if exists user_highlights_v2_select on public.user_highlights_v2;
create policy user_highlights_v2_select
  on public.user_highlights_v2
  for select
  using (auth.uid() = user_id);

drop policy if exists user_highlights_v2_insert on public.user_highlights_v2;
create policy user_highlights_v2_insert
  on public.user_highlights_v2
  for insert
  with check (auth.uid() = user_id);

drop policy if exists user_highlights_v2_update on public.user_highlights_v2;
create policy user_highlights_v2_update
  on public.user_highlights_v2
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_highlights_v2_delete on public.user_highlights_v2;
create policy user_highlights_v2_delete
  on public.user_highlights_v2
  for delete
  using (auth.uid() = user_id);
