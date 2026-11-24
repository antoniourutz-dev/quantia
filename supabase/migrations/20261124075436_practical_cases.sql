-- Material is imported separately through an authenticated administrative channel.
-- Never commit statements or original PNG bytes to the public repository.
create table public.practical_cases (
  id uuid primary key default gen_random_uuid(),
  opposition_id uuid not null references public.oppositions(id),
  curriculum_key text not null,
  case_number integer not null check (case_number > 0),
  title text not null,
  statement text not null,
  source_title text not null,
  source_pages integer[] not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  unique (opposition_id, case_number)
);
create index practical_cases_curriculum_idx on public.practical_cases(curriculum_key,status);
create table public.practical_case_questions (
  case_id uuid not null references public.practical_cases(id) on delete cascade,
  question_id bigint not null references public.preguntas(id),
  position integer not null check (position > 0),
  primary key (case_id,question_id),
  unique (question_id),
  unique (case_id,position)
);
create table public.practical_case_assets (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.practical_cases(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  source_page integer not null check (source_page > 0),
  mime_type text not null default 'image/png' check (mime_type='image/png'),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  unique (case_id,position)
);
-- Small initial collection: protected, integrity-checked PNG chunks. Separate
-- metadata avoids downloading binary content when listing cases. No public URLs.
create table public.practical_case_asset_chunks (
  asset_id uuid not null references public.practical_case_assets(id) on delete cascade,
  part integer not null check (part >= 0),
  png_base64 text not null check (length(png_base64) between 1 and 400000 and png_base64 ~ '^[A-Za-z0-9+/=]+$'),
  primary key (asset_id,part)
);
alter table public.practical_cases enable row level security;
alter table public.practical_case_questions enable row level security;
alter table public.practical_case_assets enable row level security;
alter table public.practical_case_asset_chunks enable row level security;
revoke all on public.practical_cases, public.practical_case_questions, public.practical_case_assets, public.practical_case_asset_chunks from public, anon, authenticated;
grant select on public.practical_cases, public.practical_case_questions, public.practical_case_assets, public.practical_case_asset_chunks to authenticated;
create policy practical_cases_assigned_read on public.practical_cases for select to authenticated using (
  status='published' and (
    opposition_id in (select public.student_allowed_opposition_ids())
    or (select public.has_quantia_permission('questions.manage'))
    or (select public.has_quantia_permission('quality.manage'))
    or (select public.has_quantia_permission('statistics.read'))
  )
);
create policy practical_case_questions_assigned_read on public.practical_case_questions for select to authenticated using (
  exists (select 1 from public.practical_cases c where c.id=case_id and c.status='published' and (c.opposition_id in (select public.student_allowed_opposition_ids()) or (select public.has_quantia_permission('questions.manage')) or (select public.has_quantia_permission('quality.manage')) or (select public.has_quantia_permission('statistics.read'))))
  and exists (select 1 from public.preguntas p where p.id=question_id)
);
create policy practical_case_assets_assigned_read on public.practical_case_assets for select to authenticated using (
  exists (select 1 from public.practical_cases c where c.id=case_id and c.status='published' and (c.opposition_id in (select public.student_allowed_opposition_ids()) or (select public.has_quantia_permission('questions.manage')) or (select public.has_quantia_permission('quality.manage')) or (select public.has_quantia_permission('statistics.read'))))
);
create policy practical_case_chunks_assigned_read on public.practical_case_asset_chunks for select to authenticated using (
  exists (select 1 from public.practical_case_assets a join public.practical_cases c on c.id=a.case_id where a.id=asset_id and c.status='published' and (c.opposition_id in (select public.student_allowed_opposition_ids()) or (select public.has_quantia_permission('questions.manage')) or (select public.has_quantia_permission('quality.manage')) or (select public.has_quantia_permission('statistics.read'))))
);

-- Enforce opposition consistency without updating or adding columns to preguntas.
create function public.validate_practical_case_question() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not exists (
    select 1 from public.preguntas p join public.practical_cases c on c.opposition_id=p.opposition_id
    where p.id=new.question_id and c.id=new.case_id and p.grupo::text='especifico'
  ) then
    raise exception 'Case question must belong to the same opposition and specific bank';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_practical_case_question() from public,anon,authenticated;
create trigger validate_practical_case_question before insert or update on public.practical_case_questions
for each row execute function public.validate_practical_case_question();
