# QUANTIA AUDIT 001 — Iteración 004: integridad del aprendizaje

## Hallazgo

La experiencia visual de fin de test se abría antes de que terminara el guardado;
no distinguía entre éxito comprobado, cola local y fallo sin respaldo.
Además, el frontend retiraba el intento pendiente por recibir un HTTP 2xx
sin contrastar el contrato `success/sync` de la Edge Function desplegada.

Una anomalía en la respuesta podía aparentar un guardado correcto. Si la cola
se corrompía, la siguiente escritura interpretaba el contenido como `[]`
y podía destruir intentos anteriores.

## Intervención

1. Confirmar de forma estricta los contadores que devuelve
   `sync-practice-session`: `success: true`, cantidad declarada válida
   y suma exacta de procesados y duplicados reconocidos. Se acepta el
   reintento idempotente (`duplicate_only`).
2. No quitar una sesión de la cola por un HTTP 2xx ambiguo.
3. No sobrescribir ni borrar una cola local ilegible.
4. Mostrar en la pantalla de resultados cinco estados honestos:
   guardando, guardado, pendiente con copia local, no confirmado sin
   respaldo, o sesión sin intentos evaluables.
5. Reintento manual desde la misma pantalla cuando el guardado no se
   confirma. La copia del intento permanece asociada a la sesión.
6. Guardar el resultado correcto derivándolo de la pregunta mostrada,
   evitando inconsistencias entre `is_correct` y `correct_option`
   proporcionados por distintos objetos.
7. No convertir un fallo de refresco del panel en un falso fallo de
   sincronización ya confirmada.

## Evidencia / criterios de aceptación

- Tests de aceptación/rechazo del acuse, incluidos errores parciales.
- UI test de tres estados y reintento visible.
- Test de cola corrupta sin eliminación; mantiene pruebas previas
  para 25 sesiones, cuentas separadas y cuota llena.
- Test de consistencia del resultado contra la respuesta oficial
  integrada en la sesión.
- CI exige ESLint, Vitest, compilación Vite y aislamiento SQL.

## Límites y siguiente revisión crítica

**No se ha desplegado el backend.** El código real de la función Edge
`sync-practice-session` consultado en producción realiza escrituras
secuenciales no atómicas: sesión, estado por pregunta y eventos de intentos.
Si falla el evento tras escribir el estado, el reintento puede recalcular
el progreso y contar dos veces el mismo intento antes de registrar el
marcador de idempotencia. La base necesita una transacción atómica o un
marcador de idempotencia con reserva y confirmación. Esta intervención
no proclama resuelto ese riesgo.

La cola `localStorage` tampoco está preparada para concurrencia entre
pestañas, cuotas grandes o dispositivos distintos. Esta iteración
evita borrados conocidos y ofrece transparencia, pero **no promete
almacenamiento infalible**. La integridad del aprendizaje exige una
revisión del guardado transaccional de extremo a extremo.

## Filosofía QUANTIA GOLD

No confundir una buena nota con datos guardados ni con dominio auténtico.
La experiencia debe ser sencilla, pero nunca a costa de ocultar errores.
**Primero verdad, luego confianza y después aprendizaje medible.**

## Contraprueba adicional — integración con la Edge Function real

La Edge Function `sync-practice-session` de producción llama a
`app.get_readiness_dashboard` utilizando el cliente con clave
`service_role`. La nueva protección central no puede confundir ese
cliente de servidor con un alumno sin sesión. Se ha incluido excepción
exclusiva para un JWT firmado con `role=service_role` y se prueba ese
caso en PostgreSQL sin abrir el acceso a `anon` o `authenticated`.
