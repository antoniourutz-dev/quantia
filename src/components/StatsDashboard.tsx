import { useEffect, useMemo, useState } from 'react';
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
  onStartRecommended?: () => void;
  onPracticeTopic?: (topicLabel: string, scope: SyllabusType) => void;
  onPracticeBlock?: (start: number, end: number, scope: SyllabusType) => void;
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
    return <span className="text-xs font-bold text-slate-300">—</span>;
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

  return (
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
  );
}

export default function StatsDashboard({
  results,
  bundle,
  curriculum,
  coachPlan = null,
  executablePlan = null,
  onStartRecommended,
  onPracticeTopic,
  onPracticeBlock,
}: StatsDashboardProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

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
      if (topicScopeFilter !== 'all' && item.scope !== topicScopeFilter) return false;
      if (topicStatusFilter === 'risk') return item.status === 'risk';
      if (topicStatusFilter === 'improving') return item.status === 'improving';
      if (topicStatusFilter === 'unexplored') return item.status === 'unexplored';
      return true;
    });
  }, [topicInsights, topicScopeFilter, topicStatusFilter]);

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
        : topicScopeFilter === 'all'
          ? ['common', 'specific']
          : [topicScopeFilter];

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
  }, [curriculum, filteredTopics, lawCurriculum, locale, singleScope, t, topicScopeFilter]);

  const lawBreakdown = useMemo(() => learningV2?.lawBreakdown ?? [], [learningV2?.lawBreakdown]);

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
        lens: evolutionLens,
        locale,
      }),
    [evolutionLens, evolutionWindow, locale, sessions, statsTelemetry?.scopedDaily],
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

  // Calendar Data
  const groupedSessions = useMemo(() => {
    const dayGroups = new Map<string, Map<string, { score: number; total: number; count: number }>>();
    for (const result of results) {
      if (!dayGroups.has(result.date)) dayGroups.set(result.date, new Map());
      const typeMap = dayGroups.get(result.date)!;
      const current = typeMap.get(result.label) ?? { score: 0, total: 0, count: 0 };
      typeMap.set(result.label, {
        score: current.score + result.score,
        total: current.total + result.total,
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
  }, [results]);

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
    () => questionBlocks.filter((block) => block.scope === blockScope),
    [blockScope, questionBlocks],
  );
  const selectedQuestionBlock = useMemo(
    () =>
      visibleQuestionBlocks.find((block) => block.start === selectedBlockStart) ??
      visibleQuestionBlocks[0] ??
      null,
    [selectedBlockStart, visibleQuestionBlocks],
  );
  const rankedQuestions = useMemo(
    () => rankQuestionPerformance(questionBlocks, blockScope, questionRankingSort),
    [blockScope, questionBlocks, questionRankingSort],
  );
  const blocksWorkedCount = useMemo(
    () => questionBlocks.filter((b) => b.attemptedQuestionCount > 0).length,
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

  return (
    <div className="space-y-5 pb-12 sm:space-y-6 lg:pb-20 animate-in fade-in slide-in-from-bottom-6 duration-500">
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
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200/80">
                  {readinessStateLabel}
                </div>
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
                    <strong className="text-white">{coverage}%</strong> ·{' '}
                    {t('Por repasar', 'Errepasatzeko')}: {learningV2?.backlogOverdueCount ?? 0}
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

            {/* Readiness Gauge with Confidence Band */}
            <div className="space-y-1.5">
              <div className="relative h-3.5 w-full rounded-full bg-white/10 overflow-hidden">
                {readinessCiLow != null && readinessCiHigh != null ? (
                  <div
                    className="absolute inset-y-0 rounded-full bg-indigo-400/35 border border-indigo-300/40"
                    style={{
                      left: `${Math.max(0, Math.min(100, readinessCiLow))}%`,
                      width: `${Math.max(3, Math.min(100 - readinessCiLow, readinessCiHigh - readinessCiLow))}%`,
                    }}
                  />
                ) : null}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                  style={{ width: `${Math.max(2, Math.min(100, readiness))}%` }}
                />
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
              <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden flex gap-0.5">
                {[
                  { val: memorySummary.mastered, color: 'bg-emerald-400', label: t('Dominadas', 'Menderatuak') },
                  { val: memorySummary.solid, color: 'bg-indigo-400', label: t('Sólidas', 'Sendoak') },
                  { val: memorySummary.consolidating, color: 'bg-amber-400', label: t('Consolidando', 'Sendotzen') },
                  { val: memorySummary.fragile, color: 'bg-rose-400', label: t('Frágiles', 'Hauskorrak') },
                  { val: memorySummary.unseen, color: 'bg-white/15', label: t('Sin ver', 'Ikusi gabe') },
                ].map((seg) => (
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

        {/* Right Column: Temarios (Común vs Específico) + Siguiente Paso */}
        <div className="xl:col-span-5 flex flex-col gap-5">
          {!singleScope && !lawCurriculum && syllabusSummaries.length > 0 ? (
            <div className="rounded-[2.25rem] border border-slate-100 bg-white p-5 sm:p-6 shadow-sm space-y-4 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    {t('Por temario', 'Gai-zerrendaka')}
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    {t('Común vs. Específico', 'Orokorra vs. Espezifikoa')}
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {t('Pulsa para filtrar', 'Sakatu iragazteko')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                {syllabusSummaries.map((item) => {
                  const isFiltered = topicScopeFilter === item.scope;
                  const memTotal = Math.max(1, item.totalQuestions);
                  return (
                    <button
                      key={item.scope}
                      type="button"
                      onClick={() => handleSyllabusCardClick(item.scope)}
                      className={`w-full text-left rounded-2xl border p-4 space-y-3 transition-all ${
                        isFiltered
                          ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-slate-900">
                          {formatSyllabusLabel(item.scope, locale, { curriculum, variant: 'section' })}
                        </span>
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
                          <span className="text-xs font-bold text-slate-500">
                            {item.topicCount} {t('temas', 'gai')}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="flex justify-between text-slate-500 mb-1">
                            <span>{t('Cobertura', 'Estaldura')}</span>
                            <strong className="text-slate-900 tabular-nums">{item.coveragePct}%</strong>
                          </div>
                          <div className="h-2 rounded-full bg-white border border-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-600"
                              style={{ width: `${item.coveragePct}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-slate-500 mb-1">
                            <span>{t('Acierto', 'Doitasuna')}</span>
                            <strong className="text-slate-900 tabular-nums">
                              {item.accuracyPct == null ? '—' : `${item.accuracyPct}%`}
                            </strong>
                          </div>
                          <div className="h-2 rounded-full bg-white border border-slate-200 overflow-hidden">
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
                        <div className="bg-emerald-500" style={{ width: `${(item.masteredCount / memTotal) * 100}%` }} />
                        <div className="bg-indigo-500" style={{ width: `${(item.solidCount / memTotal) * 100}%` }} />
                        <div className="bg-amber-500" style={{ width: `${(item.consolidatingCount / memTotal) * 100}%` }} />
                        <div className="bg-rose-500" style={{ width: `${(item.fragileCount / memTotal) * 100}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Single Actionable Coach Card (no duplicate copy) */}
          <div className="rounded-[2.25rem] border border-indigo-100 bg-white p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-600">
                  <Swords size={14} />
                  {t('Hoy te conviene', 'Gaur komeni zaizuna')}
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
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
              className="w-full rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm sm:text-base font-black text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-60"
            >
              {actionCopy.cta ?? t('Practicar por aquí', 'Hemendik praktikatu')}
            </button>
          </div>
        </div>
      </div>

      {/* BLOQUE 2: EVOLUCIÓN TEMPORAL CONTEXTUALIZADA */}
      <div className="rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                {t('Evolución de acierto y volumen', 'Doitasunaren eta bolumenaren bilakaera')}
              </h3>
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
                  {t('pp vs tramo anterior', 'pp aurreko tartearekin')}
                </span>
              ) : null}
            </div>
            <p className="text-xs font-medium text-slate-500">
              {t(
                'Barras suaves = preguntas del día · Línea sólida = acierto · Línea discontinua = tendencia suavizada (7 días)',
                'Barra leunak = eguneko galderak · Marra jarraitua = doitasuna · Etena = 7 eguneko joera',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
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
                  onClick={() => setEvolutionLens(item.id)}
                  aria-pressed={evolutionLens === item.id}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                    evolutionLens === item.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
              {([7, 14, 30] as EvolutionWindowDays[]).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setEvolutionWindow(days)}
                  aria-pressed={evolutionWindow === days}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition-all ${
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
            <ComposedChart data={evolutionData.points}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                minTickGap={18}
              />
              <YAxis
                yAxisId="acc"
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                width={36}
              />
              <YAxis yAxisId="vol" orientation="right" hide domain={[0, 'dataMax * 2']} />
              <Tooltip content={renderEvolutionTooltip} />
              <Bar
                yAxisId="vol"
                dataKey="questions"
                fill="#4f46e5"
                fillOpacity={0.14}
                radius={[6, 6, 0, 0]}
                barSize={20}
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

        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3.5 text-sm font-bold text-slate-700 leading-relaxed">
          {evolutionNarrative}
        </div>
      </div>

      {/* BLOQUE 3: DESGLOSE POR TEMARIOS Y TEMAS (COMPRIMIDO INICIALMENTE) */}
      <div className="rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              <Layers size={14} className="text-indigo-600" />
              {t('Desglose por temarios y temas', 'Gai-zerrenda eta gaikako banaketa')}
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">
              {t('Tu mapa completo de temas', 'Zure gaien mapa osoa')}
            </h3>
            <p className="text-xs font-medium text-slate-500">
              {t(
                'Los temarios empiezan comprimidos para evitar scroll largo: despliega cada bloque o tema para ver su detalle.',
                'Gai-zerrendak tolestuta hasten dira: zabaldu bloke edo gai bakoitza xehetasunak ikusteko.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!singleScope && !lawCurriculum ? (
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
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
                    aria-pressed={topicScopeFilter === item.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                      topicScopeFilter === item.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
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
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition-all ${
                    topicStatusFilter === item.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
              <button
                type="button"
                onClick={() => setTopicView('list')}
                aria-pressed={topicView === 'list'}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                  topicView === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {t('Lista', 'Zerrenda')}
              </button>
              <button
                type="button"
                onClick={() => setTopicView('matrix')}
                aria-pressed={topicView === 'matrix'}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                  topicView === 'matrix' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {t('Matriz', 'Matrizea')}
              </button>
              {lawBreakdown.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setTopicView('laws')}
                  aria-pressed={topicView === 'laws'}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                    topicView === 'laws' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {t('Por leyes', 'Legeka')}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* View 1: Collapsed-by-default Topic Accordions */}
        {topicView === 'list' ? (
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
                  className="text-xs font-black text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-xl bg-indigo-50"
                >
                  {anyScopeExpanded
                    ? t('Comprimir temarios', 'Gai-zerrendak tolestu')
                    : t('Desplegar todos los temas', 'Gai guztiak zabaldu')}
                </button>
              </div>

              {groupedTopics.map((group) => {
                const isExpanded = Boolean(expandedScopes[group.scope]);
                return (
                  <div
                    key={group.scope}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleScopeExpand(group.scope)}
                      className="w-full px-4 py-4 sm:px-5 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shrink-0">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-base font-black text-slate-900 truncate">
                            {group.label}
                          </div>
                          <div className="text-xs font-bold text-slate-500">
                            {group.summary.topicCount} {t('temas', 'gai')} ·{' '}
                            {group.summary.coveragePct}% {t('visto', 'ikusita')}
                            {group.summary.riskCount > 0 ? (
                              <span className="text-rose-600">
                                {' '}
                                · {group.summary.riskCount} {t('en riesgo', 'arriskuan')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-400">
                            {t('Acierto', 'Doitasuna')}
                          </div>
                          <div className="text-lg font-black text-slate-900 tabular-nums">
                            {group.summary.accuracyPct == null
                              ? '—'
                              : `${group.summary.accuracyPct}%`}
                          </div>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-black text-indigo-600">
                          {isExpanded
                            ? t('Ocultar', 'Ezkutatu')
                            : t('Ver temas', 'Gaiak ikusi')}
                        </span>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-slate-200 bg-white divide-y divide-slate-100">
                        {group.items.map((topic) => {
                          const topicOpen = Boolean(expandedTopicIds[topic.id]);
                          const accColor =
                            topic.accuracyPct == null
                              ? '#94a3b8'
                              : topic.accuracyPct >= 78
                                ? '#10b981'
                                : topic.accuracyPct >= 62
                                  ? '#f59e0b'
                                  : '#ef4444';
                          const memTotal = Math.max(1, topic.questionCount);

                          return (
                            <div key={topic.id} className="px-4 py-3 sm:px-5">
                              <button
                                type="button"
                                aria-expanded={topicOpen}
                                onClick={() => toggleTopicExpand(topic.id)}
                                className="w-full flex flex-wrap items-center justify-between gap-3 text-left"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span className="text-slate-400 shrink-0">
                                    {topicOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-black text-slate-900 truncate">
                                      {topic.label}
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                      <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0">
                                        <div
                                          className="h-full bg-indigo-600 rounded-full"
                                          style={{ width: `${topic.coveragePct}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-bold text-slate-500 tabular-nums">
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
                                      pp
                                    </span>
                                  ) : topic.status === 'unexplored' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs font-bold text-slate-500">
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
                                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 pl-6">
                                  <div className="space-y-2 flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-bold">
                                      <span>{t('Madurez de memoria', 'Memoria-egoera')}</span>
                                      <span>
                                        {t('Dominadas', 'Menderatuak')}: {topic.masteredCount} ·{' '}
                                        {t('Sólidas', 'Sendoak')}: {topic.solidCount} ·{' '}
                                        {t('Frágiles', 'Hauskorrak')}:{' '}
                                        <strong className="text-rose-600">{topic.fragileCount}</strong>
                                      </span>
                                    </div>
                                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex gap-0.5">
                                      <div className="bg-emerald-500" style={{ width: `${(topic.masteredCount / memTotal) * 100}%` }} />
                                      <div className="bg-indigo-500" style={{ width: `${(topic.solidCount / memTotal) * 100}%` }} />
                                      <div className="bg-amber-400" style={{ width: `${(topic.consolidatingCount / memTotal) * 100}%` }} />
                                      <div className="bg-rose-500" style={{ width: `${(topic.fragileCount / memTotal) * 100}%` }} />
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4 shrink-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-400">
                                        {t('Tendencia', 'Joera')}:
                                      </span>
                                      <TopicSparkline values={topic.checkpoints} color={accColor} />
                                    </div>
                                    {onPracticeTopic ? (
                                      <button
                                        type="button"
                                        onClick={() => onPracticeTopic(topic.label, topic.scope)}
                                        className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-colors"
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
        ) : topicView === 'matrix' ? (
          /* View 2: Priority Matrix (Coverage x Accuracy) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-8 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              {matrixData.length === 0 ? (
                <div className="p-6 text-sm font-bold text-slate-500">
                  {t('Sin temas suficientes para la matriz.', 'Ez dago gai nahikorik matrizerako.')}
                </div>
              ) : (
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
                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name={t('Acierto', 'Doitasuna')}
                        domain={[0, 100]}
                        unit="%"
                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                        width={40}
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
                          const fill =
                            entry.status === 'risk'
                              ? '#ef4444'
                              : entry.status === 'improving'
                                ? '#10b981'
                                : entry.status === 'unexplored'
                                  ? '#94a3b8'
                                  : '#4f46e5';
                          return <Cell key={entry.id} fill={fill} fillOpacity={0.78} />;
                        })}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs font-bold text-slate-500">
                <span>{t('Eje X: Cobertura (%) · Eje Y: Acierto (%)', 'X ardatza: Estaldura (%) · Y ardatza: Doitasuna (%)')}</span>
                <span>{t('Abajo-derecha = Fuga de puntos (alta prioridad)', 'Behean-eskuinean = Puntu ihesa (lehentasuna)')}</span>
              </div>
            </div>

            <div className="lg:col-span-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-4">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                {t('Inspector de tema', 'Gaiaren xehetasuna')}
              </div>
              {selectedMatrixTopic ? (
                <>
                  <div className="text-base font-black text-slate-900">
                    {selectedMatrixTopic.label}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-slate-400 font-bold">{t('Cobertura', 'Estaldura')}</div>
                      <div className="text-lg font-black text-slate-900 tabular-nums">
                        {selectedMatrixTopic.coveragePct}%
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-slate-400 font-bold">{t('Acierto', 'Doitasuna')}</div>
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
                      className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700"
                    >
                      {t('Practicar este tema', 'Gai hau praktikatu')}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="text-xs font-bold text-slate-500">
                  {t('Sin datos todavía.', 'Daturik gabe oraindik.')}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* View 3: Collapsed-by-default Law Breakdown */
          <div className="space-y-2.5">
            {lawBreakdown.map((law) => {
              const lawKey = law.lawId ?? law.ley_referencia;
              const open = Boolean(expandedLawIds[lawKey]);
              const acc = Math.round((law.accuracyRate ?? 0) * 100);
              const qCount = law.questionCount ?? 0;
              return (
                <div
                  key={lawKey}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setExpandedLawIds((prev) => ({ ...prev, [lawKey]: !prev[lawKey] }))
                    }
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-slate-400">
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-900 truncate">
                          {law.shortTitle ?? law.ley_referencia}
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          {law.attempts} {t('intentos', 'saiakera')}
                          {qCount > 0 ? ` · ${law.consolidatedCount ?? 0}/${qCount} ${t('consolidadas', 'sendotuak')}` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="text-base font-black text-slate-900 tabular-nums">{acc}%</span>
                  </button>
                  {open && law.blocks && law.blocks.length > 0 ? (
                    <div className="border-t border-slate-200 bg-white divide-y divide-slate-100 px-4 py-2">
                      {law.blocks.map((block) => (
                        <div
                          key={block.blockId}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="font-bold text-slate-700 truncate">{block.title}</span>
                          <span className="font-black text-slate-900 tabular-nums">
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
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                <Target size={14} className="text-indigo-600" />
                {t('Transferencia real', 'Benetako transferentzia')}
              </div>
              <h3 className="mt-1 text-xl font-black text-slate-900">
                {t('En foco (1 tema) vs. Mezclado / Largo', 'Fokuan (gai 1) vs. Nahastua / Luzea')}
              </h3>
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
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
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

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
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
          </div>
        </div>

        {/* Card B: Aguante, Precipitación y Recuperación */}
        <div className="lg:col-span-6 rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              <Activity size={14} className="text-amber-600" />
              {t('Comportamiento en tus tests', 'Zure testetako portaera')}
            </div>
            <h3 className="mt-1 text-xl font-black text-slate-900">
              {t('Aguante, Precipitación y Recuperación', 'Eustea, Presa eta Berreskurapena')}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-800">
                <span>{t('Tests largos (≥25 preg.)', 'Test luzeak (≥25 gal.)')}</span>
                <span className="text-indigo-600 tabular-nums">
                  {behavior?.longSessionDropPp == null
                    ? '—'
                    : `${behavior.longSessionDropPp > 0 ? `+${behavior.longSessionDropPp}` : behavior.longSessionDropPp} pts`}
                </span>
              </div>
              {behavior?.longSessionFirstHalfAcc != null && behavior.longSessionSecondHalfAcc != null ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('1ª mitad', '1. erdia')}</span>
                    <strong className="text-slate-900">{behavior.longSessionFirstHalfAcc}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('Tramo final', 'Azken zatia')}</span>
                    <strong className="text-slate-900">{behavior.longSessionSecondHalfAcc}%</strong>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-medium text-slate-500">
                  {t('Haz sesiones de ≥25 preguntas para medir aguante.', 'Egin ≥25 galderako saioak eustea neurtzeko.')}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-800">
                <span>{t('Fallos evitables', 'Akats saihesgarriak')}</span>
                <span className="text-rose-600 tabular-nums">
                  {behavior?.avoidableErrorRate == null ? '—' : `${behavior.avoidableErrorRate}%`}
                </span>
              </div>
              {behavior?.avoidableErrorRate != null ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('Rápidos (<2,5s)', 'Azkarregi (<2,5s)')}</span>
                    <strong className="text-slate-900">{behavior.fastErrorRate ?? 0}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('Cambió a peor', 'Okerrera aldatuak')}</span>
                    <strong className="text-slate-900">{behavior.changedToWrongRate ?? 0}%</strong>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-medium text-slate-500">
                  {t('Se activa al reunir suficientes fallos cronometrados.', 'Nahikoa akats kronometratu biltzean aktibatzen da.')}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-black text-slate-800">
              <span>{t('Recuperación de preguntas falladas', 'Huts egindako galderen berreskurapena')}</span>
              <span className="text-emerald-600 tabular-nums">
                {errorRecovery.totalFailed > 0
                  ? `${Math.round((errorRecovery.recovered / errorRecovery.totalFailed) * 100)}% ${t('recuperadas', 'berreskuratuak')}`
                  : '—'}
              </span>
            </div>
            {errorRecovery.totalFailed > 0 ? (
              <>
                <div className="h-2.5 w-full rounded-full bg-white border border-slate-200 overflow-hidden flex gap-0.5">
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${(errorRecovery.recovered / errorRecovery.totalFailed) * 100}%` }}
                  />
                  <div
                    className="bg-amber-400"
                    style={{ width: `${(errorRecovery.recovering / errorRecovery.totalFailed) * 100}%` }}
                  />
                  <div
                    className="bg-rose-500"
                    style={{ width: `${(errorRecovery.reincident / errorRecovery.totalFailed) * 100}%` }}
                  />
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-xs font-bold text-slate-600">
                  <span>
                    <strong className="text-emerald-600">{errorRecovery.recovered}</strong>{' '}
                    {t('recuperadas', 'berreskuratuak')}
                  </span>
                  <span>
                    <strong className="text-amber-600">{errorRecovery.recovering}</strong>{' '}
                    {t('en proceso', 'bidean')}
                  </span>
                  <span>
                    <strong className="text-rose-600">{errorRecovery.reincident}</strong>{' '}
                    {t('reincidentes', 'errepikatuak')}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs font-medium text-slate-500">
                {t('Aún no hay historial de fallos repetidos.', 'Oraindik ez dago huts errepikatuen historikorik.')}
              </p>
            )}
          </div>
        </div>

        {/* Card C: Modalidades ponderadas por preguntas */}
        <div className="lg:col-span-5 rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7 space-y-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              {t('Ponderado por preguntas', 'Galderaka haztatua')}
            </div>
            <h3 className="mt-1 text-xl font-black text-slate-900">
              {t('Cómo repartes tu práctica', 'Nola banatzen duzun praktika')}
            </h3>
          </div>

          {modeDistribution.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-500">
              {t('Aún no hay sesiones registradas.', 'Oraindik ez dago saiorik erregistratuta.')}
            </div>
          ) : (
            <div className="space-y-3">
              {modeDistribution.map((item, idx) => (
                <div key={item.kind} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-black text-slate-800 truncate">{item.label}</span>
                    <span className="text-slate-500 font-bold shrink-0 tabular-nums">
                      <strong className="text-slate-900">{item.questions}</strong> {t('preg.', 'gal.')} (
                      {item.sharePct}%) ·{' '}
                      <strong className="text-indigo-600">
                        {item.accuracyPct == null ? '—' : `${item.accuracyPct}%`}
                      </strong>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
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
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                {t('Hábito mensual (Color = Acierto · Punto = Volumen)', 'Hileko ohitura (Kolorea = Doitasuna)')}
              </div>
              <h3 className="mt-1 text-xl font-black text-slate-900">{calendarLabel}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t('Mes anterior', 'Aurreko hilabetea')}
                onClick={() =>
                  setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label={t('Mes siguiente', 'Hurrengo hilabetea')}
                onClick={() =>
                  setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm font-bold text-slate-500">
              {t('Aún no hay sesiones registradas.', 'Oraindik ez dago saiorik erregistratuta.')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <div className="md:col-span-7 space-y-2">
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-black text-slate-400">
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
                      ? 'border-slate-100 bg-slate-50 text-slate-300'
                      : acc != null && acc >= 80
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : acc != null && acc >= 60
                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                          : 'border-rose-200 bg-rose-50 text-rose-900';
                    const dotColor =
                      acc != null && acc >= 80
                        ? 'bg-emerald-500'
                        : acc != null && acc >= 60
                          ? 'bg-amber-500'
                          : 'bg-rose-500';

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onClick={() => setSelectedDate(cell.iso)}
                        title={
                          summary
                            ? `${formatLongDate(cell.date, locale)} · ${summary.totalQuestions} ${t('preguntas', 'galdera')} · ${acc ?? 0}%`
                            : `${formatLongDate(cell.date, locale)} · ${t('Sin actividad', 'Jarduerarik gabe')}`
                        }
                        className={`h-10 rounded-xl border text-xs font-black flex flex-col items-center justify-center transition-all ${colorClass} ${
                          isSelected ? 'ring-2 ring-indigo-600' : ''
                        } ${cell.inMonth ? '' : 'opacity-45'}`}
                      >
                        <span>{cell.date.getDate()}</span>
                        {summary ? (
                          <span
                            className={`rounded-full mt-0.5 ${dotColor} ${
                              summary.totalQuestions >= 40 ? 'w-2 h-2' : 'w-1.5 h-1.5'
                            }`}
                          />
                        ) : null}
                      </button>
                    );
                  })}
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
                {!singleScope ? (
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
                    {(['common', 'specific'] as const).map((scope) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => {
                          setBlockScope(scope);
                          setSelectedBlockStart(null);
                        }}
                        aria-pressed={blockScope === scope}
                        className={`rounded-lg px-3 py-2 text-xs font-black transition-all ${
                          blockScope === scope
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
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none"
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
