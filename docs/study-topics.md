# Temario de estudio

Módulo de lectura del temario: el alumno lee cada tema (manual, repaso exprés, cuaderno,
solucionario y errores típicos), subraya, toma notas y lleva su progreso.

## Datos (Supabase)

Migración `20261128070000_study_topics_reader.sql`.

- `study_topics`: un tema por oposición (`code`, número, título, `status`).
- `study_documents`: las cinco partes de cada tema.
- `study_document_versions`: cada versión del texto es una fila **inmutable**. Un trigger
  comprueba la huella `body_sha256` al insertar, impide cambiar el texto y solo deja pasar
  `draft → published → retired`. Solo puede haber una versión publicada por documento, y
  solo se pueden borrar borradores. Para corregir un tema se añade una versión nueva.
- `user_study_annotations`: subrayados (5 colores), notas sobre un subrayado o sobre un
  apartado, y marcadores. Se anclan con `spans` (`{b, s, e}`: bloque renderizado y desplazamientos
  en su texto) y guardan la cita (`quote`) para reubicarse si el tema cambia de versión.
- `user_study_progress`: hasta dónde ha leído el alumno, último bloque y «estudiado».

Acceso (RLS): el alumno solo lee lo publicado de las oposiciones que tiene asignadas en
`student_opposition_access`; el personal con `quality.manage` o `questions.manage` ve también
los borradores para revisarlos. Cada alumno solo ve y edita sus propias anotaciones y progreso.
Sin acceso anónimo.

El texto docente **no** está en este repositorio público. Se importa aparte por un canal
administrativo y se comprueba con huellas SHA-256 contra los ficheros aprobados.

## Lector

`src/features/studyTopics/`:

- `MarkdownBody`: Markdown (GFM) con saneado estricto. Solo se admite HTML `<a id>` de las anclas
  del material, que pasa al encabezado. Cada bloque recibe `data-b` para anclar subrayados.
- `StudyTopicReader`: lector a pantalla completa con índice, pestañas de las cinco partes,
  subrayado y notas, panel «Mis notas», barra de progreso, reanudar lectura, «marcar como
  estudiado», enlaces entre reglas y partes, y ajustes (tamaño, letra, fondo claro/sepia/oscuro).
- `StudyTopicsLibrary`: lista de temas con progreso, buscador y «continuar».

La pestaña «Temario» aparece en Estudio solo si la oposición activa tiene temas.
