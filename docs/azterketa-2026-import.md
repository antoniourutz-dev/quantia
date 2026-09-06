# Importacion de Azterketa 2.026

Objetivo: cargar en `public.preguntas` el examen `Azterketa 2.026` para Goi Mailako / Goi-teknikaria.

Datos confirmados en Supabase:

- `opposition_id`: `f0c0d3cd-8ca3-4ed4-ac0a-2caab180a77b`
- `curriculum`: `goi_teknikaria`
- `curriculum_key`: `goi_teknikaria`
- total esperado: 700 preguntas
- temario comun: 200 preguntas
- temario especifico: 500 preguntas

## Formato CSV

El importador espera un CSV con cabecera. Columnas obligatorias:

- `numero`
- `syllabus`: `common`/`comun` o `specific`/`especifico`
- `pregunta`
- `opcion_a`
- `opcion_b`
- `respuesta_correcta`: `a`, `b`, `c` o `d`

Columnas opcionales:

- `opcion_c`
- `opcion_d`
- `explicacion`
- `explicacion_editorial`
- `temario_pregunta`
- `ley_referencia`
- `subject_key`
- `difficulty`
- `language_code`

Ejemplo:

```csv
numero,syllabus,pregunta,opcion_a,opcion_b,opcion_c,opcion_d,respuesta_correcta,temario_pregunta,ley_referencia,language_code
1,common,"Galderaren enuntziatua","A aukera","B aukera","C aukera","D aukera",a,"Azterketa 2.026 - Temario comun","",eu
1,specific,"Galderaren enuntziatua","A aukera","B aukera","C aukera","D aukera",c,"Azterketa 2.026 - Temario especifico","",eu
```

## Validacion

Antes de importar:

```bash
npm run import:azterketa-2026 -- --file ./data/azterketa-2026.csv --dry-run
```

La validacion falla si no hay exactamente 200 preguntas `common` y 500 `specific`, si hay numeros duplicados dentro del mismo ambito, o si faltan campos obligatorios.

## Importacion

Requisitos:

- aplicar antes la migracion `supabase/migrations/20260820090000_azterketa_2026_question_source.sql`
- definir `SUPABASE_URL`
- definir `SUPABASE_SERVICE_ROLE_KEY`

Comando:

```bash
npm run import:azterketa-2026 -- --file ./data/azterketa-2026.csv
```

Para reemplazar una carga previa del mismo examen:

```bash
npm run import:azterketa-2026 -- --file ./data/azterketa-2026.csv --replace
```

La opcion `--replace` solo borra filas con `exam_source_key = 'goi-mailako-azterketa-2026'`.
