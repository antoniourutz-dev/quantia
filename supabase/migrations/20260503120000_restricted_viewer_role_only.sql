-- Align DB helper with app RBAC: restricted viewers are identified only by JWT app_metadata.role.
create or replace function public.is_restricted_question_bank_viewer()
returns boolean
language sql
stable
as $fn$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role')::text, '') = 'restricted_question_bank_viewer';
$fn$;
