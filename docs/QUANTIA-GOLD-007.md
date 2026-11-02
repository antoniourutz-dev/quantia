# QUANTIA GOLD 007 — Seguridad del editor

## Perímetro y punto de partida

Intervención del 2 de noviembre de 2026 autorizada para rama y PR borrador exclusivamente. PR #2 y #3 verificados abiertos, borradores, sin fusionar. Base exacta: `quality/006-exam-session-safety`, commit `db32deb32642c37135ea016f6508835694735179`. Copia local nueva y limpia antes de intervenir; no había trabajo local ajeno que sobrescribir. Rama nueva: `quality/007-admin-editor-safety`, PR dirigido a la rama de #3. No se modifica main ni se fusiona, despliega, publica, altera permisos o escribe en servicios compartidos.

## Hallazgos y decisiones

- Nueva ficha, limpiar, seleccionar una pregunta y anterior/siguiente sustituían el borrador sin advertencia.
- Filtrar o aplicar una búsqueda borraba `selectedId` aunque el contenido de la ficha siguiera visible. Guardar podía entonces crear una pregunta en lugar de actualizarla. Se conserva identidad, contenido y estado pendiente al buscar o filtrar. Cambiar filtros ya no cambia implícitamente el curriculum del borrador.
- Se inspeccionó el uso diferido de AdminQuestions en AuthenticatedAppShell. La protección alcanza Volver y las salidas por el menú de la aplicación y cierre de sesión. No se impide la caducidad o revocación legítima de la sesión.
- El estado pendiente compara todos los campos con una instantánea de la última carga o guardado confirmado. Revertir manualmente los cambios elimina el aviso; abrir metadatos o filtrar no ensucia la ficha.
- La carga conserva la ficha previa hasta obtener el detalle completo. Un fallo no deja un identificador nuevo asociado al contenido anterior. Se serializan las cargas y la navegación; los campos no se editan mientras se carga o guarda.
- El guardado usa un cierre síncrono mediante referencia, además del estado visual, para evitar dos envíos dentro del mismo ciclo de React. No existe ya una creación de respaldo si falta el identificador en modo edición.
- La resolución de oposición ignora respuestas canceladas, no pisa campos rellenados y captura errores. Solo completa fichas nuevas.
- El diálogo nativo modal aporta Escape, contención del foco, fondo inerte y recuperación de foco según el navegador. Seguir editando recibe el foco inicial. Avisos con roles status/alert, nombres accesibles para campos, columnas únicas en móvil y opciones sin anchura mínima que fuerce desbordamientos.
- Se mantiene la carga diferida del editor y la búsqueda explícita; no se añaden dependencias ni consultas por cada pulsación de búsqueda. Las respuestas de listados invalidados se ignoran.

## Criterios de aceptación y contrapruebas

1. Crear o limpiar con cambios solicita confirmación; cancelar o Escape conserva el texto. Descartar ejecuta la acción prevista.
2. Anterior/siguiente y selección de otra pregunta esperan confirmación. Fallar la carga conserva el borrador y su identidad anterior.
3. Buscar, filtrar oposición, cambiar temario, idioma, curriculum o paginación conservan la ficha. Guardar después sigue actualizando el mismo identificador.
4. Salir del editor o por la navegación de la aplicación solicita confirmación cuando hay cambios; sin cambios sale directamente. Recargar/cerrar página activa beforeunload cuando hay cambios u operaciones pendientes.
5. Mientras se guarda, no se permite sustituir ficha ni editar el contenido enviado. Doble clic llama una sola vez a la API. Éxito establece una nueva instantánea; error conserva el contenido.
6. La prueba de creación valida campos antes de enviar, impide doble envío y pasa a edición con el identificador confirmado.

Se añaden nueve pruebas UI automatizadas con API simulada, sin credenciales ni datos reales. Comprueban los criterios anteriores, reversión de cambios y registro del guardián de salida externo. La prueba del diálogo simula showModal/close porque jsdom no implementa esas funciones: no constituye una verificación real de teclado o navegador.

Validación local: lint y TypeScript sin errores; batería completa inicial de 103 pruebas superada; tras añadir dos contrapruebas, las nueve pruebas del editor superadas. Build TypeScript/Vite/PWA superado. CI del commit final debe verificarse en el PR. El workflow existente solo compila y prueba; su regresión SQL usa PostgreSQL 16 desechable. No se ejecuta contra Supabase compartido. Los artefactos dist generados al comprobar el build se excluyen del cambio.

Contrapruebas del proceso: el primer intento de pruebas no pudo crear la caché temporal por permisos de Windows; se repitió con acceso autorizado. El primer ensayo del evento Escape usaba una función inexistente en Testing Library; se corrigió para emitir el evento cancel, sin alterar el comportamiento del producto para satisfacer la prueba.

## Beneficios

El editor puede revisar texto, claves y explicaciones sin pérdidas silenciosas conocidas. Conservar la identidad al filtrar reduce el riesgo de duplicados y de correcciones aplicadas a la ficha equivocada. Para el alumno, protege la coherencia del banco que se revisa; no acredita por sí solo exactitud académica ni mejora del aprendizaje. Cada respuesta y explicación sigue necesitando revisión editorial humana.

## Limitaciones y revisión pendiente

- No hay autoguardado, persistencia del borrador ni recuperación tras cierre forzado. beforeunload depende del navegador y no garantiza aviso en cierre de proceso o suspensión móvil. El texto del aviso nativo lo decide el navegador.
- La API actual inserta/actualiza y después vuelve a leer. Una escritura confirmada seguida de una lectura fallida puede presentarse como error; una respuesta perdida puede dejar el resultado incierto. Esta intervención no garantiza idempotencia de creación ni concurrencia entre pestañas/editores. Antes de reintentar una creación tras error se debe comprobar el banco. Resolverlo requiere diseño de acuse e idempotencia separado, con backend aislado y autorización específica; no se interviene en el servicio compartido.
- No hay bloqueo optimista contra modificaciones de otro editor. No se afirma que los conflictos remotos estén resueltos.
- Pendiente revisión visual real en 320/375/768/1280 px, foco/Tab/Shift+Tab/Escape/restauración en navegadores reales y lector de pantalla. Pendiente E2E autenticado de menú y logout en un entorno aislado; el registro de salida se prueba con callback simulado.
- La instalación informa 42 vulnerabilidades en el árbol existente (3 bajas, 27 moderadas, 12 altas). No se cambian paquetes ni lockfile en esta intervención; requieren análisis separado de explotabilidad y actualización compatible.
- Permanecen los bloqueadores de #2 y #3, especialmente atomicidad de sincronización y consumidores del Supabase compartido. Este PR no autoriza fusión ni despliegue. Ambos necesitan aprobación explícita del usuario tras revisión.
