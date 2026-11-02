# Puerta de calidad Quantia — cada cambio debe servir al alumno

**Regla:** no se considera una mejora porque compile, sino porque resuelve un
problema real sin empeorar confianza, seguridad o aprendizaje.

Cada propuesta documentará:
1. Problema concreto del alumno y evidencia observada.
2. Hipótesis y línea base antes de modificar.
3. Cambio mínimo y reversible, con pruebas de roles, sesiones y oposición.
4. Medición posterior y contrastes con alumnos reales.
5. Decisión: conservar, iterar o revertir; registrar siguiente fricción.

## Indicadores (sin atribuir resultados todavía)
- Tiempo p50/p95 hasta primera pregunta interactiva.
- Sesiones completadas y guardadas sin pérdidas, incluyendo fallos de red.
- Progreso en preguntas NO vistas, separado de repeticiones conocidas.
- Calidad de explicación y trazabilidad normativa en cada error.
- Comprensión del siguiente paso; fricción en móvil, teclado, euskera/castellano.
- Retorno significativo a 7 días y recomendación voluntaria (NPS, muestra clara).

La repetición compulsiva no es un objetivo. Queremos que vuelva porque aprende.

## QUANTIA AUDIT 001 — estado y riesgos pendientes

Rama de seguridad preparada sin despliegue en el Supabase compartido.
La migración propuesta elimina una política histórica permisiva de
`public.preguntas`, restringe la lectura directa anónima y revoca un RPC
heredado que devuelve preguntas usando permisos elevados.

**La migración NO debe ejecutarse automáticamente.** Identificar primero
todos los consumidores externos del proyecto Supabase y verificar
reversión y pruebas reales por rol. Las funciones `SECURITY DEFINER` de
práctica, vistas compartidas y autorizaciones por oposición siguen siendo
auditorías separadas. RLS por sí sola no protege los caminos privilegiados.

La Edge Function `restricted-question-bank-guest` no figuraba entre las
desplegadas al auditar; el código de esta rama exige autorización de
administrador y limita las claves asignables antes de cualquier activación.

### Criterios de aceptación de este cambio
- [ ] Inventario de consumidores del Supabase compartido y contrato de acceso.
- [ ] Copia/entorno de pruebas coherente con producción, con recuperación probada.
- [ ] Preflight, migración y postcheck validados sin errores.
- [ ] Anónimo no lee por REST directo ni RPC de invitado.
- [ ] Alumno completa test, recibe explicación, guarda sesión y ve estadísticas.
- [ ] Revisor solo accede a currículos autorizados, incluso a través de RPC.
- [ ] Administrador conserva lectura, edición y gestión.
- [ ] Otras apps compartidas no sufren regresiones.
- [ ] Revisadas vistas y demás RPC privilegiados antes de declarar P0 resuelto.
- [ ] Documentadas medidas de aprendizaje, retención y reversión.

Si falla una comprobación, NO desplegar; ajustar sin reabrir todo el banco.
