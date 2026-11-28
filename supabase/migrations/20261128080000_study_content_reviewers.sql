-- Revisores del temario: cuentas que pueden ver los borradores sin tener permisos de administración.
create table private.study_content_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  note text
);
revoke all on private.study_content_reviewers from public, anon, authenticated;

create or replace function public.can_preview_study_content()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    public.has_quantia_permission('quality.manage')
    or public.has_quantia_permission('questions.manage')
    or exists (select 1 from private.study_content_reviewers r where r.user_id = (select auth.uid())),
    false)
$$;

-- Las altas de revisores se hacen aparte (datos, no esquema).
