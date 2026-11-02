# QUANTIA 001 — Auditoría adicional de superficies privilegiadas (2026-11-02)

Inspección read-only del catálogo de la instancia Supabase compartida
`gmwgwttwzkgyljevddul`, sin acceder a respuestas ni fichas de alumnos.

## Hallazgos confirmados

- `public.preguntas`: RLS activa, pero política `Enable read access for all users`
  con `USING(true)`; `anon` cuenta con `SELECT`. La política restrictiva
  coexistente se combina con OR al ser permisiva.
- `app.get_public_guest_practice_batch(text,integer,text)`: `SECURITY DEFINER`,
  ejecutable por `anon`, no exige identidad y devuelve `to_jsonb(p)`, es decir,
  la pregunta completa con respuestas. Su eliminación de la API pública está
  preparada en la migración; no basta con corregir la RLS de la tabla.
- `app.get_standard_practice_batch`: comprueba `auth.uid()`, pero su cuerpo
  registrado en producción no filtra resultados por `p_curriculum`; la función
  está concedida a `authenticated`, incluidos revisores restringidos.
- `app.get_topic_practice_batch`, `app.get_law_practice_batch`,
  `app.get_random_practice_batch`, `app.get_mixed_practice_batch` y otras RPC
  devuelven preguntas con `SECURITY DEFINER`. Necesitan pruebas específicas de
  autorización **por fila** y oposición antes de considerar protegido el banco.
- `public.student_overview`, `public.correction_queue` y
  `public.teacher_dashboard_summary` son vistas sin `security_invoker`
  y tienen `SELECT` otorgado a `anon`. La primera contiene campos como
  `email` y `general_notes`. No se leyeron filas ni se demostró acceso
  efectivo por un cliente REST: la configuración API y dependencias deben
  comprobarse. Corresponden al ámbito compartido, no al código de Quantia.
- Los avisos `anon_security_definer_function_executable` y
  `security_definer_view` necesitan revisión selectiva, no cierre masivo.

## Decisión y secuencia

1. Mantener PR #2 como **borrador**, sin ejecutar DDL en producción.
2. Ejecutar el test PostgreSQL 16 añadido al CI contra una base desechable.
3. Identificar consumidores de `app.get_public_guest_practice_batch` y de las
   vistas compartidas; confirmar configuración de esquemas expuestos.
4. Construir autorización por currículum en cada RPC privilegiada que sirve
   preguntas, con pruebas de alumno/revisor/admin y una fuente única de reglas.
5. Validar plan de migración, rollback y pruebas funcionales en entorno aislado.
6. Solo entonces desplegar a Supabase y repetir asesores de seguridad.

## Mejora del alumno incluida en esta iteración

La cola local de sincronización ya no descarta silenciosamente el intento
más antiguo al llegar a 12 sesiones. Si el navegador agota su cuota de
almacenamiento, la operación devuelve `false` sin sobrescribir la cola
anterior; la capa de sincronización mantiene el control de errores.

**Pendiente:** monitorizar almacenamiento disponible, indicar de manera
persistente los intentos sin sincronizar y resolver concurrencia entre
pestañas. No se debe confundir el éxito de las pruebas unitarias con una
garantía de persistencia ilimitada en almacenamiento local.

## Evidencia verificable

- CI frontend actual: `npm ci`, ESLint, Vitest, build.
- Nuevo CI: servicio efímero PostgreSQL 16 y comprobaciones con roles
  `anon`, `authenticated` y revisor restringido.
- Documentación Supabase RLS:
  https://supabase.com/docs/guides/database/postgres/row-level-security
- Aviso oficial sobre vistas con permisos elevados:
  https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view
