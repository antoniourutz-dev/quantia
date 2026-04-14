import { supabase } from './supabaseClient';
import {
  mapAccountIdentity,
  mapCategoryRiskSummary,
  mapLearningDashboard,
  mapLearningDashboardV2,
  mapPressureInsights,
  mapPressureInsightsV2,
  mapQuestion,
  mapSession,
  readNumber,
  readText,
} from './quantiaMappers';
import type {
  AccountIdentity,
  ActivePracticeSession,
  CloudPracticeState,
  PracticeCategoryRiskSummary,
  PracticeExamTarget,
  PracticeQuestionScopeFilter,
  Question,
  TestAnswer,
} from '../types';

export const DEFAULT_CURRICULUM = 'osakidetza_admin';

export type DashboardBundle = {
  identity: AccountIdentity;
  practiceState: CloudPracticeState;
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

const FALLBACK_CURRICULUM_OPTIONS: CurriculumOption[] = [
  { id: DEFAULT_CURRICULUM, label: 'Administrativo' },
  { id: 'auxiliar_administrativo', label: 'Auxiliar administrativo' },
  { id: 'goi-teknikaria', label: 'Goi-teknikaria' },
];

const CURRICULUM_RPC_NAMES = [
  'get_available_curriculums',
  'list_available_curriculums',
  'get_curriculum_catalog',
  'list_curriculums',
  'get_curriculums',
  'list_oposiciones',
  'get_oposiciones',
];

const CURRICULUM_TABLE_SOURCES: TableSource[] = [
  { schema: 'app', table: 'practice_profiles' },
  { schema: 'public', table: 'opposition_configs' },
  { schema: 'app', table: 'curriculums' },
  { schema: 'app', table: 'curricula' },
  { schema: 'app', table: 'oposiciones' },
  { schema: 'app', table: 'opposition_catalog' },
  { schema: 'public', table: 'curriculums' },
  { schema: 'public', table: 'curricula' },
  { schema: 'public', table: 'oposiciones' },
  { schema: 'public', table: 'opposition_catalog' },
];

const QUESTION_TABLE_SOURCES: TableSource[] = [
  { schema: 'public', table: 'preguntas' },
  { schema: 'app', table: 'preguntas' },
  { schema: 'app', table: 'study_questions' },
  { schema: 'app', table: 'questions' },
  { schema: 'app', table: 'practice_questions' },
  { schema: 'app', table: 'question_bank' },
  { schema: 'app', table: 'oposicion_questions' },
  { schema: 'public', table: 'study_questions' },
  { schema: 'public', table: 'questions' },
  { schema: 'public', table: 'practice_questions' },
  { schema: 'public', table: 'question_bank' },
  { schema: 'public', table: 'oposicion_questions' },
];

const SESSION_TABLE_SOURCES: TableSource[] = [
  { schema: 'public', table: 'practice_sessions' },
  { schema: 'app', table: 'practice_sessions' },
];

const SESSION_SELECT_CANDIDATES = [
  'session_id, mode, title, started_at, finished_at, score, total',
  'id, mode, title, started_at, finished_at, score, total',
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

const QUESTION_NUMBER_FIELD_ALIASES = [
  'numero',
  'question_number',
  'number',
  'orden',
  'order',
  'position',
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
    key: 'goi-teknikaria',
    label: 'Goi-teknikaria',
    aliases: ['goi-teknikaria', 'goi_teknikaria', 'goi-teknikaria-eu', 'goi_teknikaria_eu'],
  },
] as const;

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

    const all = Array.from(new Set([...baseCandidates, ...Array.from(resolvedIds)]));
    return all;
  })();

  curriculumCandidatesCache.set(cacheKey, task);
  return task;
};

const mapPracticeCloudError = (error: PostgrestLikeError) => {
  const message = String(error.message ?? '');
  const normalizedMessage = message.toLowerCase();

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

const isLawSelectionCurriculum = (curriculum: string) =>
  canonicalizeCurriculumId(curriculum) === 'leyes-generales';

const toSentenceCase = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const stripLawArticlePrefix = (value: string) =>
  value
    .replace(
      /^(?:arts?|art(?:[íi]culo)?s?)\.?\s*(?:\d+[A-Za-zºª]*(?:\.\d+)?(?:\s*(?:bis|ter|qu[aá]ter))?(?:\s*(?:,|y)\s*)?)+(?:\s*[.:)\-])?\s*/i,
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
    /\b(estatuto\s+de\s+autonom[ií]a[^\.,;:]*)\b/i,
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
  if (!isLawSelectionCurriculum(curriculum)) {
    return String(category ?? '').trim() || null;
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
  const candidates = CURRICULUM_VALUE_PREFERENCE_ALIASES.map((key) => readText(row[key])).filter(
    (value): value is string => Boolean(value),
  );

  if (candidates.length === 0) return null;

  const preferredCandidate = candidates.find((value) => !isOpaqueCurriculumValue(value));
  return preferredCandidate ?? candidates[0];
};

const extractCurriculumOption = (row: Record<string, unknown>): CurriculumOption | null => {
  const id = extractCurriculumId(row);
  if (!id) return null;

  return {
    id,
    label: readFirstText(row, CURRICULUM_LABEL_ALIASES) ?? formatCurriculumLabel(id),
    questionCount: readOptionalNumber(
      row.question_count ??
        row.total_questions ??
        row.questions_count ??
        row.total,
    ),
    sessionCount: readOptionalNumber(row.total_sessions ?? row.session_count),
    answeredCount: readOptionalNumber(row.total_answered ?? row.answered_count),
    lastStudiedAt: readText(row.last_studied_at ?? row.last_answered_at ?? row.updated_at),
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

const shuffleQuestions = (questions: Question[]) => {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[targetIndex]] = [shuffled[targetIndex], shuffled[index]];
  }
  return shuffled;
};

const getAccessTokenForFunctionsInvoke = async () => {
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

  for (const source of SESSION_TABLE_SOURCES) {
    if (isKnownMissingTableSource(source)) continue;

    for (const selectFields of SESSION_SELECT_CANDIDATES) {
      let shouldTryNextSelect = false;

      for (const field of CURRICULUM_FIELD_ALIASES) {
        const { data, error } = await getSchemaClient(source.schema)
          .from(source.table)
          .select(selectFields)
          .eq(field, curriculum)
          .order('finished_at', { ascending: false })
          .limit(250);

        if (!error) {
          return ((data ?? []) as Array<Record<string, unknown>>).map(mapSession);
        }

        if (isMissingColumnError(error)) {
          shouldTryNextSelect = true;
          break;
        }
        if (isMissingRelationError(error)) {
          markTableSourceMissing(source);
          shouldTryNextSelect = false;
          break;
        }
        lastError = new Error(mapPracticeCloudError(error));
        shouldTryNextSelect = false;
        break;
      }

      if (!shouldTryNextSelect) {
        break;
      }
    }
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

  let lastError: Error | null = null;
  const curriculumCandidates = await resolveCurriculumCandidates(curriculum);

  for (const source of QUESTION_TABLE_SOURCES) {
    try {
      const rows = await queryQuestionsFromSource(source, curriculum, curriculumCandidates, limit, offset);
      if (!rows || rows.length === 0) continue;

      const filtered = filterQuestionsByScope(mapQuestionRows(rows), questionScope);
      if (filtered.length === 0) continue;

      return randomize ? shuffleQuestions(filtered).slice(0, limit) : filtered.slice(0, limit);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('No se han podido leer preguntas.');
    }
  }

  if (lastError) throw lastError;
  return [];
};

const getQuestionRowsForCurriculum = async (curriculum: string, maxRows = 4000) => {
  const pageSize = Math.min(500, Math.max(100, maxRows));
  const curriculumCandidates = await resolveCurriculumCandidates(curriculum);
  let lastError: Error | null = null;

  for (const source of QUESTION_TABLE_SOURCES) {
    const collected: Array<Record<string, unknown>> = [];

    for (let offset = 0; offset < maxRows; offset += pageSize) {
      try {
        const rows = await queryQuestionsFromSource(source, curriculum, curriculumCandidates, pageSize, offset);
        if (rows === null || rows.length === 0) break;

        collected.push(...rows);
        if (rows.length < pageSize || collected.length >= maxRows) break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('No se han podido leer preguntas.');
        break;
      }
    }

    if (collected.length > 0) {
      return collected.slice(0, maxRows);
    }
  }

  if (lastError) throw lastError;
  return [];
};

export const getCurriculumCategoryOptions = async (curriculum = DEFAULT_CURRICULUM) => {
  const rows = await getQuestionRowsForCurriculum(curriculum, 4000);
  const deduped = new Map<string, string>();

  for (const row of rows) {
    const label = getCurriculumCategoryGroupLabel(curriculum, readQuestionCategoryLabel(row));
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

const getQuestionCountFromTables = async (curriculum: string) => {
  const candidates = await resolveCurriculumCandidates(curriculum);
  for (const source of QUESTION_TABLE_SOURCES) {
    if (isKnownMissingTableSource(source)) continue;

    let missingAllColumns = true;
    for (const field of QUESTION_CURRICULUM_FIELD_ALIASES) {
      const { count, error } = await getSchemaClient(source.schema)
        .from(source.table)
        .select('*', { count: 'exact', head: true })
        .in(field, candidates);

      if (!error && typeof count === 'number') {
        return count;
      }

      if (error && isMissingColumnError(error)) continue;
      missingAllColumns = false;
      if (error && isMissingRelationError(error)) {
        markTableSourceMissing(source);
        break;
      }
    }

    if (missingAllColumns) {
      const { count, error } = await getSchemaClient(source.schema)
        .from(source.table)
        .select('*', { count: 'exact', head: true });

      if (!error && typeof count === 'number' && count > 0) {
        return count;
      }
      if (error && isMissingRelationError(error)) {
        markTableSourceMissing(source);
      }
    }
  }

  return 0;
};

export const getMyAccountIdentity = async (): Promise<AccountIdentity> => {
  const { data, error } = await supabase.schema('app').rpc('get_my_account_identity').maybeSingle();
  if (error) throw new Error(mapPracticeCloudError(error));

  const identity = mapAccountIdentity(data);
  if (!identity) throw new Error('No se ha podido cargar la identidad de la cuenta.');
  return identity;
};

export const getMyPracticeState = async (
  curriculum = DEFAULT_CURRICULUM,
): Promise<CloudPracticeState> => {
  const [recentSessions, learningDashboardResponse, examTargetResponse, pressureDashboardResponse] =
    await Promise.all([
      getPracticeSessions(curriculum),
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
      return { totalQuestions: await getQuestionCountFromTables(curriculum) || fallbackQuestions.length };
    }

    return { totalQuestions: 0 };
  };

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

  const rows = await getQuestionRowsForCurriculum(curriculum, 4000);
  const filteredRows = rows.filter(
    (row) =>
      normalizeCategoryLabel(
        getCurriculumCategoryGroupLabel(curriculum, readQuestionCategoryLabel(row)),
      ) === normalizedTarget,
  );
  const mapped = shuffleQuestions(mapQuestionRows(filteredRows)).slice(0, batchSize);
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
  const candidates = await resolveCurriculumCandidates(curriculum);

  for (const source of QUESTION_TABLE_SOURCES) {
    if (isKnownMissingTableSource(source)) continue;

    for (const curriculumField of QUESTION_CURRICULUM_FIELD_ALIASES) {
      for (const numberField of QUESTION_NUMBER_FIELD_ALIASES) {
        const minResponse = await getSchemaClient(source.schema)
          .from(source.table)
          .select(numberField)
          .in(curriculumField, candidates)
          .order(numberField, { ascending: true })
          .limit(1);

        if (minResponse.error) {
          if (isMissingColumnError(minResponse.error)) continue;
          if (isMissingRelationError(minResponse.error)) {
            markTableSourceMissing(source);
            break;
          }
          continue;
        }

        const minRow = ((minResponse.data ?? []) as Array<Record<string, unknown>>)[0] ?? null;
        const minValue = minRow ? readOptionalNumber(minRow[numberField]) : null;
        if (minValue == null) continue;

        const maxResponse = await getSchemaClient(source.schema)
          .from(source.table)
          .select(numberField)
          .in(curriculumField, candidates)
          .order(numberField, { ascending: false })
          .limit(1);

        if (maxResponse.error) {
          if (isMissingColumnError(maxResponse.error)) continue;
          if (isMissingRelationError(maxResponse.error)) {
            markTableSourceMissing(source);
            break;
          }
          continue;
        }

        const maxRow = ((maxResponse.data ?? []) as Array<Record<string, unknown>>)[0] ?? null;
        const maxValue = maxRow ? readOptionalNumber(maxRow[numberField]) : null;
        if (maxValue == null) continue;

        return { min: minValue, max: maxValue };
      }
    }
  }

  return null;
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
  const limit = Math.min(2000, Math.max(1, toValue - fromValue + 1));
  const candidates = await resolveCurriculumCandidates(curriculum);

  for (const source of QUESTION_TABLE_SOURCES) {
    if (isKnownMissingTableSource(source)) continue;

    for (const curriculumField of QUESTION_CURRICULUM_FIELD_ALIASES) {
      for (const numberField of QUESTION_NUMBER_FIELD_ALIASES) {
        const { data, error } = await getSchemaClient(source.schema)
          .from(source.table)
          .select('*')
          .in(curriculumField, candidates)
          .gte(numberField, fromValue)
          .lte(numberField, toValue)
          .order(numberField, { ascending: true })
          .limit(limit);

        if (!error) {
          const questions = mapQuestionRows((data ?? []) as Array<Record<string, unknown>>);
          if (questions.length === 0) continue;
          const ordered = [...questions].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
          return randomize ? shuffleQuestions(ordered) : ordered;
        }

        if (isMissingColumnError(error)) continue;
        if (isMissingRelationError(error)) {
          markTableSourceMissing(source);
          break;
        }
      }
    }
  }

  const fallbackPool = await getQuestionsFromTables({
    curriculum,
    limit: 2000,
    offset: 0,
    questionScope: 'all',
    randomize: false,
  });

  const filtered = fallbackPool
    .filter((q) => typeof q.number === 'number' && q.number >= fromValue && q.number <= toValue)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  return randomize ? shuffleQuestions(filtered) : filtered;
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

  const fallbackQuestions = await getQuestionsFromTables({
    curriculum,
    limit,
    offset,
  });
  if (fallbackQuestions.length > 0) {
    return fallbackQuestions.slice(0, limit);
  }

  return getRandomPracticeBatch(limit, curriculum, 'all');
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
  id: crypto.randomUUID(),
  mode: 'random',
  title: 'Sesion aleatoria',
  startedAt: new Date().toISOString(),
  questions,
  batchNumber: 1,
  totalBatches: 1,
  batchStartIndex: null,
  nextStandardBatchStartIndex: null,
});

export const recordPracticeSessionInCloud = async (
  session: ActivePracticeSession,
  answers: TestAnswer[],
  curriculum = DEFAULT_CURRICULUM,
) => {
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
        mode: session.mode,
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
  const [identity, practiceState, learningDashboardV2, pressureInsightsV2, catalog, weakCategories] =
    await Promise.all([
      getMyAccountIdentity(),
      getMyPracticeState(curriculum),
      getMyLearningDashboardV2(curriculum).catch(() => null),
      getMyPressureDashboardV2(curriculum).catch(() => null),
      getPracticeCatalogSummary(curriculum).catch(async () => ({
        totalQuestions: await getQuestionCountFromTables(curriculum),
      })),
      getWeakCategorySummary(curriculum, 5).catch(() => []),
    ]);

  return {
    identity,
    practiceState: {
      ...practiceState,
      learningDashboardV2,
      pressureInsightsV2,
    },
    questionsCount: catalog.totalQuestions,
    weakCategories,
  };
};

export const signOut = async () => {
  await supabase.auth.signOut();
};
