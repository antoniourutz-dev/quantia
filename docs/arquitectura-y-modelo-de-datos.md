# Arquitectura y modelo de datos de `dashb`

## 1. Resumen ejecutivo

Esta aplicación es una plataforma de estudio de oposiciones construida con:

- Frontend: React 18 + Vite + TypeScript + Tailwind.
- Backend: Supabase.
- Persistencia principal:
  - `public.preguntas` como banco de preguntas.
  - esquema `app` para sesiones, métricas y RPCs analíticas.
  - tablas auxiliares en `public` para contexto de oposición, notas, highlights y acceso restringido.

La lógica funcional está dividida en tres modos:

1. Alumno autenticado normal.
2. Revisor restringido del banco de preguntas.
3. Administrador (`admin@oposik.app`).

## 2. Cómo funciona la aplicación

## 2.1 Entrada y autenticación

- La app arranca en [src/App.tsx](../src/App.tsx).
- Si no hay sesión, muestra `AuthScreen`.
- El login principal usa la Edge Function `login-with-username` y, si falla, hace fallback a login por email.
- La sesión de Supabase decide qué shell se monta:
  - `AuthenticatedAppShell` para usuarios normales.
  - `RestrictedQuestionBankShell` para usuarios con `app_metadata.role = restricted_question_bank_viewer`.

Archivos clave:

- [src/App.tsx](../src/App.tsx)
- [src/lib/auth.ts](../src/lib/auth.ts)
- [supabase/functions/login-with-username/index.ts](../supabase/functions/login-with-username/index.ts)

## 2.2 Shell de usuario normal

La shell principal está en [src/components/app/AuthenticatedAppShell.tsx](../src/components/app/AuthenticatedAppShell.tsx).

Desde ahí el usuario puede:

- ver dashboard,
- lanzar tests,
- hacer repaso por fallos,
- estudiar por bloques,
- abrir banco de preguntas,
- ver estadísticas,
- ajustar objetivo de examen,
- si es admin, abrir paneles de gestión.

La app carga datos desde `src/lib/quantiaApi.ts`, que es el verdadero gateway de negocio del frontend.

## 2.3 Shell de revisor restringido

`RestrictedQuestionBankShell` solo permite:

- elegir entre currículums autorizados,
- navegar el banco de preguntas,
- cerrar sesión.

No permite:

- notas,
- highlights,
- sesiones,
- paneles avanzados.

Archivo clave:

- [src/components/app/RestrictedQuestionBankShell.tsx](../src/components/app/RestrictedQuestionBankShell.tsx)

## 2.4 Módulo de estudio y banco de preguntas

La app ofrece dos maneras de consumir preguntas:

1. Sesión de práctica o estudio.
2. Banco de preguntas navegable.

El banco de preguntas:

- pagina preguntas por currículum y ámbito (`common` o `specific`),
- deja buscar por número o texto,
- resuelve el detalle completo de una pregunta al seleccionarla.

Archivos clave:

- [src/components/StudyQuestionBank.tsx](../src/components/StudyQuestionBank.tsx)
- [src/lib/questionBankApi.ts](../src/lib/questionBankApi.ts)
- [src/lib/quantiaApi.ts](../src/lib/quantiaApi.ts)

## 2.5 Panel de administración

El admin tiene tres áreas:

1. Dashboard ejecutivo.
2. Gestión de alumnos.
3. Gestión de preguntas.
4. Gestión de catálogos.

Archivos clave:

- [src/components/admin/AdminDashboard.tsx](../src/components/admin/AdminDashboard.tsx)
- [src/components/admin/AdminStudents.tsx](../src/components/admin/AdminStudents.tsx)
- [src/components/admin/AdminQuestions.tsx](../src/components/admin/AdminQuestions.tsx)
- [src/components/admin/AdminCatalogs.tsx](../src/components/admin/AdminCatalogs.tsx)
- [supabase/functions/admin-users/index.ts](../supabase/functions/admin-users/index.ts)

## 3. Nivel de certeza del modelo de datos

Para seguir ampliando esta app hay que distinguir tres niveles:

### A. Estructura exacta confirmada por migraciones del repo

Tablas creadas explícitamente aquí:

- `public.user_notes`
- `public.user_highlights_v2`
- `public.restricted_question_bank_access`

Funciones y policies confirmadas:

- `public.get_user_question_friction`
- `public.admin_set_active_opposition_context`
- `public.admin_list_tables_v2`
- `public.admin_get_table_columns_v2`
- RLS sobre `preguntas`, `user_notes`, `user_highlights_v2`, `user_opposition_profiles` y catálogos.

### B. Estructura confirmada por lecturas/escrituras del código

Aunque la SQL completa no está en el repo, el código escribe y lee estos objetos con suficiente claridad:

- `public.preguntas`
- `public.oppositions`
- `public.opposition_configs`
- `public.subjects`
- `public.question_scopes`
- `public.user_opposition_profiles`
- `app.general_laws`
- `app.general_law_blocks`
- `app.practice_sessions`
- `app.practice_profiles`
- `app.user_question_state`
- `app.question_attempt_events`
- `app.practice_attempts`
- `app.exam_targets`
- `public.profiles` o `app.user_profiles` como tabla opcional de perfil/nombre

### C. Estructura inferida pero no garantizada al 100% desde este repo

Estas partes dependen de objetos que el frontend consume pero cuya definición SQL no está versionada aquí:

- RPCs del esquema `app`:
  - `get_my_account_identity`
  - `get_readiness_dashboard`
  - `get_readiness_dashboard_v2`
  - `get_pressure_dashboard`
  - `get_pressure_dashboard_v2`
  - `get_practice_catalog_summary`
  - `get_random_practice_batch`
  - `get_weak_practice_batch`
  - `get_study_questions`
  - `get_category_risk_dashboard`
  - `set_my_exam_target` / `upsert_my_exam_target` / `update_my_exam_target`
- Edge Function `sync-practice-session`, que se invoca desde frontend pero no está en este repo.

Conclusión importante:

Este repositorio permite reconstruir muy bien el modelo funcional, pero no contiene el DDL completo del backend productivo. Por tanto, para cambios críticos de base de datos conviene extraer el esquema real de Supabase antes de migrar en producción.

## 4. Tabla central: `public.preguntas`

## 4.1 Rol funcional

Es la tabla núcleo del producto. Toda la experiencia gira alrededor de ella:

- tests,
- estudio,
- banco de preguntas,
- métricas por ley y tema,
- editor administrativo.

## 4.2 Campos confirmados por uso en código

Campos leídos o escritos directamente:

- `id`
- `opposition_id`
- `curriculum`
- `curriculum_key`
- `numero`
- `pregunta`
- `opcion_a`
- `opcion_b`
- `opcion_c`
- `opcion_d`
- `respuesta_correcta`
- `explicacion`
- `explicacion_editorial`
- `grupo`
- `ley_referencia`
- `temario_pregunta`
- `question_scope_key`
- `subject_key`
- `subject_id`
- `scope_id`
- `general_law_id`
- `general_law_block_id`
- `general_law_question_type`
- `dominant_trap_type`
- `language_code`
- `difficulty`
- `created_at`
- `updated_at`

## 4.3 Significado de negocio

- `opposition_id`: vincula la pregunta con una oposición concreta.
- `curriculum`: identificador funcional del bloque de contenidos que usa la UI.
- `curriculum_key`: clave adicional, especialmente importante para contenidos de leyes generales.
- `numero`: número secuencial visible para navegación/manualidad.
- `pregunta`: enunciado.
- `opcion_a` a `opcion_d`: respuestas.
- `respuesta_correcta`: letra correcta (`a`, `b`, `c`, `d`).
- `explicacion`: feedback visible al alumno.
- `explicacion_editorial`: explicación interna o más rica para edición.
- `grupo`: traduce el ámbito del temario.
  - `comun`
  - `especifico`
- `ley_referencia`: ley o norma asociada.
- `temario_pregunta`: tema/bloque/tópico mostrado y explotado en filtros.
- `question_scope_key`, `subject_key`, `subject_id`, `scope_id`: normalización/catalogación.
- `general_law_id`, `general_law_block_id`, `general_law_question_type`: metadatos para banco de leyes generales.
- `dominant_trap_type`: clasificación pedagógica/trampa dominante.
- `language_code`: idioma.
- `difficulty`: dificultad numérica.

## 4.4 Campos mínimos para crear una pregunta nueva

Según la validación del admin:

- `opposition_id` válido UUID
- `curriculum`
- `pregunta`
- `opcion_a`
- `opcion_b`
- `respuesta_correcta`
- `grupo`

Condiciones adicionales:

- si la correcta es `c`, `opcion_c` debe existir.
- si la correcta es `d`, `opcion_d` debe existir.
- si existe `general_law_id`, también deben existir `general_law_block_id` y `curriculum_key`.

## 4.5 Relación conceptual

- muchas `preguntas` pertenecen a una `opposition`.
- muchas `preguntas` comparten un `curriculum`.
- muchas `preguntas` pueden apuntar a:
  - un `subject`,
  - un `question_scope`,
  - una `general_law`,
  - un `general_law_block`.

## 5. Tablas de contexto de oposición

## 5.1 `public.oppositions`

Tabla catálogo de oposiciones.

No está definida en las migraciones del repo, pero sí:

- se expone en admin,
- tiene RLS,
- se trata como tabla maestra.

Uso esperado:

- catálogo principal de oposiciones disponibles.

## 5.2 `public.opposition_configs`

Tabla clave para enlazar una oposición con configuración funcional.

Campos confirmados por uso:

- `opposition_id`
- `config_json`

Dentro de `config_json` el código espera al menos:

- `curriculum`
- `curriculum_key` o `curriculumKey`
- posiblemente `label`, `name` o `title`

Rol real:

- traduce una oposición a currículum operativo.
- permite saber qué oposición está activa para un usuario.
- sirve para autocompletar datos del editor de preguntas.

## 5.3 `public.user_opposition_profiles`

Tabla que une usuario y oposición.

Campos confirmados por lectura/escritura:

- `user_id`
- `opposition_id`
- `is_primary`
- `is_active_context`
- `onboarding_completed`
- `updated_at`

Rol funcional:

- un usuario puede estar asociado a varias oposiciones.
- una puede ser el contexto activo.
- otra puede ser la primaria.

La función `admin_set_active_opposition_context`:

- desactiva el contexto activo anterior,
- activa el nuevo,
- si no existe la fila, la inserta.

## 6. Tablas de catálogo académico

## 6.1 `public.subjects`

Tabla de materias/temas normalizados.

Se usa como catálogo editable desde admin.

## 6.2 `public.question_scopes`

Tabla catálogo para ámbitos o clasificaciones del tipo de pregunta/temario.

## 6.3 `app.general_laws`

Catálogo de leyes generales.

Se usa para:

- normalizar referencias legales,
- agrupar rendimiento por ley,
- soportar preguntas ligadas a normativa transversal.

## 6.4 `app.general_law_blocks`

Subdivisión de `general_laws`.

Probable relación:

- una ley general tiene muchos bloques.
- una pregunta puede apuntar a un bloque concreto.

## 7. Tablas de estudio del usuario

## 7.1 `public.user_notes` (exacta)

Definida en migración.

Estructura exacta:

- `user_id uuid not null`
- `question_id text not null`
- `content text not null default ''`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- PK compuesta: `(user_id, question_id)`

Uso:

- una nota libre por usuario y por pregunta.

Restricción:

- los revisores restringidos no pueden usar esta tabla.

## 7.2 `public.user_highlights_v2` (exacta)

Definida en migración.

Estructura exacta:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `question_id text not null`
- `content_type text not null`
- `answer_index integer not null default -1`
- `category text null`
- `spans jsonb not null default '[]'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Índice único:

- `(user_id, question_id, content_type, answer_index)`

Uso:

- subrayados sobre:
  - enunciado,
  - explicación,
  - respuestas concretas.

`content_type` esperado:

- `question`
- `explanation`
- `answer`

`spans` contiene objetos con:

- `start_index`
- `end_index`
- `type`

## 7.3 `public.user_highlights`

Tabla legacy todavía soportada en fallback.

No está definida en este repo, pero el código la intenta usar si `user_highlights_v2` no existe.

Campos inferidos:

- `id`
- `user_id`
- `question_id`
- `start_index`
- `end_index`
- `type`

## 8. Tablas de acceso restringido

## 8.1 `public.restricted_question_bank_access` (exacta)

Definida en migración.

Estructura exacta:

- `user_id uuid primary key`
- `role text not null default 'restricted_question_bank_viewer'`
- `allowed_curriculum_keys text[] not null default array[]::text[]`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rol funcional:

- limita qué currículums puede ver un revisor restringido.

La RLS sobre `preguntas` usa esta tabla para permitir o denegar lectura.

## 8.2 Política real sobre `preguntas`

Tras la migración de abril 2026:

- cualquier lectura exige usuario autenticado,
- si el usuario no es revisor restringido, puede leer normalmente,
- si sí lo es, solo puede leer preguntas cuyo `curriculum` o `curriculum_key` encaje con `allowed_curriculum_keys`.

## 9. Esquema `app`: sesiones, progreso y analítica

## 9.1 Estado general

El esquema `app` es el motor analítico real del producto, pero no está completo en el repo.

Sí sabemos que contiene o expone:

- tablas de sesiones y progreso,
- RPCs analíticas,
- catálogos de leyes,
- identidad de cuenta,
- objetivos de examen.

## 9.2 `app.practice_sessions`

Es la tabla más importante del esquema `app` desde el punto de vista de uso.

Evidencias:

- el admin cuenta sesiones desde aquí,
- la función `get_user_question_friction` la analiza directamente,
- el frontend la usa como fuente de sesiones recientes,
- la Edge Function `sync-practice-session` la alimenta indirectamente.

Campos confirmados por lectura o payload:

- `session_id` o `id`
- `mode`
- `title`
- `started_at`
- `finished_at`
- `score`
- `total`
- algún campo de usuario:
  - `user_id`, o
  - `auth_user_id`, o
  - `student_id`, o
  - `uid`
- algún campo de currículum:
  - `curriculum`, o
  - `curriculum_key`, o
  - `curriculum_slug`, o
  - `opposition_key`, o
  - `opposition`
- un JSON de intentos:
  - `attempts`, o
  - `attempt_rows`, o
  - `attempts_json`, o
  - `answers`

Cada intento dentro del array puede contener:

- `question_id`
- `statement`
- `category`
- `answered_at`
- `is_correct`
- `mode`

## 9.3 `app.practice_attempts`

Tabla de intentos analíticos, usada en reseteo admin e inferida como fuente alternativa de métricas.

No hay definición SQL aquí.

## 9.4 `app.question_attempt_events`

Tabla granular de eventos por pregunta.

No hay definición SQL aquí.

## 9.5 `app.user_question_state`

Tabla de estado agregado por usuario y pregunta.

Probablemente soporta spaced repetition o consolidación.

## 9.6 `app.practice_profiles`

Tabla usada para descubrir currículums disponibles y probablemente para estado de práctica agregado por usuario/currículum.

## 9.7 `app.exam_targets`

Tabla inferida por el reseteo admin y relacionada con RPCs de objetivo de examen.

## 10. RPCs y analítica

## 10.1 RPC confirmada en repo: `public.get_user_question_friction`

Calcula fricción por pregunta para un usuario y un currículum.

Se apoya en `app.practice_sessions` y devuelve:

- `question_id`
- `curriculum`
- `prompt`
- `topic`
- `attempts_total`
- `wrong_total`
- `correct_total`
- `error_rate`
- `wrong_streak`
- `repeat_wrong_count`
- `simulacro_wrong_count`
- `normal_wrong_count`
- `last_seen_at`
- `last_wrong_at`
- `friction_score`
- `primary_tag`

Etiquetas posibles:

- `repeated_error`
- `pressure_trouble`
- `recent_trouble`
- `memory_fragile`
- `mixed`

## 10.2 RPCs consumidas por frontend pero no definidas aquí

La aplicación depende fuertemente de estas RPCs del esquema `app`:

- `get_my_account_identity`
- `get_readiness_dashboard`
- `get_readiness_dashboard_v2`
- `get_pressure_dashboard`
- `get_pressure_dashboard_v2`
- `get_practice_catalog_summary`
- `get_random_practice_batch`
- `get_weak_practice_batch`
- `get_study_questions`
- `get_category_risk_dashboard`
- `set_my_exam_target`
- `upsert_my_exam_target`
- `update_my_exam_target`

Esto significa que el backend real tiene mucha más lógica de la que aparece en este repo.

## 11. Relaciones de negocio principales

Modelo conceptual resumido:

- `auth.users` 1---N `user_opposition_profiles`
- `oppositions` 1---N `user_opposition_profiles`
- `oppositions` 1---1/N `opposition_configs`
- `oppositions` 1---N `preguntas`
- `preguntas` N---1 `subjects` opcional
- `preguntas` N---1 `question_scopes` opcional
- `preguntas` N---1 `general_laws` opcional
- `preguntas` N---1 `general_law_blocks` opcional
- `auth.users` 1---N `user_notes`
- `auth.users` 1---N `user_highlights_v2`
- `auth.users` 1---1 `restricted_question_bank_access`
- `auth.users` 1---N `practice_sessions`

## 12. Qué hace falta para ampliar con más preguntas

## 12.1 Alta mínima de nuevas preguntas

Para ampliar banco sobre una oposición ya existente:

1. identificar `opposition_id`,
2. decidir `curriculum`,
3. decidir `grupo`:
   - `comun`
   - `especifico`
4. insertar en `preguntas`:
   - `opposition_id`
   - `curriculum`
   - `numero`
   - `pregunta`
   - opciones
   - `respuesta_correcta`
   - opcionalmente `explicacion`, `ley_referencia`, `temario_pregunta`, `language_code`, `difficulty`

## 12.2 Recomendación de calidad de datos

Para que luego la analítica y los filtros funcionen bien, conviene rellenar siempre:

- `opposition_id`
- `curriculum`
- `curriculum_key` cuando aplique
- `grupo`
- `numero`
- `temario_pregunta`
- `ley_referencia` si la pregunta depende de norma concreta
- `subject_key` y `question_scope_key` si ya tenéis catálogo cerrado
- `language_code`

## 13. Qué hace falta para ampliar con más oposiciones

Para añadir una nueva oposición de forma consistente, el flujo correcto es:

1. Crear o completar `oppositions`.
2. Crear `opposition_configs` con `opposition_id` y `config_json`.
3. En `config_json`, definir al menos:
   - `curriculum`
   - `curriculum_key` si va a haber leyes generales o segmentación adicional
   - opcionalmente `label` o `title`
4. Crear o revisar catálogos:
   - `subjects`
   - `question_scopes`
   - `general_laws`
   - `general_law_blocks`
5. Cargar preguntas en `preguntas` con `opposition_id` correcto.
6. Si usuarios deben trabajar esa oposición, registrar `user_opposition_profiles`.

## 14. Riesgos técnicos reales que debes tener presentes

## 14.1 El repo no contiene todo el backend real

La parte más importante para métricas y generación de sesiones vive en:

- RPCs del esquema `app`,
- tablas `app.*`,
- `sync-practice-session`.

Eso hoy no está versionado aquí.

## 14.2 `preguntas` sí es ampliable desde este repo

La gestión administrativa de preguntas sí está suficientemente implementada para:

- listar,
- buscar,
- crear,
- editar,
- navegar por número.

## 14.3 El acceso restringido puede romper visibilidad

Si añadís nuevos currículums y queréis que revisores restringidos los vean, hay que actualizar:

- `allowed_curriculum_keys` en `restricted_question_bank_access`
- `app_metadata.allowed_curriculum_keys` del usuario

## 15. Qué sabe ya ChatGPT para continuar

Si en siguientes sesiones queremos seguir ampliando, este es el marco correcto:

1. La tabla central es `public.preguntas`.
2. La oposición real se modela con `oppositions` + `opposition_configs`.
3. El contexto activo de cada usuario se resuelve con `user_opposition_profiles`.
4. La analítica avanzada no sale directamente de `preguntas`, sino del esquema `app` y sus RPCs.
5. Para nuevas preguntas, lo crítico es mantener consistentes:
   - `opposition_id`
   - `curriculum`
   - `grupo`
   - `numero`
   - `temario_pregunta`
   - `ley_referencia`
6. Para nuevas oposiciones, no basta con cargar preguntas: también hay que dar de alta el contexto y la configuración.

## 16. Siguiente paso recomendado

Para trabajar con seguridad total en futuras ampliaciones, recomiendo hacer una de estas dos cosas:

1. extraer un volcado de esquema real de Supabase de `public` y `app`,
2. o usar las funciones admin de introspección (`admin_get_table_columns_v2`) con una sesión admin y documentar columna por columna las tablas productivas.

Con eso pasaríamos de un modelo muy bien reconstruido a un modelo 100% exacto.
