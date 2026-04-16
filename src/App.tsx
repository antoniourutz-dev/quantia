import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
import {
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Database,
  Menu,
  Settings,
  Users,
  TrendingUp,
  BookOpen,
  Flame,
  Star,
  Trophy,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import EntryScreen from './components/EntryScreen';
import TestSelection from './components/TestSelection';
import TestInterface from './components/TestInterface';
import PostTestStats from './components/PostTestStats';
import StudyExplorer from './components/StudyExplorer';
import MobileTabBar from './components/MobileTabBar';
import MobileTopBar from './components/MobileTopBar';
import SettingsPanel from './components/SettingsPanel';
import Dashboard from './components/dashboard/Dashboard';
import { supabaseConfigError } from './lib/supabaseConfig';
import { getSafeSupabaseSession, supabase } from './lib/supabaseClient';
import { loginWithUsername } from './lib/auth';
import { createId } from './lib/id';
import {
  buildFallbackCurriculumOptions,
  DEFAULT_CURRICULUM,
  formatCurriculumLabel,
  getAvailableCurriculums,
  getCurriculumCategoryGroupLabel,
  getCurriculumCategoryOptions,
  getCurriculumQuestionNumberBounds,
  getPracticeBatchByCategory,
  getRandomPracticeBatch,
  getQuestionsByNumberRange,
  getStudyQuestionsSlice,
  getWeakPracticeBatch,
  loadDashboardBundle,
  recordPracticeSessionInCloud,
  signOut,
  updateMyExamTarget,
  type CurriculumOption,
  type DashboardBundle,
} from './lib/quantiaApi';
import { buildCoachPlanV2 } from './lib/coach';
import { getContinuityLine } from './lib/continuity';
import { trackDecisionOnce, trackEffect } from './lib/telemetry';

const StatsDashboard = lazy(() => import('./components/StatsDashboard'));
const StudyQuestionBank = lazy(() => import('./components/StudyQuestionBank'));
const TelemetryDebugPanel = lazy(() => import('./components/TelemetryDebugPanel'));
const AdminQuestions = lazy(() => import('./components/admin/AdminQuestions'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminStudents = lazy(() => import('./components/admin/AdminStudents'));
const AdminCatalogs = lazy(() => import('./components/admin/AdminCatalogs'));
import {
  buildCoachCopySeed,
  buildHeaderStatusCopy,
  buildWeakAreaCopy,
  buildWeeklyDeltaLabel,
  getSurfaceCopy,
  resolveCoachSurfaceState,
} from './lib/coachCopyV2';
import {
  LocaleProvider,
  getLocaleForCurriculum,
  getWeekdayLabels,
  isLawSelectionCurriculum as hasLawSelection,
  isSingleScopeCurriculum,
} from './lib/locale';
import {
  ActivePracticeSession,
  AccountIdentity,
  FinishedTestPayload,
  PracticeMode,
  Question,
  SyllabusType,
  TestResult,
  formatModeLabel,
  formatSyllabusLabel,
} from './types';

type View =
  | 'dashboard'
  | 'study'
  | 'study-bank'
  | 'study-active'
  | 'test-selection'
  | 'test-active'
  | 'stats'
  | 'test-results'
  | 'settings'
  | 'admin-questions'
  | 'admin-dashboard'
  | 'admin-students'
  | 'admin-catalogs'
  | 'telemetry';

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const curriculumHasActivity = (option: CurriculumOption) =>
  (option.sessionCount ?? 0) > 0 ||
  (option.answeredCount ?? 0) > 0 ||
  Boolean(option.lastStudiedAt);
const normalizeUserIdentifier = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const normalizeCurriculumId = (value: string | null | undefined) =>
  String(value ?? '').trim().toLowerCase().replace(/_/g, '-');
const isGoiTeknikariaCurriculum = (value: string | null | undefined) => {
  const normalized = normalizeCurriculumId(value);
  return normalized === 'goi-teknikaria' || normalized.startsWith('goi-teknikaria-');
};

const ADMIN_EMAIL = 'admin@oposik.app';
const getRestrictedCurriculumForIdentity = (
  session: Session | null,
  identity: AccountIdentity | null | undefined,
) => {
  const identifiers = new Set<string>();
  const email = normalizeUserIdentifier(session?.user?.email);
  if (email) {
    identifiers.add(email);
    const [localPart] = email.split('@');
    if (localPart) identifiers.add(localPart);
  }

  const metadataUsername = normalizeUserIdentifier(
    typeof session?.user?.user_metadata?.username === 'string'
      ? session.user.user_metadata.username
      : typeof session?.user?.user_metadata?.preferred_username === 'string'
        ? session.user.user_metadata.preferred_username
        : null,
  );
  if (metadataUsername) identifiers.add(metadataUsername);

  const currentUsername = normalizeUserIdentifier(identity?.current_username);
  if (currentUsername) identifiers.add(currentUsername);

  for (const previous of identity?.previous_usernames ?? []) {
    const normalized = normalizeUserIdentifier(previous);
    if (normalized) identifiers.add(normalized);
  }

  if (identifiers.has('eneko@oposik.app') || identifiers.has('eneko')) {
    return 'goi-teknikaria';
  }

  return null;
};
const GOI_TEKNIKARIA_FALLBACK_OPTION: CurriculumOption = {
  id: 'goi-teknikaria',
  label: 'Goi-teknikaria',
};

const CURRICULUM_STORAGE_KEY = 'quantia_curriculum';
const LEGACY_CURRICULUM_STORAGE_KEY = 'osakitest_curriculum';

export default function App() {
  const [curriculum, setCurriculum] = useState<string>(() => {
    try {
      return (
        window.localStorage.getItem(CURRICULUM_STORAGE_KEY) ||
        window.localStorage.getItem(LEGACY_CURRICULUM_STORAGE_KEY) ||
        DEFAULT_CURRICULUM
      );
    } catch {
      // ignore
    }
    return DEFAULT_CURRICULUM;
  });
  const [curriculumOptions, setCurriculumOptions] = useState<CurriculumOption[]>(() =>
    buildFallbackCurriculumOptions(curriculum),
  );
  const [curriculumOptionsLoading, setCurriculumOptionsLoading] = useState(false);
  const [curriculumMenuOpen, setCurriculumMenuOpen] = useState(false);
  const [curriculumMenuStyle, setCurriculumMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedSyllabus, setSelectedSyllabus] = useState<SyllabusType | null>(null);
  const [selectedLawFilter, setSelectedLawFilter] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unauthView, setUnauthView] = useState<'entry' | 'login'>('entry');
  const [bundle, setBundle] = useState<DashboardBundle | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [syncingSession, setSyncingSession] = useState(false);
  const [activeSession, setActiveSession] = useState<ActivePracticeSession | null>(null);
  const [lastTestPayload, setLastTestPayload] = useState<FinishedTestPayload | null>(null);
  const [activeStudySession, setActiveStudySession] = useState<ActivePracticeSession | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [discoveredLawOptions, setDiscoveredLawOptions] = useState<string[]>([]);
  const [discoveredLawOptionsLoading, setDiscoveredLawOptionsLoading] = useState(false);
  const curriculumMenuRef = useRef<HTMLDivElement | null>(null);
  const curriculumTriggerRef = useRef<HTMLButtonElement | null>(null);
  const curriculumMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const locale = getLocaleForCurriculum(curriculum);
  const isBasque = locale === 'eu';
  const t = useCallback((es: string, eu: string) => (isBasque ? eu : es), [isBasque]);
  const weekdayLabels = useMemo(() => getWeekdayLabels(locale), [locale]);
  const isLawSelectionCurriculum = useMemo(() => hasLawSelection(curriculum), [curriculum]);
  const isSingleScopePracticeCurriculum = useMemo(() => isSingleScopeCurriculum(curriculum), [curriculum]);
  const restrictedCurriculum = useMemo(
    () => getRestrictedCurriculumForIdentity(session, bundle?.identity ?? null),
    [bundle?.identity, session],
  );
  const isAdminEmail = normalizeUserIdentifier(session?.user?.email) === ADMIN_EMAIL;
  useEffect(() => {
    if (
      (currentView === 'admin-questions' ||
        currentView === 'admin-dashboard' ||
        currentView === 'admin-students' ||
        currentView === 'admin-catalogs') &&
      !isAdminEmail
    ) {
      setCurrentView('dashboard');
    }
    if (currentView === 'dashboard' && isAdminEmail) {
      setCurrentView('admin-dashboard');
    }
  }, [currentView, isAdminEmail]);
  const visibleCurriculumOptions = useMemo(() => {
    if (!restrictedCurriculum) return curriculumOptions;

    const matches = curriculumOptions.filter((option) => isGoiTeknikariaCurriculum(option.id));
    if (matches.length === 0) {
      return [GOI_TEKNIKARIA_FALLBACK_OPTION];
    }

    const scored = [...matches].sort((left, right) => {
      const score = (option: CurriculumOption) =>
        (typeof option.questionCount === 'number' && option.questionCount > 0 ? 4 : 0) +
        (curriculumHasActivity(option) ? 2 : 0) +
        (isGoiTeknikariaCurriculum(option.id) ? 1 : 0);
      return score(right) - score(left);
    });

    return [scored[0]];
  }, [curriculumOptions, restrictedCurriculum]);

  useEffect(() => {
    if (currentView === 'test-active' || currentView === 'study-active') {
      setSidebarOpen(false);
    }
  }, [currentView]);

  const telemetryEnabled = useMemo(() => {
    if (bundle?.identity.is_admin) return true;
    try {
      if (window.localStorage.getItem('quantia.debug.telemetry') === '1') return true;
    } catch {
      void 0;
    }
    try {
      return new URLSearchParams(window.location.search).get('telemetry') === '1';
    } catch {
      return false;
    }
  }, [bundle?.identity.is_admin]);

  useEffect(() => {
    if (currentView !== 'telemetry') return;
    if (telemetryEnabled) return;
    setCurrentView('dashboard');
  }, [currentView, telemetryEnabled]);

  const refreshDashboard = useCallback(async () => {
    if (!session) return;
    if (restrictedCurriculum && !isGoiTeknikariaCurriculum(curriculum)) return;

    setDataLoading(true);
    setDataError(null);
    try {
      const nextBundle = await loadDashboardBundle(curriculum);
      setBundle(nextBundle);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : t('No se ha podido cargar el panel.', 'Ezin izan da panela kargatu.'),
      );
    } finally {
      setDataLoading(false);
    }
  }, [curriculum, restrictedCurriculum, session, t]);

  useEffect(() => {
    let disposed = false;

    getSafeSupabaseSession()
      .then((nextSession) => {
        if (!disposed) {
          setSession(nextSession);
          setSessionReady(true);
        }
      })
      .catch((error) => {
        if (!disposed) {
          setAuthError(
            error instanceof Error ? error.message : t('No se ha podido leer la sesion.', 'Ezin izan da saioa irakurri.'),
          );
          setSessionReady(true);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthError(null);
      if (!nextSession) {
        setBundle(null);
        setCurriculumOptions(buildFallbackCurriculumOptions());
        setActiveSession(null);
        setCurrentView('dashboard');
      }
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [t]);

  useEffect(() => {
    if (!session) return;

    let disposed = false;
    setCurriculumOptionsLoading(true);

    getAvailableCurriculums(curriculum)
      .then((options) => {
        if (disposed) return;
        setCurriculumOptions(options);
      })
      .catch(() => {
        if (disposed) return;
        setCurriculumOptions(buildFallbackCurriculumOptions(curriculum));
      })
      .finally(() => {
        if (!disposed) {
          setCurriculumOptionsLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [curriculum, session]);

  const bundleLawOptions = useMemo(() => {
    const labels = (bundle?.practiceState.learningDashboardV2?.lawBreakdown ?? [])
      .map((item) => getCurriculumCategoryGroupLabel(curriculum, item.ley_referencia))
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);

    return Array.from(new Set(labels)).sort((a, b) => a.localeCompare(b, locale === 'eu' ? 'eu' : 'es'));
  }, [bundle, curriculum, locale]);

  const lawOptions = useMemo(() => {
    const labels = [...bundleLawOptions, ...discoveredLawOptions]
      .map((value) => value.trim())
      .filter(Boolean);

    return Array.from(new Set(labels)).sort((a, b) => a.localeCompare(b, locale === 'eu' ? 'eu' : 'es'));
  }, [bundleLawOptions, discoveredLawOptions, locale]);

  useEffect(() => {
    if (!session || !isLawSelectionCurriculum) {
      setDiscoveredLawOptions([]);
      setDiscoveredLawOptionsLoading(false);
      return;
    }

    let disposed = false;
    setDiscoveredLawOptionsLoading(true);

    getCurriculumCategoryOptions(curriculum)
      .then((options) => {
        if (disposed) return;
        setDiscoveredLawOptions(options);
      })
      .catch(() => {
        if (disposed) return;
        setDiscoveredLawOptions([]);
      })
      .finally(() => {
        if (!disposed) {
          setDiscoveredLawOptionsLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [curriculum, isLawSelectionCurriculum, session]);

  useEffect(() => {
    if (restrictedCurriculum && !isGoiTeknikariaCurriculum(curriculum)) {
      const nextCurriculum = visibleCurriculumOptions[0]?.id ?? restrictedCurriculum;
      if (!nextCurriculum) return;
      setCurriculum(nextCurriculum);
      try {
        window.localStorage.setItem(CURRICULUM_STORAGE_KEY, nextCurriculum);
        window.localStorage.setItem(LEGACY_CURRICULUM_STORAGE_KEY, nextCurriculum);
      } catch {
        // ignore
      }
      return;
    }

    if (curriculumOptionsLoading) return;
    if (visibleCurriculumOptions.length === 0) return;
    const currentOption = visibleCurriculumOptions.find((option) => option.id === curriculum);
    const availableOption =
      visibleCurriculumOptions.find(
        (option) => typeof option.questionCount === 'number' && option.questionCount > 0,
      ) ??
      visibleCurriculumOptions.find((option) => curriculumHasActivity(option)) ??
      visibleCurriculumOptions[0];

    if (
      currentOption &&
      (
        currentOption.questionCount == null ||
        currentOption.questionCount > 0 ||
        curriculumHasActivity(currentOption)
      )
    ) {
      return;
    }

    const nextCurriculum = availableOption?.id;
    if (!nextCurriculum) return;
    if (nextCurriculum === curriculum) return;

    setCurriculum(nextCurriculum);
    try {
      window.localStorage.setItem(CURRICULUM_STORAGE_KEY, nextCurriculum);
      window.localStorage.setItem(LEGACY_CURRICULUM_STORAGE_KEY, nextCurriculum);
    } catch {
      // ignore
    }
  }, [curriculum, curriculumOptionsLoading, restrictedCurriculum, visibleCurriculumOptions]);

  useEffect(() => {
    if (!session) return;
    void refreshDashboard();
  }, [refreshDashboard, session]);

  const coachPlan = useMemo(() => {
    if (!bundle) return null;

    const totalBatches = Math.max(1, Math.ceil(Math.max(bundle.questionsCount, 1) / 20));
    return buildCoachPlanV2({
      learningDashboard: bundle.practiceState.learningDashboard,
      learningDashboardV2: bundle.practiceState.learningDashboardV2,
      pressureInsights: bundle.practiceState.pressureInsights,
      pressureInsightsV2: bundle.practiceState.pressureInsightsV2,
      examTarget: bundle.practiceState.examTarget,
      recentSessions: bundle.practiceState.recentSessions,
      recommendedBatchNumber: 1,
      totalBatches,
      batchSize: 20,
    });
  }, [bundle]);
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
        extra: coachPlan?.primaryAction ?? 'base',
      }),
    [bundle?.identity.current_username, coachPlan?.primaryAction, coachSurfaceState, curriculum],
  );
  const heroCopy = useMemo(
    () =>
      getSurfaceCopy({
        state: coachSurfaceState,
        surface: 'homeHero',
        locale,
        seed: `${coachCopySeed}:hero`,
      }),
    [coachCopySeed, coachSurfaceState, locale],
  );
  const homeCardCopy = useMemo(
    () =>
      getSurfaceCopy({
        state: coachSurfaceState,
        surface: 'homeCard',
        locale,
        seed: `${coachCopySeed}:home-card`,
      }),
    [coachCopySeed, coachSurfaceState, locale],
  );
  const statsSurfaceCopy = useMemo(
    () =>
      getSurfaceCopy({
        state: coachSurfaceState,
        surface: 'statsSummary',
        locale,
        seed: `${coachCopySeed}:stats`,
      }),
    [coachCopySeed, coachSurfaceState, locale],
  );
  const continuityLine = useMemo(() => getContinuityLine(locale, curriculum), [curriculum, locale]);

  useEffect(() => {
    if (!bundle) return;
    const confidence =
      bundle.practiceState.learningDashboardV2?.examReadinessConfidenceFlag ??
      bundle.practiceState.pressureInsightsV2?.confidenceFlag ??
      null;

    if (currentView === 'dashboard') {
      trackDecisionOnce(
        `home:${curriculum}:${coachSurfaceState}:${coachPlan?.primaryAction ?? ''}:${heroCopy.cta ?? ''}`,
        {
          surface: 'home',
          curriculum,
          dominantState: coachSurfaceState,
          primaryAction: coachPlan?.primaryAction ?? null,
          tone: coachPlan?.tone ?? null,
          visibleCta: heroCopy.cta ?? null,
          confidence,
        },
      );
    }

    if (currentView === 'stats') {
      trackDecisionOnce(
        `stats:${curriculum}:${coachSurfaceState}:${coachPlan?.primaryAction ?? ''}`,
        {
          surface: 'stats',
          curriculum,
          dominantState: coachSurfaceState,
          primaryAction: coachPlan?.primaryAction ?? null,
          tone: coachPlan?.tone ?? null,
          visibleCta: t('Hacer sesion recomendada', 'Gomendatutako saioa egin'),
          confidence,
        },
      );
    }
  }, [bundle, coachPlan?.primaryAction, coachPlan?.tone, coachSurfaceState, currentView, curriculum, heroCopy.cta, t]);

  const statsResults = useMemo<TestResult[]>(() => {
    if (!bundle) return [];
    return bundle.practiceState.recentSessions.map((sessionSummary) => ({
      id: sessionSummary.id,
      date: (sessionSummary.finishedAt || sessionSummary.startedAt || '').slice(0, 10),
      score: sessionSummary.score,
      total: sessionSummary.total,
      mode: sessionSummary.mode,
      label: formatModeLabel(sessionSummary.mode, locale),
    }));
  }, [bundle, locale]);

  const dashboardMetrics = useMemo(() => {
    if (!bundle) {
      return {
        commonProgress: null as number | null,
        specificProgress: null as number | null,
        weeklyQuestions: 0,
        accuracyRate: null as number | null,
        weakAreasBadge: undefined as string | undefined,
        weeklyInsightData: weekdayLabels.map((label) => ({ name: label, questions: 0 })),
        weeklyInsightSummary: t(
          'Todavia no hay movimiento suficiente para sacar una lectura util de la semana.',
          'Oraindik ez dago nahikoa mugimendurik astearen irakurketa erabilgarria egiteko.',
        ),
        weeklyInsightDelta: t('Semana por arrancar', 'Astea hasteko dago'),
      };
    }

    const topicBreakdown = bundle.practiceState.learningDashboardV2?.topicBreakdown ?? [];
    const buildScopeProgress = (scope: SyllabusType) => {
      let total = 0;
      let seen = 0;
      for (const topic of topicBreakdown) {
        if (topic.scope !== scope) continue;
        const questionCount = topic.questionCount ?? 0;
        const unseenCount = topic.unseenCount ?? 0;
        total += questionCount;
        seen += Math.max(0, questionCount - unseenCount);
      }
      return total > 0 ? Math.round((seen / total) * 100) : null;
    };

    const now = new Date();
    const startToday = startOfDay(now);
    const startLast7 = new Date(startToday);
    startLast7.setDate(startLast7.getDate() - 6);
    const startPrev7 = new Date(startLast7);
    startPrev7.setDate(startPrev7.getDate() - 7);

    const recentSessions = bundle.practiceState.recentSessions;
    const perDay = weekdayLabels.map((label) => ({ name: label, questions: 0 }));
    let currentWeekQuestions = 0;
    let previousWeekQuestions = 0;

    for (const sessionSummary of recentSessions) {
      const rawDate = sessionSummary.finishedAt || sessionSummary.startedAt;
      const sessionDate = rawDate ? new Date(rawDate) : null;
      if (!sessionDate || Number.isNaN(sessionDate.getTime())) continue;

      const dayStart = startOfDay(sessionDate);
      if (dayStart >= startLast7 && dayStart <= startToday) {
        currentWeekQuestions += sessionSummary.total;
        perDay[sessionDate.getDay()].questions += sessionSummary.total;
      } else if (dayStart >= startPrev7 && dayStart < startLast7) {
        previousWeekQuestions += sessionSummary.total;
      }
    }

    const learningV2 = bundle.practiceState.learningDashboardV2;
    const pressureV2 = bundle.practiceState.pressureInsightsV2;
    const observedOk = Boolean(learningV2?.observedAccuracySampleOk) && (learningV2?.observedAccuracyN ?? 0) >= 15;
    const pressureOk = Boolean(pressureV2?.sampleOk) && (pressureV2?.learningQuestionN ?? 0) >= 15;

    const accuracyRate =
      observedOk && learningV2
        ? Math.round((learningV2.observedAccuracyRate ?? 0) * 100)
        : pressureOk && pressureV2?.learningAccuracy != null
          ? Math.round(pressureV2.learningAccuracy * 100)
          : null;

    return {
      commonProgress: buildScopeProgress('common'),
      specificProgress: buildScopeProgress('specific'),
      weeklyQuestions: currentWeekQuestions,
      accuracyRate,
      weakAreasBadge:
        bundle.weakCategories.length > 0
          ? t(`${bundle.weakCategories.length} temas`, `${bundle.weakCategories.length} gai`)
          : undefined,
      weeklyInsightData: perDay,
      weeklyInsightSummary: [statsSurfaceCopy.line1, statsSurfaceCopy.line2].filter(Boolean).join(' '),
      weeklyInsightDelta: buildWeeklyDeltaLabel({
        locale,
        currentWeekQuestions,
        previousWeekQuestions,
      }),
    };
  }, [bundle, locale, statsSurfaceCopy.line1, statsSurfaceCopy.line2, t, weekdayLabels]);

  const weakCategory = bundle?.weakCategories[0] ?? null;
  const weakAreaCopy = useMemo(
    () =>
      buildWeakAreaCopy({
        locale,
        category: weakCategory?.category ?? null,
        state: coachSurfaceState,
        seed: `${coachCopySeed}:weak`,
      }),
    [coachCopySeed, coachSurfaceState, locale, weakCategory?.category],
  );

  const handleLogin = useCallback(async (username: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const nextSession = await loginWithUsername(username, password);
      setSession(nextSession);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : t('No se ha podido iniciar sesion.', 'Ezin izan da saioa hasi.'),
      );
    } finally {
      setAuthLoading(false);
    }
  }, [t]);

  const handleStartTest = useCallback(
    async (mode: PracticeMode, syllabus?: SyllabusType, count?: number) => {
      setSelectedSyllabus(syllabus ?? null);
      setSelectedLawFilter(null);
      setDataError(null);

      try {
        let questions: Question[] = [];
        let resolvedMode = mode;
        const selectedScopeLabel =
          syllabus
            ? formatSyllabusLabel(syllabus, locale)
            : isSingleScopePracticeCurriculum
              ? null
              : t('Mixto', 'Mistoa');
        let resolvedTitle =
          mode === 'simulacro'
            ? selectedScopeLabel
              ? `${t('Simulacro', 'Simulakroa')} (${selectedScopeLabel})`
              : t('Simulacro', 'Simulakroa')
            : mode === 'quick_five'
              ? t('Test rapido', 'Test azkarra')
              : mode === 'review'
                ? t('Repaso de fallos', 'Akatsen errepasoa')
                : selectedScopeLabel
                  ? `${t('Test', 'Testa')}: ${selectedScopeLabel}`
                  : t('Test', 'Testa');
        const batchSize =
          count ?? (mode === 'simulacro' ? 50 : mode === 'quick_five' ? 5 : 20);
        const scope = syllabus ?? 'all';

        if (mode === 'review') {
          try {
            questions = await getWeakPracticeBatch(batchSize, curriculum, scope);
          } catch (error) {
            questions = await getRandomPracticeBatch(batchSize, curriculum, scope);
            if (questions.length === 0) {
              throw error;
            }

            resolvedMode = 'mixed';
            resolvedTitle = t('Repaso guiado', 'Errepaso gidatua');
          }
        } else if (mode === 'simulacro') {
          questions = await getRandomPracticeBatch(batchSize, curriculum, scope);
        } else {
          questions = await getRandomPracticeBatch(batchSize, curriculum, scope);
        }

        if (questions.length === 0) {
          throw new Error(
            t(
              'No hay preguntas disponibles para ese temario en este momento.',
              'Une honetan ez dago galderarik eskuragarri temario horretarako.',
            ),
          );
        }

        trackEffect({
          surface: 'test',
          curriculum,
          action: 'session_started',
          context: { mode: resolvedMode, syllabus: syllabus ?? null, count: batchSize },
        });

        const session: ActivePracticeSession = {
          id: createId(),
          mode: resolvedMode,
          title: resolvedTitle,
          startedAt: new Date().toISOString(),
          questions,
          batchNumber: 1,
          totalBatches: 1,
          batchStartIndex: null,
          nextStandardBatchStartIndex: null,
        };

        setActiveSession(session);
        setCurrentView('test-active');
      } catch (error) {
        setDataError(
          error instanceof Error
            ? error.message
            : t('No se ha podido arrancar la sesion de test.', 'Ezin izan da test saioa abiatu.'),
        );
      }
    },
    [curriculum, isSingleScopePracticeCurriculum, locale, t],
  );

  const handleStartLawTest = useCallback(
    async (law: string, count = 20) => {
      const normalizedLaw = law.trim();
      if (!normalizedLaw) {
        setDataError(
          t('Selecciona una ley para iniciar el test.', 'Hautatu lege bat testa hasteko.'),
        );
        return;
      }

      setSelectedSyllabus(null);
      setSelectedLawFilter(normalizedLaw);
      setDataError(null);

      try {
        const questions = await getPracticeBatchByCategory(count, curriculum, normalizedLaw);
        if (questions.length === 0) {
          throw new Error(
            t(
              'No hay preguntas disponibles para esa ley en este momento.',
              'Une honetan ez dago galderarik lege horretarako.',
            ),
          );
        }

        const session: ActivePracticeSession = {
          id: createId(),
          mode: 'standard',
          title: `${t('Test por ley', 'Lege bidezko testa')}: ${normalizedLaw}`,
          startedAt: new Date().toISOString(),
          questions,
          batchNumber: 1,
          totalBatches: 1,
          batchStartIndex: null,
          nextStandardBatchStartIndex: null,
        };

        setActiveSession(session);
        setCurrentView('test-active');
      } catch (error) {
        setDataError(
          error instanceof Error
            ? error.message
            : t('No se ha podido arrancar el test por ley.', 'Ezin izan da lege bidezko testa abiatu.'),
        );
      }
    },
    [curriculum, t],
  );

  const handleStartCoachSession = useCallback(async () => {
    const primaryAction = coachPlan?.primaryAction ?? 'standard';
    const coachMode: PracticeMode =
      primaryAction === 'review'
        ? 'review'
        : primaryAction === 'simulacro'
          ? 'simulacro'
          : primaryAction === 'anti_trap'
            ? 'anti_trap'
            : 'standard';

    await handleStartTest(coachMode, undefined, 20);
  }, [coachPlan, handleStartTest]);

  const handleLoadCustomBounds = useCallback(
    async () => getCurriculumQuestionNumberBounds(curriculum),
    [curriculum],
  );

  const handleStartCustomTest = useCallback(
    async (params: { from: number; to: number; randomize: boolean }) => {
      setSelectedSyllabus(null);
      setDataError(null);
      try {
        const questions = await getQuestionsByNumberRange({
          curriculum,
          from: params.from,
          to: params.to,
          randomize: params.randomize,
        });

        if (questions.length === 0) {
          throw new Error(
            t(
              'No hay preguntas disponibles para ese rango en este momento.',
              'Une honetan ez dago galderarik tarte horretarako.',
            ),
          );
        }

        const session: ActivePracticeSession = {
          id: createId(),
          mode: 'custom',
          title: t(
            `Test personalizado (${params.from}–${params.to})${params.randomize ? ' • aleatorio' : ''}`,
            `Test pertsonalizatua (${params.from}–${params.to})${params.randomize ? ' • ausazkoa' : ''}`,
          ),
          startedAt: new Date().toISOString(),
          questions,
          batchNumber: 1,
          totalBatches: 1,
          batchStartIndex: null,
          nextStandardBatchStartIndex: null,
        };

        setActiveSession(session);
        setCurrentView('test-active');
      } catch (error) {
        setDataError(
          error instanceof Error
            ? error.message
            : t('No se ha podido arrancar el test personalizado.', 'Ezin izan da test pertsonalizatua abiatu.'),
        );
      }
    },
    [curriculum, t],
  );

  const handleFinishTest = useCallback(
    async (payload: FinishedTestPayload) => {
      if (!activeSession) return;

      setLastTestPayload(payload);
      setSyncingSession(true);
      setDataError(null);
      try {
        trackEffect({
          surface: 'session_end',
          curriculum,
          action: 'session_completed',
          context: {
            mode: activeSession.mode,
            score: payload.score,
            total: activeSession.questions.length,
            finishedAt: new Date().toISOString(),
          },
        });
        await recordPracticeSessionInCloud(activeSession, payload.answers, curriculum);
        await refreshDashboard();
        setCurrentView('test-results');
      } catch (error) {
        setDataError(
          error instanceof Error
            ? error.message
            : t('No se ha podido sincronizar la sesion con Quantia.', 'Ezin izan da saioa Quantiarekin sinkronizatu.'),
        );
      } finally {
        setSyncingSession(false);
      }
    },
    [activeSession, curriculum, refreshDashboard, t],
  );

  const handleLogout = useCallback(async () => {
    await signOut();
    setSession(null);
    setBundle(null);
    setCurrentView('dashboard');
  }, []);

  const headerStatus = useMemo(() => {
    const learningV2 = bundle?.practiceState.learningDashboardV2;
    const pressureV2 = bundle?.practiceState.pressureInsightsV2;
    const readiness = learningV2?.examReadinessRate != null ? Math.round(learningV2.examReadinessRate * 100) : null;
    const confidence =
      learningV2?.observedAccuracySampleOk && (learningV2?.observedAccuracyN ?? 0) >= 15
        ? learningV2.retentionSeenConfidenceFlag ?? 'medium'
        : pressureV2?.confidenceFlag ?? 'low';

    const dotClass =
      confidence === 'high'
        ? 'bg-emerald-500'
        : confidence === 'medium'
          ? 'bg-amber-500'
          : 'bg-rose-500';
    const headerCopy = buildHeaderStatusCopy({
      locale,
      readiness,
      hasReliableReading:
        Boolean(learningV2?.observedAccuracySampleOk) || Boolean(pressureV2?.sampleOk),
      confidence,
    });

    return {
      readiness,
      readingLabel: headerCopy.readingLabel,
      readinessLabel: headerCopy.readinessLabel,
      dotClass,
      sessions: bundle?.practiceState.recentSessions.length ?? 0,
    };
  }, [bundle, locale]);

  const activeCurriculumLabel = useMemo(
    () =>
      visibleCurriculumOptions.find((option) => option.id === curriculum)?.label ??
      formatCurriculumLabel(curriculum),
    [curriculum, visibleCurriculumOptions],
  );

  useEffect(() => {
    if (!curriculumMenuOpen) return;

    const updatePosition = () => {
      const el = curriculumTriggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const desiredWidth = Math.max(280, rect.width);
      const maxLeft = Math.max(12, window.innerWidth - desiredWidth - 12);
      const desiredHeight = 420;
      const belowTop = rect.bottom + 12;
      const belowSpace = Math.max(0, window.innerHeight - belowTop - 12);
      const aboveSpace = Math.max(0, rect.top - 24);
      const openUpwards = belowSpace < 220 && aboveSpace > belowSpace;
      const maxHeight = Math.min(desiredHeight, openUpwards ? aboveSpace : belowSpace);
      const top = openUpwards ? Math.max(12, rect.top - 12 - maxHeight) : belowTop;

      setCurriculumMenuStyle({
        top,
        left: Math.min(rect.left, maxLeft),
        width: desiredWidth,
        maxHeight: Math.max(200, maxHeight),
      });
    };

    updatePosition();
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const container = curriculumMenuRef.current;
      const panel = curriculumMenuPanelRef.current;
      if (!container) return;
      if (event.target instanceof Node && container.contains(event.target)) return;
      if (panel && event.target instanceof Node && panel.contains(event.target)) return;
      setCurriculumMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCurriculumMenuOpen(false);
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('touchstart', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [curriculumMenuOpen]);

  const handleSaveExamTarget = useCallback(
    async (next: { examDate: string | null; dailyReviewCapacity: number; dailyNewCapacity: number }) => {
      setSettingsSaving(true);
      setSettingsNotice(null);
      try {
        await updateMyExamTarget({
          curriculum,
          examDate: next.examDate,
          dailyReviewCapacity: next.dailyReviewCapacity,
          dailyNewCapacity: next.dailyNewCapacity,
        });
        await refreshDashboard();
        setSettingsNotice({ kind: 'success', text: t('Ajustes guardados.', 'Doikuntzak gorde dira.') });
      } catch (error) {
        setSettingsNotice({
          kind: 'error',
          text:
            error instanceof Error
              ? error.message
              : t('No se han podido guardar los ajustes.', 'Ezin izan dira doikuntzak gorde.'),
        });
      } finally {
        setSettingsSaving(false);
      }
    },
    [curriculum, refreshDashboard, t],
  );

  const handleStartStudy = useCallback(
    async (params: { scope: 'all' | SyllabusType; topic: string; count: number }) => {
      const { scope, topic, count } = params;

      const pool = await getStudyQuestionsSlice(500, 0, curriculum);
      const normalizedTopic = topic.trim().toLowerCase();
      const filtered = pool.filter((q) => {
        if (scope !== 'all' && q.syllabus !== scope) return false;
        if (normalizedTopic && !(q.category ?? '').toLowerCase().includes(normalizedTopic)) return false;
        return true;
      });

      if (filtered.length === 0) {
        throw new Error(
          t(
            'No hay preguntas disponibles para ese temario/tema en este momento.',
            'Une honetan ez dago galderarik eskuragarri temario/gai horretarako.',
          ),
        );
      }

      const shuffled = [...filtered];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const selected = shuffled.slice(0, Math.max(1, Math.min(count, shuffled.length)));

      const session: ActivePracticeSession = {
        id: createId(),
        mode: 'standard',
        title: t('Estudio guiado', 'Ikasketa gidatua'),
        startedAt: new Date().toISOString(),
        questions: selected,
        batchNumber: 1,
        totalBatches: 1,
        batchStartIndex: null,
        nextStandardBatchStartIndex: null,
      };

      setActiveStudySession(session);
      setCurrentView('study-active');
    },
    [curriculum, t],
  );

  const handleCurriculumChange = useCallback(
    (next: string) => {
      setCurriculum(next);
      try {
        window.localStorage.setItem(CURRICULUM_STORAGE_KEY, next);
        window.localStorage.setItem(LEGACY_CURRICULUM_STORAGE_KEY, next);
      } catch {
        // ignore
      }
      setBundle(null);
      setDataError(null);
      setLastTestPayload(null);
      setActiveSession(null);
      setActiveStudySession(null);
      setSelectedSyllabus(null);
      setSelectedLawFilter(null);
      setSidebarOpen(false);
      setCurrentView('dashboard');
    },
    [],
  );

  const gamification = useMemo(() => {
    if (!bundle) return { xp: 0, level: 1, streak: 0 };

    const recentSessions = bundle.practiceState.recentSessions;
    let totalQuestions = 0;
    let totalScore = 0;

    for (const s of recentSessions) {
      totalQuestions += s.total;
      totalScore += s.score;
    }

    // XP Logic: 10 XP per correct answer + 2 XP per attempt
    const xp = totalScore * 10 + totalQuestions * 2;
    const level = Math.floor(Math.sqrt(xp / 100)) + 1;

    // Streak Logic: consecutive days with sessions
    const sessionDays = new Set<string>();
    for (const s of recentSessions) {
      const dateStr = (s.finishedAt || s.startedAt || '').slice(0, 10);
      if (dateStr) sessionDays.add(dateStr);
    }

    const sortedDays = Array.from(sessionDays).sort((a, b) => b.localeCompare(a));
    let streak = 0;
    if (sortedDays.length > 0) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      // Only count streak if active today or yesterday
      if (sortedDays[0] === todayStr || sortedDays[0] === yesterdayStr) {
        streak = 1;
        for (let i = 0; i < sortedDays.length - 1; i++) {
          const current = new Date(sortedDays[i]);
          const next = new Date(sortedDays[i + 1]);
          const diff = (current.getTime() - next.getTime()) / (1000 * 3600 * 24);
          if (diff <= 1.1) {
            // 1 day difference (with small buffer)
            streak++;
          } else {
            break;
          }
        }
      }
    }

    return { xp, level, streak };
  }, [bundle]);

  if (supabaseConfigError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-10 text-center">
        <div className="mb-6 rounded-3xl bg-rose-50 p-6 text-rose-600 shadow-sm border border-rose-100 max-w-md">
          <h2 className="text-xl font-bold mb-2">{t('Error de configuracion', 'Konfigurazio errorea')}</h2>
          <p className="font-medium">
            {t(
              'Faltan las variables de entorno de Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).',
              'Supabase ingurune-aldagaiak falta dira (VITE_SUPABASE_URL eta VITE_SUPABASE_ANON_KEY).',
            )}
          </p>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <LocaleProvider locale={locale}>
        {unauthView === 'entry' ? (
          <EntryScreen
            onLogin={() => {
              setUnauthView('login');
            }}
          />
        ) : (
          <AuthScreen
            error={authError}
            loading={authLoading}
            onSubmit={handleLogin}
            onBack={() => setUnauthView('entry')}
          />
        )}
      </LocaleProvider>
    );
  }

  const activeQuestions = activeSession?.questions ?? [];
  const activeStudyQuestions = activeStudySession?.questions ?? [];
  const isTesting = currentView === 'test-active' || currentView === 'study-active';
  const isAdminView = currentView === 'admin-dashboard' || currentView === 'admin-students' || currentView === 'admin-questions';
  const showMobileTabs =
    !isTesting && !isAdminView && currentView !== 'telemetry' && currentView !== 'study-bank';
  const activeMobileTab = (() => {
    if (currentView === 'test-selection' || currentView === 'test-results') return 'test-selection';
    if (currentView === 'stats') return 'stats';
    if (currentView === 'study') return 'study';
    if (currentView === 'settings') return 'settings';
    return 'dashboard';
  })();

  const mobileTitle =
    currentView === 'dashboard'
      ? t('Inicio', 'Hasiera')
      : currentView === 'study'
        ? t('Estudio', 'Ikasketa')
        : currentView === 'test-selection'
          ? t('Test', 'Test')
          : currentView === 'stats'
            ? t('Stats', 'Stats')
            : currentView === 'test-results'
              ? t('Análisis', 'Analisia')
              : currentView === 'settings'
                ? t('Ajustes', 'Doikuntzak')
                : isAdminView
                  ? t('Admin', 'Admin')
                  : t('Quantia', 'Quantia');

  return (
    <LocaleProvider locale={locale}>
      <div className="flex h-[100svh] bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {!isTesting && (
        <>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className={`lg:hidden fixed inset-0 z-40 bg-black/40 transition-opacity ${
              sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-hidden="true"
          />
          <aside
            className={`w-72 bg-[#0a0a1a] text-white flex flex-col p-8 [@media(max-height:800px)]:p-5 shadow-2xl border-r border-white/5 fixed lg:relative inset-y-0 left-0 z-50 lg:z-20 transition-transform duration-300 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } lg:translate-x-0 overflow-y-auto`}
          >
          <div className="lg:hidden flex items-center justify-end mb-4 px-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
          <div ref={curriculumMenuRef} className="relative z-50 mb-12 [@media(max-height:800px)]:mb-6 px-2">
            <button
              ref={curriculumTriggerRef}
              type="button"
              onClick={() => setCurriculumMenuOpen((prev) => !prev)}
              disabled={curriculumOptionsLoading}
              className="w-full flex items-center justify-between gap-4 group text-left rounded-3xl px-3 py-2.5 outline-none transition-all hover:bg-white/5 focus:bg-white/5 disabled:opacity-60 disabled:hover:bg-transparent"
              aria-haspopup="menu"
              aria-expanded={curriculumMenuOpen}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="bg-gradient-to-br from-indigo-500 to-emerald-500 p-2.5 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-500 shrink-0">
                  <GraduationCap className="text-white w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-black text-2xl tracking-tighter">Quantia</span>
                    <span className="text-slate-500 font-black text-xs">•</span>
                    <span className="text-xs font-black text-slate-200 truncate max-w-[140px]">
                      {activeCurriculumLabel}
                    </span>
                  </div>
                </div>
              </div>

              {curriculumOptionsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <ChevronDown className={`h-4 w-4 transition-transform shrink-0 ${curriculumMenuOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {curriculumMenuOpen
              ? createPortal(
                  <div
                    ref={curriculumMenuPanelRef}
                    className="fixed z-[9999] overflow-hidden rounded-3xl border border-white/10 bg-[#0b1024]/95 shadow-2xl backdrop-blur-xl flex flex-col"
                    style={
                      curriculumMenuStyle
                        ? {
                            top: curriculumMenuStyle.top,
                            left: curriculumMenuStyle.left,
                            width: curriculumMenuStyle.width,
                            maxHeight: curriculumMenuStyle.maxHeight,
                          }
                        : undefined
                    }
                  >
                    <div className="px-5 py-4 border-b border-white/10 shrink-0">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {t('Oposicion', 'Oposizioa')}
                      </div>
                      <div className="mt-1 text-sm font-black text-white truncate">{activeCurriculumLabel}</div>
                      <div className="mt-2 text-[10px] font-bold text-slate-400 leading-relaxed">
                        {t(
                          'Estadisticas y progreso independientes por oposicion.',
                          'Oposizio bakoitzak bere estatistikak eta aurrerapena ditu.',
                        )}
                      </div>
                    </div>

                    <div className="p-2 flex-1 overflow-y-auto">
                      {visibleCurriculumOptions.map((opt) => {
                        const unavailable =
                          (opt.questionCount === 0 || opt.questionCount == null) &&
                          !curriculumHasActivity(opt);
                        const selected = opt.id === curriculum;
                        const subtitle = unavailable
                          ? t('Sincronizacion pendiente', 'Sinkronizazioa zain')
                          : null;

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              if (selected) {
                                setCurriculumMenuOpen(false);
                                setSidebarOpen(false);
                                return;
                              }
                              handleCurriculumChange(opt.id);
                              setCurriculumMenuOpen(false);
                              setSidebarOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all ${
                              unavailable
                                ? 'opacity-70 hover:bg-white/5 active:bg-white/10'
                                : 'hover:bg-white/5 active:bg-white/10'
                            } ${selected ? 'bg-white/10' : ''}`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-black text-white truncate">{opt.label}</div>
                              {subtitle ? (
                                <div className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {subtitle}
                                </div>
                              ) : null}
                            </div>
                            {selected ? (
                              <div className="w-8 h-8 rounded-2xl bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center">
                                <Check className="h-4 w-4 text-emerald-300" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-2xl bg-white/5 border border-white/10" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>,
                  document.body,
                )
              : null}
          </div>

          {/* Gamification Sidebar Block - Enhanced */}
          {bundle && (
            <div className="mb-12 [@media(max-height:800px)]:mb-6 [@media(max-height:700px)]:mb-4 p-5 [@media(max-height:800px)]:p-4 [@media(max-height:700px)]:p-3 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-md relative overflow-hidden group shrink-0 [@media(max-height:650px)]:hidden">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-indigo-500 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              
              <div className="flex items-center justify-between mb-6 [@media(max-height:800px)]:mb-3 relative z-10">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest truncate">
                    {t('Racha diaria', 'Eguneko bolada')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Flame size={16} className="text-amber-500 fill-amber-500/20 animate-pulse shrink-0" />
                    <span className="text-xl [@media(max-height:800px)]:text-lg font-black truncate">
                      {gamification.streak} {t('dias', 'egun')}
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 [@media(max-height:800px)]:w-8 [@media(max-height:800px)]:h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Star size={16} className="text-indigo-400 fill-indigo-400/20" />
                </div>
              </div>

              <div className="space-y-3 [@media(max-height:800px)]:space-y-2 relative z-10">
                <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest [@media(max-height:700px)]:hidden">
                  <span>{t('Nivel', 'Maila')} {gamification.level}</span>
                  <span>{gamification.xp % 100}%</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5 [@media(max-height:700px)]:hidden">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full transition-all duration-1000 shadow-[0_0_15px_rgba(79,70,229,0.5)]" 
                    style={{ width: `${(gamification.xp % 100)}%` }}
                  />
                </div>
                <div className="hidden [@media(max-height:700px)]:flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <span>{t('Nivel', 'Maila')} {gamification.level}</span>
                  <span>{gamification.xp % 100}%</span>
                </div>
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-3 [@media(max-height:800px)]:space-y-2 [@media(max-height:700px)]:space-y-1.5">
            {isAdminEmail ? (
              <>
                <button
                  onClick={() => {
                    setCurrentView('admin-dashboard');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 [@media(max-height:800px)]:gap-3 px-6 [@media(max-height:800px)]:px-4 py-4 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl transition-all duration-300 group ${
                    currentView === 'admin-dashboard'
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <LayoutDashboard size={22} className={currentView === 'admin-dashboard' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
                  <span className="text-lg [@media(max-height:800px)]:text-base [@media(max-height:700px)]:text-sm">{t('Admin', 'Admin')}</span>
                </button>
                <button
                  onClick={() => {
                    setCurrentView('admin-students');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 [@media(max-height:800px)]:gap-3 px-6 [@media(max-height:800px)]:px-4 py-4 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl transition-all duration-300 group ${
                    currentView === 'admin-students'
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Users size={22} className={currentView === 'admin-students' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
                  <span className="text-lg [@media(max-height:800px)]:text-base [@media(max-height:700px)]:text-sm">{t('Alumnos', 'Ikasleak')}</span>
                </button>
                <button
                  onClick={() => {
                    setCurrentView('admin-questions');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 [@media(max-height:800px)]:gap-3 px-6 [@media(max-height:800px)]:px-4 py-4 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl transition-all duration-300 group ${
                    currentView === 'admin-questions'
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Database size={22} className={currentView === 'admin-questions' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
                  <span className="text-lg [@media(max-height:800px)]:text-base [@media(max-height:700px)]:text-sm">{t('Preguntas', 'Galderak')}</span>
                </button>
                <button
                  onClick={() => {
                    setCurrentView('admin-catalogs');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 [@media(max-height:800px)]:gap-3 px-6 [@media(max-height:800px)]:px-4 py-4 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl transition-all duration-300 group ${
                    currentView === 'admin-catalogs'
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <GraduationCap size={22} className={currentView === 'admin-catalogs' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
                  <span className="text-lg [@media(max-height:800px)]:text-base [@media(max-height:700px)]:text-sm">{t('Catálogos', 'Katalogoak')}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setCurrentView('dashboard');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 [@media(max-height:800px)]:gap-3 px-6 [@media(max-height:800px)]:px-4 py-4 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl transition-all duration-300 group ${
                    currentView === 'dashboard' 
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <LayoutDashboard size={22} className={currentView === 'dashboard' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
                  <span className="text-lg [@media(max-height:800px)]:text-base [@media(max-height:700px)]:text-sm">{t('Dashboard', 'Panela')}</span>
                </button>
                <button
                  onClick={() => {
                    setCurrentView('test-selection');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 [@media(max-height:800px)]:gap-3 px-6 [@media(max-height:800px)]:px-4 py-4 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl transition-all duration-300 group ${
                    currentView === 'test-selection' || currentView === 'test-results'
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <ClipboardList size={22} className={currentView === 'test-selection' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
                  <span className="text-lg [@media(max-height:800px)]:text-base [@media(max-height:700px)]:text-sm">{t('Realizar test', 'Testa egin')}</span>
                </button>
                <button
                  onClick={() => {
                    setCurrentView('stats');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 [@media(max-height:800px)]:gap-3 px-6 [@media(max-height:800px)]:px-4 py-4 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl transition-all duration-300 group ${
                    currentView === 'stats' 
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <TrendingUp size={22} className={currentView === 'stats' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
                  <span className="text-lg [@media(max-height:800px)]:text-base [@media(max-height:700px)]:text-sm">{t('Estadisticas', 'Estatistikak')}</span>
                </button>
                <button
                  onClick={() => {
                    setCurrentView('study');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 [@media(max-height:800px)]:gap-3 px-6 [@media(max-height:800px)]:px-4 py-4 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl transition-all duration-300 group ${
                    currentView === 'study'
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <BookOpen size={22} className={currentView === 'study' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
                  <span className="text-lg [@media(max-height:800px)]:text-base [@media(max-height:700px)]:text-sm">{t('Estudio', 'Ikasketa')}</span>
                </button>
              </>
            )}
          </nav>

          <div className="pt-8 [@media(max-height:800px)]:pt-6 [@media(max-height:700px)]:pt-4 border-t border-white/5 space-y-3 [@media(max-height:700px)]:space-y-2">
            <button
              onClick={() => {
                setCurrentView('settings');
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-6 [@media(max-height:800px)]:px-4 py-4 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl transition-all duration-300 ${
                currentView === 'settings'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Settings size={22} />
              <span className="text-lg [@media(max-height:800px)]:text-base [@media(max-height:700px)]:text-sm">{t('Ajustes', 'Doikuntzak')}</span>
            </button>
            {isAdminEmail ? (
              <button
                onClick={() => {
                  setCurrentView('admin-questions');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-6 [@media(max-height:800px)]:px-4 py-4 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl transition-all duration-300 ${
                  currentView === 'admin-questions'
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Database size={22} />
                <span className="text-lg [@media(max-height:800px)]:text-base [@media(max-height:700px)]:text-sm">{t('Gestión BD', 'BD kudeaketa')}</span>
              </button>
            ) : null}
            <button
              onClick={() => {
                setSidebarOpen(false);
                void handleLogout();
              }}
              className="w-full flex items-center gap-4 px-6 [@media(max-height:800px)]:px-4 py-4 [@media(max-height:800px)]:py-3 [@media(max-height:700px)]:py-2.5 rounded-2xl text-rose-400 hover:bg-rose-500/10 transition-all duration-300"
            >
              <LogOut size={22} />
              <span className="text-lg [@media(max-height:800px)]:text-base [@media(max-height:700px)]:text-sm font-bold">{t('Cerrar sesion', 'Saioa itxi')}</span>
            </button>
          </div>
        </aside>
        </>
      )}

      {showMobileTabs && !isTesting ? (
        <MobileTopBar
          title={mobileTitle}
          readingLabel={headerStatus.readingLabel}
          dotClass={headerStatus.dotClass}
          curriculumLabel={activeCurriculumLabel}
          curriculumId={curriculum}
          curriculumOptions={visibleCurriculumOptions}
          curriculumOptionsLoading={curriculumOptionsLoading}
          onSelectCurriculum={(next) => setCurriculum(next)}
          onLogout={() => {
            setSidebarOpen(false);
            void handleLogout();
          }}
        />
      ) : null}

      {/* Main Content */}
      <main
        className={`flex-1 overflow-y-auto relative z-10 transition-all duration-700 ${
          isTesting
            ? 'p-3 sm:p-4 lg:p-10'
            : `px-4 sm:px-6 lg:px-12 xl:px-16 pb-10 lg:pb-16 ${
                showMobileTabs
                  ? 'pt-[calc(3.7rem+env(safe-area-inset-top))]'
                  : 'pt-5 sm:pt-8 lg:pt-12'
              } [@media(max-height:800px)]:pt-4 [@media(max-height:800px)]:sm:pt-6 [@media(max-height:800px)]:lg:pt-10`
        } ${showMobileTabs ? 'pb-[calc(7.25rem+env(safe-area-inset-bottom))]' : ''}`}
      >
        {!isTesting && (
          <header className="hidden lg:flex mb-10 lg:mb-16 flex-col lg:flex-row lg:items-start justify-between gap-8 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="flex items-start gap-4 animate-in fade-in slide-in-from-left-4 duration-1000">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden mt-1 p-3 rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-all"
              >
                <Menu className="h-5 w-5 text-slate-700" />
              </button>
              <div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {currentView === 'dashboard' && `${t('Hola', 'Kaixo')}, ${session.user.email?.split('@')[0]}`}
                {currentView === 'study' && t('Estudio guiado', 'Ikasketa gidatua')}
                {currentView === 'test-selection' && t('Configuracion de entrenamiento', 'Entrenamenduaren konfigurazioa')}
                {currentView === 'stats' && t('Inteligencia de datos', 'Datuen adimena')}
                {currentView === 'test-results' && t('Analisis de sesion', 'Saioaren analisia')}
                {currentView === 'settings' && t('Ajustes', 'Doikuntzak')}
              </h1>
              <p className="text-slate-500 mt-2 text-base sm:text-lg font-medium">
                {currentView === 'dashboard' &&
                  t(
                    'Tu centro de mando para avanzar en esta oposicion.',
                    'Zure aginte-zentroa oposizio honetan aurrera egiteko.',
                  )}
                {currentView === 'study' &&
                  t(
                    'Explora el banco de preguntas por temario y tema.',
                    'Arakatu galdera-bankua temario eta gaika.',
                  )}
                {currentView === 'test-selection' &&
                  t(
                    'Optimiza tu tiempo con lotes inteligentes.',
                    'Optimizatu zure denbora sorta adimendunekin.',
                  )}
                {currentView === 'stats' &&
                  t(
                    'Predicciones basadas en tu rendimiento real.',
                    'Zure benetako errendimenduan oinarritutako iragarpenak.',
                  )}
                {currentView === 'settings' &&
                  t(
                    'Define tu objetivo y ajusta la estrategia diaria.',
                    'Zehaztu zure helburua eta egokitu eguneroko estrategia.',
                  )}
              </p>
              </div>
            </div>

            <div className="flex items-center justify-between lg:justify-end gap-4 lg:gap-6 animate-in fade-in slide-in-from-right-4 duration-1000">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                  {t('Estado', 'Egoera')}
                </span>
                <div className="bg-indigo-50 text-indigo-700 px-4 sm:px-5 py-2.5 rounded-2xl text-sm font-black flex flex-wrap items-center gap-3 border border-indigo-100 shadow-sm shadow-indigo-100/50 max-w-full">
                  {dataLoading || syncingSession ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('Sincronizando...', 'Sinkronizatzen...')}
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2 border-r border-indigo-200 pr-4">
                        <div className={`w-2 h-2 ${headerStatus.dotClass} rounded-full`} />
                        {headerStatus.readingLabel}
                      </div>
                      <div className="flex items-center gap-2 border-r border-indigo-200 pr-4 min-w-0">
                        <GraduationCap size={16} className="text-indigo-600 shrink-0" />
                        <span className="font-black text-slate-900/90 truncate max-w-[110px] sm:max-w-[160px]">
                          {activeCurriculumLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Trophy size={16} className="text-amber-500" />
                        <span className="font-black">
                          {headerStatus.readinessLabel}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-white shadow-md flex items-center justify-center text-slate-400 font-black text-xl overflow-hidden group cursor-pointer">
                <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500">
                  {session.user.email?.[0].toUpperCase()}
                </div>
              </div>
            </div>
          </header>
        )}

        {dataError ? (
          <div className="mb-8 rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-rose-700">
            {dataError}
          </div>
        ) : null}

        {dataLoading && !bundle && currentView !== 'test-active' ? (
          <div className="flex items-center justify-center rounded-[2rem] border border-slate-100 bg-white p-20 text-slate-500">
            <Loader2 className="mr-3 h-6 w-6 animate-spin" />
            {t('Cargando panel...', 'Panela kargatzen...')}
          </div>
        ) : null}

        {!dataLoading && bundle && currentView === 'dashboard' ? (
          <Dashboard
            coachLabel={heroCopy.eyebrow ?? t('Sugerencia de hoy', 'Gaurko proposamena')}
            coachTitle={heroCopy.line1}
            coachDescription={`${continuityLine ? `${continuityLine} ` : ''}${heroCopy.line2 ?? dashboardMetrics.weeklyInsightSummary}`}
            coachCtaLabel={heroCopy.cta ?? t('Practicar ahora', 'Orain praktikatu')}
            commonProgress={dashboardMetrics.commonProgress}
            specificProgress={dashboardMetrics.specificProgress}
            weeklyQuestions={dashboardMetrics.weeklyQuestions}
            accuracyRate={dashboardMetrics.accuracyRate}
            primaryCardTitle={homeCardCopy.line1}
            primaryCardDescription={homeCardCopy.line2 ?? dashboardMetrics.weeklyInsightSummary}
            primaryCardCtaLabel={homeCardCopy.cta ?? t('Seguir por aqui', 'Hemendik jarraitu')}
            primaryCardProgressLabel={t('Temario visto', 'Ikusitako temarioa')}
            primaryCardProgressValue={Math.round(
              (bundle.practiceState.learningDashboardV2?.coverageRate ?? 0) * 100,
            )}
            weakTitle={weakAreaCopy.title}
            weakDescription={weakAreaCopy.description}
            weakCardCtaLabel={weakAreaCopy.cta ?? t('Corregir esto', 'Hori zuzendu')}
            weakAreasBadge={dashboardMetrics.weakAreasBadge}
            weeklyInsightData={dashboardMetrics.weeklyInsightData}
            weeklyInsightSummary={dashboardMetrics.weeklyInsightSummary}
            weeklyInsightDelta={dashboardMetrics.weeklyInsightDelta}
            onCoachAction={() => {
              trackEffect({
                surface: 'home',
                curriculum,
                action: 'cta_clicked',
                context: { cta: heroCopy.cta ?? null, primaryAction: coachPlan?.primaryAction ?? null },
              });
              void handleStartCoachSession();
            }}
            onStartTest={(syllabus) => {
              setSelectedSyllabus(syllabus);
              setCurrentView('test-selection');
            }}
            onShowStats={() => setCurrentView('stats')}
            onReviewErrors={() => {
              setSelectedSyllabus('specific');
              setCurrentView('test-selection');
            }}
          />
        ) : null}

        {currentView === 'test-selection' ? (
          <TestSelection
            curriculum={curriculum}
            lawOptions={lawOptions}
            lawOptionsLoading={discoveredLawOptionsLoading}
            initialLaw={selectedLawFilter}
            onStart={handleStartTest}
            onStartLawTest={handleStartLawTest}
            onStartCustom={handleStartCustomTest}
            onLoadCustomBounds={handleLoadCustomBounds}
            initialSyllabus={selectedSyllabus}
          />
        ) : null}

        {currentView === 'study' ? (
          <StudyExplorer
            bundle={bundle}
            onStartStudy={handleStartStudy}
            onOpenQuestionBank={() => setCurrentView('study-bank')}
          />
        ) : null}

        {currentView === 'study-bank' ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            }
          >
            <StudyQuestionBank
              curriculum={curriculum}
              onBack={() => setCurrentView('study')}
            />
          </Suspense>
        ) : null}

        {currentView === 'admin-dashboard' ? (
          isAdminEmail ? (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              }
            >
              <AdminDashboard
                curriculumOptions={curriculumOptions}
                defaultCurriculum={curriculum}
                onOpenStudents={() => setCurrentView('admin-students')}
                onOpenQuestions={() => setCurrentView('admin-questions')}
                onOpenCatalogs={() => setCurrentView('admin-catalogs')}
              />
            </Suspense>
          ) : null
        ) : null}

        {currentView === 'admin-students' ? (
          isAdminEmail ? (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              }
            >
              <AdminStudents onClose={() => setCurrentView('admin-dashboard')} />
            </Suspense>
          ) : null
        ) : null}

        {currentView === 'admin-questions' ? (
          isAdminEmail ? (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              }
            >
              <AdminQuestions
                curriculumOptions={curriculumOptions}
                defaultCurriculum={curriculum}
                onClose={() => setCurrentView('admin-dashboard')}
              />
            </Suspense>
          ) : null
        ) : null}

        {currentView === 'admin-catalogs' ? (
          isAdminEmail ? (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              }
            >
              <AdminCatalogs onClose={() => setCurrentView('admin-dashboard')} />
            </Suspense>
          ) : null
        ) : null}

        {currentView === 'settings' ? (
          <SettingsPanel
            examTarget={bundle?.practiceState.examTarget ?? null}
            saving={settingsSaving}
            notice={settingsNotice}
            onSave={handleSaveExamTarget}
            isAdmin={isAdminEmail}
            onOpenAdmin={() => setCurrentView('admin-dashboard')}
            onOpenTelemetry={() => setCurrentView('telemetry')}
          />
        ) : null}

        {currentView === 'telemetry' ? (
          telemetryEnabled ? (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              }
            >
              <TelemetryDebugPanel
                onClose={() => {
                  setCurrentView('settings');
                }}
              />
            </Suspense>
          ) : null
        ) : null}

        {currentView === 'test-active' && activeSession ? (
          <TestInterface
            questions={activeQuestions}
            mode={activeSession.mode}
            onFinish={handleFinishTest}
            onCancel={() => {
              setActiveSession(null);
              setCurrentView('test-selection');
            }}
          />
        ) : null}

        {currentView === 'study-active' && activeStudySession ? (
          <TestInterface
            questions={activeStudyQuestions}
            mode={activeStudySession.mode}
            onFinish={() => {
              setActiveStudySession(null);
              setCurrentView('study');
            }}
            onCancel={() => {
              setActiveStudySession(null);
              setCurrentView('study');
            }}
          />
        ) : null}

        {currentView === 'test-results' && lastTestPayload && activeSession ? (
          <PostTestStats
            payload={lastTestPayload}
            questions={activeSession.questions}
            mode={activeSession.mode}
            curriculum={curriculum}
            username={bundle?.identity.current_username ?? session?.user.email ?? null}
            onRestart={() => {
              if (selectedLawFilter) {
                void handleStartLawTest(selectedLawFilter, activeSession.questions.length || 20);
                return;
              }
              void handleStartTest(activeSession.mode, selectedSyllabus || undefined);
            }}
            onGoHome={() => {
              setActiveSession(null);
              setLastTestPayload(null);
              setCurrentView('dashboard');
            }}
          />
        ) : null}

        {currentView === 'stats' ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            }
          >
            <StatsDashboard
              results={statsResults}
              bundle={bundle}
              curriculum={curriculum}
              coachPlan={coachPlan}
              onStartRecommended={() => {
                trackEffect({
                  surface: 'stats',
                  curriculum,
                  action: 'cta_clicked',
                  context: {
                    cta: t('Hacer sesion recomendada', 'Gomendatutako saioa egin'),
                    primaryAction: coachPlan?.primaryAction ?? null,
                  },
                });
                void handleStartCoachSession();
              }}
              levelLabel={
                coachPlan
                  ? formatModeLabel(coachPlan.primaryAction === 'review' ? 'mixed' : 'standard', locale)
                  : t('Ritmo actual', 'Uneko erritmoa')
              }
            />
          </Suspense>
        ) : null}
      </main>
      {showMobileTabs ? (
        <MobileTabBar
          active={activeMobileTab}
          onChange={(next) => {
            setCurrentView(next);
            setSidebarOpen(false);
          }}
        />
      ) : null}
      </div>
    </LocaleProvider>
  );
}
