-- Temario de estudio: el texto de cada tema en versiones inmutables y las
-- anotaciones personales del alumno (subrayados, notas, marcadores, progreso).
--
-- Esta migración no contiene material docente. El texto se importa aparte por un
-- canal administrativo autorizado y nunca se versiona en este repositorio público.

-- 1. Oposición: Gobierno Vasco · Escala Administrativa C1 · OPE 2026 -----------------
insert into public.oppositions (slug, code, display_name, short_name, category, is_active, default_language, ui_locale)
values ('gv-administrativo-c1-2026', 'GV_ADM_C1_2026', 'Gobierno Vasco · Administrativo C1 · OPE 2026',
        'GV Administrativo C1', 'administracion', true, 'es', 'es-ES')
on conflict (slug) do nothing;

insert into public.opposition_curriculums (opposition_id, curriculum_key, display_label, is_primary, is_active, sort_order)
select id, 'gv_adm_c1_2026', 'Temario · Escala Administrativa C1', true, true, 60
from public.oppositions where slug = 'gv-administrativo-c1-2026'
on conflict (curriculum_key) do nothing;

insert into public.opposition_configs (opposition_id, version, status, config_json, published_at)
select id, 1, 'published', jsonb_build_object(
  'label', 'Administrativo C1 · Gobierno Vasco',
  'title', 'Administrativo C1 · Gobierno Vasco',
  'shortTitle', 'GV Administrativo C1',
  'description', 'Escala Administrativa (C1) de la Administración General de la CAE y sus OOAA, OPE 2026. Temario de estudio de los 34 temas del anexo II.',
  'category', 'administracion',
  'language', 'es',
  'uiLocale', 'es-ES',
  'curriculum', 'gv_adm_c1_2026',
  'curriculumKey', 'gv_adm_c1_2026',
  'curriculum_key', 'gv_adm_c1_2026',
  'defaultScope', 'all',
  'availableScopes', jsonb_build_array('all'),
  'modules', jsonb_build_object('practice', false, 'analytics', false, 'questionBank', false, 'studyTopics', true)
), now()
from public.oppositions where slug = 'gv-administrativo-c1-2026'
on conflict (opposition_id, version) do nothing;

-- 2. Contenido -----------------------------------------------------------------------
create table public.study_topics (
  id uuid primary key default gen_random_uuid(),
  opposition_id uuid not null references public.oppositions(id),
  curriculum_key text not null,
  code text not null unique check (code ~ '^[A-Z0-9-]{3,64}$'),
  topic_number integer not null check (topic_number > 0),
  title text not null check (length(title) between 1 and 600),
  official_statement text check (length(official_statement) <= 4000),
  sort_order integer not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opposition_id, topic_number)
);
create index study_topics_curriculum_idx on public.study_topics (curriculum_key, status, sort_order);

create table public.study_documents (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.study_topics(id) on delete restrict,
  kind text not null check (kind in ('manual', 'repaso', 'cuaderno', 'soluciones', 'errores')),
  title text not null check (length(title) between 1 and 200),
  sort_order integer not null,
  unique (topic_id, kind)
);

-- Cada versión es una fila nueva. El texto y sus huellas no se pueden cambiar.
create table public.study_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.study_documents(id) on delete restrict,
  version text not null check (version ~ '^[0-9]+\.[0-9]+$'),
  version_date date,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  body_md text not null check (length(body_md) between 1 and 600000),
  body_sha256 text not null check (body_sha256 ~ '^[a-f0-9]{64}$'),
  source_path text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  word_count integer not null check (word_count >= 0),
  normative_note text check (length(normative_note) <= 2000),
  sources_note text check (length(sources_note) <= 4000),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  retired_at timestamptz,
  unique (document_id, version)
);
create unique index study_document_versions_one_published
  on public.study_document_versions (document_id) where status = 'published';

create function public.guard_study_document_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.body_sha256 <> encode(sha256(convert_to(new.body_md, 'UTF8')), 'hex') then
      raise exception 'body_sha256 does not match body_md';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Only draft study versions can be deleted';
    end if;
    return old;
  end if;
  if new.document_id is distinct from old.document_id or new.version is distinct from old.version
     or new.body_md is distinct from old.body_md or new.body_sha256 is distinct from old.body_sha256
     or new.source_path is distinct from old.source_path or new.source_sha256 is distinct from old.source_sha256
     or new.word_count is distinct from old.word_count or new.created_at is distinct from old.created_at then
    raise exception 'Study versions are immutable: create a new version instead';
  end if;
  if not ((old.status = new.status) or (old.status = 'draft' and new.status = 'published')
          or (old.status = 'published' and new.status = 'retired')) then
    raise exception 'Invalid study version status change % -> %', old.status, new.status;
  end if;
  if new.status = 'published' and old.status = 'draft' then new.published_at := coalesce(new.published_at, now()); end if;
  if new.status = 'retired' and old.status = 'published' then new.retired_at := coalesce(new.retired_at, now()); end if;
  return new;
end;
$$;
revoke all on function public.guard_study_document_version() from public, anon, authenticated;
create trigger guard_study_document_version before insert or update or delete on public.study_document_versions
for each row execute function public.guard_study_document_version();

-- 3. Anotaciones y progreso del alumno ------------------------------------------------
create table public.user_study_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null references public.study_documents(id) on delete cascade,
  version_id uuid not null references public.study_document_versions(id) on delete cascade,
  kind text not null check (kind in ('highlight', 'note', 'bookmark')),
  color text check (color is null or color in ('yellow', 'green', 'blue', 'pink', 'orange')),
  spans jsonb not null default '[]'::jsonb
    check (jsonb_typeof(spans) = 'array' and jsonb_array_length(spans) <= 200),
  anchor_block text check (length(anchor_block) <= 64),
  quote text check (length(quote) <= 8000),
  note text check (length(note) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_study_annotations_user_doc_idx on public.user_study_annotations (user_id, document_id);

create table public.user_study_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null references public.study_documents(id) on delete cascade,
  version_id uuid not null references public.study_document_versions(id) on delete cascade,
  progress numeric(5,4) not null default 0 check (progress between 0 and 1),
  last_block text check (length(last_block) <= 64),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, document_id)
);

-- 4. Acceso ----------------------------------------------------------------------------
-- Alumnos: solo lo publicado de las oposiciones que tienen asignadas.
-- Personal de calidad/contenido: también los borradores, para revisarlos antes de publicar.
create function public.can_preview_study_content() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.has_quantia_permission('quality.manage') or public.has_quantia_permission('questions.manage'), false)
$$;
revoke all on function public.can_preview_study_content() from public, anon;
grant execute on function public.can_preview_study_content() to authenticated;

alter table public.study_topics enable row level security;
alter table public.study_documents enable row level security;
alter table public.study_document_versions enable row level security;
alter table public.user_study_annotations enable row level security;
alter table public.user_study_progress enable row level security;

revoke all on public.study_topics, public.study_documents, public.study_document_versions,
  public.user_study_annotations, public.user_study_progress from public, anon, authenticated;
grant select on public.study_topics, public.study_documents, public.study_document_versions to authenticated;
grant select, insert, update, delete on public.user_study_annotations, public.user_study_progress to authenticated;

create policy study_topics_read on public.study_topics for select to authenticated using (
  (status = 'published' and opposition_id in (select public.student_allowed_opposition_ids()))
  or (select public.can_preview_study_content())
);
create policy study_documents_read on public.study_documents for select to authenticated using (
  exists (select 1 from public.study_topics t where t.id = topic_id)
);
create policy study_document_versions_read on public.study_document_versions for select to authenticated using (
  (status = 'published' and exists (
     select 1 from public.study_documents d join public.study_topics t on t.id = d.topic_id
     where d.id = document_id and t.status = 'published'))
  or (select public.can_preview_study_content())
);

create policy user_study_annotations_own_select on public.user_study_annotations for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_study_annotations_own_insert on public.user_study_annotations for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.study_document_versions v where v.id = version_id and v.document_id = user_study_annotations.document_id));
create policy user_study_annotations_own_update on public.user_study_annotations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.study_document_versions v where v.id = version_id and v.document_id = user_study_annotations.document_id));
create policy user_study_annotations_own_delete on public.user_study_annotations for delete to authenticated
  using (user_id = (select auth.uid()));

create policy user_study_progress_own_select on public.user_study_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_study_progress_own_insert on public.user_study_progress for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.study_document_versions v where v.id = version_id and v.document_id = user_study_progress.document_id));
create policy user_study_progress_own_update on public.user_study_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.study_document_versions v where v.id = version_id and v.document_id = user_study_progress.document_id));
create policy user_study_progress_own_delete on public.user_study_progress for delete to authenticated
  using (user_id = (select auth.uid()));
