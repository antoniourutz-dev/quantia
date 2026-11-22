import type { AppLocale } from './locale';
import type {
  PracticeCategoryRiskSummary,
  PracticeLearningDashboardV2,
  PracticeMode,
  PracticeSessionSummary,
  PracticeTopicPerformance,
  SyllabusType,
} from '../types';

export type PracticeModalityKind =
  | 'topics'
  | 'challenge'
  | 'custom'
  | 'review'
  | 'quick_five'
  | 'random'
  | 'standard'
  | 'mixed'
  | 'anti_trap'
  | 'simulacro';

export type TopicAttemptEvolution = {
  topicKey: string;
  scope: SyllabusType | 'unknown';
  attempts: number;
  correct: number;
  recentAccuracy: number | null;
  priorAccuracy: number | null;
  deltaPp: number | null;
  checkpoints: number[];
};

export type ErrorRecoverySummary = {
  totalFailed: number;
  recovered: number;
  recovering: number;
  reincident: number;
};

export type BehaviorTelemetrySummary = {
  longSessionCount: number;
  longSessionFirstHalfAcc: number | null;
  longSessionSecondHalfAcc: number | null;
  longSessionDropPp: number | null;
  timedSampleCount: number;
  avoidableErrorRate: number | null;
  fastErrorRate: number | null;
  changedToWrongRate: number | null;
};

export type ScopedDailyMetrics = Record<
  string,
  {
    common: { questions: number; correct: number };
    specific: { questions: number; correct: number };
  }
>;

export type StatsAttemptTelemetry = {
  topicEvolution: Record<string, TopicAttemptEvolution>;
  errorRecovery: ErrorRecoverySummary;
  scopedDaily: ScopedDailyMetrics;
  behavior: BehaviorTelemetrySummary;
};

export type TelemetryBankItem = {
  id: string;
  number: number | null;
  scope: SyllabusType;
  category?: string | null;
  topic?: string | null;
  dedupeKey?: string | null;
};

export type TelemetryAttemptItem = {
  eventId?: string | null;
  sessionId?: string | null;
  questionId: string | null;
  questionNumber: number | null;
  scope: SyllabusType | null;
  dedupeKey?: string | null;
  answeredAt?: string | null;
  isCorrect: boolean | null;
  responseTimeMs?: number | null;
  changedAnswer?: boolean | null;
  mode?: string | null;
};

export type ModeDistributionItem = {
  kind: PracticeModalityKind;
  label: string;
  sessions: number;
  questions: number;
  correct: number;
  sharePct: number;
  accuracyPct: number | null;
};

export type FocusVsMixedSummary = {
  focusedQuestions: number;
  focusedCorrect: number;
  focusedAccuracy: number | null;
  mixedQuestions: number;
  mixedCorrect: number;
  mixedAccuracy: number | null;
  gapPp: number | null;
  enoughData: boolean;
};

export type EvolutionLens = 'all' | 'common' | 'specific' | 'mixed';
export type EvolutionWindowDays = 7 | 14 | 30;

export type EvolutionPoint = {
  iso: string;
  label: string;
  longLabel: string;
  accuracy: number | null;
  movingAvg: number | null;
  questions: number;
  correct: number;
  sessions: number;
  modesText: string;
};

export type TopicInsightStatus = 'risk' | 'improving' | 'unexplored' | 'solid';

export type TopicInsightItem = {
  id: string;
  label: string;
  scope: SyllabusType;
  questionCount: number;
  seenCount: number;
  unseenCount: number;
  coveragePct: number;
  attempts: number;
  accuracyPct: number | null;
  deltaPp: number | null;
  checkpoints: number[];
  fragileCount: number;
  consolidatingCount: number;
  solidCount: number;
  masteredCount: number;
  excessRiskPct: number | null;
  status: TopicInsightStatus;
};

export type SyllabusSummaryItem = {
  scope: SyllabusType;
  totalQuestions: number;
  seenQuestions: number;
  coveragePct: number;
  accuracyPct: number | null;
  deltaPp: number | null;
  fragileCount: number;
  consolidatingCount: number;
  solidCount: number;
  masteredCount: number;
  unseenCount: number;
  topicCount: number;
  riskTopicCount: number;
};

export const normalizeTopicKey = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const toLocalDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseTimestampMs = (raw: string | null | undefined) => {
  if (!raw) return null;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : null;
};

export const classifyPracticeSessionKind = (
  session: Pick<PracticeSessionSummary, 'mode' | 'title'>,
): PracticeModalityKind => {
  const title = normalizeTopicKey(session.title);
  if (title.startsWith('temas') || title.startsWith('gaiak')) return 'topics';
  if (title.startsWith('desafío') || title.startsWith('desafio') || title.startsWith('erronka')) {
    return 'challenge';
  }
  const mode: PracticeMode = session.mode;
  if (mode === 'weakest') return 'review';
  return mode;
};

export const formatModalityKindLabel = (kind: PracticeModalityKind, locale: AppLocale = 'es') => {
  const eu = locale === 'eu';
  switch (kind) {
    case 'topics':
      return eu ? 'Gaiak (fokua)' : 'Temas (en foco)';
    case 'challenge':
      return eu ? 'Erronka' : 'Desafío';
    case 'custom':
      return eu ? 'Zure neurrira' : 'A tu medida';
    case 'review':
      return eu ? 'Akatsak zuzendu' : 'Corregir fallos';
    case 'quick_five':
      return eu ? 'Bloke laburra' : 'Bloque corto';
    case 'simulacro':
      return eu ? 'Simulakroa' : 'Simulacro';
    case 'anti_trap':
      return eu ? 'Tranpa-kontra' : 'Anti-trampas';
    case 'mixed':
      return eu ? 'Egokitzailea' : 'Adaptativo';
    case 'random':
      return eu ? 'Ausazkoa' : 'Aleatorio';
    case 'standard':
    default:
      return eu ? 'Temario testa' : 'Test por temario';
  }
};

export const isMixedOrLongSession = (session: PracticeSessionSummary) => {
  const kind = classifyPracticeSessionKind(session);
  if (kind === 'challenge' || kind === 'simulacro' || kind === 'mixed' || kind === 'anti_trap' || kind === 'random') {
    return true;
  }
  if (kind === 'topics' || kind === 'quick_five' || kind === 'review') return false;
  const title = normalizeTopicKey(session.title);
  if (title.includes('mixto') || title.includes('mistoa') || title.includes('comun + especifico')) {
    return true;
  }
  if (kind === 'custom') {
    const hasSingleTopic = title.includes('·') && !title.includes('•');
    return !hasSingleTopic && session.total >= 25;
  }
  return session.total >= 40;
};

export const buildModeDistribution = (
  sessions: PracticeSessionSummary[],
  locale: AppLocale = 'es',
): ModeDistributionItem[] => {
  const buckets = new Map<PracticeModalityKind, { sessions: number; questions: number; correct: number }>();
  let grandTotal = 0;

  for (const session of sessions) {
    const total = Math.max(0, Number(session.total) || 0);
    if (total <= 0) continue;
    const correct = Math.max(0, Math.min(total, Number(session.score) || 0));
    const kind = classifyPracticeSessionKind(session);
    const current = buckets.get(kind) ?? { sessions: 0, questions: 0, correct: 0 };
    current.sessions += 1;
    current.questions += total;
    current.correct += correct;
    buckets.set(kind, current);
    grandTotal += total;
  }

  return [...buckets.entries()]
    .map(([kind, stats]) => ({
      kind,
      label: formatModalityKindLabel(kind, locale),
      sessions: stats.sessions,
      questions: stats.questions,
      correct: stats.correct,
      sharePct: grandTotal > 0 ? Math.round((stats.questions / grandTotal) * 100) : 0,
      accuracyPct: stats.questions > 0 ? Math.round((stats.correct / stats.questions) * 100) : null,
    }))
    .sort((a, b) => b.questions - a.questions || b.sessions - a.sessions);
};

export const buildFocusVsMixedSummary = (
  sessions: PracticeSessionSummary[],
): FocusVsMixedSummary => {
  let focusedQuestions = 0;
  let focusedCorrect = 0;
  let mixedQuestions = 0;
  let mixedCorrect = 0;

  for (const session of sessions) {
    const total = Math.max(0, Number(session.total) || 0);
    if (total <= 0) continue;
    const correct = Math.max(0, Math.min(total, Number(session.score) || 0));
    if (isMixedOrLongSession(session)) {
      mixedQuestions += total;
      mixedCorrect += correct;
    } else {
      focusedQuestions += total;
      focusedCorrect += correct;
    }
  }

  const focusedAccuracy =
    focusedQuestions > 0 ? Math.round((focusedCorrect / focusedQuestions) * 100) : null;
  const mixedAccuracy =
    mixedQuestions > 0 ? Math.round((mixedCorrect / mixedQuestions) * 100) : null;
  const enoughData = focusedQuestions >= 20 && mixedQuestions >= 20;
  const gapPp =
    focusedAccuracy != null && mixedAccuracy != null ? mixedAccuracy - focusedAccuracy : null;

  return {
    focusedQuestions,
    focusedCorrect,
    focusedAccuracy,
    mixedQuestions,
    mixedCorrect,
    mixedAccuracy,
    gapPp,
    enoughData,
  };
};

export const buildStatsAttemptTelemetry = (
  bank: TelemetryBankItem[],
  attempts: TelemetryAttemptItem[],
  resolveCategoryLabel?: (category: string | null | undefined) => string | null,
): StatsAttemptTelemetry => {
  const bankById = new Map<string, TelemetryBankItem>();
  const bankByDedupeKey = new Map<string, TelemetryBankItem>();
  const bankByScopeNumber = new Map<string, TelemetryBankItem>();

  for (const item of bank) {
    if (item.id) bankById.set(item.id, item);
    if (item.dedupeKey) bankByDedupeKey.set(item.dedupeKey, item);
    if (item.number != null && item.number > 0) {
      const key = `${item.scope}:${item.number}`;
      if (!bankByScopeNumber.has(key)) bankByScopeNumber.set(key, item);
    }
  }

  const dedupedByEvent = new Map<string, TelemetryAttemptItem>();
  const withoutEventId: TelemetryAttemptItem[] = [];
  for (const attempt of attempts) {
    if (attempt.isCorrect == null) continue;
    if (!attempt.eventId) {
      withoutEventId.push(attempt);
      continue;
    }
    const existing = dedupedByEvent.get(attempt.eventId);
    if (!existing) dedupedByEvent.set(attempt.eventId, attempt);
  }
  const cleanAttempts = [...dedupedByEvent.values(), ...withoutEventId];

  const byQuestion = new Map<string, Array<{ ts: number; isCorrect: boolean }>>();
  const byTopic = new Map<
    string,
    { scope: SyllabusType | 'unknown'; events: Array<{ ts: number; isCorrect: boolean }> }
  >();
  const bySession = new Map<string, Array<{ ts: number; isCorrect: boolean }>>();
  const scopedDaily: ScopedDailyMetrics = {};

  let timedSampleCount = 0;
  let incorrectCount = 0;
  let fastIncorrectCount = 0;
  let changedIncorrectCount = 0;
  let avoidableIncorrectCount = 0;

  for (let idx = 0; idx < cleanAttempts.length; idx += 1) {
    const attempt = cleanAttempts[idx];
    if (attempt.isCorrect == null) continue;
    const matched =
      (attempt.questionId ? bankById.get(attempt.questionId) : undefined) ??
      (attempt.dedupeKey ? bankByDedupeKey.get(attempt.dedupeKey) : undefined) ??
      (attempt.scope && attempt.questionNumber != null
        ? bankByScopeNumber.get(`${attempt.scope}:${attempt.questionNumber}`)
        : undefined);

    const scope: SyllabusType | 'unknown' = matched?.scope ?? attempt.scope ?? 'unknown';
    const ts = parseTimestampMs(attempt.answeredAt) ?? idx;
    const questionKey = matched?.id ?? attempt.questionId ?? attempt.dedupeKey ?? '';

    if (questionKey) {
      const qList = byQuestion.get(questionKey) ?? [];
      qList.push({ ts, isCorrect: attempt.isCorrect });
      byQuestion.set(questionKey, qList);
    }

    const rawCategory = matched?.category ?? matched?.topic ?? null;
    const displayLabel = resolveCategoryLabel ? resolveCategoryLabel(rawCategory) : rawCategory;
    const topicKey = normalizeTopicKey(displayLabel ?? rawCategory);
    if (topicKey) {
      const tGroup = byTopic.get(topicKey) ?? { scope, events: [] };
      if (tGroup.scope === 'unknown' && scope !== 'unknown') tGroup.scope = scope;
      tGroup.events.push({ ts, isCorrect: attempt.isCorrect });
      byTopic.set(topicKey, tGroup);
    }

    const answeredMs = parseTimestampMs(attempt.answeredAt);
    if (answeredMs != null && (scope === 'common' || scope === 'specific')) {
      const dayKey = toLocalDayKey(new Date(answeredMs));
      const dayBucket = scopedDaily[dayKey] ?? {
        common: { questions: 0, correct: 0 },
        specific: { questions: 0, correct: 0 },
      };
      dayBucket[scope].questions += 1;
      if (attempt.isCorrect) dayBucket[scope].correct += 1;
      scopedDaily[dayKey] = dayBucket;
    }

    if (attempt.sessionId) {
      const sList = bySession.get(attempt.sessionId) ?? [];
      sList.push({ ts, isCorrect: attempt.isCorrect });
      bySession.set(attempt.sessionId, sList);
    }

    if (attempt.responseTimeMs != null || attempt.changedAnswer != null) {
      timedSampleCount += 1;
      if (!attempt.isCorrect) {
        incorrectCount += 1;
        const isFast = attempt.responseTimeMs != null && attempt.responseTimeMs > 0 && attempt.responseTimeMs <= 2500;
        const isChanged = Boolean(attempt.changedAnswer);
        if (isFast) fastIncorrectCount += 1;
        if (isChanged) changedIncorrectCount += 1;
        if (isFast || isChanged) avoidableIncorrectCount += 1;
      }
    }
  }

  // Topic evolution
  const topicEvolution: Record<string, TopicAttemptEvolution> = {};
  for (const [topicKey, group] of byTopic.entries()) {
    const sorted = [...group.events].sort((a, b) => a.ts - b.ts);
    const total = sorted.length;
    const correct = sorted.filter((item) => item.isCorrect).length;

    let priorAccuracy: number | null = null;
    let recentAccuracy: number | null = null;
    let deltaPp: number | null = null;

    if (total >= 6) {
      const split = Math.max(3, Math.floor(total / 2));
      const priorSlice = sorted.slice(0, split);
      const recentSlice = sorted.slice(split);
      if (priorSlice.length >= 3 && recentSlice.length >= 3) {
        priorAccuracy = Math.round(
          (priorSlice.filter((item) => item.isCorrect).length / priorSlice.length) * 100,
        );
        recentAccuracy = Math.round(
          (recentSlice.filter((item) => item.isCorrect).length / recentSlice.length) * 100,
        );
        deltaPp = recentAccuracy - priorAccuracy;
      }
    }

    // Build up to 6 chronological checkpoint buckets for sparklines
    const checkpoints: number[] = [];
    if (total >= 4) {
      const bucketCount = Math.min(6, Math.max(2, Math.floor(total / 2)));
      for (let b = 0; b < bucketCount; b += 1) {
        const start = Math.floor((b * total) / bucketCount);
        const end = Math.floor(((b + 1) * total) / bucketCount);
        const slice = sorted.slice(start, Math.max(start + 1, end));
        checkpoints.push(
          Math.round((slice.filter((item) => item.isCorrect).length / slice.length) * 100),
        );
      }
    }

    topicEvolution[`${group.scope}:${topicKey}`] = {
      topicKey,
      scope: group.scope,
      attempts: total,
      correct,
      recentAccuracy,
      priorAccuracy,
      deltaPp,
      checkpoints,
    };
    if (!topicEvolution[topicKey]) {
      topicEvolution[topicKey] = topicEvolution[`${group.scope}:${topicKey}`];
    }
  }

  // Error recovery funnel
  const errorRecovery: ErrorRecoverySummary = {
    totalFailed: 0,
    recovered: 0,
    recovering: 0,
    reincident: 0,
  };
  for (const events of byQuestion.values()) {
    const sorted = [...events].sort((a, b) => a.ts - b.ts);
    const hadError = sorted.some((item) => !item.isCorrect);
    if (!hadError) continue;
    errorRecovery.totalFailed += 1;
    const last = sorted[sorted.length - 1];
    const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    if (!last.isCorrect) {
      errorRecovery.reincident += 1;
    } else if (prev?.isCorrect || sorted.filter((item) => item.isCorrect).length > sorted.filter((item) => !item.isCorrect).length) {
      errorRecovery.recovered += 1;
    } else {
      errorRecovery.recovering += 1;
    }
  }

  // Long session fatigue (>= 25 questions)
  let longSessionCount = 0;
  let firstHalfSum = 0;
  let firstHalfTotal = 0;
  let secondHalfSum = 0;
  let secondHalfTotal = 0;

  for (const events of bySession.values()) {
    if (events.length < 25) continue;
    longSessionCount += 1;
    const sorted = [...events].sort((a, b) => a.ts - b.ts);
    const half = Math.ceil(sorted.length / 2);
    const first = sorted.slice(0, half);
    const second = sorted.slice(half);
    firstHalfTotal += first.length;
    firstHalfSum += first.filter((item) => item.isCorrect).length;
    secondHalfTotal += second.length;
    secondHalfSum += second.filter((item) => item.isCorrect).length;
  }

  const longSessionFirstHalfAcc =
    firstHalfTotal > 0 ? Math.round((firstHalfSum / firstHalfTotal) * 100) : null;
  const longSessionSecondHalfAcc =
    secondHalfTotal > 0 ? Math.round((secondHalfSum / secondHalfTotal) * 100) : null;
  const longSessionDropPp =
    longSessionFirstHalfAcc != null && longSessionSecondHalfAcc != null
      ? longSessionSecondHalfAcc - longSessionFirstHalfAcc
      : null;

  const avoidableErrorRate =
    incorrectCount >= 5 ? Math.round((avoidableIncorrectCount / incorrectCount) * 100) : null;
  const fastErrorRate =
    incorrectCount >= 5 ? Math.round((fastIncorrectCount / incorrectCount) * 100) : null;
  const changedToWrongRate =
    incorrectCount >= 5 ? Math.round((changedIncorrectCount / incorrectCount) * 100) : null;

  return {
    topicEvolution,
    errorRecovery,
    scopedDaily,
    behavior: {
      longSessionCount,
      longSessionFirstHalfAcc,
      longSessionSecondHalfAcc,
      longSessionDropPp,
      timedSampleCount,
      avoidableErrorRate,
      fastErrorRate,
      changedToWrongRate,
    },
  };
};

export const buildEvolutionChartData = (params: {
  sessions: PracticeSessionSummary[];
  scopedDaily?: ScopedDailyMetrics | null;
  windowDays: EvolutionWindowDays;
  lens: EvolutionLens;
  locale: AppLocale;
  referenceDate?: Date;
}): {
  points: EvolutionPoint[];
  deltaPp: number | null;
  activeDays: number;
  totalQuestions: number;
} => {
  const { sessions, scopedDaily, windowDays, lens, locale, referenceDate = new Date() } = params;
  const intlLocale = locale === 'eu' ? 'eu-ES' : 'es-ES';
  const shortFormatter = new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'short' });
  const longFormatter = new Intl.DateTimeFormat(intlLocale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  const dayMap = new Map<
    string,
    { questions: number; correct: number; sessions: number; modes: Set<string> }
  >();

  if ((lens === 'common' || lens === 'specific') && scopedDaily && Object.keys(scopedDaily).length > 0) {
    for (const [iso, bucket] of Object.entries(scopedDaily)) {
      const target = bucket[lens];
      if (!target || target.questions <= 0) continue;
      dayMap.set(iso, {
        questions: target.questions,
        correct: target.correct,
        sessions: 1,
        modes: new Set([lens === 'common' ? (locale === 'eu' ? 'Orokorra' : 'Común') : (locale === 'eu' ? 'Espezifikoa' : 'Específico')]),
      });
    }
  } else {
    for (const session of sessions) {
      if (lens === 'mixed' && !isMixedOrLongSession(session)) continue;
      const rawDate = session.finishedAt || session.startedAt;
      const ts = parseTimestampMs(rawDate);
      if (ts == null) continue;
      const iso = toLocalDayKey(new Date(ts));
      const total = Math.max(0, Number(session.total) || 0);
      if (total <= 0) continue;
      const correct = Math.max(0, Math.min(total, Number(session.score) || 0));
      const current = dayMap.get(iso) ?? { questions: 0, correct: 0, sessions: 0, modes: new Set<string>() };
      current.questions += total;
      current.correct += correct;
      current.sessions += 1;
      current.modes.add(formatModalityKindLabel(classifyPracticeSessionKind(session), locale));
      dayMap.set(iso, current);
    }
  }

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const totalLookback = windowDays * 2;
  const extendedRows: EvolutionPoint[] = [];

  for (let offset = totalLookback - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const iso = toLocalDayKey(date);
    const bucket = dayMap.get(iso);
    const questions = bucket?.questions ?? 0;
    const correct = bucket?.correct ?? 0;
    const accuracy = questions > 0 ? Math.round((correct / questions) * 100) : null;
    extendedRows.push({
      iso,
      label: shortFormatter.format(date),
      longLabel: longFormatter.format(date),
      accuracy,
      movingAvg: null,
      questions,
      correct,
      sessions: bucket?.sessions ?? 0,
      modesText: bucket ? [...bucket.modes].slice(0, 2).join(' · ') : (locale === 'eu' ? 'Jarduerarik gabe' : 'Sin actividad'),
    });
  }

  // Rolling 7-day weighted moving average
  for (let idx = 0; idx < extendedRows.length; idx += 1) {
    if (extendedRows[idx].questions <= 0) continue;
    const slice = extendedRows.slice(Math.max(0, idx - 6), idx + 1);
    const qSum = slice.reduce((sum, item) => sum + item.questions, 0);
    const cSum = slice.reduce((sum, item) => sum + item.correct, 0);
    extendedRows[idx].movingAvg = qSum > 0 ? Math.round((cSum / qSum) * 100) : null;
  }

  const priorSlice = extendedRows.slice(0, windowDays);
  const currentSlice = extendedRows.slice(windowDays);

  const priorQ = priorSlice.reduce((sum, item) => sum + item.questions, 0);
  const priorC = priorSlice.reduce((sum, item) => sum + item.correct, 0);
  const currentQ = currentSlice.reduce((sum, item) => sum + item.questions, 0);
  const currentC = currentSlice.reduce((sum, item) => sum + item.correct, 0);

  const deltaPp =
    priorQ >= 15 && currentQ >= 15
      ? Math.round((currentC / currentQ) * 100 - (priorC / priorQ) * 100)
      : null;

  return {
    points: currentSlice,
    deltaPp,
    activeDays: currentSlice.filter((item) => item.questions > 0).length,
    totalQuestions: currentQ,
  };
};

export const mergeTopicInsights = (params: {
  topicBreakdown: PracticeTopicPerformance[];
  weakCategories: PracticeCategoryRiskSummary[];
  telemetry?: StatsAttemptTelemetry | null;
  resolveLabel?: (raw: string | null | undefined) => string | null;
}): TopicInsightItem[] => {
  const { topicBreakdown, weakCategories, telemetry, resolveLabel } = params;
  const riskByKey = new Map<string, PracticeCategoryRiskSummary>();
  for (const item of weakCategories) {
    const resolved = resolveLabel?.(item.category) ?? item.category;
    const key = normalizeTopicKey(resolved);
    if (key && !riskByKey.has(key)) riskByKey.set(key, item);
  }

  const merged = new Map<string, TopicInsightItem>();

  for (const topic of topicBreakdown) {
    const scope: SyllabusType = topic.scope === 'specific' ? 'specific' : 'common';
    const label = (resolveLabel?.(topic.topicLabel) ?? topic.topicLabel).trim();
    if (!label) continue;
    const key = `${scope}:${normalizeTopicKey(label)}`;
    const questionCount = Math.max(0, topic.questionCount ?? 0);
    const unseenCount = Math.max(0, Math.min(questionCount, topic.unseenCount ?? 0));
    const seenCount = Math.max(0, questionCount - unseenCount);
    const coveragePct = questionCount > 0 ? Math.round((seenCount / questionCount) * 100) : 0;

    const evo =
      telemetry?.topicEvolution[`${scope}:${normalizeTopicKey(label)}`] ??
      telemetry?.topicEvolution[normalizeTopicKey(label)] ??
      null;

    const attempts = Math.max(topic.attempts ?? 0, evo?.attempts ?? 0);
    const accuracyPct =
      attempts > 0
        ? Math.round((topic.accuracyRate ?? (evo ? evo.correct / Math.max(1, evo.attempts) : 0)) * 100)
        : null;
    const riskItem = riskByKey.get(normalizeTopicKey(label));
    const excessRiskPct =
      typeof riskItem?.excessRisk === 'number' && Number.isFinite(riskItem.excessRisk)
        ? Math.max(0, Math.round(riskItem.excessRisk * 100))
        : null;

    const fragileCount = topic.fragileCount ?? 0;
    const consolidatingCount = topic.consolidatingCount ?? 0;
    const solidCount = topic.solidCount ?? 0;
    const masteredCount = topic.masteredCount ?? 0;
    const deltaPp = evo?.deltaPp ?? null;

    let status: TopicInsightStatus = 'solid';
    if (coveragePct < 30 || seenCount === 0) {
      status = 'unexplored';
    } else if (
      (accuracyPct != null && accuracyPct < 65) ||
      (excessRiskPct != null && excessRiskPct >= 12) ||
      (deltaPp != null && deltaPp <= -5) ||
      fragileCount >= Math.max(5, Math.round(seenCount * 0.25))
    ) {
      status = 'risk';
    } else if (deltaPp != null && deltaPp >= 5) {
      status = 'improving';
    }

    merged.set(key, {
      id: key,
      label,
      scope,
      questionCount,
      seenCount,
      unseenCount,
      coveragePct,
      attempts,
      accuracyPct,
      deltaPp,
      checkpoints: evo?.checkpoints ?? [],
      fragileCount,
      consolidatingCount,
      solidCount,
      masteredCount,
      excessRiskPct,
      status,
    });
  }

  return [...merged.values()].sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'common' ? -1 : 1;
    return a.label.localeCompare(b.label, 'es', { numeric: true });
  });
};

export const buildSyllabusSummaries = (
  topics: TopicInsightItem[],
  learningV2: PracticeLearningDashboardV2 | null,
  scopedDaily?: ScopedDailyMetrics | null,
): SyllabusSummaryItem[] => {
  const scopes: SyllabusType[] = ['common', 'specific'];
  const now = new Date();
  const msDay = 24 * 60 * 60 * 1000;

  return scopes
    .map((scope) => {
      const items = topics.filter((item) => item.scope === scope);
      if (items.length === 0) return null;

      const totalQuestions = items.reduce((sum, item) => sum + item.questionCount, 0);
      const seenQuestions = items.reduce((sum, item) => sum + item.seenCount, 0);
      const unseenCount = items.reduce((sum, item) => sum + item.unseenCount, 0);
      const fragileCount = items.reduce((sum, item) => sum + item.fragileCount, 0);
      const consolidatingCount = items.reduce((sum, item) => sum + item.consolidatingCount, 0);
      const solidCount = items.reduce((sum, item) => sum + item.solidCount, 0);
      const masteredCount = items.reduce((sum, item) => sum + item.masteredCount, 0);

      const weightedAttempts = items.reduce((sum, item) => sum + item.attempts, 0);
      const weightedCorrect = items.reduce(
        (sum, item) => sum + ((item.accuracyPct ?? 0) / 100) * item.attempts,
        0,
      );
      const accuracyPct =
        weightedAttempts > 0
          ? Math.round((weightedCorrect / weightedAttempts) * 100)
          : learningV2 && items.length === topics.length
            ? Math.round((learningV2.observedAccuracyRate ?? 0) * 100)
            : null;

      let deltaPp: number | null = null;
      if (scopedDaily) {
        let recentQ = 0;
        let recentC = 0;
        let priorQ = 0;
        let priorC = 0;
        for (const [iso, bucket] of Object.entries(scopedDaily)) {
          const ts = parseTimestampMs(iso);
          if (ts == null) continue;
          const ageDays = Math.floor((now.getTime() - ts) / msDay);
          const target = bucket[scope];
          if (ageDays >= 0 && ageDays < 14) {
            recentQ += target.questions;
            recentC += target.correct;
          } else if (ageDays >= 14 && ageDays < 28) {
            priorQ += target.questions;
            priorC += target.correct;
          }
        }
        if (recentQ >= 12 && priorQ >= 12) {
          deltaPp = Math.round((recentC / recentQ) * 100 - (priorC / priorQ) * 100);
        }
      }

      return {
        scope,
        totalQuestions,
        seenQuestions,
        coveragePct: totalQuestions > 0 ? Math.round((seenQuestions / totalQuestions) * 100) : 0,
        accuracyPct,
        deltaPp,
        fragileCount,
        consolidatingCount,
        solidCount,
        masteredCount,
        unseenCount,
        topicCount: items.length,
        riskTopicCount: items.filter((item) => item.status === 'risk').length,
      };
    })
    .filter((item): item is SyllabusSummaryItem => item !== null);
};
