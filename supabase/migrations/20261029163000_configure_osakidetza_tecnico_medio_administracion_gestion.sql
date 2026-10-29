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
  'osakidetza_tecnico_medio_administracion_gestion',
  'Técnico Medio Administración y Gestión',
  true,
  true,
  40
from public.oppositions
where slug = 'osakidetza-tecnico-medio-administracion-y-gestion'
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
    'label', 'Técnico Medio Administración y Gestión',
    'title', 'Técnico Medio Administración y Gestión',
    'shortTitle', 'Administración y Gestión',
    'description', 'Oposición de Técnico/a Medio de Administración y Gestión de Osakidetza.',
    'category', 'sanidad',
    'language', 'es',
    'uiLocale', 'es-ES',
    'curriculum', 'osakidetza_tecnico_medio_administracion_gestion',
    'curriculumKey', 'osakidetza_tecnico_medio_administracion_gestion',
    'curriculum_key', 'osakidetza_tecnico_medio_administracion_gestion',
    'defaultScope', 'all',
    'availableScopes', jsonb_build_array('all', 'common', 'specific'),
    'sharedCommonCurriculum', 'tecnico_superior_administracion_y_gestion',
    'modules', jsonb_build_object(
      'practice', true,
      'analytics', true,
      'questionBank', true
    )
  ),
  now()
from public.oppositions
where slug = 'osakidetza-tecnico-medio-administracion-y-gestion'
on conflict (opposition_id, version) do update
set
  status = excluded.status,
  config_json = excluded.config_json,
  published_at = excluded.published_at,
  updated_at = now();
