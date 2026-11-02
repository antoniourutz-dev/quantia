# QUANTIA AUDIT 001 — Iteración 003: rebatir la primera solución

## Por qué el primer parche NO bastaba

Aunque RLS eliminara la política `USING(true)`, las funciones que se ejecutan
con `SECURITY DEFINER` podían seguir leyendo el catálogo sin respetar las
restricciones por oposición ni por alumno. El frontend tampoco puede actuar como
mecanismo de autorización. Se revisaron **13 RPC de práctica y resultados**
que consultan `public.preguntas`; se excluyó de esta migración la RPC
administrativa que ya contiene `app.is_admin()` y el RPC público heredado,
que la primera migración revoca.

## Correcciones nuevas (solo en rama, no desplegadas)

- Guardián `app.assert_full_practice_access`: exige identidad válida,
  impide usar los RPC de práctica al `restricted_question_bank_viewer`
  y prohíbe consultar el progreso de otra persona salvo administrador
  con permiso `app.is_admin()`.
- El rol `anon` deja de poder ejecutar esas 13 funciones; `authenticated`
  y `service_role` conservan los permisos necesarios.
- `get_standard_practice_batch`, `get_simulacro_batch` y
  `get_anti_trap_batch` filtran por oposición, en todas las ramas
  relevantes de la consulta.
- `get_topic_practice_batch` emplea el mismo criterio compartido de
  pertenencia a currículo que los demás modos.
- `get_practice_catalog_summary` y el conteo de preguntas de la
  estadística legada utilizan el currículo solicitado.
- `get_readiness_dashboard` y `get_readiness_dashboard_v2` verifican
  titularidad del expediente antes de leer o modificar datos.

## Lo que deliberadamente NO se ha cambiado

- La fórmula de selección dentro del `simulacro`: actualmente favorece
  preguntas ya vistas y por eso no es un simulacro imparcial. Rediseñar el
  modelo pedagógico requiere medición y un modo auténtico separado, no
  desactivar sin pruebas el entrenamiento ya existente.
- El acceso al banco RLS de revisores restringidos.
- Las vistas de otros proyectos alojados en el mismo Supabase. En
  particular, `student_overview`, `correction_queue` y
  `teacher_dashboard_summary` aún tienen permisos `anon`;
  revisar consumidores antes de revocar, pues no están en este repositorio.
- El aislamiento por **oposición contratada** de alumnos normales:
  actualmente los alumnos autenticados pueden utilizar varios currículos.
  Necesita modelo de inscripción real y no se debe inventar una restricción.

## Validación

Se añade prueba de PostgreSQL 16 desechable que crea funciones de producción
con `check_function_bodies=off` para las ramas analíticas no cargadas en
el fixture, y ejecuta directamente `standard` y `catalog_summary`
con dos oposiciones. También verifica denegación de uso a revisor y
lectura cruzada de expedientes de estadísticas.

**Límite de evidencia:** la compilación de funciones con dependencias
faltantes no equivale a una prueba E2E del backend completo. Falta
staging con el esquema íntegro, cuentas de prueba y todas las apps.
La mejora solo puede considerarse desplegable después de ese paso.
