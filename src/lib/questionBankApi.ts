import { supabase } from './supabaseClient';
import {
  mapQuestion,
  readText,
} from './quantiaMappers';
import { QUESTION_BANK_LIST_SELECT, toDbGrupo, toOptionKey, toSyllabusType } from './questionContracts';
import type {
  OptionKey,
  PracticeQuestionScopeFilter,
  Question,
  QuestionBankListItem,
  QuestionBankPage,
  SyllabusType,
} from '../types';

type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type QuestionBankCacheRow = {
  id: string;
  number: number | null;
  correctAnswer: OptionKey;
  syllabus: SyllabusType;
  text: string;
  category: string | null;
  dedupeKey: string;
};

type QuestionBankTarget = {
  curriculum: string;
  scope: PracticeQuestionScopeFilter;
  candidates: string[];
};

const DEFAULT_CURRICULUM = 'osakidetza_admin';

const questionBankIndexCache = new Map<string, Promise<QuestionBankCacheRow[]>>();
const questionBankDetailCache = new Map<string, Question>();

const CURRICULUM_ALIAS_GROUPS = [
  {
    key: 'osakidetza-admin',
    aliases: ['osakidetza_admin', 'osakidetza-admin', 'administrativo'],
  },
  {
    key: 'auxiliar-administrativo',
    aliases: ['auxiliar_administrativo', 'auxiliar-administrativo', 'auxiliar administrativo'],
  },
  {
    key: 'goi-teknikaria',
    aliases: ['goi-teknikaria', 'goi_teknikaria', 'goi-teknikaria-eu', 'goi_teknikaria_eu'],
  },
  {
    key: 'tecnico-superior-administracion-y-gestion',
    aliases: [
      'tecnico_superior_administracion_y_gestion',
      'tecnico-superior-administracion-y-gestion',
      'tecnico superior administracion y gestion',
      'técnico superior administración y gestión',
      'tecnico/a superior administracion y gestion',
      'técnico/a superior administración y gestión',
    ],
  },
] as const;

const SHARED_QUESTION_SOURCES: Record<
  string,
  Partial<Record<PracticeQuestionScopeFilter, Array<{ curriculum: string; scope: PracticeQuestionScopeFilter }>>>
> = {
  'auxiliar-administrativo': {
    all: [{ curriculum: DEFAULT_CURRICULUM, scope: 'common' }],
    common: [{ curriculum: DEFAULT_CURRICULUM, scope: 'common' }],
  },
};

const canonicalizeCurriculumId = (value: string) =>
  String(value).trim().toLowerCase().replace(/_/g, '-');

const getCurriculumAliasGroup = (value: string) => {
  const normalized = canonicalizeCurriculumId(value);
  return CURRICULUM_ALIAS_GROUPS.find((group) =>
    group.aliases.some((alias) => canonicalizeCurriculumId(alias) === normalized),
  );
};

const buildCurriculumCandidates = (curriculum: string) => {
  const raw = String(curriculum ?? '').trim();
  const lower = raw.toLowerCase();
  const spacedRaw = raw.replace(/[_-]+/g, ' ').trim();
  const spacedLower = spacedRaw.toLowerCase();

  return Array.from(
    new Set([
      raw,
      lower,
      spacedRaw,
      spacedLower,
      ...getCurriculumAliasCandidates(curriculum),
    ].filter(Boolean)),
  );
};

const getCurriculumAliasCandidates = (value: string) => {
  const group = getCurriculumAliasGroup(value);
  if (!group) return [];

  return group.aliases.flatMap((alias) => {
    const trimmed = alias.trim();
    if (!trimmed) return [];

    return Array.from(
      new Set([
        trimmed,
        trimmed.toLowerCase(),
        trimmed.replace(/-/g, '_'),
        trimmed.replace(/_/g, '-'),
      ]),
    );
  });
};

const getSharedQuestionSources = (
  curriculum: string,
  questionScope: PracticeQuestionScopeFilter,
) => {
  const normalized = canonicalizeCurriculumId(curriculum);
  const sources = SHARED_QUESTION_SOURCES[normalized];
  if (!sources) return [];
  return sources[questionScope] ?? [];
};

const resolveQuestionBankTargets = (
  curriculum: string,
  questionScope: PracticeQuestionScopeFilter = 'all',
): QuestionBankTarget[] => {
  const sharedTargets = getSharedQuestionSources(curriculum, questionScope);
  const rawTargets: Array<{ curriculum: string; scope: PracticeQuestionScopeFilter }> =
    questionScope === 'common' && sharedTargets.length > 0
      ? [...sharedTargets]
      : questionScope === 'all' && sharedTargets.length > 0
        ? [{ curriculum, scope: 'specific' }, ...sharedTargets]
        : [{ curriculum, scope: questionScope }, ...sharedTargets];

  const targets = rawTargets.map((target) => ({
    curriculum: target.curriculum,
    scope: target.scope,
    candidates: buildCurriculumCandidates(target.curriculum),
  }));

  const deduped = new Map<string, QuestionBankTarget>();
  for (const target of targets) {
    const key = `${canonicalizeCurriculumId(target.curriculum)}:${target.scope}`;
    if (!deduped.has(key)) {
      deduped.set(key, target);
    }
  }

  return Array.from(deduped.values());
};

const readOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readFirstText = (row: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    const value = readText(row[key]);
    if (value) return value;
  }
  return null;
};

const readQuestionCategoryLabel = (row: Record<string, unknown>) =>
  readFirstText(row, [
    'ley_referencia',
    'category',
    'tema',
    'topic',
    'subject',
    'materia',
    'subtema',
    'temario_pregunta',
    'topic_label',
    'topicLabel',
    'tema_pregunta',
    'topic_name',
    'bloque',
  ]);

const normalizeCategoryLabel = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeQuestionBankText = (value: string) =>
  value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

const buildQuestionBankDedupeKey = (row: {
  number: number | null;
  category: string | null;
  text: string;
  correctAnswer: OptionKey;
}) =>
  [
    row.number ?? '',
    normalizeCategoryLabel(row.category),
    normalizeQuestionBankText(row.text),
    row.correctAnswer,
  ].join('|');

const mapQuestionBankCacheRow = (row: Record<string, unknown>): QuestionBankCacheRow | null => {
  const id = readText(row.id ?? row.question_id ?? row.uuid ?? row.slug);
  const correctAnswer = toOptionKey(
    row.respuesta_correcta ??
      row.correct_answer ??
      row.correct_option ??
      row.answer ??
      row.correct_answer_index,
  );
  const text = readFirstText(row, [
    'pregunta',
    'pregunta_texto',
    'question_text',
    'statement',
    'prompt',
    'stem',
    'enunciado_pregunta',
    'enunciado',
    'texto',
    'question',
  ]);

  if (!id || !correctAnswer || !text) return null;

  const number = readOptionalNumber(
    row.numero ?? row.question_number ?? row.number ?? row.orden ?? row.order ?? row.position,
  );
  const category = readQuestionCategoryLabel(row);
  const syllabus =
    toSyllabusType(
      row.question_scope ??
        row.question_scope_key ??
        row.raw_scope ??
        row.scope ??
        row.scope_key ??
        row.grupo ??
        row.temario_pregunta ??
        row.tema_pregunta ??
        row.subject_key,
      'common',
    );

  return {
    id,
    number,
    correctAnswer,
    syllabus,
    text,
    category,
    dedupeKey: buildQuestionBankDedupeKey({
      number,
      category,
      text,
      correctAnswer,
    }),
  };
};

const mapPracticeCloudError = (error: PostgrestLikeError) => {
  const message = String(error.message ?? '');
  return message || 'No se ha podido completar la operación.';
};

const queryQuestionBankRowsForTarget = async (target: QuestionBankTarget) => {
  const query = supabase
    .from('preguntas')
    .select(QUESTION_BANK_LIST_SELECT)
    .in('curriculum', target.candidates);

  const { data, error } = await query
    .order('numero', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw new Error(mapPracticeCloudError(error));
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map(mapQuestionBankCacheRow)
    .filter((row): row is QuestionBankCacheRow => Boolean(row))
    .filter((row) => target.scope === 'all' || row.syllabus === target.scope);
};

const mergeQuestionBankRows = (rows: QuestionBankCacheRow[]) => {
  const deduped = new Map<string, QuestionBankCacheRow>();

  for (const row of rows) {
    if (!deduped.has(row.dedupeKey)) {
      deduped.set(row.dedupeKey, row);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const leftNumber = left.number ?? Number.MAX_SAFE_INTEGER;
    const rightNumber = right.number ?? Number.MAX_SAFE_INTEGER;
    if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    return left.id.localeCompare(right.id, 'es');
  });
};

const buildQuestionBankIndexCacheKey = (
  curriculum: string,
  questionScope: PracticeQuestionScopeFilter,
) => [canonicalizeCurriculumId(curriculum), questionScope].join('|');

const getQuestionBankIndex = async (
  curriculum: string,
  questionScope: PracticeQuestionScopeFilter = 'all',
) => {
  const cacheKey = buildQuestionBankIndexCacheKey(curriculum, questionScope);
  const existing = questionBankIndexCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    const targets = resolveQuestionBankTargets(curriculum, questionScope);
    const rows = await Promise.all(targets.map((target) => queryQuestionBankRowsForTarget(target)));
    return mergeQuestionBankRows(rows.flat());
  })().catch((error) => {
    questionBankIndexCache.delete(cacheKey);
    throw error;
  });

  questionBankIndexCache.set(cacheKey, task);
  return task;
};

export const getQuestionBankPage = async (params: {
  curriculum: string;
  questionScope?: PracticeQuestionScopeFilter;
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<QuestionBankPage> => {
  const curriculum = params.curriculum;
  const questionScope = params.questionScope ?? 'all';
  const page = Math.max(0, Math.trunc(params.page ?? 0));
  const pageSize = Math.max(24, Math.min(180, Math.trunc(params.pageSize ?? 120)));
  const search = String(params.search ?? '').trim();
  const start = page * pageSize;
  const end = start + pageSize;
  const index = await getQuestionBankIndex(curriculum, questionScope);
  const normalizedSearch = search.toLowerCase();
  const filtered = !normalizedSearch
    ? index
    : /^\d{1,6}$/.test(search)
      ? index.filter((question) => question.number === Number(search))
      : index.filter((question) => question.text.toLowerCase().includes(normalizedSearch));

  return {
    items: filtered.slice(start, end).map(
      (row): QuestionBankListItem => ({
        id: row.id,
        number: row.number,
        correctAnswer: row.correctAnswer,
        syllabus: row.syllabus,
      }),
    ),
    page,
    pageSize,
    hasNextPage: end < filtered.length,
  };
};

export const getQuestionBankQuestionDetail = async (params: {
  questionId: string;
}): Promise<Question> => {
  const questionId = String(params.questionId ?? '').trim();
  if (!questionId) {
    throw new Error('No se ha indicado una pregunta válida.');
  }

  const cached = questionBankDetailCache.get(questionId);
  if (cached) return cached;

  const resolvedId = /^\d+$/.test(questionId) ? Number(questionId) : questionId;
  const { data, error } = await supabase
    .from('preguntas')
    .select('*')
    .eq('id', resolvedId)
    .maybeSingle();

  if (error) {
    throw new Error(mapPracticeCloudError(error));
  }

  if (!data) {
    throw new Error('No se ha encontrado la pregunta seleccionada.');
  }

  const question = mapQuestion((data ?? null) as Record<string, unknown>);
  if (!question) {
    throw new Error('No se ha podido interpretar la pregunta seleccionada.');
  }

  questionBankDetailCache.set(questionId, question);
  return question;
};
