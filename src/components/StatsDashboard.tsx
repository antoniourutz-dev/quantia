import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flame,
  Grid,
  Layers,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type {
  ExecutableSessionPlan,
  PracticeSessionSummary,
  SyllabusType,
  TestResult,
} from '../types';
import { formatModeLabel, formatSyllabusLabel } from '../types';
import type { DashboardBundle } from '../lib/quantiaApi';
import { getCurriculumCategoryGroupLabel } from '../lib/quantiaApi';
import type { CoachPlanV2 } from '../lib/coach';
import {
  calculateActiveDayStreak,
  calculateWeightedAccuracy,
} from '../lib/practiceStatistics';
import {
  buildCoachCopySeed,
  buildVisibleStatusLabel,
  getSurfaceCopy,
  resolveCoachSurfaceState,
} from '../lib/coachCopyV2';
import {
  formatLongDate,
  formatMonthYear,
  getCalendarWeekdayLabels,
  isLawSelectionCurriculum,
  isSingleScopeCurriculum,
  useAppLocale,
} from '../lib/locale';
import {
  rankQuestionPerformance,
  type QuestionRankingSort,
} from '../lib/questionBlockStats';
import {
  buildEvolutionChartData,
  buildFocusVsMixedSummary,
  buildModeDistribution,
  buildSyllabusSummaries,
  classifyPracticeSessionKind,
  formatModalityKindLabel,
  mergeTopicInsights,
  type EvolutionLens,
  type EvolutionWindowDays,
  type TopicInsightItem,
} from '../lib/statsInsights';

interface StatsDashboardProps {
  results: TestResult[];
  bundle: DashboardBundle | null;
  curriculum: string;
  coachPlan?: CoachPlanV2 | null;
  executablePlan?: ExecutableSessionPlan | null;
  hydrating?: boolean;
  telemetryError?: string | null;
  onRetryTelemetry?: () => void;
  onStartRecommended?: () => void;
  onPracticeTopic?: (topicLabel: string, scope: SyllabusType) => void;
  onPracticeBlock?: (start: number, end: number, scope: SyllabusType) => void;
  onPracticeReviewMistakes?: () => void;
  onPracticeMixed?: () => void;
  onPracticeLaw?: (lawReference: string) => void;
}

type TopicStatusFilter = 'all' | 'risk' | 'improving' | 'unexplored';
type TopicDisplayView = 'list' | 'matrix' | 'laws';

const parseIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, Math.max(0, m - 1), d);
};

const toIsoDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function TopicSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <span className="text-xs font-bold text-slate-400">—</span>;
  }
  const width = 68;
  const height = 22;
  const pad = 3;
  const min = Math.min(...values, 40);
  const max = Math.max(...values, 95);
  const span = Math.max(10, max - min);
  const points = values.map((val, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (val - min) / span) * (height - pad * 2);
    return { x, y };
  });
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const firstVal = values[0];
  const lastVal = values[values.length - 1];

  return (
    <span className="inline-flex items-center">
      <svg width={width} height={height} className="overflow-visible shrink-0" aria-hidden="true">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline}
        />
        <circle cx={last.x} cy={last.y} r={2.8} fill={color} />
      </svg>
      <span className="sr-only">
        {firstVal}% → {lastVal}%
      </span>
    </span>
  );
}

export default function StatsDashboard({
  results,
  bundle,
  curriculum,
  coachPlan = null,
  executablePlan = null,
  hydrating = false,
  telemetryError = null,
  onRetryTelemetry,
  onStartRecommended,
  onPracticeTopic,
  onPracticeBlock,
  onPracticeReviewMistakes,
  onPracticeMixed,
  onPracticeLaw,
}: StatsDashboardProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = useCallback((es: string, eu: string) => (isBasque ? eu : es), [isBasque]);

  const singleScope = isSingleScopeCurriculum(curriculum);
  const lawCurriculum = isLawSelectionCurriculum(curriculum);

  const learningV2 = bundle?.practiceState.learningDashboardV2 ?? null;
  const pressureV2 = bundle?.practiceState.pressureInsightsV2 ?? null;
  const examTarget = bundle?.practiceState.examTarget ?? null;
  const weakCategories = bundle?.weakCategories ?? [];
  const questionBlocks = bundle?.questionBlocks ?? [];
  const statsTelemetry = bundle?.statsTelemetry ?? null;

  // Fallback synthetic PracticeSessionSummary[] from `results` if recentSessions is absent in tests
  const sessions = useMemo<PracticeSessionSummary[]>(() => {
    const recent = bundle?.practiceState.recentSessions ?? [];
    if (recent.length > 0) return recent;
    return results.map((item) => ({
      id: item.id,
      mode: item.mode,
      title: item.label,
      startedAt: `${item.date}T10:00:00.000Z`,
      finishedAt: `${item.date}T10:15:00.000Z`,
      score: item.score,
      total: item.total,
    }));
  }, [bundle?.practiceState.recentSessions, results]);

  // Interactive UI State
  const [evolutionWindow, setEvolutionWindow] = useState<EvolutionWindowDays>(14);
  const [evolutionLens, setEvolutionLens] = useState<EvolutionLens>('all');
  const [pinnedEvolutionDate, setPinnedEvolutionDate] = useState<string | null>(null);

  const [topicScopeFilter, setTopicScopeFilter] = useState<'all' | SyllabusType>('all');
  const [topicStatusFilter, setTopicStatusFilter] = useState<TopicStatusFilter>('all');
  const [topicView, setTopicView] = useState<TopicDisplayView>('list');

  // IMPORTANT: Topic groups and individual topics start collapsed by default to avoid long scrolling
  const [expandedScopes, setExpandedScopes] = useState<Record<string, boolean>>({});
  const [expandedTopicIds, setExpandedTopicIds] = useState<Record<string, boolean>>({});
  const [expandedLawIds, setExpandedLawIds] = useState<Record<string, boolean>>({});
  const [selectedMatrixTopicId, setSelectedMatrixTopicId] = useState<string | null>(null);

  // Question blocks explorer starts collapsed by default to keep initial height compact
  const [blocksExpanded, setBlocksExpanded] = useState(false);
  const [blockScope, setBlockScope] = useState<'common' | 'specific'>('common');
  const [selectedBlockStart, setSelectedBlockStart] = useState<number | null>(null);
  const [questionStatsView, setQuestionStatsView] = useState<'blocks' | 'ranking'>('blocks');
  const [questionRankingSort, setQuestionRankingSort] = useState<QuestionRankingSort>('most_viewed');

  const availableBlockScopes = useMemo(() => {
    const set = new Set<SyllabusType>();
    for (const block of questionBlocks) set.add(block.scope);
    return Array.from(set);
  }, [questionBlocks]);

  const effectiveEvolutionLens: EvolutionLens =
    (singleScope || lawCurriculum) && (evolutionLens === 'common' || evolutionLens === 'specific')
      ? 'all'
      : evolutionLens;
  const effectiveTopicScope: 'all' | SyllabusType =
    singleScope || lawCurriculum ? 'all' : topicScopeFilter;
  const effectiveBlockScope: SyllabusType =
    availableBlockScopes.length === 0
      ? blockScope
      : availableBlockScopes.includes(blockScope)
        ? blockScope
        : availableBlockScopes[0];

  // Core KPIs
  const readiness = Math.round((learningV2?.examReadinessRate ?? 0) * 100);
  const readinessCiLow =
    learningV2?.examReadinessCiLow != null ? Math.round(learningV2.examReadinessCiLow * 100) : null;
  const readinessCiHigh =
    learningV2?.examReadinessCiHigh != null ? Math.round(learningV2.examReadinessCiHigh * 100) : null;
  const readinessConfidence = learningV2?.examReadinessConfidenceFlag ?? 'low';

  const historyAccuracy = useMemo(() => calculateWeightedAccuracy(results), [results]);
  const historyQuestionCount = useMemo(
    () => results.reduce((sum, result) => sum + result.total, 0),
    [results],
  );
  const observedAccuracy = Math.round(
    historyAccuracy ?? (learningV2?.observedAccuracyRate ?? 0) * 100,
  );

  const weeklyQuestions = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startLast7 = new Date(startToday);
    startLast7.setDate(startLast7.getDate() - 6);

    let total = 0;
    for (const sessionSummary of sessions) {
      const rawDate = sessionSummary.finishedAt || sessionSummary.startedAt;
      const sessionDate = rawDate ? new Date(rawDate) : null;
      if (!sessionDate || Number.isNaN(sessionDate.getTime())) continue;
      const dayStart = new Date(sessionDate);
      dayStart.setHours(0, 0, 0, 0);
      if (dayStart >= startLast7 && dayStart <= startToday) {
        total += sessionSummary.total;
      }
    }
    return total;
  }, [sessions]);

  const activeDayStreak = useMemo(() => {
    const dayKeys = results.map((item) => item.date).filter(Boolean);
    return calculateActiveDayStreak(dayKeys);
  }, [results]);

  const daysToExam = useMemo(() => {
    const raw = examTarget?.examDate ?? bundle?.practiceState.learningDashboard?.examDate ?? null;
    if (!raw) return null;
    const exam = new Date(raw);
    if (Number.isNaN(exam.getTime())) return null;
    return Math.max(0, Math.ceil((exam.getTime() - Date.now()) / 86_400_000));
  }, [bundle?.practiceState.learningDashboard?.examDate, examTarget?.examDate]);

  const readinessStateLabel = buildVisibleStatusLabel({
    locale,
    readiness,
    backlogOverdueCount: learningV2?.backlogOverdueCount ?? 0,
    weeklyQuestions,
    observedOk:
      historyQuestionCount >= 30 ||
      Boolean(learningV2?.observedAccuracySampleOk) ||
      Boolean(pressureV2?.sampleOk),
    observedAccuracy,
    pressureGapPct:
      pressureV2?.pressureGapRaw == null ? null : Math.round(pressureV2.pressureGapRaw * 100),
  });

  const coverage = Math.round((learningV2?.coverageRate ?? 0) * 100);
  const recommendedCount = learningV2?.recommendedTodayCount ?? 0;
  const recommendedPracticeMode =
    executablePlan?.mode ?? learningV2?.recommendedMode ?? 'standard';
  const coachSeedKey = executablePlan?.primaryAction ?? learningV2?.recommendedMode ?? 'standard';
  const recommendedModeLabel = formatModeLabel(recommendedPracticeMode, locale);

  const coachSurfaceState = useMemo(
    () => resolveCoachSurfaceState(coachPlan, bundle),
    [bundle, coachPlan],
  );

  const coachCopySeed = useMemo(
    () =>
      buildCoachCopySeed({
        curriculum,
        username: bundle?.identity.current_username,
        state: coachSurfaceState,
        extra: `stats:${coachSeedKey}`,
      }),
    [bundle?.identity.current_username, coachSeedKey, coachSurfaceState, curriculum],
  );

  const statsCopy = useMemo(
    () =>
      getSurfaceCopy({
        state: coachSurfaceState,
        surface: 'statsSummary',
        locale,
        seed: `${coachCopySeed}:summary`,
      }),
    [coachCopySeed, coachSurfaceState, locale],
  );

  const actionCopy = useMemo(
    () =>
      getSurfaceCopy({
        state: coachSurfaceState,
        surface: 'homeCard',
        locale,
        seed: `${coachCopySeed}:action`,
      }),
    [coachCopySeed, coachSurfaceState, locale],
  );

  const actionSummary = [statsCopy.line1, statsCopy.line2].filter(Boolean).join(' ');

  // Memory DNA breakdown (prefer attempt-based telemetry when present so high-accuracy practice is not misclassified as fragile)
  const memorySummary = useMemo(() => {
    const telemetryMem = statsTelemetry?.memorySummary;
    const telemetrySeen = telemetryMem
      ? telemetryMem.mastered + telemetryMem.solid + telemetryMem.consolidating + telemetryMem.fragile
      : 0;

    const totalQ = Math.max(
      learningV2?.totalQuestions ?? 0,
      bundle?.questionsCount ?? 0,
      telemetryMem?.totalQuestions ?? 0,
    );

    const mastered = telemetrySeen > 0 ? telemetryMem!.mastered : (learningV2?.masteredCount ?? 0);
    const solid = telemetrySeen > 0 ? telemetryMem!.solid : (learningV2?.solidCount ?? 0);
    const consolidating =
      telemetrySeen > 0 ? telemetryMem!.consolidating : (learningV2?.consolidatingCount ?? 0);
    const fragile = telemetrySeen > 0 ? telemetryMem!.fragile : (learningV2?.fragileCount ?? 0);
    const seen =
      telemetrySeen > 0
        ? telemetrySeen
        : Math.max(learningV2?.seenQuestions ?? 0, mastered + solid + consolidating + fragile);
    const unseen = Math.max(0, totalQ - seen);
    const tracked = Math.max(1, totalQ || seen);
    return {
      totalQ,
      mastered,
      solid,
      consolidating,
      fragile,
      unseen,
      tracked,
    };
  }, [bundle?.questionsCount, learningV2, statsTelemetry?.memorySummary]);

  // Topic & Syllabus Insights
  const topicInsights = useMemo(
    () =>
      mergeTopicInsights({
        topicBreakdown: learningV2?.topicBreakdown ?? [],
        weakCategories,
        telemetry: statsTelemetry,
        resolveLabel: (raw) => getCurriculumCategoryGroupLabel(curriculum, raw) ?? raw ?? null,
      }),
    [curriculum, learningV2?.topicBreakdown, statsTelemetry, weakCategories],
  );

  const syllabusSummaries = useMemo(
    () => buildSyllabusSummaries(topicInsights, learningV2, statsTelemetry?.scopedDaily ?? null),
    [learningV2, statsTelemetry?.scopedDaily, topicInsights],
  );

  const filteredTopics = useMemo(() => {
    return topicInsights.filter((item) => {
      if (effectiveTopicScope !== 'all' && item.scope !== effectiveTopicScope) return false;
      if (topicStatusFilter === 'risk') return item.status === 'risk';
      if (topicStatusFilter === 'improving') return item.status === 'improving';
      if (topicStatusFilter === 'unexplored') return item.status === 'unexplored';
      return true;
    });
  }, [topicInsights, effectiveTopicScope, topicStatusFilter]);

  const groupedTopics = useMemo(() => {
    const groups: Array<{
      scope: SyllabusType;
      label: string;
      items: TopicInsightItem[];
      summary: {
        topicCount: number;
        coveragePct: number;
        accuracyPct: number | null;
        riskCount: number;
        fragileCount: number;
      };
    }> = [];

    const scopes: SyllabusType[] =
      singleScope || lawCurriculum
        ? ['common']
        : effectiveTopicScope === 'all'
          ? ['common', 'specific']
          : [effectiveTopicScope];

    for (const scope of scopes) {
      const items =
        singleScope || lawCurriculum
          ? filteredTopics
          : filteredTopics.filter((item) => item.scope === scope);
      if (items.length === 0) continue;

      const totalQ = items.reduce((sum, item) => sum + item.questionCount, 0);
      const seenQ = items.reduce((sum, item) => sum + item.seenCount, 0);
      const attempts = items.reduce((sum, item) => sum + item.attempts, 0);
      const weightedCorrect = items.reduce(
        (sum, item) => sum + ((item.accuracyPct ?? 0) / 100) * item.attempts,
        0,
      );

      groups.push({
        scope,
        label:
          singleScope || lawCurriculum
            ? t('Temario completo', 'Gai-zerrenda osoa')
            : formatSyllabusLabel(scope, locale, { curriculum, variant: 'section' }),
        items,
        summary: {
          topicCount: items.length,
          coveragePct: totalQ > 0 ? Math.round((seenQ / totalQ) * 100) : 0,
          accuracyPct: attempts > 0 ? Math.round((weightedCorrect / attempts) * 100) : null,
          riskCount: items.filter((item) => item.status === 'risk').length,
          fragileCount: items.reduce((sum, item) => sum + item.fragileCount, 0),
        },
      });
    }
    return groups;
  }, [curriculum, effectiveTopicScope, filteredTopics, lawCurriculum, locale, singleScope, t]);

  const lawBreakdown = useMemo(() => learningV2?.lawBreakdown ?? [], [learningV2?.lawBreakdown]);
  const effectiveTopicView: TopicDisplayView =
    topicView === 'laws' && lawBreakdown.length === 0 ? 'list' : topicView;

  // Matrix Scatter Data
  const matrixData = useMemo(
    () =>
      filteredTopics.map((topic) => ({
        id: topic.id,
        name: topic.label,
        x: topic.coveragePct,
        y: topic.accuracyPct ?? 15,
        z: Math.max(20, topic.questionCount),
        status: topic.status,
        scope: topic.scope,
        item: topic,
      })),
    [filteredTopics],
  );

  const selectedMatrixTopic = useMemo(() => {
    return (
      filteredTopics.find((item) => item.id === selectedMatrixTopicId) ??
      filteredTopics.find((item) => item.status === 'risk') ??
      filteredTopics[0] ??
      null
    );
  }, [filteredTopics, selectedMatrixTopicId]);

  // Evolution Chart
  const evolutionData = useMemo(
    () =>
      buildEvolutionChartData({
        sessions,
        scopedDaily: statsTelemetry?.scopedDaily ?? null,
        windowDays: evolutionWindow,
        lens: effectiveEvolutionLens,
        locale,
      }),
    [effectiveEvolutionLens, evolutionWindow, locale, sessions, statsTelemetry?.scopedDaily],
  );

  const evolutionNarrative = useMemo(() => {
    const active = evolutionData.points.filter((point) => point.questions > 0);
    if (active.length === 0) {
      return t(
        'Aún no hay actividad suficiente en este filtro para trazar una evolución.',
        'Oraindik ez dago jarduera nahikorik iragazki honetan bilakaera marrazteko.',
      );
    }
    if (evolutionData.totalQuestions < 40 || evolutionData.activeDays < 3) {
      return t(
        'Ya hay primeros datos, pero con pocos días todavía para sacar conclusiones firmes. Sigue sumando.',
        'Lehen datuak badaude, baina oraindik egun gutxi ondorio sendoak ateratzeko. Jarraitu gehitzen.',
      );
    }
    if (evolutionData.deltaPp != null && evolutionData.deltaPp >= 4) {
      return t(
        `Subida clara de +${evolutionData.deltaPp} puntos respecto al tramo anterior. Estás consolidando el ritmo.`,
        `+${evolutionData.deltaPp} puntuko igoera argia aurreko tartearekin alderatuta. Erritmoa sendotzen ari zara.`,
      );
    }
    if (evolutionData.deltaPp != null && evolutionData.deltaPp <= -4) {
      return t(
        `Bajada de ${Math.abs(evolutionData.deltaPp)} puntos frente al tramo previo. Prueba una sesión corta de repaso por tema antes de mezclar.`,
        `Aurreko tartearekiko ${Math.abs(evolutionData.deltaPp)} puntuko jaitsiera. Saiatu nahastu aurretik gaikako saio labur batekin.`,
      );
    }
    return t(
      'Ritmo estable en este tramo. Alternar temas concretos con tandas mezcladas te ayudará a seguir subiendo.',
      'Erritmo egonkorra tarte honetan. Gai zehatzak eta saio nahastuak txandakatzeak igotzen lagunduko dizu.',
    );
  }, [evolutionData, t]);

  // Focus vs Mixed + Behavior + Modalities
  const focusVsMixed = useMemo(() => buildFocusVsMixedSummary(sessions), [sessions]);
  const modeDistribution = useMemo(
    () => buildModeDistribution(sessions, locale),
    [locale, sessions],
  );
  const errorRecovery = statsTelemetry?.errorRecovery ?? {
    totalFailed: 0,
    recovered: 0,
    recovering: 0,
    reincident: 0,
  };
  const behavior = statsTelemetry?.behavior ?? null;

  // Calendar Data (unified with `sessions` and `classifyPracticeSessionKind`)
  const groupedSessions = useMemo(() => {
    const dayGroups = new Map<string, Map<string, { score: number; total: number; count: number }>>();
    for (const session of sessions) {
      const total = Math.max(0, Number(session.total) || 0);
      if (total <= 0) continue;
      const rawDate = session.finishedAt ?? session.startedAt;
      if (!rawDate) continue;
      const parsed = new Date(rawDate);
      const isoDate = Number.isNaN(parsed.getTime())
        ? String(rawDate).slice(0, 10)
        : toIsoDate(parsed);
      if (!isoDate) continue;
      const kind = classifyPracticeSessionKind(session);
      const label = formatModalityKindLabel(kind, locale);
      if (!dayGroups.has(isoDate)) dayGroups.set(isoDate, new Map());
      const typeMap = dayGroups.get(isoDate)!;
      const current = typeMap.get(label) ?? { score: 0, total: 0, count: 0 };
      const score = Math.max(0, Math.min(total, Number(session.score) || 0));
      typeMap.set(label, {
        score: current.score + score,
        total: current.total + total,
        count: current.count + 1,
      });
    }
    return [...dayGroups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, typeMap]) => ({
        date,
        types: [...typeMap.entries()].map(([label, stats]) => ({
          label,
          totalSessions: stats.count,
          totalScore: stats.score,
          totalQuestions: stats.total,
          percentage: stats.total > 0 ? (stats.score / stats.total) * 100 : 0,
        })),
      }));
  }, [locale, sessions]);

  const daySummaryMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalSessions: number;
        totalQuestions: number;
        totalCorrect: number;
        accuracy: number;
        types: Array<{
          label: string;
          totalSessions: number;
          totalScore: number;
          totalQuestions: number;
          percentage: number;
        }>;
      }
    >();
    for (const day of groupedSessions) {
      const totalSessions = day.types.reduce((acc, item) => acc + item.totalSessions, 0);
      const totalQuestions = day.types.reduce((acc, item) => acc + item.totalQuestions, 0);
      const totalCorrect = day.types.reduce((acc, item) => acc + item.totalScore, 0);
      map.set(day.date, {
        totalSessions,
        totalQuestions,
        totalCorrect,
        accuracy: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
        types: day.types,
      });
    }
    return map;
  }, [groupedSessions]);

  const initialCalendarMonth = useMemo(() => {
    const base = groupedSessions[0]?.date ? parseIsoDate(groupedSessions[0].date) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [groupedSessions]);

  const [calendarMonth, setCalendarMonth] = useState(initialCalendarMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(groupedSessions[0]?.date ?? null);

  useEffect(() => {
    setCalendarMonth(initialCalendarMonth);
  }, [initialCalendarMonth]);

  useEffect(() => {
    if (!selectedDate && groupedSessions[0]?.date) setSelectedDate(groupedSessions[0].date);
  }, [groupedSessions, selectedDate]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const weekdayIndex = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - weekdayIndex);
    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + index,
      );
      return {
        iso: toIsoDate(current),
        date: current,
        inMonth: current.getMonth() === month,
      };
    });
  }, [calendarMonth]);

  const selectedDaySummary = selectedDate ? daySummaryMap.get(selectedDate) ?? null : null;
  const weekdayLabels = getCalendarWeekdayLabels(locale);
  const calendarLabel = formatMonthYear(calendarMonth, locale);

  // Question Blocks
  const visibleQuestionBlocks = useMemo(
    () => questionBlocks.filter((block) => block.scope === effectiveBlockScope),
    [effectiveBlockScope, questionBlocks],
  );
  const selectedQuestionBlock = useMemo(
    () =>
      visibleQuestionBlocks.find((block) => block.start === selectedBlockStart) ??
      visibleQuestionBlocks[0] ??
      null,
    [selectedBlockStart, visibleQuestionBlocks],
  );
  const rankedQuestions = useMemo(
    () =>
      blocksExpanded && questionStatsView === 'ranking'
        ? rankQuestionPerformance(questionBlocks, effectiveBlockScope, questionRankingSort, {
            strategy: 'wilson',
          })
        : [],
    [blocksExpanded, effectiveBlockScope, questionBlocks, questionRankingSort, questionStatsView],
  );
  const blocksWorkedCount = useMemo(
    () => questionBlocks.filter((b) => b.attempts > 0).length,
    [questionBlocks],
  );

  // Helpers
  const formatConfidence = (flag: 'low' | 'medium' | 'high') =>
    flag === 'high' ? t('Alta', 'Handia') : flag === 'medium' ? t('Media', 'Ertaina') : t('Baja', 'Baxua');

  const confidenceClass = (flag: 'low' | 'medium' | 'high') =>
    flag === 'high'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : flag === 'medium'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';

  const modeColors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  const toggleScopeExpand = (scope: string) => {
    setExpandedScopes((prev) => ({ ...prev, [scope]: !prev[scope] }));
  };

  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopicIds((prev) => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const anyScopeExpanded = groupedTopics.some((group) => Boolean(expandedScopes[group.scope]));

  const toggleAllTopicScopes = () => {
    if (anyScopeExpanded) {
      setExpandedScopes({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const group of groupedTopics) next[group.scope] = true;
    setExpandedScopes(next);
  };

  const handleSyllabusCardClick = (scope: SyllabusType) => {
    setTopicScopeFilter((prev) => (prev === scope ? 'all' : scope));
    setExpandedScopes((prev) => ({ ...prev, [scope]: true }));
    setEvolutionLens((prev) => (prev === scope ? 'all' : scope));
  };

  const renderEvolutionTooltip = (props: {
    active?: boolean;
    payload?: Array<{ payload?: unknown }>;
  }) => {
    const { active, payload } = props;
    const raw = payload?.[0]?.payload;
    if (!active || !raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.longLabel !== 'string') return null;
    const q = Number(row.questions ?? 0);
    const c = Number(row.correct ?? 0);
    const acc = row.accuracy == null ? null : Number(row.accuracy);
    const ma = row.movingAvg == null ? null : Number(row.movingAvg);
    const modesText = typeof row.modesText === 'string' ? row.modesText : '';

    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl text-xs">
        <div className="font-black text-slate-900">{row.longLabel}</div>
        {q === 0 ? (
          <div className="mt-1 font-bold text-slate-400">
            {t('Sin actividad', 'Jarduerarik gabe')}
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{t('Acierto', 'Doitasuna')}:</span>
              <strong className="text-slate-900">{acc ?? 0}%</strong>
            </div>
            {ma != null ? (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">{t('Media móvil 7d', '7 eguneko batez bestekoa')}:</span>
                <strong className="text-sky-600">{ma}%</strong>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{t('Preguntas', 'Galderak')}:</span>
              <strong className="text-slate-900">
                {c}/{q}
              </strong>
            </div>
            {modesText ? (
              <div className="pt-1 border-t border-slate-100 font-bold text-indigo-600">
                {modesText}
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const hasAnyPracticeData = useMemo(() => {
    const telemetrySeen =
      (statsTelemetry?.memorySummary?.mastered ?? 0) +
      (statsTelemetry?.memorySummary?.solid ?? 0) +
      (statsTelemetry?.memorySummary?.consolidating ?? 0) +
      (statsTelemetry?.memorySummary?.fragile ?? 0);
    return (
      sessions.length > 0 ||
      (learningV2?.seenQuestions ?? 0) > 0 ||
      telemetrySeen > 0 ||
      questionBlocks.some((b) => b.attempts > 0)
    );
  }, [learningV2?.seenQuestions, questionBlocks, sessions.length, statsTelemetry?.memorySummary]);

  const activeEvolutionPoints = useMemo(
    () => evolutionData.points.filter((point) => point.questions > 0),
    [evolutionData.points],
  );

  const pinnedEvolutionPoint = useMemo(() => {
    if (pinnedEvolutionDate) {
      const exact = evolutionData.points.find((point) => point.iso === pinnedEvolutionDate);
      if (exact) return exact;
    }
    return activeEvolutionPoints[activeEvolutionPoints.length - 1] ?? null;
  }, [activeEvolutionPoints, evolutionData.points, pinnedEvolutionDate]);

  if (!hydrating && !hasAnyPracticeData) {
    const startAction = onStartRecommended ?? onPracticeMixed;
    return (
      <section
        aria-labelledby="stats-onboarding-heading"
        className="space-y-5 pb-12 sm:space-y-6 lg:pb-20"
      >
        {telemetryError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900"
          >
            <span>
              {t(
                'No se pudo cargar toda la telemetría detallada. Mostrando datos disponibles.',
                'Ezin izan da telemetria zehatz guztia kargatu. Eskuragarri dauden datuak erakusten.',
              )}
            </span>
            {onRetryTelemetry ? (
              <button
                type="button"
                onClick={onRetryTelemetry}
                className="min-h-[44px] rounded-xl bg-amber-700 px-4 py-2 text-xs font-black text-white transition hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-1"
              >
                {t('Reintentar', 'Berriro saiatu')}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#0a0a1a] p-6 text-white sm:p-8 space-y-6">
          <div className="absolute right-0 top-0 -mr-20 -mt-20 h-[260px] w-[260px] rounded-full bg-indigo-600/30 blur-[100px]" />
          <div className="relative z-10 space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-indigo-300">
              <Zap size={14} />
              {t('Tu panel de evolución', 'Zure bilakaera-panela')}
            </div>
            <h2
              id="stats-onboarding-heading"
              className="text-2xl sm:text-3xl font-black tracking-tight"
            >
              {t(
                'Completa tu primer test para activar tus estadísticas',
                'Osatu zure lehen testa estatistikak aktibatzeko',
              )}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {t(
                'No necesitas hacer simulacros completos: cualquier test por temas, Desafío o bloque corto construirá tu mapa real de progreso.',
                'Ez duzu simulakro osorik egin behar: gaikako edozein testek, Erronkak edo bloke laburrek zure benetako aurrerapen-mapa sortuko dute.',
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {[
                {
                  title: t('1. Pulso y evolución', '1. Egoera eta bilakaera'),
                  desc: t('Acierto diario, tendencia y ritmo semanal.', 'Eguneko doitasuna, joera eta asteroko erritmoa.'),
                },
                {
                  title: t('2. Memoria por tema', '2. Gaikako memoria'),
                  desc: t('Qué dominas, qué está sólido y qué debes repasar.', 'Zer menderatzen duzun eta zer errepasatu.'),
                },
                {
                  title: t('3. Recuperación de fallos', '3. Akatsen berreskurapena'),
                  desc: t('Seguimiento automático de tus preguntas falladas.', 'Huts egindako galderen jarraipen automatikoa.'),
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1"
                >
                  <div className="text-xs font-black text-indigo-200">{step.title}</div>
                  <p className="text-xs text-slate-300 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
            {startAction ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={startAction}
                  className="min-h-[44px] rounded-2xl bg-indigo-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a1a]"
                >
                  {t('Empezar mi primer test', 'Hasi nire lehen testa')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5 pb-12 sm:space-y-6 lg:pb-20">
      <h1 className="sr-only">
        {t('Estadísticas de evolución y progreso', 'Bilakaera eta aurrerapen estatistikak')}
      </h1>

      {hydrating && !statsTelemetry ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-xs font-bold text-indigo-800"
        >
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" aria-hidden="true" />
            <span>
              {t(
                'Actualizando memoria del banco, evolución por temas y comportamiento...',
                'Bankuaren memoria, gaikako bilakaera eta portaera eguneratzen...',
              )}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2 w-12 rounded-full bg-indigo-200/80 animate-pulse" />
            <span className="h-2 w-8 rounded-full bg-indigo-200/60 animate-pulse" />
          </div>
        </div>
      ) : null}

      {telemetryError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900"
        >
          <span>
            {t(
              'No se pudo cargar toda la telemetría detallada. Mostrando datos disponibles.',
              'Ezin izan da telemetria zehatz guztia kargatu. Eskuragarri dauden datuak erakusten.',
            )}
          </span>
          {onRetryTelemetry ? (
            <button
              type="button"
              onClick={onRetryTelemetry}
              className="min-h-[44px] rounded-xl bg-amber-700 px-3.5 py-2 text-xs font-black text-white transition hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-1"
            >
              {t('Reintentar', 'Berriro saiatu')}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* BLOQUE 1: PULSO DEL OPOSITOR */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#0a0a1a] p-6 text-white sm:p-7 flex flex-col justify-between gap-6">
          <div className="absolute right-0 top-0 -mr-20 -mt-20 h-[280px] w-[280px] rounded-full bg-indigo-600/30 blur-[110px]" />
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-[200px] w-[200px] rounded-full bg-emerald-500/20 blur-[90px]" />

          <div className="relative z-10 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-indigo-300">
                <Zap size={14} />
                {t('Pulso general', 'Egoera orokorra')}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full border text-xs font-black ${confidenceClass(readinessConfidence)}`}
                >
                  {t('Confianza', 'Konfiantza')}: {formatConfidence(readinessConfidence)}
                </span>
                <span className="px-3 py-1 rounded-full border border-white/15 bg-white/5 text-xs font-bold text-slate-200 inline-flex items-center gap-1.5">
                  <Flame size={13} className="text-amber-400" />
                  {activeDayStreak}{' '}
                  {activeDayStreak === 1 ? t('día racha', 'eguneko bolada') : t('días racha', 'eguneko bolada')}
                </span>
                {daysToExam != null ? (
                  <span className="px-3 py-1 rounded-full border border-white/15 bg-white/5 text-xs font-bold text-indigo-200">
                    {t('Examen en', 'Azterketarako')}: {daysToExam}d
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200/80">
                  {readinessStateLabel}
                </h2>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-4xl sm:text-5xl font-black tracking-tight tabular-nums">
                    {readiness}%
                  </span>
                  <span className="text-xs font-bold text-indigo-200/80">
                    {t('Acierto observado', 'Ikusitako doitasuna')}: {observedAccuracy}%
                  </span>
                </div>
                {readinessCiLow != null && readinessCiHigh != null ? (
                  <p className="mt-1 text-xs font-medium text-slate-300">
                    {t('Banda estimada realista', 'Banda errealista')}:{' '}
                    <strong className="text-white">
                      {readinessCiLow}% – {readinessCiHigh}%
                    </strong>{' '}
                    · {t('Visto', 'Ikusita')}: {coverage}%
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-medium text-slate-300">
                    {t('Cobertura del banco', 'Bankuaren estaldura')}:{' '}
                    <strong className="text-white">{coverage}%</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 shrink-0">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-center">
                  <div className="text-xs font-bold text-slate-300">
                    {t('Esta semana', 'Aste honetan')}
                  </div>
                  <div className="text-lg font-black tabular-nums">{weeklyQuestions}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-center">
                  <div className="text-xs font-bold text-slate-300">
                    {t('Por repasar', 'Errepasatzeko')}
                  </div>
                  <div className="text-lg font-black tabular-nums">
                    {learningV2?.backlogOverdueCount ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Readiness Gauge with Confidence Band (CI band above base bar so ciLow is always visible) */}
            <div className="space-y-1.5">
              <div
                role="progressbar"
                aria-label={t('Preparación estimada', 'Estimaziozko prestaketa')}
                aria-valuenow={readiness}
                aria-valuemin={0}
                aria-valuemax={100}
                className="relative h-3.5 w-full rounded-full bg-white/10 overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                  style={{ width: `${Math.max(2, Math.min(100, readiness))}%` }}
                />
                {readinessCiLow != null && readinessCiHigh != null ? (
                  <div
                    className="absolute inset-y-0 rounded-full bg-white/25 border border-white/60"
                    style={{
                      left: `${Math.max(0, Math.min(97, readinessCiLow))}%`,
                      width: `${Math.max(2, Math.min(100 - Math.max(0, Math.min(97, readinessCiLow)), readinessCiHigh - readinessCiLow))}%`,
                    }}
                  />
                ) : null}
              </div>
            </div>

            {/* 5-State Memory DNA Bar */}
            <div className="pt-4 border-t border-white/10 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold uppercase tracking-[0.18em] text-indigo-200/80">
                  {t('Estado de memoria del banco', 'Bankuaren memoria-egoera')} (
                  {memorySummary.totalQ || memorySummary.tracked})
                </span>
                <span className="font-bold text-emerald-300">
                  {t('Dominadas + Sólidas', 'Menderatuak + Sendoak')}:{' '}
                  {memorySummary.mastered + memorySummary.solid}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={t('Estado de memoria del banco', 'Bankuaren memoria-egoera')}
                aria-valuenow={Math.round(
                  ((memorySummary.mastered + memorySummary.solid) / memorySummary.tracked) * 100,
                )}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-3 w-full rounded-full bg-white/10 overflow-hidden flex gap-0.5"
              >
                {[
                  { val: memorySummary.mastered, color: 'bg-emerald-400', label: t('Dominadas', 'Menderatuak') },
                  { val: memorySummary.solid, color: 'bg-indigo-400', label: t('Sólidas', 'Sendoak') },
                  { val: memorySummary.consolidating, color: 'bg-amber-400', label: t('Consolidando', 'Sendotzen') },
                  { val: memorySummary.fragile, color: 'bg-rose-400', label: t('Frágiles', 'Hauskorrak') },
                  { val: memorySummary.unseen, color: 'bg-white/15', label: t('Sin ver', 'Ikusi gabe') },
                ]
                  .filter((seg) => seg.val > 0)
                  .map((seg) => (
                    <div
                      key={seg.label}
                      title={`${seg.label}: ${seg.val}`}
                      className={`${seg.color} h-full transition-all duration-500`}
                      style={{ width: `${(seg.val / memorySummary.tracked) * 100}%` }}
                    />
                  ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {[
                  { label: t('Dominadas', 'Menderatuak'), val: memorySummary.mastered, dot: 'bg-emerald-400' },
                  { label: t('Sólidas', 'Sendoak'), val: memorySummary.solid, dot: 'bg-indigo-400' },
                  { label: t('Consolidando', 'Sendotzen'), val: memorySummary.consolidating, dot: 'bg-amber-400' },
                  { label: t('Frágiles', 'Hauskorrak'), val: memorySummary.fragile, dot: 'bg-rose-400' },
                  { label: t('Sin ver', 'Ikusi gabe'), val: memorySummary.unseen, dot: 'bg-white/30' },
                ].map((seg) => (
                  <div key={seg.label} className="flex items-center gap-1.5 text-slate-200">
                    <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${seg.dot}`} />
                    <span className="truncate text-slate-300">{seg.label}:</span>
                    <strong className="tabular-nums text-white">{seg.val}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Siguiente Paso (priority on mobile) + Temarios (Común vs Específico) */}
        <div className="xl:col-span-5 flex flex-col gap-5">
          {/* Single Actionable Coach Card (first on mobile so CTA isn't buried) */}
          <div className="order-first xl:order-last rounded-[2.25rem] border border-indigo-100 bg-white p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-700">
                  <Swords size={14} />
                  {t('Hoy te conviene', 'Gaur komeni zaizuna')}
                </h2>
                <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                  {recommendedModeLabel} · {recommendedCount} {t('preg.', 'gal.')}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-700 leading-relaxed">
                {actionSummary ||
                  t(
                    'Sigue sumando sesiones cortas y constantes para consolidar tu base.',
                    'Jarraitu saio labur eta jarraituak egiten zure oinarria sendotzeko.',
                  )}
              </p>
            </div>
            <button
              type="button"
              onClick={onStartRecommended}
              disabled={!onStartRecommended}
              className="min-h-[44px] w-full rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm sm:text-base font-black text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              {actionCopy.cta ?? t('Practicar por aquí', 'Hemendik praktikatu')}
            </button>
          </div>

          {!singleScope && !lawCurriculum && syllabusSummaries.length > 0 ? (
            <div className="rounded-[2.25rem] border border-slate-100 bg-white p-5 sm:p-6 shadow-sm space-y-4 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    {t('Por temario', 'Gai-zerrendaka')}
                  </div>
                  <h2 className="text-lg font-black text-slate-900">
                    {t('Común vs. Específico', 'Orokorra vs. Espezifikoa')}
                  </h2>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {t('Pulsa para filtrar', 'Sakatu iragazteko')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                {syllabusSummaries.map((item) => {
                  const isFiltered = topicScopeFilter === item.scope;
                  const memTotal = Math.max(1, item.totalQuestions);
                  const scopeTitle = formatSyllabusLabel(item.scope, locale, {
                    curriculum,
                    variant: 'section',
                  });
                  return (
                    <button
                      key={item.scope}
                      type="button"
                      onClick={() => handleSyllabusCardClick(item.scope)}
                      aria-pressed={isFiltered}
                      className={`w-full text-left rounded-2xl border p-4 space-y-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        isFiltered
                          ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-slate-900">{scopeTitle}</span>
                        <div className="flex items-center gap-1.5">
                          {item.deltaPp != null ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                                item.deltaPp >= 0
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {item.deltaPp >= 0 ? `↑ +${item.deltaPp}` : `↓ ${item.deltaPp}`} pts
                            </span>
                          ) : null}
                          <span className="text-xs font-bold text-slate-600">
                            {item.topicCount} {t('temas', 'gai')}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="flex justify-between text-slate-600 mb-1">
                            <span>{t('Cobertura', 'Estaldura')}</span>
                            <strong className="text-slate-900 tabular-nums">{item.coveragePct}%</strong>
                          </div>
                          <div
                            role="progressbar"
                            aria-label={`${scopeTitle} · ${t('Cobertura', 'Estaldura')}`}
                            aria-valuenow={item.coveragePct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="h-2 rounded-full bg-white border border-slate-200 overflow-hidden"
                          >
                            <div
                              className="h-full rounded-full bg-indigo-600"
                              style={{ width: `${item.coveragePct}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-slate-600 mb-1">
                            <span>{t('Acierto', 'Doitasuna')}</span>
                            <strong className="text-slate-900 tabular-nums">
                              {item.accuracyPct == null ? '—' : `${item.accuracyPct}%`}
                            </strong>
                          </div>
                          <div
                            role="progressbar"
                            aria-label={`${scopeTitle} · ${t('Acierto', 'Doitasuna')}`}
                            aria-valuenow={item.accuracyPct ?? 0}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="h-2 rounded-full bg-white border border-slate-200 overflow-hidden"
                          >
                            <div
                              className={`h-full rounded-full ${
                                (item.accuracyPct ?? 0) >= 75
                                  ? 'bg-emerald-500'
                                  : (item.accuracyPct ?? 0) >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                              }`}
                              style={{ width: `${item.accuracyPct ?? 0}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden flex gap-0.5">
                        {[
                          { val: item.masteredCount, cls: 'bg-emerald-500' },
                          { val: item.solidCount, cls: 'bg-indigo-500' },
                          { val: item.consolidatingCount, cls: 'bg-amber-500' },
                          { val: item.fragileCount, cls: 'bg-rose-500' },
                        ]
                          .filter((seg) => seg.val > 0)
                          .map((seg, idx) => (
                            <div
                              key={idx}
                              className={seg.cls}
                              style={{ width: `${(seg.val / memTotal) * 100}%` }}
                            />
                          ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* BLOQUE 2: EVOLUCIÓN TEMPORAL CONTEXTUALIZADA */}
      <div className="rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {t('Evolución de acierto y volumen', 'Doitasunaren eta bolumenaren bilakaera')}
              </h2>
              {evolutionData.deltaPp != null ? (
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${
                    evolutionData.deltaPp >= 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {evolutionData.deltaPp >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {evolutionData.deltaPp >= 0 ? `+${evolutionData.deltaPp}` : evolutionData.deltaPp}{' '}
                  {t('pts vs tramo anterior', 'pts aurreko tartearekin')}
                </span>
              ) : null}
            </div>
            <p className="text-xs font-medium text-slate-600">
              {t(
                'Barras suaves = preguntas del día · Línea sólida = acierto · Línea verde discontinua = objetivo 70%',
                'Barra leunak = eguneko galderak · Marra jarraitua = doitasuna · Marra berdea = %70 helburua',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label={t('Filtrar evolución por ámbito', 'Bilakaera esparruka iragazi')}
              className="flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1"
            >
              {(
                [
                  { id: 'all', label: t('Global', 'Orokorra') },
                  ...(!singleScope && !lawCurriculum
                    ? [
                        { id: 'common' as const, label: formatSyllabusLabel('common', locale, { curriculum, variant: 'compact' }) },
                        { id: 'specific' as const, label: formatSyllabusLabel('specific', locale, { curriculum, variant: 'compact' }) },
                      ]
                    : []),
                  { id: 'mixed', label: t('Mezcla / Largo', 'Nahastua / Luzea') },
                ] as Array<{ id: EvolutionLens; label: string }>
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setEvolutionLens(item.id);
                    setPinnedEvolutionDate(null);
                  }}
                  aria-pressed={effectiveEvolutionLens === item.id}
                  className={`min-h-[44px] sm:min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    effectiveEvolutionLens === item.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label={t('Ventana temporal', 'Denbora tartea')}
              className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1"
            >
              {([7, 14, 30] as EvolutionWindowDays[]).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    setEvolutionWindow(days);
                    setPinnedEvolutionDate(null);
                  }}
                  aria-pressed={evolutionWindow === days}
                  className={`min-h-[44px] sm:min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 ${
                    evolutionWindow === days
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={evolutionData.points}
              onClick={(state) => {
                const payload = (
                  state as { activePayload?: Array<{ payload?: { iso?: string } }> } | null
                )?.activePayload?.[0]?.payload;
                if (payload?.iso) setPinnedEvolutionDate(payload.iso);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                minTickGap={18}
              />
              <YAxis
                yAxisId="acc"
                domain={[0, 100]}
                unit="%"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                width={44}
              />
              <YAxis yAxisId="vol" orientation="right" hide domain={[0, 'dataMax * 2']} />
              <ReferenceLine yAxisId="acc" y={70} stroke="#10b981" strokeDasharray="4 4" />
              <Tooltip content={renderEvolutionTooltip} />
              <Bar
                yAxisId="vol"
                dataKey="questions"
                fill="#4f46e5"
                fillOpacity={0.14}
                radius={[6, 6, 0, 0]}
                maxBarSize={evolutionWindow === 30 ? 8 : evolutionWindow === 14 ? 14 : 22}
              />
              <Line
                yAxisId="acc"
                type="monotone"
                dataKey="movingAvg"
                connectNulls
                stroke="#0ea5e9"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
              />
              <Line
                yAxisId="acc"
                type="monotone"
                dataKey="accuracy"
                connectNulls={false}
                stroke="#4f46e5"
                strokeWidth={3}
                dot={{ r: 4, fill: '#ffffff', stroke: '#4f46e5', strokeWidth: 2.5 }}
                activeDot={{ r: 6, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Touch & keyboard tap-to-pin day inspector */}
        {pinnedEvolutionPoint ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-black text-slate-900">{pinnedEvolutionPoint.longLabel}</span>
              <span className="font-bold text-slate-700 tabular-nums">
                {t('Acierto', 'Doitasuna')}:{' '}
                <strong className="text-indigo-700">
                  {pinnedEvolutionPoint.accuracy == null ? '—' : `${pinnedEvolutionPoint.accuracy}%`}
                </strong>
              </span>
              <span className="font-bold text-slate-700 tabular-nums">
                {t('Preguntas', 'Galderak')}:{' '}
                <strong className="text-slate-900">
                  {pinnedEvolutionPoint.correct}/{pinnedEvolutionPoint.questions}
                </strong>
              </span>
              {pinnedEvolutionPoint.modesText ? (
                <span className="font-bold text-indigo-700">{pinnedEvolutionPoint.modesText}</span>
              ) : null}
            </div>
            {activeEvolutionPoints.length > 1 ? (
              <label className="inline-flex items-center gap-2 font-bold text-slate-600">
                <span>{t('Día:', 'Eguna:')}</span>
                <select
                  aria-label={t('Inspeccionar día de la gráfica', 'Grafikako eguna ikuskatu')}
                  value={pinnedEvolutionPoint.iso}
                  onChange={(event) => setPinnedEvolutionDate(event.target.value)}
                  className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {activeEvolutionPoints.map((pt) => (
                    <option key={pt.iso} value={pt.iso}>
                      {pt.label} ({pt.questions} {t('preg.', 'gal.')})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3.5 text-sm font-bold text-slate-700 leading-relaxed">
          {evolutionNarrative}
        </div>
      </div>

      {/* BLOQUE 3: DESGLOSE POR TEMARIOS Y TEMAS (COMPRIMIDO INICIALMENTE) */}
      <div className="rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              <Layers size={14} className="text-indigo-600" />
              {t('Desglose por temarios y temas', 'Gai-zerrenda eta gaikako banaketa')}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              {t('Tu mapa completo de temas', 'Zure gaien mapa osoa')}
            </h2>
            <p className="text-xs font-medium text-slate-600">
              {t(
                'Los temarios empiezan comprimidos para evitar scroll largo: despliega cada bloque o tema para ver su detalle.',
                'Gai-zerrendak tolestuta hasten dira: zabaldu bloke edo gai bakoitza xehetasunak ikusteko.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {effectiveTopicView !== 'laws' && !singleScope && !lawCurriculum ? (
              <div
                role="group"
                aria-label={t('Filtrar temas por temario', 'Gaiak gai-zerrendaka iragazi')}
                className="flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1"
              >
                {(
                  [
                    { id: 'all', label: t('Todos', 'Denak') },
                    { id: 'common', label: formatSyllabusLabel('common', locale, { curriculum, variant: 'compact' }) },
                    { id: 'specific', label: formatSyllabusLabel('specific', locale, { curriculum, variant: 'compact' }) },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTopicScopeFilter(item.id)}
                    aria-pressed={effectiveTopicScope === item.id}
                    className={`min-h-[44px] sm:min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      effectiveTopicScope === item.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}

            {effectiveTopicView !== 'laws' ? (
              <div
                role="group"
                aria-label={t('Filtrar temas por estado', 'Gaiak egoeraren arabera iragazi')}
                className="flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1"
              >
                {(
                  [
                    { id: 'all', label: t('Todos', 'Denak') },
                    { id: 'risk', label: t('En riesgo', 'Arriskuan') },
                    { id: 'improving', label: t('Mejorando', 'Hobetzen') },
                    { id: 'unexplored', label: t('Por explorar', 'Ikusteko') },
                  ] as Array<{ id: TopicStatusFilter; label: string }>
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTopicStatusFilter(item.id);
                      if (item.id !== 'all') {
                        setExpandedScopes({ common: true, specific: true });
                      }
                    }}
                    aria-pressed={topicStatusFilter === item.id}
                    className={`min-h-[44px] sm:min-h-[36px] rounded-lg px-2.5 py-1.5 text-xs font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 ${
                      topicStatusFilter === item.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div
              role="tablist"
              aria-label={t('Vista del mapa de temas', 'Gaien maparen ikuspegia')}
              className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={effectiveTopicView === 'list'}
                onClick={() => setTopicView('list')}
                className={`min-h-[44px] sm:min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  effectiveTopicView === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {t('Lista', 'Zerrenda')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={effectiveTopicView === 'matrix'}
                onClick={() => setTopicView('matrix')}
                className={`min-h-[44px] sm:min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  effectiveTopicView === 'matrix' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {t('Matriz', 'Matrizea')}
              </button>
              {lawBreakdown.length > 0 ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={effectiveTopicView === 'laws'}
                  onClick={() => setTopicView('laws')}
                  className={`min-h-[44px] sm:min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    effectiveTopicView === 'laws' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {t('Por leyes', 'Legeka')}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* View 1: Collapsed-by-default Topic Accordions */}
        {effectiveTopicView === 'list' ? (
          groupedTopics.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-600">
              {t(
                'Todavía no hay temas que coincidan con este filtro.',
                'Oraindik ez dago iragazki honekin bat datorren gairik.',
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={toggleAllTopicScopes}
                  className="min-h-[44px] sm:min-h-[36px] text-xs font-black text-indigo-700 hover:text-indigo-900 px-3.5 py-2 rounded-xl bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {anyScopeExpanded
                    ? t('Comprimir temarios', 'Gai-zerrendak tolestu')
                    : t('Desplegar todos los temas', 'Gai guztiak zabaldu')}
                </button>
              </div>

              {groupedTopics.map((group) => {
                const isExpanded = Boolean(expandedScopes[group.scope]);
                const scopePanelId = `stats-scope-panel-${group.scope}`;
                return (
                  <div
                    key={group.scope}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={scopePanelId}
                      onClick={() => toggleScopeExpand(group.scope)}
                      className="min-h-[56px] w-full px-4 py-4 sm:px-5 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-slate-100/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shrink-0">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-base font-black text-slate-900 line-clamp-2">
                            {group.label}
                          </div>
                          <div className="text-xs font-bold text-slate-600">
                            {group.summary.topicCount} {t('temas', 'gai')} ·{' '}
                            {group.summary.coveragePct}% {t('visto', 'ikusita')}
                            {group.summary.riskCount > 0 ? (
                              <span className="text-rose-700">
                                {' '}
                                · {group.summary.riskCount} {t('en riesgo', 'arriskuan')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-600">
                            {t('Acierto', 'Doitasuna')}
                          </div>
                          <div className="text-lg font-black text-slate-900 tabular-nums">
                            {group.summary.accuracyPct == null
                              ? '—'
                              : `${group.summary.accuracyPct}%`}
                          </div>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-black text-indigo-700">
                          {isExpanded
                            ? t('Ocultar', 'Ezkutatu')
                            : t('Ver temas', 'Gaiak ikusi')}
                        </span>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div
                        id={scopePanelId}
                        className="border-t border-slate-200 bg-white divide-y divide-slate-100"
                      >
                        {group.items.map((topic, topicIdx) => {
                          const topicOpen = Boolean(expandedTopicIds[topic.id]);
                          const topicPanelId = `stats-topic-panel-${group.scope}-${topicIdx}`;
                          const accColor =
                            topic.accuracyPct == null
                              ? '#64748b'
                              : topic.accuracyPct >= 78
                                ? '#047857'
                                : topic.accuracyPct >= 62
                                  ? '#b45309'
                                  : '#be123c';
                          const memTotal = Math.max(1, topic.questionCount);

                          return (
                            <div key={topic.id} className="px-4 py-3 sm:px-5">
                              <button
                                type="button"
                                aria-expanded={topicOpen}
                                aria-controls={topicPanelId}
                                onClick={() => toggleTopicExpand(topic.id)}
                                className="min-h-[44px] w-full flex flex-wrap items-center justify-between gap-3 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span className="text-slate-500 shrink-0">
                                    {topicOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div
                                      className={`text-sm font-black text-slate-900 ${
                                        topicOpen ? '' : 'line-clamp-2'
                                      }`}
                                    >
                                      {topic.label}
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                      <div
                                        role="progressbar"
                                        aria-label={`${topic.label} · ${t('Cobertura', 'Estaldura')}`}
                                        aria-valuenow={topic.coveragePct}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0"
                                      >
                                        <div
                                          className="h-full bg-indigo-600 rounded-full"
                                          style={{ width: `${topic.coveragePct}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-bold text-slate-600 tabular-nums">
                                        {topic.seenCount}/{topic.questionCount} ({topic.coveragePct}%)
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  {topic.deltaPp != null ? (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-xs font-black ${
                                        topic.deltaPp > 0
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : topic.deltaPp < 0
                                            ? 'bg-rose-50 text-rose-700'
                                            : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {topic.deltaPp > 0
                                        ? `↑ +${topic.deltaPp}`
                                        : topic.deltaPp < 0
                                          ? `↓ ${topic.deltaPp}`
                                          : '0'}{' '}
                                      pts
                                    </span>
                                  ) : topic.status === 'unexplored' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                      {t('Poco visto', 'Gutxi ikusita')}
                                    </span>
                                  ) : null}

                                  <span
                                    className="text-base font-black tabular-nums min-w-[42px] text-right"
                                    style={{ color: accColor }}
                                  >
                                    {topic.accuracyPct == null ? '—' : `${topic.accuracyPct}%`}
                                  </span>
                                </div>
                              </button>

                              {topicOpen ? (
                                <div
                                  id={topicPanelId}
                                  className="mt-3 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 pl-6"
                                >
                                  <div className="space-y-2 flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-bold">
                                      <span>{t('Madurez de memoria', 'Memoria-egoera')}</span>
                                      <span>
                                        {t('Dominadas', 'Menderatuak')}: {topic.masteredCount} ·{' '}
                                        {t('Sólidas', 'Sendoak')}: {topic.solidCount} ·{' '}
                                        {t('Consolidando', 'Sendotzen')}: {topic.consolidatingCount} ·{' '}
                                        {t('Frágiles', 'Hauskorrak')}:{' '}
                                        <strong className="text-rose-700">{topic.fragileCount}</strong>
                                      </span>
                                    </div>
                                    <div
                                      role="progressbar"
                                      aria-label={`${topic.label} · ${t('Madurez de memoria', 'Memoria-egoera')}`}
                                      aria-valuenow={Math.round(
                                        ((topic.masteredCount + topic.solidCount) / memTotal) * 100,
                                      )}
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                      className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex gap-0.5"
                                    >
                                      {[
                                        { val: topic.masteredCount, cls: 'bg-emerald-500' },
                                        { val: topic.solidCount, cls: 'bg-indigo-500' },
                                        { val: topic.consolidatingCount, cls: 'bg-amber-400' },
                                        { val: topic.fragileCount, cls: 'bg-rose-500' },
                                      ]
                                        .filter((seg) => seg.val > 0)
                                        .map((seg, segIdx) => (
                                          <div
                                            key={segIdx}
                                            className={seg.cls}
                                            style={{ width: `${(seg.val / memTotal) * 100}%` }}
                                          />
                                        ))}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-4 shrink-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-600">
                                        {t('Tendencia', 'Joera')}:
                                      </span>
                                      <TopicSparkline values={topic.checkpoints} color={accColor} />
                                    </div>
                                    {onPracticeTopic ? (
                                      <button
                                        type="button"
                                        onClick={() => onPracticeTopic(topic.label, topic.scope)}
                                        className="min-h-[44px] sm:min-h-[36px] px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                                      >
                                        {topic.fragileCount >= 8
                                          ? t('Reforzar tema', 'Gaia indartu')
                                          : t('Practicar tema', 'Gaia praktikatu')}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )
        ) : effectiveTopicView === 'matrix' ? (
          /* View 2: Priority Matrix (Coverage x Accuracy) with keyboard-accessible topic selector */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-8 rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              {matrixData.length === 0 ? (
                <div className="p-6 text-sm font-bold text-slate-600">
                  {t('Sin temas suficientes para la matriz.', 'Ez dago gai nahikorik matrizerako.')}
                </div>
              ) : (
                <>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 16, right: 20, bottom: 16, left: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name={t('Cobertura', 'Estaldura')}
                          domain={[0, 100]}
                          unit="%"
                          tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          name={t('Acierto', 'Doitasuna')}
                          domain={[0, 100]}
                          unit="%"
                          tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                          width={44}
                        />
                        <ZAxis type="number" dataKey="z" range={[120, 460]} />
                        <ReferenceLine x={50} stroke="#cbd5e1" strokeDasharray="4 4" />
                        <ReferenceLine y={70} stroke="#cbd5e1" strokeDasharray="4 4" />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          formatter={(value: unknown, name: unknown) => [`${value}%`, String(name)]}
                          labelFormatter={(_, payload) =>
                            String((payload?.[0]?.payload as { name?: string } | undefined)?.name ?? '')
                          }
                        />
                        <Scatter
                          data={matrixData}
                          onClick={(entry) => {
                            const id = (entry as { id?: string } | undefined)?.id;
                            if (id) setSelectedMatrixTopicId(id);
                          }}
                        >
                          {matrixData.map((entry) => {
                            const isSelected = selectedMatrixTopic?.id === entry.id;
                            const fill =
                              entry.status === 'risk'
                                ? '#be123c'
                                : entry.status === 'improving'
                                  ? '#047857'
                                  : entry.status === 'unexplored'
                                    ? '#64748b'
                                    : '#4f46e5';
                            return (
                              <Cell
                                key={entry.id}
                                fill={fill}
                                fillOpacity={isSelected ? 1 : 0.72}
                                stroke={isSelected ? '#0f172a' : '#ffffff'}
                                strokeWidth={isSelected ? 3 : 1}
                              />
                            );
                          })}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Keyboard & touch selector synced with ScatterChart */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 w-full sm:w-auto">
                      <span className="shrink-0">{t('Seleccionar tema:', 'Gaia hautatu:')}</span>
                      <select
                        aria-label={t('Seleccionar tema en la matriz', 'Matrizean gaia hautatu')}
                        value={selectedMatrixTopic?.id ?? ''}
                        onChange={(event) => setSelectedMatrixTopicId(event.target.value)}
                        className="min-h-[40px] flex-1 sm:max-w-[280px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        {matrixData.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} ({entry.x}% · {entry.y}%)
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="text-xs font-bold text-slate-600">
                      {t('Abajo-derecha = Fuga de puntos (alta prioridad)', 'Behean-eskuinean = Puntu ihesa (lehentasuna)')}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="lg:col-span-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-4">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                {t('Inspector de tema', 'Gaiaren xehetasuna')}
              </div>
              {selectedMatrixTopic ? (
                <>
                  <div className="text-base font-black text-slate-900">
                    {selectedMatrixTopic.label}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-slate-600 font-bold">{t('Cobertura', 'Estaldura')}</div>
                      <div className="text-lg font-black text-slate-900 tabular-nums">
                        {selectedMatrixTopic.coveragePct}%
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-slate-600 font-bold">{t('Acierto', 'Doitasuna')}</div>
                      <div className="text-lg font-black text-slate-900 tabular-nums">
                        {selectedMatrixTopic.accuracyPct == null
                          ? '—'
                          : `${selectedMatrixTopic.accuracyPct}%`}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    {t('Frágiles', 'Hauskorrak')}: {selectedMatrixTopic.fragileCount} ·{' '}
                    {t('Dominadas', 'Menderatuak')}: {selectedMatrixTopic.masteredCount}
                  </div>
                  {onPracticeTopic ? (
                    <button
                      type="button"
                      onClick={() =>
                        onPracticeTopic(selectedMatrixTopic.label, selectedMatrixTopic.scope)
                      }
                      className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                    >
                      {t('Practicar este tema', 'Gai hau praktikatu')}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="text-xs font-bold text-slate-600">
                  {t('Sin datos todavía.', 'Daturik gabe oraindik.')}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* View 3: Collapsed-by-default Law Breakdown with 1-click practice CTA */
          <div className="space-y-2.5">
            {lawBreakdown.map((law, lawIdx) => {
              const lawKey = law.lawId ?? law.ley_referencia;
              const hasBlocks = Boolean(law.blocks && law.blocks.length > 0);
              const open = hasBlocks && Boolean(expandedLawIds[lawKey]);
              const lawPanelId = `stats-law-panel-${lawIdx}`;
              const acc = Math.round((law.accuracyRate ?? 0) * 100);
              const qCount = law.questionCount ?? 0;
              const lawAction = onPracticeLaw
                ? () => onPracticeLaw(law.ley_referencia)
                : onPracticeTopic
                  ? () => onPracticeTopic(law.ley_referencia, 'specific')
                  : null;

              return (
                <div
                  key={lawKey}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden"
                >
                  <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    {hasBlocks ? (
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={lawPanelId}
                        onClick={() =>
                          setExpandedLawIds((prev) => ({ ...prev, [lawKey]: !prev[lawKey] }))
                        }
                        className="min-h-[44px] flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        <span className="text-slate-500 shrink-0">
                          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                        <div className="min-w-0">
                          <div className={`text-sm font-black text-slate-900 ${open ? '' : 'line-clamp-2'}`}>
                            {law.shortTitle ?? law.ley_referencia}
                          </div>
                          <div className="text-xs font-bold text-slate-600">
                            {law.attempts} {t('intentos', 'saiakera')}
                            {qCount > 0 ? ` · ${law.consolidatedCount ?? 0}/${qCount} ${t('consolidadas', 'sendotuak')}` : ''}
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="min-h-[44px] flex-1 min-w-0 flex items-center gap-2.5">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-slate-900 line-clamp-2">
                            {law.shortTitle ?? law.ley_referencia}
                          </div>
                          <div className="text-xs font-bold text-slate-600">
                            {law.attempts} {t('intentos', 'saiakera')}
                            {qCount > 0 ? ` · ${law.consolidatedCount ?? 0}/${qCount} ${t('consolidadas', 'sendotuak')}` : ''}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base font-black text-slate-900 tabular-nums">{acc}%</span>
                      {lawAction ? (
                        <button
                          type="button"
                          onClick={lawAction}
                          className="min-h-[44px] sm:min-h-[36px] rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                        >
                          {t('Practicar ley', 'Legea praktikatu')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {open && law.blocks && law.blocks.length > 0 ? (
                    <div
                      id={lawPanelId}
                      className="border-t border-slate-200 bg-white divide-y divide-slate-100 px-4 py-2"
                    >
                      {law.blocks.map((block) => (
                        <div
                          key={block.blockId}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="font-bold text-slate-700">{block.title}</span>
                          <span className="font-black text-slate-900 tabular-nums shrink-0">
                            {Math.round((block.accuracyRate ?? 0) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BLOQUE 4: TRANSFERENCIA, COMPORTAMIENTO Y HÁBITO (SIN DEPENDER DE SIMULACROS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card A: En Foco vs Mezclado / Largo */}
        <div className="lg:col-span-6 rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                <Target size={14} className="text-indigo-600" />
                {t('Transferencia real', 'Benetako transferentzia')}
              </div>
              <h2 className="mt-1 text-xl font-black text-slate-900">
                {t('En foco (1 tema) vs. Mezclado / Largo', 'Fokuan (gai 1) vs. Nahastua / Luzea')}
              </h2>
            </div>
            {focusVsMixed.gapPp != null ? (
              <span
                className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ${
                  focusVsMixed.gapPp >= -5
                    ? 'bg-emerald-50 text-emerald-700'
                    : focusVsMixed.gapPp >= -14
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-rose-50 text-rose-700'
                }`}
              >
                {focusVsMixed.gapPp > 0 ? `+${focusVsMixed.gapPp}` : focusVsMixed.gapPp} pts
              </span>
            ) : null}
          </div>

          <div className="space-y-3.5">
            {[
              {
                label: t('Práctica en foco (Temas / Repaso)', 'Fokuko praktika (Gaiak / Errepasoa)'),
                acc: focusVsMixed.focusedAccuracy,
                count: focusVsMixed.focusedQuestions,
                bar: 'bg-emerald-500',
              },
              {
                label: t('Mezclado o largo (Desafío / Temario)', 'Nahastua edo luzea (Erronka / Temarioa)'),
                acc: focusVsMixed.mixedAccuracy,
                count: focusVsMixed.mixedQuestions,
                bar: 'bg-indigo-600',
              },
            ].map((row) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600">
                    {row.label} · {row.count} {t('preg.', 'gal.')}
                  </span>
                  <strong className="text-sm font-black text-slate-900 tabular-nums">
                    {row.acc == null ? '—' : `${row.acc}%`}
                  </strong>
                </div>
                <div
                  role="progressbar"
                  aria-label={row.label}
                  aria-valuenow={row.acc ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-3 rounded-full bg-slate-100 overflow-hidden"
                >
                  <div
                    className={`h-full rounded-full ${row.bar}`}
                    style={{ width: `${row.acc ?? 0}%` }}
                  />
                </div>
              </div>
            ))}

            {pressureV2 && pressureV2.simulacroQuestionN > 0 && pressureV2.simulacroAccuracy != null ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">
                  {t('Simulacros registrados', 'Erregistratutako simulakroak')} (
                  {pressureV2.simulacroQuestionN} {t('preg.', 'gal.')})
                </span>
                <strong className="font-black text-slate-900 tabular-nums">
                  {Math.round(pressureV2.simulacroAccuracy * 100)}%
                </strong>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
              {!focusVsMixed.enoughData
                ? t(
                    'Combina sesiones por tema con algún Desafío o test de temario completo para medir si sostienes lo aprendido al mezclar.',
                    'Konbinatu gaikako saioak Erronka edo gai-zerrenda osoko testekin, nahastean eusten diozun ikusteko.',
                  )
                : focusVsMixed.gapPp != null && focusVsMixed.gapPp <= -12
                  ? t(
                      'Aciertas muy bien tema a tema, pero al mezclar todo el temario baja tu precisión. Alterna con sesiones mixtas cortas.',
                      'Oso ondo asmatzen duzu gaiz gai, baina dena nahastean jaisten da. Txandakatu saio nahastu laburrekin.',
                    )
                  : t(
                      'Buena transferencia: sostienes el acierto incluso cuando mezclas temas distintos en sesiones largas.',
                      'Transferentzia ona: doitasunari eusten diozu saio luzeetan gaiak nahastean ere.',
                    )}
            </p>
            {onPracticeMixed && (!focusVsMixed.enoughData || (focusVsMixed.gapPp != null && focusVsMixed.gapPp <= -8)) ? (
              <button
                type="button"
                onClick={onPracticeMixed}
                className="min-h-[44px] sm:min-h-[36px] shrink-0 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
              >
                {t('Hacer test mezclado', 'Test nahastua egin')}
              </button>
            ) : null}
          </div>
        </div>

        {/* Card B: Aguante, Precipitación y Recuperación */}
        <div className="lg:col-span-6 rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              <Activity size={14} className="text-amber-600" />
              {t('Comportamiento en tus tests', 'Zure testetako portaera')}
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-900">
              {t('Aguante, Precipitación y Recuperación', 'Eustea, Presa eta Berreskurapena')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-800">
                <span>{t('Tests largos (≥25 preg.)', 'Test luzeak (≥25 gal.)')}</span>
                <span className="text-indigo-700 tabular-nums">
                  {behavior?.longSessionDropPp == null
                    ? '—'
                    : `${behavior.longSessionDropPp > 0 ? `+${behavior.longSessionDropPp}` : behavior.longSessionDropPp} pts`}
                </span>
              </div>
              {behavior?.longSessionFirstHalfAcc != null && behavior.longSessionSecondHalfAcc != null ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t('1ª mitad', '1. erdia')}</span>
                    <strong className="text-slate-900">{behavior.longSessionFirstHalfAcc}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t('Tramo final', 'Azken zatia')}</span>
                    <strong className="text-slate-900">{behavior.longSessionSecondHalfAcc}%</strong>
                  </div>
                  {behavior.fatigueEnoughData === false ? (
                    <p className="pt-1 text-[11px] font-semibold text-slate-600">
                      {t(
                        `Orientativo (${behavior.longSessionCount}/3 sesiones continuas).`,
                        `Orientagarria (${behavior.longSessionCount}/3 saio jarraitu).`,
                      )}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs font-medium text-slate-600">
                  {t('Haz sesiones de ≥25 preguntas para medir aguante.', 'Egin ≥25 galderako saioak eustea neurtzeko.')}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-800">
                <span>{t('Fallos evitables', 'Akats saihesgarriak')}</span>
                <span className="text-rose-700 tabular-nums">
                  {behavior?.avoidableErrorRate == null ? '—' : `${behavior.avoidableErrorRate}%`}
                </span>
              </div>
              {behavior?.avoidableErrorRate != null ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t('Rápidos (<2,5s)', 'Azkarregi (<2,5s)')}</span>
                    <strong className="text-slate-900">{behavior.fastErrorRate ?? 0}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t('Cambió a peor', 'Okerrera aldatuak')}</span>
                    <strong className="text-slate-900">{behavior.changedToWrongRate ?? 0}%</strong>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-medium text-slate-600">
                  {t('Se activa al reunir suficientes fallos cronometrados.', 'Nahikoa akats kronometratu biltzean aktibatzen da.')}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black text-slate-800">
              <span>{t('Recuperación de preguntas falladas', 'Huts egindako galderen berreskurapena')}</span>
              <span className="text-emerald-700 tabular-nums">
                {errorRecovery.totalFailed > 0
                  ? `${Math.round((errorRecovery.recovered / errorRecovery.totalFailed) * 100)}% ${t('recuperadas', 'berreskuratuak')}`
                  : '—'}
              </span>
            </div>
            {errorRecovery.totalFailed > 0 ? (
              <>
                <div
                  role="progressbar"
                  aria-label={t('Recuperación de preguntas falladas', 'Huts egindako galderen berreskurapena')}
                  aria-valuenow={Math.round((errorRecovery.recovered / errorRecovery.totalFailed) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2.5 w-full rounded-full bg-white border border-slate-200 overflow-hidden flex gap-0.5"
                >
                  {[
                    { val: errorRecovery.recovered, cls: 'bg-emerald-500' },
                    { val: errorRecovery.recovering, cls: 'bg-amber-400' },
                    { val: errorRecovery.pending ?? 0, cls: 'bg-orange-400' },
                    { val: errorRecovery.reincident, cls: 'bg-rose-500' },
                  ]
                    .filter((seg) => seg.val > 0)
                    .map((seg, idx) => (
                      <div
                        key={idx}
                        className={seg.cls}
                        style={{ width: `${(seg.val / errorRecovery.totalFailed) * 100}%` }}
                      />
                    ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span>
                      <strong className="text-emerald-700">{errorRecovery.recovered}</strong>{' '}
                      {t('recuperadas', 'berreskuratuak')}
                    </span>
                    <span>
                      <strong className="text-amber-700">{errorRecovery.recovering}</strong>{' '}
                      {t('en proceso', 'bidean')}
                    </span>
                    {(errorRecovery.pending ?? 0) > 0 ? (
                      <span>
                        <strong className="text-orange-700">{errorRecovery.pending}</strong>{' '}
                        {t('pendientes', 'zain')}
                      </span>
                    ) : null}
                    <span>
                      <strong className="text-rose-700">{errorRecovery.reincident}</strong>{' '}
                      {t('reincidentes', 'errepikatuak')}
                    </span>
                  </div>
                  {onPracticeReviewMistakes &&
                  errorRecovery.reincident + (errorRecovery.pending ?? 0) > 0 ? (
                    <button
                      type="button"
                      onClick={onPracticeReviewMistakes}
                      className="min-h-[44px] sm:min-h-[34px] rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
                    >
                      {t('Repasar fallos', 'Akatsak errepasatu')}
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-xs font-medium text-slate-600">
                {t('Aún no hay historial de fallos repetidos.', 'Oraindik ez dago huts errepikatuen historikorik.')}
              </p>
            )}
          </div>
        </div>

        {/* Card C: Modalidades ponderadas por preguntas */}
        <div className="lg:col-span-5 rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7 space-y-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              {t('Ponderado por preguntas', 'Galderaka haztatua')}
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-900">
              {t('Cómo repartes tu práctica', 'Nola banatzen duzun praktika')}
            </h2>
          </div>

          {modeDistribution.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-600">
              {t('Aún no hay sesiones registradas.', 'Oraindik ez dago saiorik erregistratuta.')}
            </div>
          ) : (
            <div className="space-y-3">
              {modeDistribution.map((item, idx) => (
                <div key={item.kind} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-black text-slate-800 truncate">{item.label}</span>
                    <span className="text-slate-600 font-bold shrink-0 tabular-nums">
                      <strong className="text-slate-900">{item.questions}</strong> {t('preg.', 'gal.')} (
                      {item.sharePct}%) ·{' '}
                      <strong className="text-indigo-700">
                        {item.accuracyPct == null ? '—' : `${item.accuracyPct}%`}
                      </strong>
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${item.label} (${item.sharePct}%)`}
                    aria-valuenow={item.sharePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2.5 rounded-full bg-slate-100 overflow-hidden"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, item.sharePct)}%`,
                        backgroundColor: modeColors[idx % modeColors.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card D: Calendario Bivariado (Calidad x Volumen) */}
        <div className="lg:col-span-7 rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                {t(
                  'Hábito mensual (Color = Acierto · Tamaño = Volumen)',
                  'Hileko ohitura (Kolorea = Doitasuna · Tamaina = Bolumena)',
                )}
              </div>
              <h2 className="mt-1 text-xl font-black text-slate-900">{calendarLabel}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t('Mes anterior', 'Aurreko hilabetea')}
                onClick={() =>
                  setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                className="min-w-[44px] min-h-[44px] sm:w-9 sm:h-9 sm:min-w-0 sm:min-h-0 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label={t('Mes siguiente', 'Hurrengo hilabetea')}
                onClick={() =>
                  setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                className="min-w-[44px] min-h-[44px] sm:w-9 sm:h-9 sm:min-w-0 sm:min-h-0 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {groupedSessions.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm font-bold text-slate-600">
              {t('Aún no hay sesiones registradas.', 'Oraindik ez dago saiorik erregistratuta.')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <div className="md:col-span-7 space-y-2">
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-black text-slate-500">
                  {weekdayLabels.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarCells.map((cell) => {
                    const summary = daySummaryMap.get(cell.iso);
                    const isSelected = selectedDate === cell.iso;
                    const acc = summary && summary.totalQuestions > 0 ? Math.round(summary.accuracy) : null;
                    const colorClass = !summary
                      ? 'border-slate-100 bg-slate-50 text-slate-400'
                      : acc != null && acc >= 80
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : acc != null && acc >= 60
                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                          : 'border-rose-200 bg-rose-50 text-rose-900';
                    const dotColor =
                      acc != null && acc >= 80
                        ? 'bg-emerald-600'
                        : acc != null && acc >= 60
                          ? 'bg-amber-600'
                          : 'bg-rose-600';
                    const volumeSizeClass = !summary
                      ? ''
                      : summary.totalQuestions >= 40
                        ? 'w-3 h-1.5 rounded-full'
                        : summary.totalQuestions >= 15
                          ? 'w-2 h-2 rounded-full'
                          : 'w-1.5 h-1.5 rounded-full';
                    const cellAriaLabel = summary
                      ? `${formatLongDate(cell.date, locale)}: ${summary.totalQuestions} ${t('preguntas', 'galdera')}, ${acc ?? 0}% ${t('de acierto', 'doitasun')}`
                      : `${formatLongDate(cell.date, locale)}: ${t('Sin actividad', 'Jarduerarik gabe')}`;

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onClick={() => setSelectedDate(cell.iso)}
                        aria-label={cellAriaLabel}
                        aria-pressed={isSelected}
                        title={cellAriaLabel}
                        className={`min-h-[44px] sm:h-10 sm:min-h-0 rounded-xl border text-xs font-black flex flex-col items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${colorClass} ${
                          isSelected ? 'ring-2 ring-indigo-600' : ''
                        } ${cell.inMonth ? '' : 'opacity-45'}`}
                      >
                        <span>{cell.date.getDate()}</span>
                        {summary ? (
                          <span className={`mt-0.5 ${dotColor} ${volumeSizeClass}`} aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-bold text-slate-600">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true" /> ≥80%
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-600" aria-hidden="true" /> 60–79%
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-600" aria-hidden="true" /> &lt;60%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" aria-hidden="true" /> &lt;15
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-500" aria-hidden="true" /> 15–39
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 h-1.5 rounded-full bg-slate-500" aria-hidden="true" /> ≥40 {t('preg.', 'gal.')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                {!selectedDaySummary || !selectedDate ? (
                  <p className="text-xs font-bold text-slate-500">
                    {t('Selecciona un día para ver su resumen.', 'Hautatu egun bat laburpena ikusteko.')}
                  </p>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                          {t('Día', 'Eguna')}
                        </div>
                        <div className="text-sm font-black text-slate-900">
                          {formatLongDate(parseIsoDate(selectedDate), locale)}
                        </div>
                      </div>
                      <span className="text-2xl font-black text-indigo-600 tabular-nums">
                        {Math.round(selectedDaySummary.accuracy)}%
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                      {selectedDaySummary.totalQuestions} {t('preguntas', 'galdera')} ·{' '}
                      {selectedDaySummary.totalSessions}{' '}
                      {selectedDaySummary.totalSessions === 1 ? t('sesión', 'saio') : t('sesiones', 'saio')}
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-slate-200">
                      {selectedDaySummary.types.map((typeGroup) => (
                        <div
                          key={`${selectedDate}-${typeGroup.label}`}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="font-bold text-slate-700 truncate pr-2">
                            {typeGroup.label} ({typeGroup.totalQuestions})
                          </span>
                          <strong className="font-black text-slate-900 tabular-nums">
                            {Math.round(typeGroup.percentage)}%
                          </strong>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BLOQUE 5: EXPLORADOR DE BLOQUES Y RANKING (COMPRIMIDO INICIALMENTE) */}
      <div className="rounded-[2.25rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          aria-expanded={blocksExpanded}
          onClick={() => setBlocksExpanded((prev) => !prev)}
          className="w-full p-5 sm:p-7 flex flex-wrap items-center justify-between gap-4 text-left hover:bg-slate-50/70 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Grid size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                {t('Detalle por pregunta', 'Galderaz galderako xehetasuna')}
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                {t('Mosaico de bloques de 10 y clasificación', '10eko blokeen mosaikoa eta sailkapena')}
              </h3>
              <p className="text-xs font-bold text-slate-500">
                {blocksWorkedCount}/{questionBlocks.length} {t('bloques iniciados', 'bloke hasita')}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-700">
            {blocksExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {blocksExpanded ? t('Ocultar detalle', 'Ezkutatu') : t('Explorar bloques', 'Blokeak ikusi')}
          </span>
        </button>

        {blocksExpanded ? (
          <div className="border-t border-slate-100 p-5 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
                {(['blocks', 'ranking'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setQuestionStatsView(view)}
                    aria-pressed={questionStatsView === view}
                    className={`rounded-lg px-3.5 py-2 text-xs font-black transition-all ${
                      questionStatsView === view
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    {view === 'blocks' ? t('Mosaico por bloques', 'Blokeen mosaikoa') : t('Clasificación', 'Sailkapena')}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!singleScope && !lawCurriculum && availableBlockScopes.length > 1 ? (
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
                    {(['common', 'specific'] as const).map((scope) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => {
                          setBlockScope(scope);
                          setSelectedBlockStart(null);
                        }}
                        aria-pressed={effectiveBlockScope === scope}
                        className={`rounded-lg px-3 py-2 text-xs font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                          effectiveBlockScope === scope
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-white'
                        }`}
                      >
                        {scope === 'common' ? t('Común', 'Orokorra') : t('Específico', 'Espezifikoa')}
                      </button>
                    ))}
                  </div>
                ) : null}

                {questionStatsView === 'ranking' ? (
                  <select
                    aria-label={t('Ordenar por', 'Ordenatu honen arabera')}
                    value={questionRankingSort}
                    onChange={(event) =>
                      setQuestionRankingSort(event.target.value as QuestionRankingSort)
                    }
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <option value="most_viewed">{t('Más vistas', 'Ikusienak')}</option>
                    <option value="least_viewed">{t('Menos vistas', 'Gutxien ikusiak')}</option>
                    <option value="most_correct">{t('Mayor % acierto', 'Asmatze handiena')}</option>
                    <option value="most_incorrect">{t('Mayor % fallo', 'Hutsegite handiena')}</option>
                  </select>
                ) : null}
              </div>
            </div>

            {questionStatsView === 'blocks' ? (
              visibleQuestionBlocks.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-600">
                  {t('No hay preguntas numeradas para este bloque.', 'Ez dago zenbakitutako galderarik atal honetan.')}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-10 gap-2">
                    {visibleQuestionBlocks.map((block) => {
                      const acc =
                        block.accuracyRate == null ? null : Math.round(block.accuracyRate * 100);
                      const isSel = selectedQuestionBlock?.start === block.start;
                      const tone =
                        acc == null
                          ? 'border-slate-200 bg-slate-50 text-slate-400'
                          : acc >= 80
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : acc >= 60
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-rose-200 bg-rose-50 text-rose-800';
                      return (
                        <button
                          key={`${block.scope}:${block.start}`}
                          type="button"
                          onClick={() => setSelectedBlockStart(block.start)}
                          className={`rounded-xl border p-2 text-center transition-all ${tone} ${
                            isSel ? 'ring-2 ring-indigo-600' : ''
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-800">
                            {block.start}–{block.end}
                          </div>
                          <div className="text-xs font-black tabular-nums mt-0.5">
                            {acc == null ? '—' : `${acc}%`}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedQuestionBlock ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-black text-slate-800">
                          {t('Bloque', 'Blokea')} {selectedQuestionBlock.start}–{selectedQuestionBlock.end} ·{' '}
                          <span className="text-slate-500 font-bold">
                            {selectedQuestionBlock.attemptedQuestionCount}/
                            {selectedQuestionBlock.questionCount} {t('vistas', 'ikusita')} ·{' '}
                            {selectedQuestionBlock.correct} {t('aciertos', 'asmatze')} ·{' '}
                            {selectedQuestionBlock.incorrect} {t('fallos', 'akats')}
                          </span>
                        </div>
                        {onPracticeBlock ? (
                          <button
                            type="button"
                            onClick={() =>
                              onPracticeBlock(
                                selectedQuestionBlock.start,
                                selectedQuestionBlock.end,
                                selectedQuestionBlock.scope,
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700"
                          >
                            {t('Repasar bloque', 'Blokea errepasatu')}
                          </button>
                        ) : null}
                      </div>

                      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                        {selectedQuestionBlock.questions.map((question) => {
                          const acc =
                            question.accuracyRate == null
                              ? null
                              : Math.round(question.accuracyRate * 100);
                          return (
                            <div
                              key={question.id}
                              className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <span className="font-black text-indigo-600 shrink-0">
                                  #{question.number}
                                </span>
                                <span className="font-bold text-slate-700 line-clamp-2">
                                  {question.text}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 tabular-nums">
                                <span className="text-slate-500 font-bold">
                                  {question.correct}/{question.attempts}
                                </span>
                                <span
                                  className={`font-black min-w-[36px] text-right ${
                                    acc == null
                                      ? 'text-slate-300'
                                      : acc >= 80
                                        ? 'text-emerald-600'
                                        : acc >= 60
                                          ? 'text-amber-600'
                                          : 'text-rose-600'
                                  }`}
                                >
                                  {acc == null ? '—' : `${acc}%`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            ) : rankedQuestions.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-600">
                {t('No hay preguntas numeradas para clasificar.', 'Ez dago zenbakitutako galderarik sailkatzeko.')}
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {rankedQuestions.slice(0, 60).map((question, index) => {
                  const acc =
                    question.accuracyRate == null ? null : Math.round(question.accuracyRate * 100);
                  return (
                    <div
                      key={question.id}
                      className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-white"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="font-black text-slate-400 shrink-0">{index + 1}.</span>
                        <span className="font-black text-indigo-600 shrink-0">#{question.number}</span>
                        <span className="font-bold text-slate-700 line-clamp-2">{question.text}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 tabular-nums font-bold">
                        <span className="text-slate-500">
                          {question.views} {t('vistas', 'ikustaldi')}
                        </span>
                        <span className="text-emerald-600">{question.correct}✓</span>
                        <span className="text-rose-600">{question.incorrect}✕</span>
                        <span
                          className={`font-black min-w-[36px] text-right ${
                            acc == null
                              ? 'text-slate-300'
                              : acc >= 80
                                ? 'text-emerald-600'
                                : acc >= 60
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                          }`}
                        >
                          {acc == null ? '—' : `${acc}%`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
