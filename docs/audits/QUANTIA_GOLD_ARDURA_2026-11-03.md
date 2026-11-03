# QUANTIA GOLD — administración delegada Ardura

Fecha: 3 de noviembre de 2026. PR: #5.

## Cambios

- Corregidos los delimitadores de cuatro funciones SQL.
- Cinco permisos explícitos para la identidad confirmada de `ardura@oposik.app`.
- Propietario comprobado en `public.admin_users` y `app.user_roles`; la migración exige otro propietario antes de retirar roles globales de Ardura.
- RLS por ámbito para preguntas, catálogos, usuarios, estadísticas y calidad; permisos no concedibles desde clientes.
- Estadísticas con RPC de recuento independiente de la gestión de usuarios.
- RPC editorial de subrayados adaptada a preguntas/calidad; autorización previa conservada para propietarios.
- RPC antigua de cambio de contexto limitada a `service_role`; la Edge Function valida actor y destinatario.
- Columna `public.profiles.role` excluida de la actualización por clientes para impedir autoasignación de roles.
- `admin-users`: verifica firma, emisor y audiencia del JWT, existencia y bloqueo del usuario y permisos confiables en servidor.
- Ardura no puede editar propietarios/gestores, cambiar contraseñas, borrar cuentas ni reiniciar progreso. Las cuentas privilegiadas se excluyen de su listado.
- Cerrada una vía de toma de cuenta por correo: crear un acceso restringido sobre una cuenta existente ya no puede cambiar su contraseña para gestores delegados.
- Interfaz: permisos cerrados por defecto, secciones por permiso, acciones sensibles solo para propietario; contextos personales retirados del editor genérico de catálogos.

## Validación realizada

- `npm ci --ignore-scripts`: correcto.
- `npm run lint`: correcto, cero errores/advertencias de ESLint.
- `npm test`: 21 archivos, 96 pruebas correctas.
- `npm run build`: TypeScript, Vite y PWA correctos.
- 14 pruebas del handler real de Edge con frontera Auth/Data simulada: anónimo, token inválido, usuario bloqueado, alumno, destinos privilegiados, acciones sensibles, ataque por correo, listado y facultades del propietario.
- 3 pruebas de permisos de interfaz: cierre por defecto, cinco secciones y catálogo aislado.
- Ensayo transaccional de migración en Oposik, con ROLLBACK completo: correcto tras corregir también terminadores de las RPC editoriales.
- Comprobaciones repetidas tras aplicar la migración: propietario y Ardura con cinco permisos; identidad sintética sin permisos ni lectura de calidad/sesiones ajenas; anónimo sin ejecución de funciones protegidas; bloqueo de escritura en permisos y rol del perfil.
- Producción confirmada mediante el código servido por `https://kuantia.vercel.app`: proyecto Supabase `gmwgwttwzkgyljevddul` (Oposik).
- Migración aplicada en Oposik; `admin-users` desplegada ACTIVE, versión 27.
- No se han cambiado preguntas, estadísticas ni datos reales de alumnos para probar. Las mutaciones del handler se prueban exclusivamente con dobles en memoria. Las comprobaciones SQL usan lecturas y permisos; el ensayo de migración se revirtió antes de la aplicación definitiva.

## Límites y comprobaciones pendientes

La verificación SQL representa identidades mediante claims y rol `authenticated`; no equivale a un inicio de sesión real en la interfaz. Falta completar la navegación autenticada con Ardura, propietario y alumno después del despliegue frontend. El navegador disponible muestra el formulario de acceso y no dispone de esas sesiones. No se han extraído contraseñas, creado enlaces de suplantación ni cambiado credenciales.

El auditor general de Supabase conserva avisos previos: nueve vistas SECURITY DEFINER, funciones antiguas ejecutables y search_path mutable, extensión en public y opciones de seguridad de Auth. No se afirma que todo el proyecto esté libre de vulnerabilidades. Las vistas y funciones ajenas a esta administración requieren una revisión específica para evitar romper funcionalidades existentes. Referencia: https://supabase.com/docs/guides/database/database-linter

La activación definitiva no debe darse por aceptada hasta la comprobación visual autenticada y la confirmación del despliegue frontend del commit validado.
