insert into public.opposition_curriculums (
  opposition_id,
  curriculum_key,
  display_label,
  is_primary,
  is_active,
  sort_order
)
select
  id,
  'osakidetza_electromedicina',
  'Electromedicina',
  true,
  true,
  20
from public.oppositions
where slug = 'osakidetza-electromedicina'
on conflict (curriculum_key) do update
set
  opposition_id = excluded.opposition_id,
  display_label = excluded.display_label,
  is_primary = excluded.is_primary,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.opposition_configs (
  opposition_id,
  version,
  status,
  config_json,
  published_at
)
select
  id,
  1,
  'published',
  jsonb_build_object(
    'label', 'Electromedicina',
    'title', 'Electromedicina',
    'shortTitle', 'Electromedicina',
    'description', 'Oposición de Técnico/a de Instalaciones de Electromedicina de Osakidetza.',
    'category', 'sanidad',
    'language', 'es',
    'uiLocale', 'es-ES',
    'curriculum', 'osakidetza_electromedicina',
    'curriculumKey', 'osakidetza_electromedicina',
    'curriculum_key', 'osakidetza_electromedicina',
    'defaultScope', 'all',
    'availableScopes', jsonb_build_array('all', 'common', 'specific'),
    'sharedCommonCurriculum', 'osakidetza_admin',
    'modules', jsonb_build_object(
      'practice', true,
      'analytics', true,
      'questionBank', true
    )
  ),
  now()
from public.oppositions
where slug = 'osakidetza-electromedicina'
on conflict (opposition_id, version) do update
set
  status = excluded.status,
  config_json = excluded.config_json,
  published_at = excluded.published_at,
  updated_at = now();
