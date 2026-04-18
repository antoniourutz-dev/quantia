create table if not exists public.user_notes (
  user_id uuid not null,
  question_id text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.user_notes enable row level security;

drop policy if exists user_notes_select on public.user_notes;
create policy user_notes_select
  on public.user_notes
  for select
  using (auth.uid() = user_id);

drop policy if exists user_notes_insert on public.user_notes;
create policy user_notes_insert
  on public.user_notes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists user_notes_update on public.user_notes;
create policy user_notes_update
  on public.user_notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_notes_delete on public.user_notes;
create policy user_notes_delete
  on public.user_notes
  for delete
  using (auth.uid() = user_id);

