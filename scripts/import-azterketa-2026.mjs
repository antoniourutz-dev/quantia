import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXAM_SOURCE_KEY = 'goi-mailako-azterketa-2026';
const EXAM_SOURCE_TITLE = 'Azterketa 2.026';
const OPPOSITION_ID = 'f0c0d3cd-8ca3-4ed4-ac0a-2caab180a77b';
const CURRICULUM = 'goi_teknikaria';
const CURRICULUM_KEY = 'goi_teknikaria';

const REQUIRED_COUNTS = {
  common: 200,
  specific: 500,
};

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith('--')) continue;
  const key = arg.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith('--')) {
    args.set(key, true);
  } else {
    args.set(key, next);
    index += 1;
  }
}

const filePath = args.get('file');
const dryRun = Boolean(args.get('dry-run'));
const replace = Boolean(args.get('replace'));

if (!filePath) {
  fail('Uso: npm run import:azterketa-2026 -- --file ./ruta/preguntas.csv [--dry-run] [--replace]');
}

const normalizeHeader = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const headerAliases = {
  numero: ['numero', 'n', 'question_number', 'official_question_number'],
  syllabus: ['syllabus', 'ambito', 'scope', 'temario', 'grupo', 'question_scope_key'],
  pregunta: ['pregunta', 'question', 'question_text', 'enunciado', 'texto'],
  opcion_a: ['opcion_a', 'option_a', 'a'],
  opcion_b: ['opcion_b', 'option_b', 'b'],
  opcion_c: ['opcion_c', 'option_c', 'c'],
  opcion_d: ['opcion_d', 'option_d', 'd'],
  respuesta_correcta: ['respuesta_correcta', 'correct_answer', 'official_answer', 'respuesta', 'answer'],
  explicacion: ['explicacion', 'explanation'],
  explicacion_editorial: ['explicacion_editorial', 'editorial_explanation'],
  temario_pregunta: ['temario_pregunta', 'tema', 'topic', 'subject'],
  ley_referencia: ['ley_referencia', 'ley', 'law_reference'],
  subject_key: ['subject_key', 'subject'],
  difficulty: ['difficulty', 'dificultad'],
  language_code: ['language_code', 'idioma', 'language'],
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows.filter((values) => values.some((value) => String(value).trim()));
};

const readCsvRecords = (path) => {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  if (rows.length < 2) fail('El CSV debe incluir cabecera y al menos una pregunta.');

  const headers = rows[0].map(normalizeHeader);
  const indexByCanonical = Object.fromEntries(
    Object.entries(headerAliases).map(([canonical, aliases]) => [
      canonical,
      aliases.map(normalizeHeader).map((alias) => headers.indexOf(alias)).find((index) => index >= 0) ?? -1,
    ]),
  );

  const missing = ['numero', 'syllabus', 'pregunta', 'opcion_a', 'opcion_b', 'respuesta_correcta'].filter(
    (key) => indexByCanonical[key] < 0,
  );
  if (missing.length) fail(`Faltan columnas obligatorias: ${missing.join(', ')}.`);

  return rows.slice(1).map((values, index) => {
    const record = { __line: index + 2 };
    for (const key of Object.keys(headerAliases)) {
      const position = indexByCanonical[key];
      record[key] = position >= 0 ? String(values[position] ?? '').trim() : '';
    }
    return record;
  });
};

const normalizeScope = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (['common', 'comun', 'orokorra', 'general', 'temario comun'].includes(normalized)) return 'common';
  if (['specific', 'especifico', 'espezifikoa', 'temario especifico'].includes(normalized)) return 'specific';
  return null;
};

const normalizeAnswer = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['a', 'b', 'c', 'd'].includes(normalized) ? normalized : null;
};

const toNumber = (value) => {
  if (!String(value ?? '').trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPayload = (record) => {
  const scope = normalizeScope(record.syllabus);
  const answer = normalizeAnswer(record.respuesta_correcta);
  const numero = toNumber(record.numero);
  const difficulty = toNumber(record.difficulty);
  const errors = [];

  if (!scope) errors.push('ambito/syllabus invalido');
  if (!numero) errors.push('numero invalido');
  if (!record.pregunta) errors.push('pregunta vacia');
  if (!record.opcion_a) errors.push('opcion_a vacia');
  if (!record.opcion_b) errors.push('opcion_b vacia');
  if (!answer) errors.push('respuesta_correcta invalida');
  if (answer === 'c' && !record.opcion_c) errors.push('opcion_c obligatoria si la respuesta es c');
  if (answer === 'd' && !record.opcion_d) errors.push('opcion_d obligatoria si la respuesta es d');
  if (errors.length) return { errors };

  return {
    payload: {
      opposition_id: OPPOSITION_ID,
      curriculum: CURRICULUM,
      curriculum_key: CURRICULUM_KEY,
      numero,
      pregunta: record.pregunta,
      opcion_a: record.opcion_a,
      opcion_b: record.opcion_b,
      opcion_c: record.opcion_c || null,
      opcion_d: record.opcion_d || null,
      respuesta_correcta: answer,
      explicacion: record.explicacion || null,
      explicacion_editorial: record.explicacion_editorial || null,
      grupo: scope === 'common' ? 'comun' : 'especifico',
      question_scope_key: scope,
      temario_pregunta: record.temario_pregunta || `${EXAM_SOURCE_TITLE} - ${scope === 'common' ? 'Temario comun' : 'Temario especifico'}`,
      ley_referencia: record.ley_referencia || null,
      subject_key: record.subject_key || null,
      difficulty,
      language_code: record.language_code || 'eu',
      exam_source_key: EXAM_SOURCE_KEY,
      exam_source_title: EXAM_SOURCE_TITLE,
      exam_source_year: 2026,
      exam_question_scope: scope,
    },
  };
};

const records = readCsvRecords(resolve(filePath));
const built = records.map((record) => ({ line: record.__line, ...buildPayload(record) }));
const invalid = built.filter((item) => item.errors);
if (invalid.length) {
  for (const item of invalid.slice(0, 20)) {
    console.error(`Linea ${item.line}: ${item.errors.join('; ')}`);
  }
  fail(`${invalid.length} filas invalidas. Corrige el CSV antes de importar.`);
}

const payload = built.map((item) => item.payload);
const counts = payload.reduce((acc, row) => {
  acc[row.exam_question_scope] = (acc[row.exam_question_scope] ?? 0) + 1;
  return acc;
}, {});

for (const [scope, expected] of Object.entries(REQUIRED_COUNTS)) {
  if (counts[scope] !== expected) {
    fail(`Conteo incorrecto para ${scope}: esperado ${expected}, recibido ${counts[scope] ?? 0}.`);
  }
}

const duplicateKeys = new Set();
const seenKeys = new Set();
for (const row of payload) {
  const key = `${row.exam_question_scope}:${row.numero}`;
  if (seenKeys.has(key)) duplicateKeys.add(key);
  seenKeys.add(key);
}
if (duplicateKeys.size) fail(`Numeros duplicados por ambito: ${Array.from(duplicateKeys).join(', ')}.`);

console.log(`CSV validado: ${payload.length} preguntas (${counts.common} comun, ${counts.specific} especifico).`);
if (dryRun) process.exit(0);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ACCESS_TOKEN;
if (!supabaseUrl || !supabaseKey) {
  fail('Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para importar en Supabase.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

if (replace) {
  const { error } = await supabase
    .from('preguntas')
    .delete()
    .eq('opposition_id', OPPOSITION_ID)
    .eq('exam_source_key', EXAM_SOURCE_KEY);
  if (error) fail(`No se ha podido limpiar la carga anterior: ${error.message}`);
}

for (let index = 0; index < payload.length; index += 100) {
  const chunk = payload.slice(index, index + 100);
  const { error } = await supabase.from('preguntas').insert(chunk);
  if (error) fail(`Error importando bloque ${index + 1}-${index + chunk.length}: ${error.message}`);
}

console.log(`Importacion completada: ${payload.length} preguntas de ${EXAM_SOURCE_TITLE}.`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
