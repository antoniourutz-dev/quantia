import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Settings,
  TrendingUp,
  BookOpen,
  Flame,
  Star,
  Trophy,
} from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import TestSelection from './components/TestSelection';
import TestInterface from './components/TestInterface';
import StatsDashboard from './components/StatsDashboard';
import PostTestStats from './components/PostTestStats';
import StudyExplorer from './components/StudyExplorer';
import SettingsPanel from './components/SettingsPanel';
import Dashboard from './components/dashboard/Dashboard';
import { supabaseConfigError } from './lib/supabaseConfig';
import { getSafeSupabaseSession, supabase } from './lib/supabaseClient';
import { loginWithUsername } from './lib/auth';
import {
  DEFAULT_CURRICULUM,
  getRandomPracticeBatch,
  getStudyQuestionsSlice,
  getWeakPracticeBatch,
  loadDashboardBundle,
  recordPracticeSessionInCloud,
  signOut,
  updateMyExamTarget,
  type DashboardBundle,
} from './lib/quantiaApi';
import { buildCoachPlanV2, buildCoachTwoLineMessageV2 } from './lib/coach';
import {
  ActivePracticeSession,
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
  | 'study-active'
  | 'test-selection'
  | 'test-active'
  | 'stats'
  | 'test-results'
  | 'settings';

const weekdayLabels = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedSyllabus, setSelectedSyllabus] = useState<SyllabusType | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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

  const refreshDashboard = useCallback(async () => {
    if (!session) return;

    setDataLoading(true);
    setDataError(null);
    try {
      const nextBundle = await loadDashboardBundle(DEFAULT_CURRICULUM);
      setBundle(nextBundle);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'No se ha podido cargar el panel.');
    } finally {
      setDataLoading(false);
    }
  }, [session]);

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
          setAuthError(error instanceof Error ? error.message : 'No se ha podido leer la sesion.');
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
        setActiveSession(null);
        setCurrentView('dashboard');
      }
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, []);

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

  const coachMessage = useMemo(
    () => (coachPlan ? buildCoachTwoLineMessageV2(coachPlan) : null),
    [coachPlan],
  );

  const statsResults = useMemo<TestResult[]>(() => {
    if (!bundle) return [];
    return bundle.practiceState.recentSessions.map((sessionSummary) => ({
      id: sessionSummary.id,
      date: (sessionSummary.finishedAt || sessionSummary.startedAt || '').slice(0, 10),
      score: sessionSummary.score,
      total: sessionSummary.total,
      mode: sessionSummary.mode,
      label: formatModeLabel(sessionSummary.mode),
    }));
  }, [bundle]);

  const dashboardMetrics = useMemo(() => {
    if (!bundle) {
      return {
        commonProgress: null as number | null,
        specificProgress: null as number | null,
        weeklyQuestions: 0,
        accuracyRate: null as number | null,
        weakAreasBadge: undefined as string | undefined,
        weeklyInsightData: weekdayLabels.map((label) => ({ name: label, questions: 0 })),
        weeklyInsightSummary: 'Todavia no hay suficiente actividad para construir una lectura semanal.',
        weeklyInsightDelta: 'Actividad inicial',
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

    const deltaValue =
      previousWeekQuestions <= 0
        ? currentWeekQuestions > 0
          ? 100
          : 0
        : Math.round(((currentWeekQuestions - previousWeekQuestions) / previousWeekQuestions) * 100);

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
      weakAreasBadge: bundle.weakCategories.length > 0 ? `${bundle.weakCategories.length} temas` : undefined,
      weeklyInsightData: perDay,
      weeklyInsightSummary:
        coachPlan?.reasons[0] ??
        bundle.practiceState.learningDashboardV2?.focusMessage ??
        'La semana ya deja una primera foto de uso y rendimiento.',
      weeklyInsightDelta:
        previousWeekQuestions > 0
          ? `${deltaValue >= 0 ? '+' : ''}${deltaValue}% vs semana anterior`
          : currentWeekQuestions > 0
            ? 'Primera semana con actividad'
            : 'Sin actividad reciente',
    };
  }, [bundle, coachPlan]);

  const primaryCardTitle =
    coachPlan?.primaryAction === 'review'
      ? 'Consolidar antes de seguir'
      : coachPlan?.primaryAction === 'recovery'
        ? 'Recuperar ritmo'
        : coachPlan?.primaryAction === 'simulacro'
          ? 'Medir nivel real'
          : coachPlan?.primaryAction === 'anti_trap'
            ? 'Afinar lectura'
            : coachPlan?.primaryAction === 'push'
              ? 'Subir exigencia'
              : 'Continuidad limpia';

  const weakCategory = bundle?.weakCategories[0] ?? null;
  const weakTitle = weakCategory ? `Area mas fragil: ${weakCategory.category}` : 'Sin alertas dominantes';
  const weakDescription = weakCategory
    ? `Esta categoria concentra mas riesgo que tu media actual. Un bloque corto aqui puede mover el panel rapido.`
    : 'No aparecen categorias con riesgo dominante. Puedes repartir practica con mas libertad.';

  const handleLogin = useCallback(async (username: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const nextSession = await loginWithUsername(username, password);
      setSession(nextSession);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se ha podido iniciar sesion.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleStartTest = useCallback(
    async (mode: PracticeMode, syllabus?: SyllabusType, count?: number) => {
      setSelectedSyllabus(syllabus ?? null);
      setDataError(null);

      try {
        let questions: Question[] = [];
        let resolvedMode = mode;
        const selectedScope = syllabus ?? 'common';
        let resolvedTitle =
          mode === 'simulacro'
            ? `Simulacro${syllabus ? ` (${formatSyllabusLabel(syllabus)})` : ' (Mixto)'}`
            : mode === 'quick_five'
              ? 'Test rapido'
              : mode === 'review'
                ? 'Repaso de fallos'
                : `Test: ${formatSyllabusLabel(selectedScope)}`;
        const batchSize =
          count ?? (mode === 'simulacro' ? 50 : mode === 'quick_five' ? 5 : 20);
        const scope = syllabus ?? 'all';

        if (mode === 'review') {
          try {
            questions = await getWeakPracticeBatch(batchSize, DEFAULT_CURRICULUM, scope);
          } catch (error) {
            questions = await getRandomPracticeBatch(batchSize, DEFAULT_CURRICULUM, scope);
            if (questions.length === 0) {
              throw error;
            }

            resolvedMode = 'mixed';
            resolvedTitle = 'Repaso guiado';
          }
        } else if (mode === 'simulacro') {
          questions = await getRandomPracticeBatch(batchSize, DEFAULT_CURRICULUM, scope);
        } else {
          questions = await getRandomPracticeBatch(batchSize, DEFAULT_CURRICULUM, scope);
        }

        if (questions.length === 0) {
          throw new Error('No hay preguntas disponibles para ese temario en este momento.');
        }

        const session: ActivePracticeSession = {
          id: crypto.randomUUID(),
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
          error instanceof Error ? error.message : 'No se ha podido arrancar la sesion de test.',
        );
      }
    },
    [],
  );

  const handleFinishTest = useCallback(
    async (payload: FinishedTestPayload) => {
      if (!activeSession) return;

      setLastTestPayload(payload);
      setSyncingSession(true);
      setDataError(null);
      try {
        await recordPracticeSessionInCloud(activeSession, payload.answers, DEFAULT_CURRICULUM);
        await refreshDashboard();
        setCurrentView('test-results');
      } catch (error) {
        setDataError(
          error instanceof Error
            ? error.message
            : 'No se ha podido sincronizar la sesion con Quantia.',
        );
      } finally {
        setSyncingSession(false);
      }
    },
    [activeSession, refreshDashboard],
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

    const confidenceLabel =
      confidence === 'high' ? 'Alta' : confidence === 'medium' ? 'Media' : 'Baja';
    const dotClass =
      confidence === 'high'
        ? 'bg-emerald-500'
        : confidence === 'medium'
          ? 'bg-amber-500'
          : 'bg-rose-500';

    const signalLabel =
      learningV2?.observedAccuracySampleOk || pressureV2?.sampleOk ? `Señal: ${confidenceLabel}` : 'Sin señal';

    return {
      readiness,
      signalLabel,
      dotClass,
      sessions: bundle?.practiceState.recentSessions.length ?? 0,
    };
  }, [bundle]);

  const handleSaveExamTarget = useCallback(
    async (next: { examDate: string | null; dailyReviewCapacity: number; dailyNewCapacity: number }) => {
      setSettingsSaving(true);
      setSettingsNotice(null);
      try {
        await updateMyExamTarget({
          curriculum: DEFAULT_CURRICULUM,
          examDate: next.examDate,
          dailyReviewCapacity: next.dailyReviewCapacity,
          dailyNewCapacity: next.dailyNewCapacity,
        });
        await refreshDashboard();
        setSettingsNotice({ kind: 'success', text: 'Ajustes guardados.' });
      } catch (error) {
        setSettingsNotice({
          kind: 'error',
          text: error instanceof Error ? error.message : 'No se han podido guardar los ajustes.',
        });
      } finally {
        setSettingsSaving(false);
      }
    },
    [refreshDashboard],
  );

  const handleStartStudy = useCallback(
    async (params: { scope: 'all' | SyllabusType; topic: string; count: number }) => {
      const { scope, topic, count } = params;

      const pool = await getStudyQuestionsSlice(500, 0, DEFAULT_CURRICULUM);
      const normalizedTopic = topic.trim().toLowerCase();
      const filtered = pool.filter((q) => {
        if (scope !== 'all' && q.syllabus !== scope) return false;
        if (normalizedTopic && !(q.category ?? '').toLowerCase().includes(normalizedTopic)) return false;
        return true;
      });

      if (filtered.length === 0) {
        throw new Error('No hay preguntas disponibles para ese temario/tema en este momento.');
      }

      const shuffled = [...filtered];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const selected = shuffled.slice(0, Math.max(1, Math.min(count, shuffled.length)));

      const session: ActivePracticeSession = {
        id: crypto.randomUUID(),
        mode: 'standard',
        title: 'Estudio guiado',
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
          <h2 className="text-xl font-bold mb-2">Error de Configuración</h2>
          <p className="font-medium">
            Faltan las variables de entorno de Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).
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
    return <AuthScreen error={authError} loading={authLoading} onSubmit={handleLogin} />;
  }

  const activeQuestions = activeSession?.questions ?? [];
  const activeStudyQuestions = activeStudySession?.questions ?? [];
  const isTesting = currentView === 'test-active' || currentView === 'study-active';

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {!isTesting && (
        <aside className="w-72 bg-[#0a0a1a] text-white flex flex-col p-8 shadow-2xl border-r border-white/5 relative z-20 animate-in slide-in-from-left duration-700">
          <div className="flex items-center gap-4 mb-12 px-2 group cursor-pointer">
            <div className="bg-gradient-to-br from-indigo-500 to-emerald-500 p-2.5 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-500">
              <GraduationCap className="text-white w-7 h-7" />
            </div>
            <span className="font-black text-2xl tracking-tighter">
              OsakiTest<span className="text-indigo-400">Pro</span>
            </span>
          </div>

          {/* Gamification Sidebar Block - Enhanced */}
          {bundle && (
            <div className="mb-12 p-5 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 bg-indigo-500 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest truncate">Daily Streak</span>
                  <div className="flex items-center gap-2">
                    <Flame size={18} className="text-amber-500 fill-amber-500/20 animate-pulse shrink-0" />
                    <span className="text-xl font-black truncate">{gamification.streak} días</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Star size={18} className="text-indigo-400 fill-indigo-400/20" />
                </div>
              </div>

              <div className="space-y-3 relative z-10">
                <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Nivel {gamification.level}</span>
                  <span>{gamification.xp % 100}%</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full transition-all duration-1000 shadow-[0_0_15px_rgba(79,70,229,0.5)]" 
                    style={{ width: `${(gamification.xp % 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-3">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${
                currentView === 'dashboard' 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <LayoutDashboard size={22} className={currentView === 'dashboard' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
              <span className="text-lg">Dashboard</span>
            </button>
            <button
              onClick={() => setCurrentView('test-selection')}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${
                currentView === 'test-selection' || currentView === 'test-results'
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <ClipboardList size={22} className={currentView === 'test-selection' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
              <span className="text-lg">Realizar Test</span>
            </button>
            <button
              onClick={() => setCurrentView('stats')}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${
                currentView === 'stats' 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <TrendingUp size={22} className={currentView === 'stats' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
              <span className="text-lg">Estadísticas</span>
            </button>
            <button
              onClick={() => setCurrentView('study')}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${
                currentView === 'study'
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950/50 font-bold scale-[1.02]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <BookOpen size={22} className={currentView === 'study' ? 'text-white' : 'group-hover:text-indigo-400 transition-colors'} />
              <span className="text-lg">Estudio</span>
            </button>
          </nav>

          <div className="pt-8 border-t border-white/5 space-y-3">
            <button
              onClick={() => setCurrentView('settings')}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${
                currentView === 'settings'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Settings size={22} />
              <span className="text-lg">Ajustes</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-rose-400 hover:bg-rose-500/10 transition-all duration-300"
            >
              <LogOut size={22} />
              <span className="text-lg font-bold">Cerrar sesión</span>
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto relative z-10 transition-all duration-700 ${isTesting ? 'p-10 lg:p-16' : 'p-10 lg:p-16'}`}>
        {!isTesting && (
          <header className="mb-16 flex items-start justify-between animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="animate-in fade-in slide-in-from-left-4 duration-1000">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                {currentView === 'dashboard' && `Hola, ${session.user.email?.split('@')[0]}`}
                {currentView === 'study' && 'Estudio guiado'}
                {currentView === 'test-selection' && 'Configuración de Entrenamiento'}
                {currentView === 'stats' && 'Inteligencia de Datos'}
                {currentView === 'test-results' && 'Análisis de Sesión'}
                {currentView === 'settings' && 'Ajustes'}
              </h1>
              <p className="text-slate-500 mt-2 text-lg font-medium">
                {currentView === 'dashboard' && 'Tu centro de mando para el éxito en Osakidetza.'}
                {currentView === 'study' && 'Explora el banco de preguntas por temario y tema.'}
                {currentView === 'test-selection' && 'Optimiza tu tiempo con lotes inteligentes.'}
                {currentView === 'stats' && 'Predicciones basadas en tu rendimiento real.'}
                {currentView === 'settings' && 'Define tu objetivo y ajusta la estrategia diaria.'}
              </p>
            </div>

            <div className="flex items-center gap-6 animate-in fade-in slide-in-from-right-4 duration-1000">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Status</span>
                <div className="bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-2xl text-sm font-black flex items-center gap-3 border border-indigo-100 shadow-sm shadow-indigo-100/50">
                  {dataLoading || syncingSession ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 border-r border-indigo-200 pr-4">
                        <div className={`w-2 h-2 ${headerStatus.dotClass} rounded-full`} />
                        {headerStatus.signalLabel}
                      </div>
                      <div className="flex items-center gap-2">
                        <Trophy size={16} className="text-amber-500" />
                        <span className="font-black">
                          {headerStatus.readiness == null ? 'Preparación: —' : `Preparación: ${headerStatus.readiness}%`}
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
            Cargando panel...
          </div>
        ) : null}

        {!dataLoading && bundle && currentView === 'dashboard' ? (
          <Dashboard
            coachLabel={`Coach ${coachPlan?.tone ?? 'activo'}`}
            coachTitle={coachMessage?.line1 ?? 'Tu panel ya esta conectado.'}
            coachDescription={
              coachMessage?.line2 ??
              bundle.practiceState.learningDashboardV2?.focusMessage ??
              'La lectura del coach aparecerá aqui en cuanto haya datos suficientes.'
            }
            coachCtaLabel={
              coachPlan?.primaryAction === 'simulacro' ? 'Practicar especifico' : 'Practicar ahora'
            }
            commonProgress={dashboardMetrics.commonProgress}
            specificProgress={dashboardMetrics.specificProgress}
            weeklyQuestions={dashboardMetrics.weeklyQuestions}
            accuracyRate={dashboardMetrics.accuracyRate}
            primaryCardTitle={primaryCardTitle}
            primaryCardDescription={
              coachPlan?.reasons[0] ??
              bundle.practiceState.learningDashboardV2?.focusMessage ??
              'Empieza una sesion para generar una senal mas limpia.'
            }
            primaryCardProgressLabel="Cobertura global"
            primaryCardProgressValue={Math.round(
              (bundle.practiceState.learningDashboardV2?.coverageRate ?? 0) * 100,
            )}
            weakTitle={weakTitle}
            weakDescription={weakDescription}
            weakAreasBadge={dashboardMetrics.weakAreasBadge}
            weeklyInsightData={dashboardMetrics.weeklyInsightData}
            weeklyInsightSummary={dashboardMetrics.weeklyInsightSummary}
            weeklyInsightDelta={dashboardMetrics.weeklyInsightDelta}
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
          <TestSelection onStart={handleStartTest} initialSyllabus={selectedSyllabus} />
        ) : null}

        {currentView === 'study' ? (
          <StudyExplorer bundle={bundle} onStartStudy={handleStartStudy} />
        ) : null}

        {currentView === 'settings' ? (
          <SettingsPanel
            examTarget={bundle?.practiceState.examTarget ?? null}
            saving={settingsSaving}
            notice={settingsNotice}
            onSave={handleSaveExamTarget}
          />
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
            onRestart={() => {
              handleStartTest(activeSession.mode, selectedSyllabus || undefined);
            }}
            onGoHome={() => {
              setActiveSession(null);
              setLastTestPayload(null);
              setCurrentView('dashboard');
            }}
          />
        ) : null}

        {currentView === 'stats' ? (
          <StatsDashboard
            results={statsResults}
            bundle={bundle}
            levelLabel={
              coachPlan
                ? formatModeLabel(coachPlan.primaryAction === 'review' ? 'mixed' : 'standard')
                : 'Preparacion activa'
            }
          />
        ) : null}
      </main>
    </div>
  );
}
