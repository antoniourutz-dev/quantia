import { getSafeSupabaseSession, supabase } from './supabaseClient';
import { supabaseAnonKey, supabaseUrl } from './supabaseConfig';
import { createId } from './id';
import {
  QUESTION_BANK_LIST_SELECT,
  parseSyllabusType,
  toDbGrupo,
  toOptionKey,
  toSyllabusType,
} from './questionContracts';
import { getLocaleForCurriculum, isGoiTeknikariaCurriculum } from './locale';
import {
  mapAccountIdentity,
  mapCategoryRiskSummary,
  mapLearningDashboard,
  mapLearningDashboardV2,
  mapPressureInsights,
  mapPressureInsightsV2,
  mapQuestion,
  mapSession,
  normalizeQuestionScope,
  readNumber,
  readText,
} from './quantiaMappers';
import type {
  AccountIdentity,
  ActivePracticeSession,
  CloudPracticeState,
  OptionKey,
  PracticeCategoryRiskSummary,
  PracticeExamTarget,
  PracticeMode,
  PracticeQuestionScopeFilter,
  AdminQuestionDetail,
  AdminQuestionListItem,
  AdminUserDetail,
  AdminUserListItem,
  Question,
  PracticeSessionSummary,
  QuestionBankListItem,
  QuestionBankPage,
  SyllabusType,
  TestAnswer,
} from '../types';
import { formatSyllabusLabel } from '../types';

export const DEFAULT_CURRICULUM = 'osakidetza_admin';

export type DashboardBundle = {
  identity: AccountIdentity;
  practiceState: CloudPracticeState;
  activitySessions: PracticeSessionSummary[];
  questionsCount: number;
  weakCategories: PracticeCategoryRiskSummary[];
};

export type CurriculumOption = {
  id: string;
  label: string;
  questionCount?: number | null;
  sessionCount?: number | null;
  answeredCount?: number | null;
  lastStudiedAt?: string | null;
};

type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type SchemaName = 'app' | 'public';

type TableSource = {
  schema: SchemaName;
  table: string;
};

const getTableSourceKey = (source: TableSource) => `${source.schema}.${source.table}`;
const missingTableSources = new Set<string>();
const missingCurriculumRpcs = new Set<string>();
const questionBankDetailCache = new Map<string, Question>();

type QuestionBankCacheRow = {
  id: string;
  number: number | null;
  correctAnswer: OptionKey;
  syllabus: SyllabusType;
  text: string;
  category: string | null;
  dedupeKey: string;
};

const questionBankIndexCache = new Map<string, Promise<QuestionBankCacheRow[]>>();

const FALLBACK_CURRICULUM_OPTIONS: CurriculumOption[] = [
  { id: DEFAULT_CURRICULUM, label: 'Administrativo' },
  { id: 'auxiliar_administrativo', label: 'Auxiliar administrativo' },
  {
    id: 'tecnico_superior_administracion_y_gestion',
    label: 'Técnico/a Superior Administración y Gestión',
  },
  { id: 'general', label: 'General' },
  { id: 'leyes_generales', label: 'Leyes Generales' },
  { id: 'goi-teknikaria', label: 'Goi-teknikaria' },
];

const CURRICULUM_RPC_NAMES: string[] = [];

const CURRICULUM_TABLE_SOURCES: TableSource[] = [
  { schema: 'app', table: 'practice_profiles' },
  { schema: 'public', table: 'opposition_configs' },
];

const QUESTION_TABLE_SOURCES: TableSource[] = [
  { schema: 'public', table: 'preguntas' },
];

const SESSION_TABLE_SOURCES: TableSource[] = [
  { schema: 'app', table: 'practice_sessions' },
];

const ATTEMPT_TABLE_SOURCES: TableSource[] = [
  { schema: 'app', table: 'user_question_state' },
  { schema: 'app', table: 'question_attempt_events' },
  { schema: 'app', table: 'practice_attempts' },
  { schema: 'app', table: 'practice_sessions' },
];

const SESSION_SELECT_CANDIDATES = [
  'session_id, mode, title, started_at, finished_at, score, total',
  'id, mode, title, started_at, finished_at, score, total',
  'session_id, mode, title, startedAt, finishedAt, score, total',
  'id, mode, title, startedAt, finishedAt, score, total',
  'session_id, mode, title, started_at, score, total',
  'id, mode, title, started_at, score, total',
  'session_id, mode, title, startedAt, score, total',
  'id, mode, title, startedAt, score, total',
] as const;

const SESSION_ATTEMPTS_SELECT_CANDIDATES = [
  'session_id, attempts',
  'id, attempts',
  'session_id, attempts_json',
  'id, attempts_json',
  'session_id, attempt_rows',
  'id, attempt_rows',
  'session_id, answers',
  'id, answers',
] as const;

const CURRICULUM_FIELD_ALIASES = [
  'curriculum',
  'curriculum_slug',
  'curriculum_code',
  'curriculum_key',
  'oposicion',
  'oposicion_slug',
  'oposicion_codigo',
  'oposicion_key',
  'opposition',
  'opposition_slug',
  'opposition_code',
  'opposition_key',
  'curriculum_id',
  'oposicion_id',
  'opposition_id',
] as const;

const CURRICULUM_LABEL_ALIASES = [
  'curriculum_label',
  'curriculum_name',
  'display_name',
  'displayName',
  'label',
  'name',
  'title',
  'oposicion_nombre',
  'opposition_name',
] as const;

const QUESTION_CURRICULUM_FIELD_ALIASES = [
  ...CURRICULUM_FIELD_ALIASES,
  'curriculum_label',
  'curriculum_name',
  'oposicion_nombre',
  'opposition_name',
  'temario_pregunta',
  'subject_key',
] as const;

const QUESTION_CATEGORY_FIELD_ALIASES = [
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
] as const;

const CURRICULUM_VALUE_PREFERENCE_ALIASES = [
  'curriculum',
  'curriculum_slug',
  'curriculum_code',
  'curriculum_key',
  'oposicion_slug',
  'oposicion_codigo',
  'oposicion_key',
  'opposition_slug',
  'opposition_code',
  'opposition_key',
  'oposicion',
  'opposition',
  'slug',
  'code',
  'curriculum_id',
  'oposicion_id',
  'opposition_id',
] as const;

const canonicalizeCurriculumId = (value: string) => String(value).trim().toLowerCase().replace(/_/g, '-');

const CURRICULUM_ALIAS_GROUPS = [
  {
    key: 'osakidetza-admin',
    label: 'Administrativo',
    aliases: ['osakidetza_admin', 'osakidetza-admin', 'administrativo'],
  },
  {
    key: 'auxiliar-administrativo',
    label: 'Auxiliar administrativo',
    aliases: ['auxiliar_administrativo', 'auxiliar-administrativo', 'auxiliar administrativo'],
  },
  {
    key: 'goi-teknikaria',
    label: 'Goi-teknikaria',
    aliases: ['goi-teknikaria', 'goi_teknikaria', 'goi-teknikaria-eu', 'goi_teknikaria_eu'],
  },
  {
    key: 'tecnico-superior-administracion-y-gestion',
    label: 'Técnico/a Superior Administración y Gestión',
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

type SharedCurriculumSource = {
  curriculum: string;
  scope: PracticeQuestionScopeFilter;
};

const CURRICULUM_SHARED_QUESTION_SOURCES: Record<
  string,
  Partial<Record<PracticeQuestionScopeFilter, SharedCurriculumSource[]>>
> = {
  'auxiliar-administrativo': {
    all: [{ curriculum: DEFAULT_CURRICULUM, scope: 'common' }],
    common: [{ curriculum: DEFAULT_CURRICULUM, scope: 'common' }],
  },
};

const getCurriculumAliasGroup = (value: string) => {
  const normalized = canonicalizeCurriculumId(value);
  return CURRICULUM_ALIAS_GROUPS.find((group) =>
    group.aliases.some((alias) => canonicalizeCurriculumId(alias) === normalized),
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

const getSharedCurriculumSources = (
  curriculum: string,
  questionScope: PracticeQuestionScopeFilter,
) => {
  const normalized = canonicalizeCurriculumId(curriculum);
  const sources = CURRICULUM_SHARED_QUESTION_SOURCES[normalized];
  if (!sources) return [];
  return sources[questionScope] ?? [];
};

const buildCurriculumCandidates = (curriculum: string) => {
  const raw = String(curriculum ?? '').trim();
  const lower = raw.toLowerCase();
  const capitalized = raw ? raw[0].toUpperCase() + raw.slice(1) : '';
  const capitalizedLower = lower ? lower[0].toUpperCase() + lower.slice(1) : '';
  const spacedRaw = raw.replace(/[_-]+/g, ' ').trim();
  const spacedLower = spacedRaw.toLowerCase();
  const spacedCapitalized = spacedRaw ? spacedRaw[0].toUpperCase() + spacedRaw.slice(1) : '';
  const spacedTitle = spacedLower
    .split(' ')
    .filter(Boolean)
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
  const candidates = new Set<string>();
  for (const value of [
    raw,
    lower,
    capitalized,
    capitalizedLower,
    spacedRaw,
    spacedLower,
    spacedCapitalized,
    spacedTitle,
  ]) {
    if (!value) continue;
    candidates.add(value);
    candidates.add(value.replace(/-/g, '_'));
    candidates.add(value.replace(/_/g, '-'));
    for (const alias of getCurriculumAliasCandidates(value)) {
      candidates.add(alias);
    }
  }
  return Array.from(candidates);
};

const curriculumCandidatesCache = new Map<string, Promise<string[]>>();
const curriculumContextCandidatesCache = new Map<string, Promise<string[]>>();

const resolveCurrentUserCurriculumContextCandidates = async (
  curriculum: string,
  baseCandidates: string[],
) => {
  const cacheKey = canonicalizeCurriculumId(curriculum);
  if (curriculumContextCandidatesCache.has(cacheKey)) {
    return curriculumContextCandidatesCache.get(cacheKey)!;
  }

  const task = (async () => {
    const session = await getSafeSupabaseSession().catch(() => null);
    const userId = readText(session?.user?.id);
    if (!userId) return [];

    const { data: profiles, error: profilesError } = await supabase
      .from('user_opposition_profiles')
      .select('opposition_id,is_active_context,is_primary')
      .eq('user_id', userId)
      .limit(24);

    if (profilesError || !Array.isArray(profiles) || profiles.length === 0) {
      return [];
    }

    const oppositionIds = profiles
      .map((row) => readText((row as Record<string, unknown>).opposition_id))
      .filter((value): value is string => Boolean(value));

    if (oppositionIds.length === 0) return [];

    const normalizedBase = new Set(baseCandidates.map((value) => canonicalizeCurriculumId(value)));
    const { data: configs, error: configsError } = await supabase
      .from('opposition_configs')
      .select('opposition_id,config_json')
      .in('opposition_id', oppositionIds);

    if (configsError || !Array.isArray(configs) || configs.length === 0) {
      return [];
    }

    const resolved = new Set<string>();
    for (const row of configs as Array<Record<string, unknown>>) {
      const oppositionId = readText(row.opposition_id);
      const cfg =
        row.config_json && typeof row.config_json === 'object' && !Array.isArray(row.config_json)
          ? (row.config_json as Record<string, unknown>)
          : null;
      if (!cfg) continue;

      const cfgValues = [
        readText(cfg.curriculum),
        readText(cfg.curriculum_key ?? cfg.curriculumKey),
        readText(cfg.label ?? cfg.name ?? cfg.title),
      ].filter((value): value is string => Boolean(value));

      const matches = cfgValues.some((value) => normalizedBase.has(canonicalizeCurriculumId(value)));
      if (!matches) continue;

      if (oppositionId) resolved.add(oppositionId);
      for (const value of cfgValues) resolved.add(value);
    }

    return Array.from(resolved);
  })();

  curriculumContextCandidatesCache.set(cacheKey, task);
  return task;
};

const resolveCurriculumCandidates = async (curriculum: string) => {
  const cacheKey = canonicalizeCurriculumId(curriculum);
  if (curriculumCandidatesCache.has(cacheKey)) {
    return curriculumCandidatesCache.get(cacheKey)!;
  }

  const task = (async () => {
    const baseCandidates = buildCurriculumCandidates(curriculum);
    const normalized = new Set(baseCandidates.map((value) => String(value).trim().toLowerCase()));
    const resolvedIds = new Set<string>();

    for (const source of CURRICULUM_TABLE_SOURCES) {
      if (isKnownMissingTableSource(source)) continue;

      const { data, error } = await getSchemaClient(source.schema).from(source.table).select('*').limit(220);
      if (error) {
        if (isMissingRelationError(error)) {
          markTableSourceMissing(source);
          continue;
        }
        if (isMissingColumnError(error)) continue;
        continue;
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      for (const row of rows) {
        const values = [
          ...CURRICULUM_VALUE_PREFERENCE_ALIASES.map((key) => readText(row[key])),
          ...CURRICULUM_LABEL_ALIASES.map((key) => readText(row[key])),
        ].filter((value): value is string => Boolean(value));

        const matches = values.some((value) => normalized.has(String(value).trim().toLowerCase()));
        if (!matches) continue;

        for (const idKey of ['id', 'curriculum_id', 'oposicion_id', 'opposition_id'] as const) {
          const idValue = readText((row as Record<string, unknown>)[idKey]);
          if (idValue) resolvedIds.add(idValue);
        }
      }

      if (resolvedIds.size > 0) {
        break;
      }
    }

    const userContextCandidates = await resolveCurrentUserCurriculumContextCandidates(
      curriculum,
      baseCandidates,
    ).catch(() => []);
    for (const candidate of userContextCandidates) {
      resolvedIds.add(candidate);
    }

    const all = Array.from(new Set([...baseCandidates, ...Array.from(resolvedIds)]));
    return all;
  })();

  curriculumCandidatesCache.set(cacheKey, task);
  return task;
};

type CurriculumQueryTarget = {
  curriculum: string;
  candidates: string[];
  scope: PracticeQuestionScopeFilter;
};

const resolveQuestionCurriculumTargets = async (
  curriculum: string,
  questionScope: PracticeQuestionScopeFilter = 'all',
): Promise<CurriculumQueryTarget[]> => {
  const rawTargets: Array<{ curriculum: string; scope: PracticeQuestionScopeFilter }> = [
    { curriculum, scope: questionScope },
    ...getSharedCurriculumSources(curriculum, questionScope),
  ];

  const targets = await Promise.all(
    rawTargets.map(async (target) => ({
      curriculum: target.curriculum,
      scope: target.scope,
      candidates: await resolveCurriculumCandidates(target.curriculum),
    })),
  );

  const deduped = new Map<string, CurriculumQueryTarget>();
  for (const target of targets) {
    const key = `${canonicalizeCurriculumId(target.curriculum)}:${target.scope}`;
    if (!deduped.has(key)) {
      deduped.set(key, target);
    }
  }

  return Array.from(deduped.values());
};

const hasSharedQuestionSources = (
  curriculum: string,
  questionScope: PracticeQuestionScopeFilter = 'all',
) => getSharedCurriculumSources(curriculum, questionScope).length > 0;

const mapPracticeCloudError = (error: PostgrestLikeError) => {
  const message = String(error.message ?? '');
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes('service is unavailable') ||
    normalizedMessage.includes('bad gateway') ||
    normalizedMessage.includes('gateway timeout') ||
    normalizedMessage.includes('temporarily unavailable') ||
    normalizedMessage.includes('timeout')
  ) {
    return 'El backend de Supabase no esta disponible ahora mismo (proyecto pausado o caida temporal). Reactiva el proyecto en Supabase y vuelve a intentarlo.';
  }
  if (error.code === '42501' || normalizedMessage.includes('not_authenticated')) {
    return 'La sesion ha caducado. Vuelve a iniciar sesion.';
  }
  if (
    normalizedMessage.includes('permission denied') ||
    normalizedMessage.includes('insufficient privilege') ||
    normalizedMessage.includes('row level security') ||
    normalizedMessage.includes('rls')
  ) {
    return 'No hay permisos para leer la tabla de preguntas desde la app (RLS/policies). Activa una policy SELECT para el rol authenticated (o anon si procede) en la tabla preguntas.';
  }
  if (normalizedMessage.includes('could not find the function')) {
    return 'Faltan RPCs del backend de practica en Supabase. Revisa las migraciones.';
  }
  return message || 'No se ha podido completar la operacion.';
};

const getErrorSignature = (error: PostgrestLikeError) =>
  `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();

const isMissingColumnForField = (error: PostgrestLikeError, field: string) => {
  const signature = getErrorSignature(error);
  const target = String(field).trim().toLowerCase();
  if (!target) return false;
  return (
    signature.includes(`"${target}"`) ||
    signature.includes(`'${target}'`) ||
    signature.includes(` ${target} `) ||
    signature.includes(`.${target}`) ||
    signature.includes(`=${target}`) ||
    signature.includes(` ${target}.`)
  );
};

const isSchemaCacheSignatureError = (error: PostgrestLikeError) => {
  const signature = getErrorSignature(error);
  return signature.includes('could not find the function') || signature.includes('schema cache');
};

const isMissingRelationError = (error: PostgrestLikeError) => {
  const signature = getErrorSignature(error);
  return (
    error.code === '42P01' ||
    signature.includes('does not exist') ||
    signature.includes('relation') ||
    signature.includes('could not find the table')
  );
};

const isMissingColumnError = (error: PostgrestLikeError) => {
  const signature = getErrorSignature(error);
  return error.code === '42703' || signature.includes('column') || signature.includes('field');
};

const getSchemaClient = (schema: SchemaName) =>
  schema === 'app' ? supabase.schema('app') : supabase;

const isKnownMissingTableSource = (source: TableSource) =>
  missingTableSources.has(getTableSourceKey(source));

const markTableSourceMissing = (source: TableSource) => {
  missingTableSources.add(getTableSourceKey(source));
};

const readFirstText = (row: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    const value = readText(row[key]);
    if (value) return value;
  }
  return null;
};

const readOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCategoryLabel = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const readQuestionCategoryLabel = (row: Record<string, unknown>) =>
  readFirstText(row, QUESTION_CATEGORY_FIELD_ALIASES);

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

const buildQuestionContentDedupKey = (row: {
  number: number | null;
  category: string | null;
  text: string | null;
  correctAnswer: OptionKey | null;
}) => {
  const normalizedText = normalizeQuestionBankText(String(row.text ?? ''));
  if (!normalizedText || !row.correctAnswer) return null;

  return [
    row.number ?? '',
    normalizeCategoryLabel(row.category),
    normalizedText,
    row.correctAnswer,
  ].join('|');
};

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
    normalizeQuestionScope(
      row.question_scope ??
        row.question_scope_key ??
        row.raw_scope ??
        row.scope ??
        row.scope_key ??
        row.grupo ??
        row.temario_pregunta ??
        row.tema_pregunta ??
        row.subject_key,
    ) ?? 'common';

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

const buildQuestionBankIndexCacheKey = (
  curriculum: string,
  questionScope: PracticeQuestionScopeFilter,
) => [canonicalizeCurriculumId(curriculum), questionScope].join('|');

const resolveQuestionBankTargets = async (
  curriculum: string,
  questionScope: PracticeQuestionScopeFilter = 'all',
): Promise<CurriculumQueryTarget[]> => {
  const sharedTargets = getSharedCurriculumSources(curriculum, questionScope);
  const rawTargets: Array<{ curriculum: string; scope: PracticeQuestionScopeFilter }> =
    questionScope === 'common' && sharedTargets.length > 0
      ? [...sharedTargets]
      : questionScope === 'all' && sharedTargets.length > 0
        ? [{ curriculum, scope: 'specific' }, ...sharedTargets]
        : [{ curriculum, scope: questionScope }, ...sharedTargets];

  const targets = rawTargets.map((target) => ({
    curriculum: target.curriculum,
    scope: target.scope,
    candidates: Array.from(
      new Set([
        ...buildCurriculumCandidates(target.curriculum),
        ...getCurriculumAliasCandidates(target.curriculum),
      ]),
    ),
  }));

  const deduped = new Map<string, CurriculumQueryTarget>();
  for (const target of targets) {
    const key = `${canonicalizeCurriculumId(target.curriculum)}:${target.scope}`;
    if (!deduped.has(key)) {
      deduped.set(key, target);
    }
  }

  return Array.from(deduped.values());
};

const queryQuestionBankRowsForTarget = async (target: CurriculumQueryTarget) => {
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
    .filter((row) => target.scope === 'all' || row.syllabus === target.scope)
    ;
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
    const targets = await resolveQuestionBankTargets(curriculum, questionScope);
    const rows = await Promise.all(targets.map((target) => queryQuestionBankRowsForTarget(target)));
    return mergeQuestionBankRows(rows.flat());
  })().catch((error) => {
    questionBankIndexCache.delete(cacheKey);
    throw error;
  });

  questionBankIndexCache.set(cacheKey, task);
  return task;
};

const isLawSelectionCurriculum = (curriculum: string) =>
  canonicalizeCurriculumId(curriculum) === 'leyes-generales';

const toSentenceCase = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const stripLawArticlePrefix = (value: string) =>
  value
    .replace(
      /^(?:arts?|art(?:[íi]culo)?s?)\.?\s*(?:\d+[A-Za-zºª]*(?:\.\d+)?(?:\s*(?:bis|ter|qu[aá]ter))?(?:\s*(?:,|y)\s*)?)+(?:\s*[.:)-])?\s*/i,
      '',
    )
    .replace(/^(?:de la|de las|de los|del|de|la|las|los|el)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const getLawGroupLabel = (value: string | null | undefined) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const cleaned = stripLawArticlePrefix(raw);
  if (!cleaned) return null;

  if (/(constituci[oó]n|(?:^|\W)ce(?:\W|$))/i.test(cleaned)) {
    return 'Constitución';
  }

  const explicitLawMatchers = [
    /\b(ley(?:\s+org[aá]nica)?(?:\s+foral)?\s+\d+\/\d{4})\b/i,
    /\b(real\s+decreto(?:\s+legislativo)?\s+\d+\/\d{4})\b/i,
    /\b(real\s+decreto-ley\s+\d+\/\d{4})\b/i,
    /\b(estatuto\s+de\s+autonom[ií]a[^.,;:]*)\b/i,
  ];

  for (const matcher of explicitLawMatchers) {
    const match = cleaned.match(matcher);
    if (match?.[1]) {
      return toSentenceCase(match[1].replace(/\s+/g, ' ').trim());
    }
  }

  return toSentenceCase(cleaned);
};

export const getCurriculumCategoryGroupLabel = (
  curriculum: string,
  category: string | null | undefined,
) => {
  const raw = String(category ?? '').trim();
  if (!raw) return null;

  if (isGoiTeknikariaCurriculum(curriculum)) {
    const syllabus = parseSyllabusType(raw);
    if (syllabus) {
      return formatSyllabusLabel(syllabus, getLocaleForCurriculum(curriculum), { curriculum });
    }
  }

  if (!isLawSelectionCurriculum(curriculum)) {
    return raw;
  }

  return getLawGroupLabel(category);
};

const hasCurriculumActivity = (option: Pick<CurriculumOption, 'sessionCount' | 'answeredCount' | 'lastStudiedAt'>) =>
  (option.sessionCount ?? 0) > 0 ||
  (option.answeredCount ?? 0) > 0 ||
  Boolean(option.lastStudiedAt);

const isOpaqueCurriculumValue = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return true;

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
  const isLongNumeric = /^\d{6,}$/.test(normalized);
  const isHashLike = /^[0-9a-f]{16,}$/i.test(normalized);

  return isUuid || isLongNumeric || isHashLike;
};

export const formatCurriculumLabel = (curriculum: string) => {
  const normalized = curriculum.trim();
  if (!normalized) return 'Oposicion';

  const aliasGroup = getCurriculumAliasGroup(normalized);
  if (aliasGroup) return aliasGroup.label;

  const known = FALLBACK_CURRICULUM_OPTIONS.find((option) => option.id === normalized);
  if (known) return known.label;

  return normalized
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => {
      if (segment.length <= 3) return segment.toUpperCase();
      return segment[0].toUpperCase() + segment.slice(1);
    })
    .join(' ');
};

export const buildFallbackCurriculumOptions = (preferredCurriculum?: string) => {
  const options = [...FALLBACK_CURRICULUM_OPTIONS];
  const normalizedPreferred = preferredCurriculum?.trim();
  if (
    normalizedPreferred &&
    !options.some((option) => option.id === normalizedPreferred)
  ) {
    options.unshift({
      id: normalizedPreferred,
      label: formatCurriculumLabel(normalizedPreferred),
    });
  }
  return options;
};

const extractCurriculumId = (row: Record<string, unknown>) => {
  const nestedConfig =
    row.config_json && typeof row.config_json === 'object' && !Array.isArray(row.config_json)
      ? (row.config_json as Record<string, unknown>)
      : null;
  const sourceRow = nestedConfig ? { ...row, ...nestedConfig } : row;

  const candidates = CURRICULUM_VALUE_PREFERENCE_ALIASES.map((key) => readText(sourceRow[key])).filter(
    (value): value is string => Boolean(value),
  );

  if (candidates.length === 0) return null;
  const preferredCandidate = candidates.find((value) => !isOpaqueCurriculumValue(value));
  return preferredCandidate ?? candidates[0];
};

// ==========================================
// STUDY MODE LOCAL ACTIONS
// ==========================================

import type { HighlightType, TextHighlight } from '../components/HighlightableText';

type StudyHighlightContentType = 'question' | 'explanation' | 'answer';

type StudyHighlightSpan = {
  start_index: number;
  end_index: number;
  type: HighlightType;
};

const buildSpanId = (span: { startIndex: number; endIndex: number; type: HighlightType }) =>
  `${span.startIndex}:${span.endIndex}:${span.type}`;

const buildStudyKey = (params: {
  questionId: string;
  contentType: StudyHighlightContentType;
  answerIndex?: number | null;
}) => {
  if (params.contentType === 'explanation') return `${params.questionId}_exp`;
  if (params.contentType === 'answer') return `${params.questionId}_ans_${params.answerIndex ?? 0}`;
  return params.questionId;
};

const parseStudyKey = (
  key: string,
): { baseQuestionId: string; contentType: StudyHighlightContentType; answerIndex: number | null } => {
  const raw = String(key ?? '');
  if (raw.endsWith('_exp')) {
    return { baseQuestionId: raw.slice(0, -4), contentType: 'explanation', answerIndex: null };
  }
  const match = raw.match(/^(.*)_ans_(\d+)$/);
  if (match) {
    return { baseQuestionId: match[1], contentType: 'answer', answerIndex: Number(match[2]) };
  }
  return { baseQuestionId: raw, contentType: 'question', answerIndex: null };
};

export interface StudyQuestionData {
  highlights: Record<string, TextHighlight[]>;
  notes: Record<string, string>;
}

const STUDY_STORE_KEY = 'quantia_study_state';

const readStudyState = (): StudyQuestionData => {
  try {
    const raw = window.localStorage.getItem(STUDY_STORE_KEY);
    if (!raw) return { highlights: {}, notes: {} };
    return JSON.parse(raw);
  } catch {
    return { highlights: {}, notes: {} };
  }
};

const writeStudyState = (state: StudyQuestionData) => {
  try {
    window.localStorage.setItem(STUDY_STORE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
};

export const getStudyData = async (questionIds: string[]): Promise<StudyQuestionData> => {
  const session = await getSafeSupabaseSession();
  const userId = session?.user?.id;
  
  const state = readStudyState();
  const res: StudyQuestionData = { highlights: {}, notes: {} };

  for (const qid of questionIds) {
    if (state.highlights[qid]) res.highlights[qid] = state.highlights[qid];
    if (state.notes[qid]) res.notes[qid] = state.notes[qid];

    const expKey = `${qid}_exp`;
    if (state.highlights[expKey]) res.highlights[expKey] = state.highlights[expKey];

    for (let index = 0; index < 4; index += 1) {
      const answerKey = `${qid}_ans_${index}`;
      if (state.highlights[answerKey]) res.highlights[answerKey] = state.highlights[answerKey];
    }
  }

  // If no user, stick to local
  if (!userId) {
    return res;
  }

  try {
    const { data: cloudHighlightsV2, error: h2Error } = await supabase
      .from('user_highlights_v2')
      .select('question_id, content_type, answer_index, spans')
      .in('question_id', questionIds)
      .eq('user_id', userId);

    if (!h2Error && cloudHighlightsV2) {
      for (const row of cloudHighlightsV2 as any[]) {
        const questionId = String(row.question_id ?? '');
        const contentType = String(row.content_type ?? '') as StudyHighlightContentType;
        const answerIndex =
          contentType === 'answer' && typeof row.answer_index === 'number'
            ? Math.max(0, Math.trunc(row.answer_index))
            : null;
        const spans = Array.isArray(row.spans) ? (row.spans as StudyHighlightSpan[]) : [];
        const key = buildStudyKey({ questionId, contentType, answerIndex });
        if (!res.highlights[key]) res.highlights[key] = [];
        for (const span of spans) {
          const startIndex = Number((span as any).start_index);
          const endIndex = Number((span as any).end_index);
          const type = (span as any).type as HighlightType;
          if (!Number.isFinite(startIndex) || !Number.isFinite(endIndex)) continue;
          if (!type) continue;
          res.highlights[key].push({
            id: buildSpanId({ startIndex, endIndex, type }),
            startIndex,
            endIndex,
            type,
          });
        }
      }
    } else {
      const { data: cloudHighlights, error: hError } = await supabase
        .from('user_highlights')
        .select('*')
        .in('question_id', questionIds)
        .eq('user_id', userId);

      if (!hError && cloudHighlights) {
        cloudHighlights.forEach((item: any) => {
          if (!res.highlights[item.question_id]) res.highlights[item.question_id] = [];
          res.highlights[item.question_id].push({
            id: item.id,
            startIndex: item.start_index,
            endIndex: item.end_index,
            type: item.type as any,
          });
        });
      }
    }

    // 2. Fetch Notes from Cloud
    const { data: cloudNotes, error: nError } = await supabase
      .from('user_notes')
      .select('question_id, content')
      .in('question_id', questionIds)
      .eq('user_id', userId);

    if (!nError && cloudNotes) {
      cloudNotes.forEach((item: any) => {
        res.notes[item.question_id] = item.content;
      });
    }

    // Sync back to local storage for offline use
    const newState = { ...state };
    Object.keys(res.highlights).forEach(qid => { newState.highlights[qid] = res.highlights[qid]; });
    Object.keys(res.notes).forEach(qid => { newState.notes[qid] = res.notes[qid]; });
    writeStudyState(newState);

  } catch (err) {
    console.error('Error fetching study data from Supabase:', err);
  }

  return res;
};

export const saveStudyData = async (
  questionId: string, 
  data: { highlights?: TextHighlight[], notes?: string },
  meta?: {
    contentType?: StudyHighlightContentType;
    answerIndex?: number | null;
    category?: string | null;
    baseQuestionId?: string;
  },
) => {
  // Always update local first for immediate UI response
  const state = readStudyState();
  if (data.highlights) state.highlights[questionId] = data.highlights;
  if (data.notes !== undefined) state.notes[questionId] = data.notes;
  writeStudyState(state);

  // Attempt Cloud Sync
  const session = await getSafeSupabaseSession();
  const userId = session?.user?.id;
  if (!userId) return;

  try {
    if (data.highlights) {
      const parsed = parseStudyKey(questionId);
      const contentType = meta?.contentType ?? parsed.contentType;
      const answerIndex = meta?.answerIndex ?? parsed.answerIndex;
      const baseQuestionId = meta?.baseQuestionId ?? parsed.baseQuestionId;
      const category = meta?.category ?? null;
      const normalizedAnswerIndex =
        contentType === 'answer'
          ? typeof answerIndex === 'number' && Number.isFinite(answerIndex)
            ? Math.max(0, Math.trunc(answerIndex))
            : 0
          : -1;

      const spans: StudyHighlightSpan[] = data.highlights.map((h) => ({
        start_index: h.startIndex,
        end_index: h.endIndex,
        type: h.type,
      }));

      const delRes = await supabase
        .from('user_highlights_v2')
        .delete()
        .eq('user_id', userId)
        .eq('question_id', baseQuestionId)
        .eq('content_type', contentType)
        .eq('answer_index', normalizedAnswerIndex);

      const v2Missing =
        Boolean(delRes.error) &&
        (String((delRes.error as any)?.code ?? '') === '42P01' ||
          String((delRes.error as any)?.message ?? '').toLowerCase().includes('relation'));

      if (!v2Missing) {
        if (spans.length > 0) {
          await supabase.from('user_highlights_v2').upsert(
            {
              user_id: userId,
              question_id: baseQuestionId,
              content_type: contentType,
              answer_index: normalizedAnswerIndex,
              category,
              spans,
            },
            { onConflict: 'user_id,question_id,content_type,answer_index' },
          );
        }
      } else {
        await supabase.from('user_highlights').delete().eq('question_id', questionId).eq('user_id', userId);

        const rows = data.highlights.map((h) => ({
          user_id: userId,
          question_id: questionId,
          start_index: h.startIndex,
          end_index: h.endIndex,
          type: h.type,
        }));

        if (rows.length > 0) {
          await supabase.from('user_highlights').insert(rows);
        }
      }
    }

    if (data.notes !== undefined) {
      const normalizedNote = String(data.notes ?? '');
      const payload = {
        user_id: userId,
        question_id: questionId,
        content: normalizedNote,
      };

      const deleteResult = await supabase
        .from('user_notes')
        .delete()
        .eq('user_id', userId)
        .eq('question_id', questionId);

      if (deleteResult.error) {
        throw deleteResult.error;
      }

      if (normalizedNote.trim()) {
        const insertResult = await supabase.from('user_notes').insert(payload);
        if (insertResult.error) {
          throw insertResult.error;
        }
      }
    }
  } catch (err) {
    console.error('Error saving study data to Supabase:', err);
  }
};

export const setLastVisitedStudyQuestion = (questionId: string) => {
  try {
    localStorage.setItem('quantia_last_study_qid', questionId);
  } catch (e) {
    // ignore
  }
};

export const getLastVisitedStudyQuestion = (): string | null => {
  return localStorage.getItem('quantia_last_study_qid');
};

const buildNormalizedCurriculumCandidateSet = (values: string[]) => {
  const normalized = new Set<string>();
  for (const value of values) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) continue;
    normalized.add(trimmed.toLowerCase());
    normalized.add(canonicalizeCurriculumId(trimmed));
  }
  return normalized;
};

const rowMatchesCurriculumCandidates = (
  row: Record<string, unknown>,
  normalizedCandidates: Set<string>,
) => {
  const rawValues = [
    ...CURRICULUM_VALUE_PREFERENCE_ALIASES.map((key) => readText(row[key])),
    ...CURRICULUM_LABEL_ALIASES.map((key) => readText(row[key])),
  ].filter((value): value is string => Boolean(value));

  for (const value of rawValues) {
    const trimmed = String(value).trim();
    if (!trimmed) continue;
    if (normalizedCandidates.has(trimmed.toLowerCase())) return true;
    if (normalizedCandidates.has(canonicalizeCurriculumId(trimmed))) return true;
  }

  return false;
};

const rowHasCurriculumMetadata = (row: Record<string, unknown>) => {
  const rawValues = [
    ...CURRICULUM_VALUE_PREFERENCE_ALIASES.map((key) => readText(row[key])),
    ...CURRICULUM_LABEL_ALIASES.map((key) => readText(row[key])),
  ].filter((value): value is string => Boolean(value));

  return rawValues.length > 0;
};

const sortSessionSummariesByRecency = <T extends { finishedAt?: string | null; startedAt?: string | null }>(
  rows: T[],
) =>
  [...rows].sort((left, right) => {
    const leftDate = Date.parse(left.finishedAt || left.startedAt || '');
    const rightDate = Date.parse(right.finishedAt || right.startedAt || '');
    if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) return rightDate - leftDate;
    if (Number.isFinite(rightDate)) return 1;
    if (Number.isFinite(leftDate)) return -1;
    return 0;
  });

const getSessionTableRows = async (source: TableSource, limit: number) => {
  const orderedQueries = [
    () =>
      getSchemaClient(source.schema)
        .from(source.table)
        .select('*')
        .order('finished_at', { ascending: false, nullsFirst: false })
        .limit(limit),
    () =>
      getSchemaClient(source.schema)
        .from(source.table)
        .select('*')
        .order('started_at', { ascending: false, nullsFirst: false })
        .limit(limit),
    () => getSchemaClient(source.schema).from(source.table).select('*').limit(limit),
  ];

  for (const query of orderedQueries) {
    const { data, error } = await query();
    if (!error) {
      return { data: (data ?? []) as Array<Record<string, unknown>>, error: null as PostgrestLikeError | null };
    }
    if (isMissingColumnError(error)) continue;
    if (isMissingRelationError(error)) {
      markTableSourceMissing(source);
      return { data: [] as Array<Record<string, unknown>>, error };
    }
    return { data: [] as Array<Record<string, unknown>>, error };
  }

  return { data: [] as Array<Record<string, unknown>>, error: null as PostgrestLikeError | null };
};

const getRecentActivitySessions = async () => {
  let lastError: Error | null = null;

  for (const source of SESSION_TABLE_SOURCES) {
    if (isKnownMissingTableSource(source)) continue;

    const { data, error } = await getSessionTableRows(source, 1000);
    if (!error) {
      return sortSessionSummariesByRecency(
        ((data ?? []) as Array<Record<string, unknown>>).map(mapSession),
      );
    }

    if (isMissingRelationError(error)) {
      markTableSourceMissing(source);
      continue;
    }
    lastError = new Error(mapPracticeCloudError(error));
  }

  if (lastError) throw lastError;
  return [];
};

const extractCurriculumOption = (row: Record<string, unknown>): CurriculumOption | null => {
  const nestedConfig =
    row.config_json && typeof row.config_json === 'object' && !Array.isArray(row.config_json)
      ? (row.config_json as Record<string, unknown>)
      : null;
  const sourceRow = nestedConfig ? { ...row, ...nestedConfig } : row;
  const id = extractCurriculumId(sourceRow);
  if (!id) return null;

  return {
    id,
    label: readFirstText(sourceRow, CURRICULUM_LABEL_ALIASES) ?? formatCurriculumLabel(id),
    questionCount: readOptionalNumber(
      sourceRow.question_count ??
        sourceRow.total_questions ??
        sourceRow.questions_count ??
        sourceRow.total,
    ),
    sessionCount: readOptionalNumber(sourceRow.total_sessions ?? sourceRow.session_count),
    answeredCount: readOptionalNumber(sourceRow.total_answered ?? sourceRow.answered_count),
    lastStudiedAt: readText(sourceRow.last_studied_at ?? sourceRow.last_answered_at ?? sourceRow.updated_at),
  };
};

const mergeCurriculumOptions = (
  options: CurriculumOption[],
  preferredCurriculum?: string,
): CurriculumOption[] => {
  const merged = new Map<string, CurriculumOption>();

  for (const option of options) {
    const id = option.id.trim();
    if (!id) continue;

    const current = merged.get(id);
    if (!current) {
      merged.set(id, {
        id,
        label: option.label?.trim() || formatCurriculumLabel(id),
        questionCount: option.questionCount ?? null,
        sessionCount: option.sessionCount ?? null,
        answeredCount: option.answeredCount ?? null,
        lastStudiedAt: option.lastStudiedAt ?? null,
      });
      continue;
    }

    merged.set(id, {
      id,
      label:
        current.label === formatCurriculumLabel(id) && option.label?.trim()
          ? option.label.trim()
          : current.label,
      questionCount: current.questionCount ?? option.questionCount ?? null,
      sessionCount: current.sessionCount ?? option.sessionCount ?? null,
      answeredCount: current.answeredCount ?? option.answeredCount ?? null,
      lastStudiedAt: current.lastStudiedAt ?? option.lastStudiedAt ?? null,
    });
  }

  const preferred = preferredCurriculum?.trim();
  const availabilityRank = (option: CurriculumOption) => {
    if (typeof option.questionCount === 'number') {
      if (option.questionCount > 0) return 0;
      return hasCurriculumActivity(option) ? 1 : 3;
    }
    if (hasCurriculumActivity(option)) return 1;
    return 2;
  };

  const compareOptions = (a: CurriculumOption, b: CurriculumOption) => {
    const rankDiff = availabilityRank(a) - availabilityRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.label.localeCompare(b.label, 'es');
  };

  const sorted = Array.from(merged.values()).sort(compareOptions);
  if (!preferred) return sorted;

  return sorted.sort((a, b) => {
    if (a.id === preferred) return -1;
    if (b.id === preferred) return 1;
    return compareOptions(a, b);
  });
};

const mapQuestionRows = (rows: Array<Record<string, unknown>>) =>
  rows
    .map((row) => {
      const payload =
        row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : row;
      return mapQuestion(payload);
    })
    .filter((question): question is Question => Boolean(question));

const filterQuestionsByScope = (
  questions: Question[],
  questionScope: PracticeQuestionScopeFilter,
) => {
  if (questionScope === 'all') return questions;
  return questions.filter(
    (question) =>
      question.questionScope === questionScope || question.syllabus === questionScope,
  );
};

const buildQuestionDedupKey = (question: Question) => {
  const normalizedText = String(question.text ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const normalizedCategory = normalizeCategoryLabel(question.category);
  return [question.number ?? '', normalizedCategory, normalizedText, question.correctAnswer].join('|');
};

const mergeQuestionCollections = (questions: Question[]) => {
  const deduped = new Map<string, Question>();

  for (const question of questions) {
    const key = buildQuestionDedupKey(question);
    if (!deduped.has(key)) {
      deduped.set(key, question);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const leftNumber = left.number ?? Number.MAX_SAFE_INTEGER;
    const rightNumber = right.number ?? Number.MAX_SAFE_INTEGER;
    if (leftNumber !== rightNumber) return leftNumber - rightNumber;

    const leftCategory = String(left.category ?? '');
    const rightCategory = String(right.category ?? '');
    const categoryDiff = leftCategory.localeCompare(rightCategory, 'es');
    if (categoryDiff !== 0) return categoryDiff;

    const textDiff = left.text.localeCompare(right.text, 'es');
    if (textDiff !== 0) return textDiff;

    return left.id.localeCompare(right.id, 'es');
  });
};

const getQuestionSnapshotFromTables = async (params: {
  curriculum: string;
  maxQuestions?: number;
  questionScope?: PracticeQuestionScopeFilter;
}) => {
  const {
    curriculum,
    maxQuestions = 4000,
    questionScope = 'all',
  } = params;

  const pageSize = Math.min(500, Math.max(100, maxQuestions));
  const targets = await resolveQuestionCurriculumTargets(curriculum, questionScope);
  let lastError: Error | null = null;

  for (const source of QUESTION_TABLE_SOURCES) {
    const collected: Question[] = [];

    for (const target of targets) {
      for (let offset = 0; offset < maxQuestions; offset += pageSize) {
        try {
          const rows = await queryQuestionsFromSource(
            source,
            target.curriculum,
            target.candidates,
            pageSize,
            offset,
          );

          if (rows === null || rows.length === 0) {
            break;
          }

          const filtered = filterQuestionsByScope(mapQuestionRows(rows), target.scope);
          if (filtered.length > 0) {
            collected.push(...filtered);
          }

          if (rows.length < pageSize || collected.length >= maxQuestions) {
            break;
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('No se han podido leer preguntas.');
          break;
        }
      }
    }

    const merged = mergeQuestionCollections(collected).slice(0, maxQuestions);
    if (merged.length > 0) {
      return merged;
    }
  }

  if (lastError) throw lastError;
  return [];
};

const shuffleQuestions = (questions: Question[]) => {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[targetIndex]] = [shuffled[targetIndex], shuffled[index]];
  }
  return shuffled;
};

const getFreshSessionForFunctionInvoke = async (requiredEmail?: string) => {
  const {
    data: { session: initialSession },
    error,
  } = await supabase.auth.getSession();
  let session = initialSession;

  if (error || !session?.access_token) {
    throw new Error('No hay sesion activa. Inicia sesion de nuevo para guardar el progreso.');
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs < Date.now() + 90_000) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      session = refreshed.session;
    }
  }

  if (!session?.access_token) {
    throw new Error('No se ha podido refrescar la sesion. Inicia sesion de nuevo.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(session.access_token);

  if (userError || !user?.email) {
    throw new Error('La sesion no es valida. Cierra sesion y vuelve a iniciar sesion.');
  }

  if (requiredEmail && normalizeEmail(user.email) !== normalizeEmail(requiredEmail)) {
    throw new Error('Acceso denegado.');
  }

  return {
    ...session,
    user,
  };
};

const getAccessTokenForFunctionsInvoke = async () => {
  const session = await getFreshSessionForFunctionInvoke();
  return session.access_token;
};

const getCurriculumOptionsFromTables = async (
  sources: TableSource[],
  limit = 120,
  stopOnFirstSuccess = false,
) => {
  const discovered: CurriculumOption[] = [];

  for (const source of sources) {
    if (isKnownMissingTableSource(source)) continue;

    const { data, error } = await getSchemaClient(source.schema)
      .from(source.table)
      .select('*')
      .limit(limit);

    if (!error) {
      const options = ((data ?? []) as Array<Record<string, unknown>>)
        .map(extractCurriculumOption)
        .filter((option): option is CurriculumOption => Boolean(option));
      discovered.push(...options);
      if (stopOnFirstSuccess && options.length > 0) {
        break;
      }
      continue;
    }

    if (isMissingRelationError(error)) {
      markTableSourceMissing(source);
      continue;
    }
    if (isMissingColumnError(error)) continue;
  }

  return discovered;
};

export const getAvailableCurriculums = async (preferredCurriculum?: string) => {
  const discovered: CurriculumOption[] = [];

  if (discovered.length === 0) {
    discovered.push(...(await getCurriculumOptionsFromTables(CURRICULUM_TABLE_SOURCES, 120, true)));
  }

  if (discovered.length === 0) {
    discovered.push(
      ...(await getCurriculumOptionsFromTables(
        [...QUESTION_TABLE_SOURCES, ...SESSION_TABLE_SOURCES],
        200,
        true,
      )),
    );
  }

  if (discovered.length === 0) {
    for (const rpcName of CURRICULUM_RPC_NAMES) {
      if (missingCurriculumRpcs.has(rpcName)) continue;

      const { data, error } = await supabase.schema('app').rpc(rpcName, {});
      if (!error) {
        const rows = Array.isArray(data) ? data : data ? [data] : [];
        discovered.push(
          ...rows
            .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
            .map(extractCurriculumOption)
            .filter((option): option is CurriculumOption => Boolean(option)),
        );
        if (discovered.length > 0) {
          break;
        }
        continue;
      }

      if (isSchemaCacheSignatureError(error) || isMissingRelationError(error)) {
        missingCurriculumRpcs.add(rpcName);
        continue;
      }
    }
  }

  if (discovered.length > 0) {
    return enrichCurriculumOptions(
      [...discovered, ...buildFallbackCurriculumOptions(preferredCurriculum)],
      preferredCurriculum,
    );
  }

  return mergeCurriculumOptions(
    buildFallbackCurriculumOptions(preferredCurriculum),
    preferredCurriculum,
  );
};

const getPracticeSessions = async (curriculum: string) => {
  let lastError: Error | null = null;
  const curriculumCandidates = await resolveCurriculumCandidates(curriculum).catch(() =>
    buildCurriculumCandidates(curriculum),
  );
  const normalizedCandidates = buildNormalizedCurriculumCandidateSet(curriculumCandidates);

  for (const source of SESSION_TABLE_SOURCES) {
    if (isKnownMissingTableSource(source)) continue;

    const { data, error } = await getSessionTableRows(source, 1000);

    if (!error) {
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      if (rows.length === 0) return [];

      const rowsWithCurriculumMetadata = rows.filter(rowHasCurriculumMetadata);
      if (rowsWithCurriculumMetadata.length === 0) {
        return sortSessionSummariesByRecency(rows.map(mapSession));
      }

      return sortSessionSummariesByRecency(
        rowsWithCurriculumMetadata
          .filter((row) => rowMatchesCurriculumCandidates(row, normalizedCandidates))
          .map(mapSession),
      );
    }

    if (isMissingRelationError(error)) {
      markTableSourceMissing(source);
      continue;
    }
    lastError = new Error(mapPracticeCloudError(error));
  }

  if (lastError) throw lastError;
  return [];
};

const queryQuestionsFromSource = async (
  source: TableSource,
  curriculum: string,
  curriculumCandidates: string[],
  limit: number,
  offset: number,
) => {
  if (isKnownMissingTableSource(source)) {
    return null;
  }

  const end = Math.max(offset, offset + Math.max(limit, 1) - 1);

  for (const field of QUESTION_CURRICULUM_FIELD_ALIASES) {
    const { data, error } = await getSchemaClient(source.schema)
      .from(source.table)
      .select('*')
      .in(field, curriculumCandidates)
      .range(offset, end);

    if (!error) {
      return (data ?? []) as Array<Record<string, unknown>>;
    }

    if (isMissingColumnError(error)) continue;
    if (isMissingRelationError(error)) {
      markTableSourceMissing(source);
      return null;
    }
    throw new Error(mapPracticeCloudError(error));
  }

  const { data, error } = await getSchemaClient(source.schema)
    .from(source.table)
    .select('*')
    .range(offset, end);

  if (!error) {
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return [];

    const discoveredCurricula = rows.map(extractCurriculumId).filter(Boolean);
    if (discoveredCurricula.length === 0) {
      return rows;
    }

    const target = canonicalizeCurriculumId(curriculum);
    return rows.filter((row) => canonicalizeCurriculumId(extractCurriculumId(row) ?? '') === target);
  }

  if (isMissingRelationError(error)) {
    markTableSourceMissing(source);
    return null;
  }
  throw new Error(mapPracticeCloudError(error));
};

const getQuestionsFromTables = async (params: {
  curriculum: string;
  limit: number;
  offset?: number;
  questionScope?: PracticeQuestionScopeFilter;
  randomize?: boolean;
}) => {
  const {
    curriculum,
    limit,
    offset = 0,
    questionScope = 'all',
    randomize = false,
  } = params;
  const requestedWindow = randomize
    ? Math.min(4000, Math.max(limit * 8, 300))
    : Math.min(4000, Math.max(limit + offset, 300));

  const snapshot = await getQuestionSnapshotFromTables({
    curriculum,
    maxQuestions: requestedWindow,
    questionScope,
  });

  if (snapshot.length === 0) {
    return [];
  }

  if (randomize) {
    return shuffleQuestions(snapshot).slice(0, limit);
  }

  return snapshot.slice(offset, offset + limit);
};

const extractAttemptRows = (row: Record<string, unknown>): Array<Record<string, unknown>> => {
  const candidate =
    row.attempts ??
    row.attempt_rows ??
    row.attempts_json ??
    row.answers ??
    row.items ??
    null;
  if (Array.isArray(candidate)) {
    return candidate.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>;
  }
  if (typeof candidate === 'string') {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>;
      }
    } catch {
      return [];
    }
  }
  return [];
};

type AttemptedQuestionRefs = {
  ids: Set<string>;
  dedupeKeys: Set<string>;
};

const buildAttemptQuestionDedupKey = (row: Record<string, unknown>) =>
  buildQuestionContentDedupKey({
    number: readOptionalNumber(
      row.question_number ??
        row.questionNumber ??
        row.numero ??
        row.number ??
        row.item_number ??
        row.itemNumber,
    ),
    category: readText(row.category ?? row.tema ?? row.topic ?? row.subject ?? row.ley_referencia),
    text: readText(
      row.statement ??
        row.question_text ??
        row.questionText ??
        row.text ??
        row.pregunta ??
        row.enunciado,
    ),
    correctAnswer: toOptionKey(
      row.correct_option ??
        row.correctOption ??
        row.correct_answer ??
        row.correctAnswer ??
        row.respuesta_correcta,
    ),
  });

const collectAttemptQuestionRefs = (row: Record<string, unknown>, target: AttemptedQuestionRefs) => {
  const directQuestionId = readText(
    row.question_id ??
      row.questionId ??
      row.pregunta_id ??
      row.preguntaId ??
      row.item_id ??
      row.itemId,
  );
  if (directQuestionId) target.ids.add(directQuestionId);

  const directDedupeKey = buildAttemptQuestionDedupKey(row);
  if (directDedupeKey) target.dedupeKeys.add(directDedupeKey);

  const attempts = extractAttemptRows(row);
  for (const attempt of attempts) {
    const nestedQuestionId = readText(attempt.question_id ?? attempt.questionId ?? attempt.id);
    if (nestedQuestionId) target.ids.add(nestedQuestionId);

    const nestedDedupeKey = buildAttemptQuestionDedupKey(attempt);
    if (nestedDedupeKey) target.dedupeKeys.add(nestedDedupeKey);
  }
};

const COMMON_PROGRESS_DEBUG_KEY = 'quantia.debug.common_progress.v1';

const isCommonProgressDebugEnabled = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COMMON_PROGRESS_DEBUG_KEY) === '1';
  } catch {
    return false;
  }
};

const getAttemptedQuestionRefsFromSessions = async (
  curriculum: string,
): Promise<AttemptedQuestionRefs | null> => {
  let lastError: Error | null = null;
  const curriculumCandidates = await resolveCurriculumCandidates(curriculum).catch(() =>
    buildCurriculumCandidates(curriculum),
  );
  const normalizedCandidates = buildNormalizedCurriculumCandidateSet(curriculumCandidates);

  for (const source of ATTEMPT_TABLE_SOURCES) {
    if (isKnownMissingTableSource(source)) continue;

    const { data, error } = await getSchemaClient(source.schema)
      .from(source.table)
      .select('*')
      .limit(source.table === 'practice_sessions' ? 1000 : 4000);

    if (!error) {
      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
      if (rows.length === 0) continue;

      const rowsWithCurriculumMetadata = rows.filter(rowHasCurriculumMetadata);
      if (rowsWithCurriculumMetadata.length === 0) {
        continue;
      }

      const sourceRows = rowsWithCurriculumMetadata.filter((row) =>
        rowMatchesCurriculumCandidates(row, normalizedCandidates),
      );
      if (sourceRows.length === 0) continue;

      const attempted: AttemptedQuestionRefs = {
        ids: new Set<string>(),
        dedupeKeys: new Set<string>(),
      };
      for (const row of sourceRows) {
        collectAttemptQuestionRefs(row, attempted);
      }

      return attempted.ids.size > 0 || attempted.dedupeKeys.size > 0 ? attempted : null;
    }

    if (isMissingRelationError(error)) {
      markTableSourceMissing(source);
      continue;
    }
    lastError = new Error(mapPracticeCloudError(error));
  }

  if (lastError) return null;
  return null;
};

export const getCurriculumCategoryOptions = async (curriculum = DEFAULT_CURRICULUM) => {
  const questions = await getQuestionSnapshotFromTables({
    curriculum,
    maxQuestions: 4000,
    questionScope: 'all',
  });
  const deduped = new Map<string, string>();

  for (const question of questions) {
    const label = getCurriculumCategoryGroupLabel(curriculum, question.category);
    const normalized = normalizeCategoryLabel(label);
    if (!normalized || deduped.has(normalized)) continue;
    deduped.set(normalized, label!.trim());
  }

  return Array.from(deduped.values()).sort((a, b) => a.localeCompare(b, 'es'));
};

async function getRandomPracticeBatchPreview(
  curriculum: string,
  questionScope: PracticeQuestionScopeFilter = 'all',
) {
  if (hasSharedQuestionSources(curriculum, questionScope)) {
    const preview = await getQuestionsFromTables({
      curriculum,
      limit: 1,
      questionScope,
      randomize: true,
    });
    return preview.slice(0, 1);
  }

  const { data, error } = await supabase.schema('app').rpc('get_random_practice_batch', {
    p_curriculum: curriculum,
    p_batch_size: 1,
    p_question_scope: questionScope,
  });

  if (!error) {
    const questions = filterQuestionsByScope(
      mapQuestionRows((data ?? []) as Array<Record<string, unknown>>),
      questionScope,
    );
    if (questions.length > 0) {
      return questions.slice(0, 1);
    }
  }

  const fallbackQuestions = await getQuestionsFromTables({
    curriculum,
    limit: 1,
    questionScope,
    randomize: true,
  });

  if (fallbackQuestions.length > 0) {
    return fallbackQuestions.slice(0, 1);
  }

  if (error && !isSchemaCacheSignatureError(error) && !isMissingRelationError(error)) {
    throw new Error(mapPracticeCloudError(error));
  }

  return [];
}

async function enrichCurriculumOptions(
  options: CurriculumOption[],
  preferredCurriculum?: string,
): Promise<CurriculumOption[]> {
  const merged = mergeCurriculumOptions(options, preferredCurriculum);

  const enriched = await Promise.all(
    merged.map(async (option) => {
      if (option.questionCount === 0 && !hasCurriculumActivity(option)) {
        const realCount = await getQuestionCountFromTables(option.id);
        if (realCount > 0) {
          return {
            ...option,
            questionCount: realCount,
          };
        }
      }

      try {
        const preview = await getRandomPracticeBatchPreview(option.id, 'all');
        if (preview.length > 0) {
          return {
            ...option,
            questionCount:
              typeof option.questionCount === 'number' && option.questionCount > 0
                ? option.questionCount
                : 1,
          };
        }
      } catch {
        return option;
      }

      if (hasCurriculumActivity(option)) {
        return {
          ...option,
          questionCount: option.questionCount ?? null,
        };
      }

      return {
        ...option,
        questionCount: null,
      };
    }),
  );

  return mergeCurriculumOptions(enriched, preferredCurriculum);
}

const getQuestionCountFromTables = async (
  curriculum: string,
  questionScope: PracticeQuestionScopeFilter = 'all',
) => {
  const snapshot = await getQuestionSnapshotFromTables({
    curriculum,
    maxQuestions: 4000,
    questionScope,
  });
  return snapshot.length;
};

const buildIdentityFromAuthUser = async (): Promise<AccountIdentity | null> => {
  const session = await getSafeSupabaseSession().catch(() => null);
  let user = session?.user ?? null;

  if (!user) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    user = data.user;
  }

  const metadata = user.user_metadata ?? {};
  const email = readText(user.email);
  const emailUsername = email?.split('@')[0]?.trim() ?? null;
  const currentUsername =
    readText((metadata as Record<string, unknown>).current_username) ??
    readText((metadata as Record<string, unknown>).username) ??
    readText((metadata as Record<string, unknown>).preferred_username) ??
    emailUsername;

  if (!currentUsername) return null;

  return {
    user_id: user.id,
    current_username: currentUsername,
    is_admin: Boolean((metadata as Record<string, unknown>).is_admin),
    player_mode:
      String((metadata as Record<string, unknown>).player_mode ?? '').trim().toLowerCase() === 'generic'
        ? 'generic'
        : 'advanced',
    previous_usernames: [],
  };
};

export const getMyAccountIdentity = async (): Promise<AccountIdentity> => {
  const { data, error } = await supabase.schema('app').rpc('get_my_account_identity').maybeSingle();
  if (!error) {
    const identity = mapAccountIdentity(data);
    if (identity) return identity;
  }

  const fallbackIdentity = await buildIdentityFromAuthUser();
  if (fallbackIdentity) return fallbackIdentity;

  if (error) throw new Error(mapPracticeCloudError(error));
  throw new Error('No se ha podido cargar la identidad de la cuenta.');
};

export const getMyPracticeState = async (
  curriculum = DEFAULT_CURRICULUM,
  options?: { includeRecentSessions?: boolean },
): Promise<CloudPracticeState> => {
  const includeRecentSessions = options?.includeRecentSessions ?? true;
  const [recentSessions, learningDashboardResponse, examTargetResponse, pressureDashboardResponse] =
    await Promise.all([
      includeRecentSessions ? getPracticeSessions(curriculum) : Promise.resolve([]),
      supabase.schema('app').rpc('get_readiness_dashboard', { p_curriculum: curriculum }).maybeSingle(),
      supabase.schema('app').rpc('get_my_exam_target', { p_curriculum: curriculum }).maybeSingle(),
      supabase.schema('app').rpc('get_pressure_dashboard', { p_curriculum: curriculum }).maybeSingle(),
    ]);

  const { data: learningDashboardData, error: learningDashboardError } = learningDashboardResponse;
  const { data: examTargetData, error: examTargetError } = examTargetResponse;
  const { data: pressureInsightsData, error: pressureInsightsError } = pressureDashboardResponse;

  const examTarget =
    examTargetData && typeof examTargetData === 'object'
      ? {
          userId: String((examTargetData as Record<string, unknown>)['user_id'] ?? ''),
          curriculum: String((examTargetData as Record<string, unknown>)['curriculum'] ?? curriculum),
          examDate: readText((examTargetData as Record<string, unknown>)['exam_date']),
          dailyReviewCapacity: readNumber(
            (examTargetData as Record<string, unknown>)['daily_review_capacity'],
            35,
          ),
          dailyNewCapacity: readNumber(
            (examTargetData as Record<string, unknown>)['daily_new_capacity'],
            10,
          ),
          updatedAt: readText((examTargetData as Record<string, unknown>)['updated_at']),
        }
      : null;

  return {
    recentSessions,
    learningDashboard: learningDashboardError
      ? null
      : mapLearningDashboard((learningDashboardData ?? null) as Record<string, unknown> | null),
    learningDashboardV2: null,
    examTarget: examTargetError ? null : examTarget,
    pressureInsights: pressureInsightsError
      ? null
      : mapPressureInsights((pressureInsightsData ?? null) as Record<string, unknown> | null),
    pressureInsightsV2: null,
  };
};

export const getMyLearningDashboardV2 = async (curriculum = DEFAULT_CURRICULUM) => {
  const { data, error } = await supabase
    .schema('app')
    .rpc('get_readiness_dashboard_v2', { p_curriculum: curriculum })
    .maybeSingle();

  if (error) {
    if (isSchemaCacheSignatureError(error)) return null;
    throw new Error(mapPracticeCloudError(error));
  }

  return mapLearningDashboardV2((data ?? null) as Record<string, unknown> | null);
};

export const getMyPressureDashboardV2 = async (curriculum = DEFAULT_CURRICULUM) => {
  const { data, error } = await supabase
    .schema('app')
    .rpc('get_pressure_dashboard_v2', { p_curriculum: curriculum })
    .maybeSingle();

  if (error) {
    if (isSchemaCacheSignatureError(error)) return null;
    throw new Error(mapPracticeCloudError(error));
  }

  return mapPressureInsightsV2((data ?? null) as Record<string, unknown> | null);
};

export const getPracticeCatalogSummary = async (
  curriculum = DEFAULT_CURRICULUM,
  questionScope: PracticeQuestionScopeFilter = 'all',
) => {
  const loadFallbackSummary = async () => {
    const fallbackQuestions = await getQuestionsFromTables({
      curriculum,
      limit: 500,
      questionScope,
    });

    if (fallbackQuestions.length > 0) {
      return {
        totalQuestions:
          (await getQuestionCountFromTables(curriculum, questionScope)) || fallbackQuestions.length,
      };
    }

    return { totalQuestions: 0 };
  };

  if (hasSharedQuestionSources(curriculum, questionScope)) {
    return loadFallbackSummary();
  }

  const { data, error } = await supabase
    .schema('app')
    .rpc('get_practice_catalog_summary', {
      p_curriculum: curriculum,
      p_question_scope: questionScope,
    })
    .maybeSingle();

  if (!error) {
    const totalQuestions = readNumber((data as Record<string, unknown> | null)?.total_questions);
    if (totalQuestions > 0) {
      const previewQuestions = await getRandomPracticeBatchPreview(curriculum, questionScope);
      if (previewQuestions.length > 0) {
        return {
          totalQuestions,
        };
      }

      return loadFallbackSummary();
    }

    return loadFallbackSummary();
  }

  const fallbackSummary = await loadFallbackSummary();
  if (fallbackSummary.totalQuestions > 0) {
    return fallbackSummary;
  }

  throw new Error(mapPracticeCloudError(error));
};

export const getWeakCategorySummary = async (
  curriculum = DEFAULT_CURRICULUM,
  limit = 5,
  questionScope: PracticeQuestionScopeFilter = 'all',
) => {
  const { data, error } = await supabase.schema('app').rpc('get_category_risk_dashboard', {
    p_curriculum: curriculum,
    p_limit: limit,
    p_question_scope: questionScope,
  });

  if (error) {
    if (isSchemaCacheSignatureError(error)) return [];
    throw new Error(mapPracticeCloudError(error));
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(mapCategoryRiskSummary);
};

export const getRandomPracticeBatch = async (
  batchSize: number,
  curriculum = DEFAULT_CURRICULUM,
  questionScope: PracticeQuestionScopeFilter = 'all',
) => {
  if (hasSharedQuestionSources(curriculum, questionScope)) {
    return getQuestionsFromTables({
      curriculum,
      limit: batchSize,
      questionScope,
      randomize: true,
    });
  }

  const { data, error } = await supabase.schema('app').rpc('get_random_practice_batch', {
    p_curriculum: curriculum,
    p_batch_size: batchSize,
    p_question_scope: questionScope,
  });

  if (!error) {
    const questions = filterQuestionsByScope(
      mapQuestionRows((data ?? []) as Array<Record<string, unknown>>),
      questionScope,
    );
    if (questions.length > 0) {
      return questions.slice(0, batchSize);
    }
  }

  const fallbackQuestions = await getQuestionsFromTables({
    curriculum,
    limit: Math.max(batchSize * 3, batchSize),
    questionScope,
    randomize: true,
  });

  if (fallbackQuestions.length > 0) {
    return fallbackQuestions.slice(0, batchSize);
  }

  if (error) throw new Error(mapPracticeCloudError(error));
  return [];
};

export const getPracticeBatchByCategory = async (
  batchSize: number,
  curriculum = DEFAULT_CURRICULUM,
  category: string,
): Promise<Question[]> => {
  const normalizedTarget = normalizeCategoryLabel(getCurriculumCategoryGroupLabel(curriculum, category));
  if (!normalizedTarget) return [];

  const snapshot = await getQuestionSnapshotFromTables({
    curriculum,
    maxQuestions: 4000,
    questionScope: 'all',
  });
  const mapped = shuffleQuestions(
    snapshot.filter(
      (question) =>
        normalizeCategoryLabel(
          getCurriculumCategoryGroupLabel(curriculum, question.category),
        ) === normalizedTarget,
    ),
  ).slice(0, batchSize);
  if (mapped.length > 0) {
    return mapped;
  }

  const fallbackPool = await getStudyQuestionsSlice(2000, 0, curriculum);
  const fallbackMatches = fallbackPool.filter(
    (question) =>
      normalizeCategoryLabel(getCurriculumCategoryGroupLabel(curriculum, question.category)) === normalizedTarget,
  );
  return shuffleQuestions(fallbackMatches).slice(0, batchSize);
};

export const getCurriculumQuestionNumberBounds = async (
  curriculum = DEFAULT_CURRICULUM,
): Promise<{ min: number; max: number } | null> => {
  const snapshot = await getQuestionSnapshotFromTables({
    curriculum,
    maxQuestions: 4000,
    questionScope: 'all',
  });
  const numbers = snapshot
    .map((question) => question.number)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (numbers.length === 0) return null;

  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  };
};

export const getQuestionsByNumberRange = async (params: {
  curriculum: string;
  from: number;
  to: number;
  randomize?: boolean;
}): Promise<Question[]> => {
  const { curriculum, randomize = false } = params;
  const fromValue = Math.min(params.from, params.to);
  const toValue = Math.max(params.from, params.to);
  const snapshot = await getQuestionSnapshotFromTables({
    curriculum,
    maxQuestions: 4000,
    questionScope: 'all',
  });
  const filtered = snapshot
    .filter((q) => typeof q.number === 'number' && q.number >= fromValue && q.number <= toValue)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  return randomize ? shuffleQuestions(filtered) : filtered;
};

export const getPracticeQuestionsByIds = async (params: {
  curriculum: string;
  questionIds: string[];
  questionScope?: PracticeQuestionScopeFilter;
  limit?: number;
}): Promise<Question[]> => {
  const curriculum = String(params.curriculum ?? '').trim() || DEFAULT_CURRICULUM;
  const questionScope = params.questionScope ?? 'all';
  const limit = Math.max(
    1,
    Math.min(120, Math.trunc(params.limit ?? params.questionIds.length ?? 20)),
  );
  const ids = Array.from(
    new Set(params.questionIds.map((id) => String(id ?? '').trim()).filter(Boolean)),
  );
  if (ids.length === 0) return [];

  const snapshot = await getQuestionSnapshotFromTables({
    curriculum,
    maxQuestions: 5000,
    questionScope,
  });
  const byId = new Map(snapshot.map((q) => [q.id, q] as const));
  const ordered = ids.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q));
  return ordered.slice(0, limit);
};

const topicOptionsCache = new Map<string, Promise<string[]>>();

export const getCurriculumTopicOptions = async (params: {
  curriculum: string;
  questionScope?: PracticeQuestionScopeFilter;
}): Promise<string[]> => {
  const curriculum = String(params.curriculum ?? '').trim() || DEFAULT_CURRICULUM;
  const scope = params.questionScope ?? 'all';
  const cacheKey = `${curriculum}::${scope}`;
  const cached = topicOptionsCache.get(cacheKey);
  if (cached) return cached;

  const task = (async () => {
    const snapshot = await getQuestionSnapshotFromTables({
      curriculum,
      maxQuestions: 5000,
      questionScope: scope,
    });
    const topics = new Set<string>();
    for (const q of snapshot) {
      const label = getCurriculumCategoryGroupLabel(curriculum, q.category);
      if (label) topics.add(label);
    }
    return Array.from(topics).sort((a, b) => a.localeCompare(b, 'es'));
  })().catch((error) => {
    topicOptionsCache.delete(cacheKey);
    throw error;
  });

  topicOptionsCache.set(cacheKey, task);
  return task;
};

export const getCustomPracticeBatch = async (params: {
  curriculum: string;
  limit: number;
  syllabus: SyllabusType | null;
  topicId: string | null;
  randomize?: boolean;
}): Promise<Question[]> => {
  const curriculum = String(params.curriculum ?? '').trim() || DEFAULT_CURRICULUM;
  const limit = Math.max(1, Math.min(200, Math.trunc(params.limit)));
  const randomize = params.randomize !== false;
  const scope: PracticeQuestionScopeFilter = params.syllabus ?? 'all';
  const topicId = String(params.topicId ?? '').trim() || null;

  const snapshot = await getQuestionSnapshotFromTables({
    curriculum,
    maxQuestions: 5000,
    questionScope: scope,
  });

  const normalizedTarget = topicId
    ? normalizeCategoryLabel(getCurriculumCategoryGroupLabel(curriculum, topicId) ?? topicId)
    : null;

  const filtered = normalizedTarget
    ? snapshot.filter((q) => normalizeCategoryLabel(getCurriculumCategoryGroupLabel(curriculum, q.category)) === normalizedTarget)
    : snapshot;

  const shuffled = randomize ? shuffleQuestions(filtered) : filtered;
  return shuffled.slice(0, limit);
};

export const getWeakPracticeBatch = async (
  batchSize: number,
  curriculum = DEFAULT_CURRICULUM,
  questionScope: PracticeQuestionScopeFilter = 'all',
) => {
  const rpcAttempts = [
    { p_curriculum: curriculum, p_limit: batchSize, p_question_scope: questionScope },
    { p_curriculum: curriculum, p_batch_size: batchSize, p_question_scope: questionScope },
  ];

  let lastError: PostgrestLikeError | null = null;

  for (const params of rpcAttempts) {
    const { data, error } = await supabase.schema('app').rpc('get_weak_practice_batch', params);

    if (!error) {
      const questions = filterQuestionsByScope(
        mapQuestionRows((data ?? []) as Array<Record<string, unknown>>),
        questionScope,
      );
      if (questions.length > 0) {
        return questions.slice(0, batchSize);
      }
      return [];
    }

    lastError = error;
    if (!isSchemaCacheSignatureError(error)) {
      break;
    }
  }

  throw new Error(
    mapPracticeCloudError(
      lastError ?? { message: 'No se ha podido cargar el repaso de fallos.' },
    ),
  );
};

export const getStudyQuestionsSlice = async (
  limit = 150,
  offset = 0,
  curriculum = DEFAULT_CURRICULUM,
): Promise<Question[]> => {
  const fallbackQuestions = await getQuestionsFromTables({
    curriculum,
    limit,
    offset,
  });
  if (fallbackQuestions.length > 0) {
    return fallbackQuestions.slice(0, limit);
  }

  const rpcAttempts = [
    { p_curriculum: curriculum, p_limit: limit, p_offset: offset },
    { p_curriculum: curriculum, p_batch_size: limit, p_offset: offset },
  ];

  for (const params of rpcAttempts) {
    const { data, error } = await supabase.schema('app').rpc('get_study_questions', params);
    if (!error) {
      const questions = mapQuestionRows((data ?? []) as Array<Record<string, unknown>>);
      if (questions.length > 0) {
        return questions.slice(0, limit);
      }
    }
  }

  return getRandomPracticeBatch(limit, curriculum, 'all');
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
  curriculum: string;
  questionId: string;
  questionScope?: PracticeQuestionScopeFilter;
}): Promise<Question> => {
  const questionId = String(params.questionId ?? '').trim();
  if (!questionId) {
    throw new Error('No se ha indicado una pregunta valida.');
  }

  const cached = questionBankDetailCache.get(questionId);
  if (cached) return cached;

  try {
    const resolvedId = /^\d+$/.test(questionId) ? Number(questionId) : questionId;
    const { data, error } = await supabase
      .from('preguntas')
      .select('*')
      .eq('id', resolvedId)
      .maybeSingle();

    if (!error && data) {
      const question = mapQuestion((data ?? null) as Record<string, unknown>);
      if (question) {
        questionBankDetailCache.set(questionId, question);
        return question;
      }
      throw new Error('No se ha podido interpretar la pregunta seleccionada.');
    }
    if (error) {
      throw new Error(mapPracticeCloudError(error));
    }
    throw new Error('No se ha encontrado la pregunta seleccionada.');
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('No se ha podido cargar la pregunta seleccionada.');
  }
};

export const getQuestionBankSnapshot = async (params: {
  curriculum: string;
  questionScope?: PracticeQuestionScopeFilter;
  maxQuestions?: number;
}): Promise<Question[]> => {
  return getQuestionSnapshotFromTables({
    curriculum: params.curriculum,
    maxQuestions: params.maxQuestions ?? 4000,
    questionScope: params.questionScope ?? 'all',
  });
};

const ADMIN_EMAIL = 'admin@oposik.app';
const normalizeEmail = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const assertAdminSession = async () => {
  return await getFreshSessionForFunctionInvoke(ADMIN_EMAIL);
};

const adminInvokeFunction = async <T = unknown>(functionName: string, body: Record<string, unknown>): Promise<T> => {
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`;
  const send = async (accessToken: string) =>
    fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

  const session = await assertAdminSession();
  const response = await send(session.access_token);

  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();
  const normalizedRaw = raw.trim();
  const looksLikeHtml =
    contentType.includes('text/html') ||
    /^<!doctype html\b/i.test(normalizedRaw) ||
    /^<html\b/i.test(normalizedRaw) ||
    /^<head\b/i.test(normalizedRaw) ||
    /^<body\b/i.test(normalizedRaw);

  if (looksLikeHtml) {
    const snippet = normalizedRaw.replace(/\s+/g, ' ').slice(0, 140);
    const deploymentHint =
      response.status === 404
        ? `La Edge Function ${functionName} no parece estar desplegada en Supabase.`
        : `La Edge Function ${functionName} ha respondido con HTML en lugar de JSON.`;
    throw new Error(`${deploymentHint} Revisa el despliegue de funciones. ${snippet}`.trim());
  }

  let parsed: unknown = null;
  try {
    parsed = raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    if (raw) {
      throw new Error(`La Edge Function ${functionName} ha devuelto una respuesta no valida para JSON.`);
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Sesion no valida para invocar Edge Functions. Cierra sesion y vuelve a iniciar sesion.');
    }
    const parsedObject =
      parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    const errorLabel =
      parsedObject && typeof parsedObject.error === 'string'
        ? String(parsedObject.error)
        : parsedObject && typeof parsedObject.message === 'string'
          ? String(parsedObject.message)
          : typeof parsed === 'string'
            ? parsed
            : '';
    const detail =
      parsedObject && typeof parsedObject.detail === 'string' ? String(parsedObject.detail) : '';
    const message =
      (detail ? `${errorLabel}: ${detail}` : errorLabel) ||
      `Edge Function ${functionName} fallo (${response.status}).`;
    throw new Error(message);
  }

  return parsed as T;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const mapAdminQuestionListItem = (row: Record<string, unknown>): AdminQuestionListItem | null => {
  const id = readText(row.id ?? row.question_id ?? row.uuid ?? row.slug);
  if (!id) return null;
  const text = readText(row.pregunta ?? row.question_text ?? row.text);
  if (!text) return null;
  const syllabus = toSyllabusType(
    row.grupo ?? row.scope ?? row.syllabus ?? row.temario_pregunta ?? row.tema_pregunta ?? row.subject_key,
  );
  const correctAnswer = toOptionKey(row.respuesta_correcta ?? row.correct_answer ?? row.correctAnswer);
  const number = readNumber(row.numero ?? row.question_number ?? row.number);
  return {
    id,
    oppositionId: readText(row.opposition_id ?? row.oposicion_id ?? row.oppositionId) ?? null,
    curriculum: readText(row.curriculum ?? row.oposicion ?? row.opposition) ?? null,
    curriculumKey: readText(row.curriculum_key ?? row.curriculumKey) ?? null,
    number,
    text,
    correctAnswer,
    syllabus,
    category: readText(row.subject_key ?? row.category) ?? null,
    lawReference: readText(row.ley_referencia ?? row.law_reference ?? row.lawReference) ?? null,
    topic: readText(row.temario_pregunta ?? row.topic ?? row.block ?? row.temario) ?? null,
    languageCode: readText(row.language_code ?? row.languageCode) ?? null,
    difficulty: readNumber(row.difficulty) ?? null,
    updatedAt: readText(row.updated_at ?? row.updatedAt) ?? null,
  };
};

export const adminFindAdjacentQuestionId = async (params: {
  direction: 'prev' | 'next';
  oppositionId: string;
  curriculum?: string | null;
  curriculumKey?: string | null;
  syllabus: SyllabusType;
  fromNumber: number;
  languageCode?: string | null;
  topic?: string | null;
}): Promise<{ id: string; number: number } | null> => {
  await assertAdminSession();
  const oppositionId = readText(params.oppositionId);
  if (!oppositionId) throw new Error('opposition_id inválido.');
  const fromNumber = typeof params.fromNumber === 'number' && Number.isFinite(params.fromNumber) ? params.fromNumber : NaN;
  if (!Number.isFinite(fromNumber)) throw new Error('Número inválido.');

  let query = supabase
    .from('preguntas')
    .select('id,numero')
    .eq('opposition_id', oppositionId)
    .eq('grupo', toDbGrupo(params.syllabus));

  const curriculum = readText(params.curriculum);
  if (curriculum) query = query.eq('curriculum', curriculum);
  const curriculumKey = readText(params.curriculumKey);
  if (curriculumKey) query = query.eq('curriculum_key', curriculumKey);
  const languageCode = readText(params.languageCode);
  if (languageCode) query = query.eq('language_code', languageCode);
  const topic = readText(params.topic);
  if (topic) query = query.eq('temario_pregunta', topic);

  query =
    params.direction === 'next'
      ? query.gt('numero', fromNumber).order('numero', { ascending: true }).order('id', { ascending: true })
      : query.lt('numero', fromNumber).order('numero', { ascending: false }).order('id', { ascending: false });

  const { data, error } = await query.limit(1);
  if (error) throw new Error(mapPracticeCloudError(error));
  const row = Array.isArray(data) ? ((data[0] ?? null) as Record<string, unknown> | null) : null;
  if (!row) return null;
  const id = readText(row.id);
  const number = readNumber(row.numero, NaN);
  if (!id || !Number.isFinite(number)) return null;
  return { id, number };
};

export const adminListQuestions = async (params: {
  curriculum?: string | null;
  oppositionId?: string | null;
  curriculumKey?: string | null;
  questionScope?: PracticeQuestionScopeFilter;
  search?: string;
  topic?: string | null;
  lawReference?: string | null;
  languageCode?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<{ items: AdminQuestionListItem[]; page: number; pageSize: number; hasNextPage: boolean }> => {
  await assertAdminSession();
  const page = Math.max(1, Math.round(params.page ?? 1));
  const pageSize = Math.max(10, Math.min(200, Math.round(params.pageSize ?? 50)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('preguntas')
    .select(
      'id,opposition_id,curriculum,curriculum_key,numero,pregunta,respuesta_correcta,grupo,ley_referencia,temario_pregunta,subject_key,language_code,difficulty,updated_at',
      { count: 'exact' },
    )
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  const curriculum = readText(params.curriculum);
  if (curriculum) {
    query = query.eq('curriculum', curriculum);
  }

  const oppositionId = readText(params.oppositionId);
  if (oppositionId) {
    query = query.eq('opposition_id', oppositionId);
  }

  const curriculumKey = readText(params.curriculumKey);
  if (curriculumKey) {
    query = query.eq('curriculum_key', curriculumKey);
  }

  const scope = params.questionScope ?? 'all';
  if (scope === 'common') query = query.eq('grupo', 'comun');
  if (scope === 'specific') query = query.eq('grupo', 'especifico');

  const search = readText(params.search);
  if (search) {
    const asNumber = Number(search);
    if (Number.isFinite(asNumber) && String(search).trim().length <= 6) {
      query = query.eq('numero', asNumber);
    } else {
      const escaped = String(search).replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
      query = query.or(`pregunta.ilike.%${escaped}%,temario_pregunta.ilike.%${escaped}%,ley_referencia.ilike.%${escaped}%`);
    }
  }

  const topic = readText(params.topic);
  if (topic) {
    query = query.ilike('temario_pregunta', `%${topic}%`);
  }

  const lawReference = readText(params.lawReference);
  if (lawReference) {
    query = query.ilike('ley_referencia', `%${lawReference}%`);
  }

  const languageCode = readText(params.languageCode);
  if (languageCode) {
    query = query.eq('language_code', languageCode);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(mapPracticeCloudError(error));

  const items = (Array.isArray(data) ? data : [])
    .map((row) => mapAdminQuestionListItem((row ?? null) as Record<string, unknown>))
    .filter(Boolean) as AdminQuestionListItem[];

  const total = typeof count === 'number' ? count : items.length;
  return {
    items,
    page,
    pageSize,
    hasNextPage: to < total,
  };
};

export const adminGetQuestionDetail = async (questionId: string): Promise<AdminQuestionDetail> => {
  await assertAdminSession();
  const id = readText(questionId);
  if (!id) throw new Error('Pregunta inválida.');
  const { data, error } = await supabase.from('preguntas').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(mapPracticeCloudError(error));
  if (!data) throw new Error('No se ha encontrado la pregunta seleccionada.');

  const mapped = mapQuestion((data ?? null) as Record<string, unknown>);
  if (!mapped) throw new Error('No se ha podido interpretar la pregunta seleccionada.');
  const listItem = mapAdminQuestionListItem((data ?? null) as Record<string, unknown>);
  if (!listItem) throw new Error('No se ha podido interpretar la pregunta seleccionada.');

  return {
    ...listItem,
    options: mapped.options,
    explanation: mapped.explanation,
    editorialExplanation: readText((data as Record<string, unknown>).explicacion_editorial) ?? null,
    questionScopeKey: readText((data as Record<string, unknown>).question_scope_key) ?? null,
    subjectKey: readText((data as Record<string, unknown>).subject_key) ?? null,
    subjectId: readText((data as Record<string, unknown>).subject_id) ?? null,
    scopeId: readText((data as Record<string, unknown>).scope_id) ?? null,
    generalLawId: readText((data as Record<string, unknown>).general_law_id) ?? null,
    generalLawBlockId: readText((data as Record<string, unknown>).general_law_block_id) ?? null,
    generalLawQuestionType: readText((data as Record<string, unknown>).general_law_question_type) ?? null,
    dominantTrapType: readText((data as Record<string, unknown>).dominant_trap_type) ?? null,
  };
};

export const adminCreateQuestion = async (input: {
  oppositionId: string;
  curriculum: string;
  curriculumKey?: string | null;
  syllabus: SyllabusType;
  number: number | null;
  text: string;
  options: { a: string; b: string; c?: string | null; d?: string | null };
  correctAnswer: OptionKey;
  explanation: string | null;
  editorialExplanation?: string | null;
  topic?: string | null;
  lawReference?: string | null;
  questionScopeKey?: string | null;
  subjectKey?: string | null;
  subjectId?: string | null;
  scopeId?: string | null;
  generalLawId?: string | null;
  generalLawBlockId?: string | null;
  generalLawQuestionType?: string | null;
  dominantTrapType?: string | null;
  languageCode?: string | null;
  difficulty?: number | null;
}): Promise<AdminQuestionDetail> => {
  await assertAdminSession();

  const oppositionId = readText(input.oppositionId);
  const curriculum = readText(input.curriculum);
  const text = readText(input.text);
  if (!oppositionId || !isUuid(oppositionId)) throw new Error('La oposición (opposition_id) es obligatoria.');
  if (!curriculum) throw new Error('El curriculum es obligatorio.');
  if (!text) throw new Error('La pregunta es obligatoria.');
  const a = readText(input.options.a);
  const b = readText(input.options.b);
  const c = readText(input.options.c);
  const d = readText(input.options.d);
  if (!a || !b) throw new Error('Las opciones A y B son obligatorias.');
  if (input.correctAnswer === 'c' && !c) throw new Error('La opción C es obligatoria si es la respuesta correcta.');
  if (input.correctAnswer === 'd' && !d) throw new Error('La opción D es obligatoria si es la respuesta correcta.');

  const generalLawId = readText(input.generalLawId);
  const generalLawBlockId = readText(input.generalLawBlockId);
  const curriculumKey = readText(input.curriculumKey);
  if (generalLawId && (!generalLawBlockId || !curriculumKey)) {
    throw new Error('Para preguntas de leyes generales, general_law_id requiere general_law_block_id y curriculum_key.');
  }

  const payload: Record<string, unknown> = {
    opposition_id: oppositionId,
    curriculum,
    curriculum_key: curriculumKey ?? null,
    grupo: toDbGrupo(input.syllabus),
    numero: typeof input.number === 'number' && Number.isFinite(input.number) ? input.number : null,
    pregunta: text,
    opcion_a: a,
    opcion_b: b,
    opcion_c: c ?? null,
    opcion_d: d ?? null,
    respuesta_correcta: input.correctAnswer,
    explicacion: readText(input.explanation) ?? null,
    explicacion_editorial: readText(input.editorialExplanation) ?? null,
    ley_referencia: readText(input.lawReference) ?? null,
    temario_pregunta: readText(input.topic) ?? null,
    question_scope_key: readText(input.questionScopeKey) ?? null,
    subject_key: readText(input.subjectKey) ?? null,
    subject_id: readText(input.subjectId) ?? null,
    scope_id: readText(input.scopeId) ?? null,
    general_law_id: generalLawId ?? null,
    general_law_block_id: generalLawBlockId ?? null,
    general_law_question_type: readText(input.generalLawQuestionType) ?? null,
    dominant_trap_type: readText(input.dominantTrapType) ?? null,
    language_code: readText(input.languageCode) ?? null,
    difficulty: typeof input.difficulty === 'number' && Number.isFinite(input.difficulty) ? input.difficulty : null,
  };

  const { data, error } = await supabase.from('preguntas').insert(payload).select('*').single();
  if (error) throw new Error(mapPracticeCloudError(error));

  const created = await adminGetQuestionDetail(readText((data as unknown as Record<string, unknown>)?.id) ?? '');
  return created;
};

export const adminUpdateQuestion = async (
  questionId: string,
  input: {
    oppositionId: string;
    curriculum: string;
    curriculumKey?: string | null;
    syllabus: SyllabusType;
    number: number | null;
    text: string;
    options: { a: string; b: string; c?: string | null; d?: string | null };
    correctAnswer: OptionKey;
    explanation: string | null;
    editorialExplanation?: string | null;
    topic?: string | null;
    lawReference?: string | null;
    questionScopeKey?: string | null;
    subjectKey?: string | null;
    subjectId?: string | null;
    scopeId?: string | null;
    generalLawId?: string | null;
    generalLawBlockId?: string | null;
    generalLawQuestionType?: string | null;
    dominantTrapType?: string | null;
    languageCode?: string | null;
    difficulty?: number | null;
  },
): Promise<AdminQuestionDetail> => {
  await assertAdminSession();
  const id = readText(questionId);
  if (!id) throw new Error('Pregunta inválida.');

  const oppositionId = readText(input.oppositionId);
  const curriculum = readText(input.curriculum);
  const text = readText(input.text);
  if (!oppositionId || !isUuid(oppositionId)) throw new Error('La oposición (opposition_id) es obligatoria.');
  if (!curriculum) throw new Error('El curriculum es obligatorio.');
  if (!text) throw new Error('La pregunta es obligatoria.');
  const a = readText(input.options.a);
  const b = readText(input.options.b);
  const c = readText(input.options.c);
  const d = readText(input.options.d);
  if (!a || !b) throw new Error('Las opciones A y B son obligatorias.');
  if (input.correctAnswer === 'c' && !c) throw new Error('La opción C es obligatoria si es la respuesta correcta.');
  if (input.correctAnswer === 'd' && !d) throw new Error('La opción D es obligatoria si es la respuesta correcta.');

  const generalLawId = readText(input.generalLawId);
  const generalLawBlockId = readText(input.generalLawBlockId);
  const curriculumKey = readText(input.curriculumKey);
  if (generalLawId && (!generalLawBlockId || !curriculumKey)) {
    throw new Error('Para preguntas de leyes generales, general_law_id requiere general_law_block_id y curriculum_key.');
  }

  const payload: Record<string, unknown> = {
    opposition_id: oppositionId,
    curriculum,
    curriculum_key: curriculumKey ?? null,
    grupo: toDbGrupo(input.syllabus),
    numero: typeof input.number === 'number' && Number.isFinite(input.number) ? input.number : null,
    pregunta: text,
    opcion_a: a,
    opcion_b: b,
    opcion_c: c ?? null,
    opcion_d: d ?? null,
    respuesta_correcta: input.correctAnswer,
    explicacion: readText(input.explanation) ?? null,
    explicacion_editorial: readText(input.editorialExplanation) ?? null,
    ley_referencia: readText(input.lawReference) ?? null,
    temario_pregunta: readText(input.topic) ?? null,
    question_scope_key: readText(input.questionScopeKey) ?? null,
    subject_key: readText(input.subjectKey) ?? null,
    subject_id: readText(input.subjectId) ?? null,
    scope_id: readText(input.scopeId) ?? null,
    general_law_id: generalLawId ?? null,
    general_law_block_id: generalLawBlockId ?? null,
    general_law_question_type: readText(input.generalLawQuestionType) ?? null,
    dominant_trap_type: readText(input.dominantTrapType) ?? null,
    language_code: readText(input.languageCode) ?? null,
    difficulty: typeof input.difficulty === 'number' && Number.isFinite(input.difficulty) ? input.difficulty : null,
  };

  const { error } = await supabase.from('preguntas').update(payload).eq('id', id);
  if (error) throw new Error(mapPracticeCloudError(error));

  return adminGetQuestionDetail(id);
};

export const adminResolveOppositionConfigByOppositionId = async (
  oppositionId: string,
): Promise<{ curriculum: string | null; curriculumKey: string | null }> => {
  await assertAdminSession();
  const normalized = readText(oppositionId);
  if (!normalized) return { curriculum: null, curriculumKey: null };
  try {
    const { data, error } = await supabase
      .from('opposition_configs')
      .select('config_json')
      .eq('opposition_id', normalized)
      .maybeSingle();
    if (error) return { curriculum: null, curriculumKey: null };
    const record = (data ?? null) as Record<string, unknown> | null;
    const cfg = (record?.config_json ?? null) as Record<string, unknown> | null;
    return {
      curriculum: readText(cfg?.curriculum) ?? null,
      curriculumKey: readText(cfg?.curriculum_key ?? cfg?.curriculumKey) ?? null,
    };
  } catch {
    return { curriculum: null, curriculumKey: null };
  }
};

export const adminListUsers = async (params: {
  search?: string;
  page?: number;
  perPage?: number;
}): Promise<{ items: AdminUserListItem[]; page: number; perPage: number; total: number | null }> => {
  await assertAdminSession();
  const payload = await adminInvokeFunction<Record<string, unknown>>('admin-users', {
    action: 'list',
    search: readText(params.search) ?? null,
    page: Math.max(1, Math.round(params.page ?? 1)),
    perPage: Math.max(10, Math.min(200, Math.round(params.perPage ?? 50))),
  });
  const itemsRaw = (payload?.items ?? []) as unknown[];
  const items: AdminUserListItem[] = itemsRaw
    .map((row) => (row ?? null) as Record<string, unknown>)
    .map((row) => ({
      userId: readText(row.userId ?? row.user_id) ?? '',
      email: readText(row.email) ?? null,
      createdAt: readText(row.createdAt ?? row.created_at) ?? null,
      lastSignInAt: readText(row.lastSignInAt ?? row.last_sign_in_at) ?? null,
      currentUsername: readText(row.currentUsername ?? row.current_username) ?? null,
      activeOppositionId: readText(row.activeOppositionId ?? row.active_opposition_id ?? row.opposition_id) ?? null,
      activeCurriculum: readText(row.activeCurriculum ?? row.active_curriculum ?? row.curriculum) ?? null,
    }))
    .filter((row) => Boolean(row.userId));
  return {
    items,
    page: readNumber(payload?.page) ?? Math.max(1, Math.round(params.page ?? 1)),
    perPage: readNumber(payload?.perPage) ?? Math.max(10, Math.min(200, Math.round(params.perPage ?? 50))),
    total: readNumber(payload?.total) ?? null,
  };
};

export const adminGetUserDetail = async (userId: string): Promise<AdminUserDetail> => {
  await assertAdminSession();
  const id = readText(userId);
  if (!id) throw new Error('Usuario inválido.');
  const payload = await adminInvokeFunction<Record<string, unknown>>('admin-users', { action: 'detail', userId: id });
  return {
    userId: readText(payload?.userId ?? payload?.user_id) ?? id,
    email: readText(payload?.email) ?? null,
    createdAt: readText(payload?.createdAt ?? payload?.created_at) ?? null,
    lastSignInAt: readText(payload?.lastSignInAt ?? payload?.last_sign_in_at) ?? null,
    currentUsername: readText(payload?.currentUsername ?? payload?.current_username) ?? null,
    activeOppositionId: readText(payload?.activeOppositionId ?? payload?.active_opposition_id ?? payload?.opposition_id) ?? null,
    activeCurriculum: readText(payload?.activeCurriculum ?? payload?.active_curriculum ?? payload?.curriculum) ?? null,
    sessionsTotal: readNumber(payload?.sessionsTotal ?? payload?.sessions_total) ?? null,
    sessionsLast7d: readNumber(payload?.sessionsLast7d ?? payload?.sessions_last_7d) ?? null,
    accuracyRateLast7d: typeof payload?.accuracyRateLast7d === 'number' ? payload.accuracyRateLast7d : null,
    totalAnsweredLast7d: readNumber(payload?.totalAnsweredLast7d ?? payload?.total_answered_last_7d) ?? null,
  };
};

export const adminCreateUser = async (input: { email: string; password: string; username?: string | null }) => {
  await assertAdminSession();
  const email = readText(input.email);
  const password = readText(input.password);
  if (!email || !password) throw new Error('Email y contraseña son obligatorios.');
  await adminInvokeFunction('admin-users', {
    action: 'create',
    email,
    password,
    username: readText(input.username) ?? null,
  });
};

export const adminCreateRestrictedQuestionBankViewer = async (input: {
  email: string;
  password?: string | null;
  username?: string | null;
  allowedCurriculumKeys?: string[] | null;
  redirectTo?: string | null;
}): Promise<{ userId: string; magicLink: string | null }> => {
  await assertAdminSession();
  const email = readText(input.email);
  if (!email) throw new Error('Email es obligatorio.');
  const payload = await adminInvokeFunction<Record<string, unknown>>('admin-users', {
    action: 'create_restricted_question_bank_viewer',
    email,
    password: readText(input.password) ?? null,
    username: readText(input.username) ?? null,
    allowedCurriculumKeys: Array.isArray(input.allowedCurriculumKeys) ? input.allowedCurriculumKeys : null,
    redirectTo: readText(input.redirectTo) ?? null,
  });
  const userId = readText(payload?.userId ?? payload?.user_id) ?? '';
  const magicLink = readText(payload?.magicLink ?? payload?.magic_link) ?? null;
  if (!userId) throw new Error('No se ha podido crear el usuario restringido.');
  return { userId, magicLink: magicLink || null };
};

export const adminUpdateUserName = async (input: { userId: string; username: string }) => {
  await assertAdminSession();
  const userId = readText(input.userId);
  const username = readText(input.username);
  if (!userId || !username) throw new Error('Datos inválidos.');
  await adminInvokeFunction('admin-users', { action: 'update_name', userId, username });
};

export const adminDeleteUser = async (userId: string) => {
  await assertAdminSession();
  const id = readText(userId);
  if (!id) throw new Error('Usuario inválido.');
  await adminInvokeFunction('admin-users', { action: 'delete', userId: id });
};

export const adminResetUserData = async (userId: string) => {
  await assertAdminSession();
  const id = readText(userId);
  if (!id) throw new Error('Usuario inválido.');
  await adminInvokeFunction('admin-users', { action: 'reset_progress', userId: id });
};

export const adminSetUserPassword = async (input: { userId: string; password: string }) => {
  await assertAdminSession();
  const userId = readText(input.userId);
  const password = readText(input.password);
  if (!userId || !password) throw new Error('Datos inválidos.');
  await adminInvokeFunction('admin-users', { action: 'set_password', userId, password });
};

export const adminSetUserActive = async (input: { userId: string; active: boolean }) => {
  await assertAdminSession();
  const userId = readText(input.userId);
  if (!userId) throw new Error('Datos inválidos.');
  await adminInvokeFunction('admin-users', { action: input.active ? 'enable' : 'disable', userId });
};

export const adminSetUserActiveOpposition = async (input: { userId: string; oppositionId: string }) => {
  await assertAdminSession();
  const userId = readText(input.userId);
  const oppositionId = readText(input.oppositionId);
  if (!userId || !oppositionId) throw new Error('Datos inválidos.');
  await adminInvokeFunction('admin-users', { action: 'set_active_opposition', userId, oppositionId });
};

const ADMIN_CATALOG_TABLES = [
  { schema: 'public', table: 'oppositions' },
  { schema: 'public', table: 'opposition_configs' },
  { schema: 'public', table: 'subjects' },
  { schema: 'public', table: 'question_scopes' },
  { schema: 'public', table: 'user_opposition_profiles' },
  { schema: 'app', table: 'general_laws' },
  { schema: 'app', table: 'general_law_blocks' },
] as const;
const isAllowedAdminCatalogTable = (schema: string, table: string) =>
  ADMIN_CATALOG_TABLES.some((entry) => entry.schema === schema && entry.table === table);

export const adminListCatalogTables = async (tables: { schema: string; table: string }[]) => {
  await assertAdminSession();
  const input = Array.isArray(tables) ? tables : [];
  const grouped = new Map<string, string[]>();
  for (const entry of input) {
    const schema = readText(entry.schema);
    const table = readText(entry.table);
    if (!schema || !table) continue;
    if (!isAllowedAdminCatalogTable(schema, table)) continue;
    const list = grouped.get(schema) ?? [];
    list.push(table);
    grouped.set(schema, list);
  }

  const discovered: { schema: string; table: string }[] = [];
  for (const [schema, list] of grouped.entries()) {
    const { data, error } = await supabase.rpc('admin_list_tables_v2', { p_schema: schema, p_tables: list });
    if (error) continue;
    const rows = (Array.isArray(data) ? data : []) as unknown[];
    for (const row of rows) {
      const record = (row ?? null) as Record<string, unknown>;
      const table = readText(record.table_name ?? record.tableName);
      if (table) discovered.push({ schema, table });
    }
  }
  return discovered;
};

export const adminGetTableColumns = async (params: { schema: string; table: string }) => {
  await assertAdminSession();
  const schema = readText(params.schema);
  const name = readText(params.table);
  if (!schema || !name || !isAllowedAdminCatalogTable(schema, name)) throw new Error('Tabla no permitida.');
  const { data, error } = await supabase.rpc('admin_get_table_columns_v2', { p_schema: schema, p_table: name });
  if (error) throw new Error(mapPracticeCloudError(error));
  const rows = (Array.isArray(data) ? data : []) as unknown[];
  return rows
    .map((row) => (row ?? null) as Record<string, unknown>)
    .map((row) => ({
      ordinalPosition: readNumber(row.ordinal_position ?? row.ordinalPosition, 0),
      columnName: readText(row.column_name ?? row.columnName) ?? '',
      dataType: readText(row.data_type ?? row.dataType) ?? '',
      isNullable: Boolean(row.is_nullable ?? row.isNullable),
      columnDefault: readText(row.column_default ?? row.columnDefault),
      udtName: readText(row.udt_name ?? row.udtName) ?? '',
    }))
    .filter((row) => Boolean(row.columnName));
};

export const adminUpsertCatalogRow = async (params: {
  schema: 'public' | 'app';
  table: string;
  action: 'list' | 'insert' | 'update';
  row?: Record<string, unknown>;
  where?: Record<string, unknown>;
}): Promise<Record<string, unknown>[] > => {
  await assertAdminSession();
  const schema = readText(params.schema) as 'public' | 'app';
  const table = readText(params.table);
  if (!schema || !table || !isAllowedAdminCatalogTable(schema, table)) throw new Error('Tabla no permitida.');
  const client = schema === 'app' ? supabase.schema('app') : supabase;

  if (params.action === 'list') {
    const { data, error } = await client.from(table).select('*').limit(100);
    if (error) throw new Error(mapPracticeCloudError(error));
    return (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  }

  const row = params.row ?? {};
  if (params.action === 'insert') {
    const { data, error } = await client.from(table).insert(row).select('*');
    if (error) throw new Error(mapPracticeCloudError(error));
    return (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  }

  const where = params.where ?? {};
  const { data, error } = await client.from(table).update(row).match(where).select('*');
  if (error) throw new Error(mapPracticeCloudError(error));
  return (Array.isArray(data) ? data : []) as Record<string, unknown>[];
};

export const updateMyExamTarget = async (input: {
  curriculum: string;
  examDate: string | null;
  dailyReviewCapacity: number;
  dailyNewCapacity: number;
}): Promise<PracticeExamTarget> => {
  const { curriculum, examDate, dailyReviewCapacity, dailyNewCapacity } = input;

  const payloadA = {
    p_curriculum: curriculum,
    p_exam_date: examDate,
    p_daily_review_capacity: dailyReviewCapacity,
    p_daily_new_capacity: dailyNewCapacity,
  };
  const payloadB = {
    p_curriculum: curriculum,
    p_exam_date: examDate,
    p_review_capacity: dailyReviewCapacity,
    p_new_capacity: dailyNewCapacity,
  };

  const rpcNames = ['set_my_exam_target', 'upsert_my_exam_target', 'update_my_exam_target'];
  const payloads = [payloadA, payloadB];

  for (const rpcName of rpcNames) {
    for (const rpcPayload of payloads) {
      const { data, error } = await supabase.schema('app').rpc(rpcName, rpcPayload).maybeSingle();
      if (!error) {
        const target =
          data && typeof data === 'object'
            ? {
                userId: String((data as Record<string, unknown>)['user_id'] ?? ''),
                curriculum: String((data as Record<string, unknown>)['curriculum'] ?? curriculum),
                examDate: readText((data as Record<string, unknown>)['exam_date']),
                dailyReviewCapacity: readNumber(
                  (data as Record<string, unknown>)['daily_review_capacity'] ??
                    (data as Record<string, unknown>)['p_daily_review_capacity'],
                  dailyReviewCapacity,
                ),
                dailyNewCapacity: readNumber(
                  (data as Record<string, unknown>)['daily_new_capacity'] ??
                    (data as Record<string, unknown>)['p_daily_new_capacity'],
                  dailyNewCapacity,
                ),
                updatedAt: readText((data as Record<string, unknown>)['updated_at']),
              }
            : null;
        if (target) return target;
        return {
          userId: '',
          curriculum,
          examDate,
          dailyReviewCapacity,
          dailyNewCapacity,
          updatedAt: new Date().toISOString(),
        };
      }

      if (!isSchemaCacheSignatureError(error)) {
        break;
      }
    }
  }

  throw new Error('No se ha podido guardar el objetivo de examen (RPC no disponible en Supabase).');
};

export const buildRandomPracticeSession = (questions: Question[]): ActivePracticeSession => ({
  id: createId(),
  mode: 'random',
  title: 'Sesion aleatoria',
  startedAt: new Date().toISOString(),
  questions,
  batchNumber: 1,
  totalBatches: 1,
  batchStartIndex: null,
  nextStandardBatchStartIndex: null,
});

const normalizePracticeModeForCloudSync = (mode: PracticeMode): PracticeMode => {
  switch (mode) {
    case 'custom':
    case 'mixed':
    case 'anti_trap':
      return 'standard';
    case 'weakest':
      return 'review';
    default:
      return mode;
  }
};

export const recordPracticeSessionInCloud = async (
  session: ActivePracticeSession,
  answers: TestAnswer[],
  curriculum = DEFAULT_CURRICULUM,
) => {
  const syncedMode = normalizePracticeModeForCloudSync(session.mode);
  const attempts = answers
    .map((answer) => {
      const question = session.questions.find((item) => item.id === answer.questionId);
      if (!question) return null;

      return {
        question_id: question.id,
        question_number: question.number,
        statement: question.text,
        category: question.category,
        question_scope: question.questionScope,
        explanation: question.explanation,
        selected_option: answer.selectedOption,
        correct_option: answer.correctOption,
        is_correct: answer.isCorrect,
        answered_at: answer.answeredAt,
        response_time_ms: answer.responseTimeMs,
        time_to_first_selection_ms: answer.timeToFirstSelectionMs,
        changed_answer: answer.changedAnswer,
        error_type_inferred: null,
      };
    })
    .filter(Boolean);

  const accessToken = await getAccessTokenForFunctionsInvoke();
  const { data, error } = await supabase.functions.invoke('sync-practice-session', {
    body: {
      session: {
        id: session.id,
        mode: syncedMode,
        title: session.title,
        startedAt: session.startedAt,
        batchNumber: session.batchNumber,
        batchSize: session.questions.length,
        batchStartIndex: session.batchStartIndex,
        nextStandardBatchStartIndex: session.nextStandardBatchStartIndex,
      },
      attempts,
      curriculum,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) throw new Error(mapPracticeCloudError(error));
  return data;
};

export const loadDashboardBundle = async (
  curriculum = DEFAULT_CURRICULUM,
): Promise<DashboardBundle> => {
  const primaryBundle = await loadDashboardPrimaryBundle(curriculum);
  return hydrateDashboardBundle(primaryBundle, curriculum);
};

export const loadDashboardPrimaryBundle = async (
  curriculum = DEFAULT_CURRICULUM,
): Promise<DashboardBundle> => {
  const [identity, practiceState, activitySessions] = await Promise.all([
    getMyAccountIdentity(),
    getMyPracticeState(curriculum, { includeRecentSessions: false }),
    getRecentActivitySessions().catch(() => []),
  ]);

  const inferredQuestionsCount = Math.max(
    practiceState.learningDashboard?.totalQuestions ?? 0,
    practiceState.learningDashboardV2?.totalQuestions ?? 0,
  );

  return {
    identity,
    practiceState,
    activitySessions,
    questionsCount: inferredQuestionsCount,
    weakCategories: [],
  };
};

export const getRecentSessionsForHome = async (curriculum = DEFAULT_CURRICULUM) => {
  return getPracticeSessions(curriculum);
};

export const hydrateDashboardBundle = async (
  primaryBundle: DashboardBundle,
  curriculum = DEFAULT_CURRICULUM,
  options?: { skipSharedCommonOverride?: boolean },
): Promise<DashboardBundle> => {
  const [learningDashboardV2, pressureInsightsV2, catalog, weakCategories] = await Promise.all([
    getMyLearningDashboardV2(curriculum).catch(() => null),
    getMyPressureDashboardV2(curriculum).catch(() => null),
    getPracticeCatalogSummary(curriculum).catch(async () => ({
      totalQuestions: await getQuestionCountFromTables(curriculum),
    })),
    getWeakCategorySummary(curriculum, 5).catch(() => []),
  ]);

  const skipSharedCommonOverride = options?.skipSharedCommonOverride ?? false;
  const sharedCommonOverride = skipSharedCommonOverride ? null : await computeSharedCommonOverride(curriculum);

  const patchedLearningDashboardV2 =
    learningDashboardV2 && sharedCommonOverride
      ? {
          ...learningDashboardV2,
          topicBreakdown: [
            ...(learningDashboardV2.topicBreakdown ?? []).filter(
              (topic) => !(topic.scope === 'common' && topic.topicLabel === 'Parte común'),
            ),
            {
              topicLabel: 'Parte común',
              scope: 'common' as const,
              attempts: sharedCommonOverride.attempts,
              questionCount: sharedCommonOverride.total,
              unseenCount: sharedCommonOverride.unseen,
              correctAttempts: 0,
              accuracyRate: 0,
            },
          ],
        }
      : learningDashboardV2;

  const dashboardReportedQuestions = Math.max(
    primaryBundle.practiceState.learningDashboard?.totalQuestions ?? 0,
    patchedLearningDashboardV2?.totalQuestions ?? 0,
    primaryBundle.questionsCount ?? 0,
  );
  const normalizedQuestionsCount =
    catalog.totalQuestions > 0 ? catalog.totalQuestions : dashboardReportedQuestions;

  const syncedPracticeState: CloudPracticeState = {
    ...primaryBundle.practiceState,
    learningDashboard:
      primaryBundle.practiceState.learningDashboard && normalizedQuestionsCount > 0
        ? {
            ...primaryBundle.practiceState.learningDashboard,
            totalQuestions: normalizedQuestionsCount,
          }
        : primaryBundle.practiceState.learningDashboard,
    learningDashboardV2:
      patchedLearningDashboardV2 && normalizedQuestionsCount > 0
        ? {
            ...patchedLearningDashboardV2,
            totalQuestions: normalizedQuestionsCount,
            coverageRate: Math.max(
              0,
              Math.min(1, (patchedLearningDashboardV2.seenQuestions ?? 0) / normalizedQuestionsCount),
            ),
          }
        : patchedLearningDashboardV2,
    pressureInsightsV2,
  };

  return {
    identity: primaryBundle.identity,
    practiceState: syncedPracticeState,
    activitySessions: primaryBundle.activitySessions,
    questionsCount: normalizedQuestionsCount,
    weakCategories,
  };
};

type SharedCommonOverride = { total: number; unseen: number; attempts: number };
const sharedCommonOverrideCache = new Map<string, Promise<SharedCommonOverride | null>>();

export const computeSharedCommonOverride = async (curriculum: string): Promise<SharedCommonOverride | null> => {
  const normalized = String(curriculum ?? '').trim() || DEFAULT_CURRICULUM;
  if (!hasSharedQuestionSources(normalized, 'common')) return null;

  const cached = sharedCommonOverrideCache.get(normalized);
  if (cached) return cached;

  const task = (async () => {
    const commonSnapshot = await getQuestionSnapshotFromTables({
      curriculum: normalized,
      maxQuestions: 4000,
      questionScope: 'common',
    }).catch(() => []);
    const commonQuestionKeysById = new Map<string, string>();
    const commonQuestionKeys = new Set<string>();
    for (const question of commonSnapshot) {
      const fallbackId = String(question.id ?? '').trim();
      const dedupeKey = buildQuestionDedupKey(question);
      const canonicalKey = dedupeKey || `id:${fallbackId}`;
      if (fallbackId) commonQuestionKeysById.set(fallbackId, canonicalKey);
      commonQuestionKeys.add(canonicalKey);
    }
    const attemptedRefs = await getAttemptedQuestionRefsFromSessions(normalized).catch(() => null);
    if (commonQuestionKeys.size === 0 || !attemptedRefs) return null;

    const seenSharedCommon = new Set<string>();

    for (const id of attemptedRefs.ids) {
      const canonicalKey = commonQuestionKeysById.get(id);
      if (canonicalKey) seenSharedCommon.add(canonicalKey);
    }

    for (const dedupeKey of attemptedRefs.dedupeKeys) {
      if (commonQuestionKeys.has(dedupeKey)) seenSharedCommon.add(dedupeKey);
    }

    const seenCommon = seenSharedCommon.size;
    const totalCommon = commonQuestionKeys.size;
    const safeSeen = Math.max(0, Math.min(totalCommon, seenCommon));
    const unseen = Math.max(0, totalCommon - safeSeen);

    if (isCommonProgressDebugEnabled()) {
      console.info('[commonProgress]', {
        curriculum: normalized,
        totalCommon,
        seenCommon: safeSeen,
        commonQuestionIds: commonQuestionKeysById.size,
        commonQuestionKeys: commonQuestionKeys.size,
        attemptedIds: attemptedRefs.ids.size,
        attemptedDedupeKeys: attemptedRefs.dedupeKeys.size,
      });
    }

    return { total: totalCommon, unseen, attempts: safeSeen };
  })().catch((error) => {
    sharedCommonOverrideCache.delete(normalized);
    throw error;
  });

  sharedCommonOverrideCache.set(normalized, task);
  return task;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};
