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
  'osakidetza_mantenimiento_instalaciones',
  'Técnico Medio Mantenimiento',
  true,
  true,
  30
from public.oppositions
where slug = 'osakidetza-mantenimiento-instalaciones'
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
    'label', 'Técnico Medio Mantenimiento',
    'title', 'Técnico Medio Mantenimiento',
    'shortTitle', 'Mantenimiento',
    'description', 'Oposición de Técnico/a Medio de Mantenimiento e Instalaciones de Osakidetza.',
    'category', 'sanidad',
    'language', 'es',
    'uiLocale', 'es-ES',
    'curriculum', 'osakidetza_mantenimiento_instalaciones',
    'curriculumKey', 'osakidetza_mantenimiento_instalaciones',
    'curriculum_key', 'osakidetza_mantenimiento_instalaciones',
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
where slug = 'osakidetza-mantenimiento-instalaciones'
on conflict (opposition_id, version) do update
set
  status = excluded.status,
  config_json = excluded.config_json,
  published_at = excluded.published_at,
  updated_at = now();
