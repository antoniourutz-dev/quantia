create table if not exists public.question_errata_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  question_id text not null,
  curriculum text not null,
  category text not null check (
    category in ('wrong_answer', 'outdated_law', 'ambiguous_wording', 'typo', 'other')
  ),
  comment text not null default '',
  status text not null default 'pending' check (
    status in ('pending', 'reviewed', 'resolved', 'dismissed')
  ),
  created_at timestamptz not null default now()
);

create index if not exists idx_question_errata_reports_user_question
  on public.question_errata_reports (user_id, question_id);

create index if not exists idx_question_errata_reports_curriculum_status
  on public.question_errata_reports (curriculum, status, created_at desc);

alter table public.question_errata_reports enable row level security;

drop policy if exists "question_errata_reports_select_own" on public.question_errata_reports;
create policy "question_errata_reports_select_own"
  on public.question_errata_reports
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.has_quantia_permission('quality.manage')
  );

drop policy if exists "question_errata_reports_insert_own" on public.question_errata_reports;
create policy "question_errata_reports_insert_own"
  on public.question_errata_reports
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "question_errata_reports_update_quality_manager" on public.question_errata_reports;
create policy "question_errata_reports_update_quality_manager"
  on public.question_errata_reports
  for update
  to authenticated
  using (public.has_quantia_permission('quality.manage'))
  with check (public.has_quantia_permission('quality.manage'));
