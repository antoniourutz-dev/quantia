import type {
  AccountIdentity,
  PracticeCategoryRiskSummary,
  PracticeLearningDashboard,
  PracticeLearningDashboardV2,
  PracticePressureInsights,
  PracticePressureInsightsV2,
  PracticeSessionSummary,
  Question,
} from '../types';
import { createId } from './id';

const OPTION_KEYS = ['a', 'b', 'c', 'd'] as const;

export const readText = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

export const readNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toNullableNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeQuestionScope = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'common' || normalized === 'comun') return 'common' as const;
  if (normalized === 'specific' || normalized === 'especifico' || normalized === 'específico') {
    return 'specific' as const;
  }
  return null;
};

export const mapPracticeMode = (value: unknown): PracticeSessionSummary['mode'] => {
  const normalized = String(value ?? '').trim().toLowerCase();
  switch (normalized) {
    case 'quick_five':
    case 'weakest':
    case 'random':
    case 'review':
    case 'mixed':
    case 'simulacro':
    case 'anti_trap':
    case 'custom':
      return normalized;
    default:
      return 'standard';
  }
};

const normalizeComparable = (value: string) =>
  value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

const pickFirstText = (row: Record<string, unknown>, fieldNames: string[]) => {
  for (const fieldName of fieldNames) {
    const value = readText(row[fieldName]);
    if (value) return value;
  }
  return null;
};

const extractOptionsFromObject = (rawOptions: unknown) => {
  if (!rawOptions || typeof rawOptions !== 'object' || Array.isArray(rawOptions)) {
    return null;
  }

  const source = rawOptions as Record<string, unknown>;
  const entries = OPTION_KEYS.map((key) => [key, readText(source[key])] as const);
  if (entries.some(([, value]) => !value)) return null;
  return Object.fromEntries(entries) as Record<(typeof OPTION_KEYS)[number], string>;
};

const extractOptionTextFromValue = (value: unknown) => {
  if (typeof value === 'string') return readText(value);
  if (!value || typeof value !== 'object') return null;

  const source = value as Record<string, unknown>;
  return (
    readText(source.text) ??
    readText(source.label) ??
    readText(source.content) ??
    readText(source.value) ??
    readText(source.option) ??
    readText(source.answer) ??
    readText(source.descripcion)
  );
};

const extractOptionsFromArray = (rawOptions: unknown) => {
  if (!Array.isArray(rawOptions) || rawOptions.length < OPTION_KEYS.length) {
    return null;
  }

  const entries = OPTION_KEYS.map((key, index) => [key, extractOptionTextFromValue(rawOptions[index])] as const);
  if (entries.some(([, value]) => !value)) return null;

  return Object.fromEntries(entries) as Record<(typeof OPTION_KEYS)[number], string>;
};

const extractOptions = (row: Record<string, unknown>) => {
  const nestedOptions =
    extractOptionsFromObject(row.opciones) ??
    extractOptionsFromObject(row.options) ??
    extractOptionsFromArray(row.opciones) ??
    extractOptionsFromArray(row.options) ??
    extractOptionsFromArray(row.answers) ??
    extractOptionsFromArray(row.choices) ??
    extractOptionsFromArray(row.alternatives);
  if (nestedOptions) return nestedOptions;

  const aliases: Record<(typeof OPTION_KEYS)[number], string[]> = {
    a: [
      'opcion_a',
      'option_a',
      'respuesta_a',
      'choice_a',
      'answer_a',
      'opcion1',
      'opcion_1',
      'respuesta1',
      'respuesta_1',
      'a',
    ],
    b: [
      'opcion_b',
      'option_b',
      'respuesta_b',
      'choice_b',
      'answer_b',
      'opcion2',
      'opcion_2',
      'respuesta2',
      'respuesta_2',
      'b',
    ],
    c: [
      'opcion_c',
      'option_c',
      'respuesta_c',
      'choice_c',
      'answer_c',
      'opcion3',
      'opcion_3',
      'respuesta3',
      'respuesta_3',
      'c',
    ],
    d: [
      'opcion_d',
      'option_d',
      'respuesta_d',
      'choice_d',
      'answer_d',
      'opcion4',
      'opcion_4',
      'respuesta4',
      'respuesta_4',
      'd',
    ],
  };

  const entries = OPTION_KEYS.map((key) => [key, pickFirstText(row, aliases[key])] as const);
  if (entries.some(([, value]) => !value)) return null;
  return Object.fromEntries(entries) as Record<(typeof OPTION_KEYS)[number], string>;
};

const mapNumericOption = (value: number) => {
  const index = Math.trunc(value) - 1;
  return OPTION_KEYS[index] ?? null;
};

const extractCorrectOption = (
  row: Record<string, unknown>,
  options: Record<(typeof OPTION_KEYS)[number], string>,
) => {
  const rawCorrectValue =
    row.correct_answer_index ??
    row.correct_option_index ??
    row.correct_index ??
    row.answer_index ??
    row.respuesta_correcta_indice ??
    row.respuesta_correcta ??
    row.correct_option ??
    row.correct_answer ??
    row.respuesta ??
    row.answer;

  if (typeof rawCorrectValue === 'number' && Number.isFinite(rawCorrectValue)) {
    return mapNumericOption(rawCorrectValue);
  }

  if (rawCorrectValue && typeof rawCorrectValue === 'object') {
    const source = rawCorrectValue as Record<string, unknown>;
    const nestedText =
      readText(source.id) ??
      readText(source.key) ??
      readText(source.value) ??
      readText(source.text) ??
      readText(source.label);
    if (nestedText) {
      const normalizedNested = normalizeComparable(nestedText);
      if (OPTION_KEYS.includes(normalizedNested as (typeof OPTION_KEYS)[number])) {
        return normalizedNested as (typeof OPTION_KEYS)[number];
      }

      const numericNested = Number(nestedText);
      if (Number.isFinite(numericNested)) {
        return mapNumericOption(numericNested);
      }
    }
  }

  const correctText = readText(rawCorrectValue);
  if (!correctText) return null;

  const normalizedCorrect = normalizeComparable(correctText);
  if (OPTION_KEYS.includes(normalizedCorrect as (typeof OPTION_KEYS)[number])) {
    return normalizedCorrect as (typeof OPTION_KEYS)[number];
  }

  const numericCandidate = Number(correctText);
  if (Number.isFinite(numericCandidate)) {
    return mapNumericOption(numericCandidate);
  }

  return (
    OPTION_KEYS.find((key) => normalizeComparable(options[key]) === normalizedCorrect) ?? null
  );
};

export const mapQuestion = (row: Record<string, unknown>): Question | null => {
  const statement = pickFirstText(row, [
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
  const options = extractOptions(row);
  if (!statement || !options) return null;

  const correctOption = extractCorrectOption(row, options);
  if (!correctOption) return null;

  const questionScope =
    normalizeQuestionScope(row.question_scope) ??
    normalizeQuestionScope(row.question_scope_key) ??
    normalizeQuestionScope(row.raw_scope) ??
    normalizeQuestionScope(row.scope) ??
    normalizeQuestionScope(row.scope_key) ??
    normalizeQuestionScope(row.grupo);

  return {
    id: readText(row.id ?? row.question_id ?? row.uuid ?? row.slug) ?? createId(),
    number: toNullableNumber(
      row.numero ?? row.question_number ?? row.number ?? row.orden ?? row.order ?? row.position,
    ),
    text: statement,
    options: OPTION_KEYS.map((key) => ({ id: key, text: options[key] })),
    correctAnswer: correctOption,
    explanation:
      pickFirstText(row, [
        'explicacion',
        'explanation',
        'justificacion',
        'feedback',
        'solution',
        'rationale',
      ]) ??
      'Sin explicacion disponible.',
    syllabus: questionScope ?? 'common',
    category: pickFirstText(row, [
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
      'ley_referencia',
    ]),
    questionScope,
  };
};

export const mapSession = (value: Record<string, unknown>): PracticeSessionSummary => ({
  id: String(value.session_id ?? value.id ?? ''),
  mode: mapPracticeMode(value.mode),
  title: String(value.title ?? 'Sesion'),
  startedAt: String(value.started_at ?? value.startedAt ?? ''),
  finishedAt: String(value.finished_at ?? value.finishedAt ?? ''),
  score: readNumber(value.score),
  total: readNumber(value.total),
});

export const mapLearningDashboard = (
  value: Record<string, unknown> | null,
): PracticeLearningDashboard | null => {
  if (!value) return null;

  return {
    totalQuestions: readNumber(value.total_questions),
    seenQuestions: readNumber(value.seen_questions),
    readiness: Number(value.readiness ?? 0.25) || 0.25,
    overdueCount: readNumber(value.overdue_count),
    dailyReviewCapacity: readNumber(value.daily_review_capacity, 35),
    dailyNewCapacity: readNumber(value.daily_new_capacity, 10),
    examDate: readText(value.exam_date),
    focusMessage:
      readText(value.focus_message) ??
      'Hoy te conviene hacer una sesion clara y seguir desde ahi.',
  };
};

export const mapCategoryRiskSummary = (row: Record<string, unknown>): PracticeCategoryRiskSummary => ({
  category: String(row.category ?? 'Sin grupo').trim() || 'Sin grupo',
  attempts: readNumber(row.attempts),
  incorrectAttempts: readNumber(row.incorrect_attempts),
  rawFailRate: toNullableNumber(row.raw_fail_rate),
  smoothedFailRate: toNullableNumber(row.smoothed_fail_rate),
  baselineFailRate: toNullableNumber(row.baseline_fail_rate),
  excessRisk: toNullableNumber(row.excess_risk),
  sampleOk: Boolean(row.sample_ok),
  confidenceFlag:
    (readText(row.confidence_flag) as PracticeCategoryRiskSummary['confidenceFlag']) ?? 'low',
});

export const mapAccountIdentity = (value: unknown): AccountIdentity | null => {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const userId = String(record.user_id ?? '').trim();
  const currentUsername = String(record.current_username ?? '').trim();
  if (!userId || !currentUsername) return null;

  return {
    user_id: userId,
    current_username: currentUsername,
    is_admin: Boolean(record.is_admin),
    player_mode: String(record.player_mode ?? '').trim().toLowerCase() === 'generic' ? 'generic' : 'advanced',
    previous_usernames: Array.isArray(record.previous_usernames)
      ? record.previous_usernames.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [],
  };
};

export const mapLearningDashboardV2 = (
  value: Record<string, unknown> | null,
): PracticeLearningDashboardV2 | null => {
  if (!value) return null;

  const rawLawBreakdown = Array.isArray(value.law_breakdown) ? value.law_breakdown : [];
  const rawTopicBreakdown = Array.isArray(value.topic_breakdown) ? value.topic_breakdown : [];

  return {
    totalQuestions: readNumber(value.total_questions),
    seenQuestions: readNumber(value.seen_questions),
    coverageRate: readNumber(value.coverage_rate),
    observedAccuracyRate: readNumber(value.observed_accuracy_rate),
    observedAccuracyN: readNumber(value.observed_accuracy_n),
    observedAccuracyCiLow: toNullableNumber(value.observed_accuracy_ci_low),
    observedAccuracyCiHigh: toNullableNumber(value.observed_accuracy_ci_high),
    observedAccuracySampleOk: Boolean(value.observed_accuracy_sample_ok),
    retentionSeenRate: toNullableNumber(value.retention_seen_rate),
    retentionSeenN: readNumber(value.retention_seen_n),
    retentionSeenConfidenceFlag:
      (readText(value.retention_seen_confidence_flag) as PracticeLearningDashboardV2['retentionSeenConfidenceFlag']) ??
      'low',
    unseenPriorRate: readNumber(value.unseen_prior_rate, 0.25),
    examReadinessRate: readNumber(value.exam_readiness_rate, 0.25),
    examReadinessCiLow: toNullableNumber(value.exam_readiness_ci_low),
    examReadinessCiHigh: toNullableNumber(value.exam_readiness_ci_high),
    examReadinessConfidenceFlag:
      (readText(value.exam_readiness_confidence_flag) as PracticeLearningDashboardV2['examReadinessConfidenceFlag']) ??
      'low',
    backlogOverdueCount: readNumber(value.backlog_overdue_count),
    fragileCount: readNumber(value.fragile_count),
    consolidatingCount: readNumber(value.consolidating_count),
    solidCount: readNumber(value.solid_count),
    masteredCount: readNumber(value.mastered_count),
    recommendedReviewCount: readNumber(value.recommended_review_count),
    recommendedNewCount: readNumber(value.recommended_new_count),
    recommendedTodayCount: readNumber(value.recommended_today_count),
    recommendedMode: mapPracticeMode(value.recommended_mode),
    focusMessage:
      readText(value.focus_message) ?? 'Todavia hace falta un poco mas para leer bien por donde seguir.',
    lawBreakdown: rawLawBreakdown.map((law: Record<string, unknown>) => {
      const rawBlocks = law.blocks ?? law.block_breakdown;
      const blocks = Array.isArray(rawBlocks)
        ? rawBlocks.map((block: Record<string, unknown>) => ({
            blockId: String(block.block_id ?? block.blockId ?? ''),
            title: readText(block.title) ?? 'Bloque',
            trainingFocus: readText(block.training_focus ?? block.trainingFocus),
            questionCount: readNumber(block.question_count ?? block.questionCount),
            consolidatedCount: readNumber(block.consolidated_count ?? block.consolidatedCount),
            attempts: readNumber(block.attempts),
            correctAttempts: readNumber(block.correct_attempts ?? block.correctAttempts),
            accuracyRate: Number(block.accuracy_rate ?? block.accuracyRate ?? 0),
          }))
        : undefined;

      return {
        ley_referencia: String(law.ley_referencia || 'Otras Normas'),
        lawId: readText(law.law_id ?? law.lawId) ?? undefined,
        shortTitle: readText(law.short_title ?? law.shortTitle),
        trainingIntent: readText(law.training_intent ?? law.trainingIntent),
        blocks: blocks && blocks.length > 0 ? blocks : undefined,
        scope: normalizeQuestionScope(law.raw_scope) ?? 'unknown',
        attempts: readNumber(law.attempts),
        questionCount: readNumber(law.question_count),
        consolidatedCount: readNumber(law.consolidated_count),
        correctAttempts: readNumber(law.correct_attempts),
        accuracyRate: Number(law.accuracy_rate ?? 0),
      };
    }),
    topicBreakdown: rawTopicBreakdown.flatMap((topic: Record<string, unknown>) => {
      const topicLabel = readText(topic.topic_label ?? topic.temario_pregunta ?? topic.label);
      if (!topicLabel) return [];

      return [
        {
          topicLabel,
          scope: normalizeQuestionScope(topic.raw_scope) ?? 'unknown',
          attempts: readNumber(topic.attempts),
          questionCount: readNumber(topic.question_count),
          consolidatedCount: readNumber(topic.consolidated_count),
          unseenCount: readNumber(topic.unseen_count),
          fragileCount: readNumber(topic.fragile_count),
          consolidatingCount: readNumber(topic.consolidating_count),
          solidCount: readNumber(topic.solid_count),
          masteredCount: readNumber(topic.mastered_count),
          correctAttempts: readNumber(topic.correct_attempts),
          accuracyRate: Number(topic.accuracy_rate ?? 0),
        },
      ];
    }),
  };
};

export const mapPressureInsights = (
  value: Record<string, unknown> | null,
): PracticePressureInsights | null => {
  if (!value) return null;

  return {
    learningAccuracy: toNullableNumber(value.learning_accuracy),
    simulacroAccuracy: toNullableNumber(value.simulacro_accuracy),
    pressureGap: toNullableNumber(value.pressure_gap),
    avgSimulacroFatigue: toNullableNumber(value.avg_simulacro_fatigue),
    overconfidenceRate: toNullableNumber(value.overconfidence_rate),
    recommendedMode: readText(value.recommended_mode) as PracticePressureInsights['recommendedMode'],
    pressureMessage:
      readText(value.pressure_message) ?? 'Todavia hacen falta mas respuestas para ver con claridad como llegas cuando aprietas.',
  };
};

export const mapPressureInsightsV2 = (
  value: Record<string, unknown> | null,
): PracticePressureInsightsV2 | null => {
  if (!value) return null;

  return {
    learningAccuracy: toNullableNumber(value.learning_accuracy),
    simulacroAccuracy: toNullableNumber(value.simulacro_accuracy),
    pressureGapRaw: toNullableNumber(value.pressure_gap_raw),
    learningSessionN: readNumber(value.learning_session_n),
    simulacroSessionN: readNumber(value.simulacro_session_n),
    learningQuestionN: readNumber(value.learning_question_n),
    simulacroQuestionN: readNumber(value.simulacro_question_n),
    avgSimulacroFatigue: toNullableNumber(value.avg_simulacro_fatigue),
    overconfidenceRate: toNullableNumber(value.overconfidence_rate),
    sampleOk: Boolean(value.sample_ok),
    confidenceFlag:
      (readText(value.confidence_flag) as PracticePressureInsightsV2['confidenceFlag']) ?? 'low',
    recommendedMode: readText(
      value.recommended_mode,
    ) as PracticePressureInsightsV2['recommendedMode'],
    pressureMessage:
      readText(value.pressure_message) ?? 'Todavia hace falta un poco mas para saber como respondes cuando sube la exigencia.',
  };
};
