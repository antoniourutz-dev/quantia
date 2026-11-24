import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  BarChart3,
  RotateCcw,
  LayoutDashboard,
  Clock,
  FileText,
  Flag,
  Zap,
  Info,
  Scale,
} from 'lucide-react';
import type {
  ActivePracticeSession,
  FinishedTestPayload,
  PracticeMode,
  Question,
  SyllabusType,
} from '../types';
import { buildReviewSurfaceCopy } from '../lib/coachCopyV2';
import { useAppLocale } from '../lib/locale';
import { storeSessionCloseSummary } from '../lib/continuity';
import { trackDecision, trackEffect } from '../lib/telemetry';
import { buildSessionEndExperience } from '../lib/sessionEndExperience';
import { getCurriculumCategoryGroupLabel } from '../lib/quantiaApi';
import HighlightableText from './HighlightableText';
import EditorialExplanation from './EditorialExplanation';
import QuestionNoteDrawer from './QuestionNoteDrawer';
import QuestionErrataPanel from './QuestionErrataPanel';
import { useStudyAnnotations } from '../hooks/useStudyAnnotations';
import {
  getUserErrataReportsForQuestions,
  type QuestionErrataReport,
} from '../lib/questionErrataApi';
import {
  createAnalysisLoadTrace,
  markAnalysisCtaVisible,
  markAnalysisHydrated,
  markAnalysisLevel1Ready,
  markAnalysisReviewVisible,
} from '../lib/analysisLoadMetrics';
import {
  calculateNetScore,
  DEFAULT_PENALTY_RULE,
  formatNetScore,
  PENALTY_RULES,
  type PenaltyRuleId,
} from '../lib/netScore';

type ReviewFilter = 'all' | 'incorrect' | 'unanswered' | 'flagged';

interface PostTestStatsProps {
  payload: FinishedTestPayload;
  topicReview?: ReactNode;
  questions: Question[];
  mode: PracticeMode;
  curriculum: string;
  username?: string | null;
  coachContext?: ActivePracticeSession['coach'] | null;
  onStartNextSession?: (params: {
    mode: PracticeMode;
    questionCount: number | null;
    syllabus: SyllabusType | null;
  }) => void;
  onRestart: () => void;
  onGoBack: () => void;
  onGoHome: () => void;
  homeVariant?: 'dashboard' | 'test-selection';
  penaltyRule?: PenaltyRuleId;
  userId?: string | null;
}

export default function PostTestStats({
  payload,
  topicReview,
  questions,
  mode,
  curriculum,
  username,
  coachContext = null,
  onStartNextSession,
  onRestart,
  onGoBack,
  onGoHome,
  homeVariant = 'dashboard',
  penaltyRule = DEFAULT_PENALTY_RULE,
  userId = null,
}: PostTestStatsProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const { score, answers } = payload;
  const scorableQuestions = useMemo(
    () => questions.filter((question) => question.correctAnswer != null),
    [questions],
  );
  const total = scorableQuestions.length;
  const answerMap = useMemo(() => new Map(answers.map((a) => [a.questionId, a])), [answers]);
  const flaggedSet = useMemo(
    () => new Set(payload.flaggedQuestionIds ?? []),
    [payload.flaggedQuestionIds],
  );
  const unansweredCount = useMemo(
    () =>
      scorableQuestions.filter((q) => {
        const a = answerMap.get(q.id);
        return !a || a.selectedOption == null;
      }).length,
    [answerMap, scorableQuestions],
  );
  const answeredCount = Math.max(0, total - unansweredCount);
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const incorrectCount = Math.max(0, total - score - unansweredCount);
  const failed = incorrectCount;
  const flaggedCount = useMemo(
    () => scorableQuestions.filter((q) => flaggedSet.has(q.id)).length,
    [flaggedSet, scorableQuestions],
  );
  const mostlyBlank = unansweredCount > 0 && unansweredCount > answeredCount;
  const hasPenalty = penaltyRule !== 'none';
  const penaltyMeta = PENALTY_RULES[penaltyRule];
  const netScore = useMemo(
    () =>
      calculateNetScore({
        correct: score,
        incorrect: incorrectCount,
        unanswered: unansweredCount,
        total,
        penaltyRule,
      }),
    [incorrectCount, penaltyRule, score, total, unansweredCount],
  );

  const answeredEntries = useMemo(
    () => answers.filter((a) => a.selectedOption != null),
    [answers],
  );
  const avgTimeMs = answeredEntries.length > 0
    ? answeredEntries.reduce((acc, curr) => acc + (curr.responseTimeMs ?? 0), 0) / answeredEntries.length
    : 0;
  const avgTimeSec = (avgTimeMs / 1000).toFixed(1);
  const analysisTrace = useMemo(() => createAnalysisLoadTrace(`${curriculum}:${mode}`), [curriculum, mode]);
  const [analysisHydrated, setAnalysisHydrated] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showReviewExplanation, setShowReviewExplanation] = useState(false);
  const [reviewNoteDrawerOpen, setReviewNoteDrawerOpen] = useState(false);
  const [errataReportsMap, setErrataReportsMap] = useState<
    Record<string, QuestionErrataReport[]>
  >({});

  const scorableQuestionIds = useMemo(
    () => scorableQuestions.map((q) => q.id),
    [scorableQuestions],
  );
  const {
    highlightsMap,
    notesMap,
    addHighlight,
    removeHighlight,
    saveNote,
  } = useStudyAnnotations({
    questionIds: scorableQuestionIds,
    enabled: showReview,
  });

  useEffect(() => {
    if (!showReview || scorableQuestionIds.length === 0) return;
    let cancelled = false;
    getUserErrataReportsForQuestions(scorableQuestionIds, userId)
      .then((reports) => {
        if (!cancelled) setErrataReportsMap(reports);
      })
      .catch(() => {
        // Ignore
      });
    return () => {
      cancelled = true;
    };
  }, [scorableQuestionIds, showReview]);

  const sessionEnd = useMemo(
    () =>
      buildSessionEndExperience({
        locale,
        payload,
        questionsCount: total,
        mode,
        curriculum,
        username,
        coachContext,
      }),
    [coachContext, curriculum, locale, mode, payload, total, username],
  );

  const displayHeadline = mostlyBlank
    ? isBasque
      ? `Testa osatu gabe (${answeredCount}/${total} erantzunda)`
      : `Test parcial (${answeredCount} de ${total} contestadas)`
    : sessionEnd.headline;
  const displaySummary = mostlyBlank
    ? isBasque
      ? `Zuri utzitako ${unansweredCount} galderak ez dira huts gisa gordetzen. Orain berrikus ditzakezu hutsuneak antzemateko.`
      : `Las ${unansweredCount} preguntas en blanco no cuentan como fallo en tus estadísticas. Puedes revisarlas ahora para detectar lagunas.`
    : sessionEnd.summary;

  const reviewCopy = buildReviewSurfaceCopy({
    locale,
    failedCount: failed,
    curriculum,
    username,
  });

  const lawData = useMemo(() => {
    if (!analysisHydrated) return [];

    const lawStats = scorableQuestions.reduce((acc, q) => {
      const law =
        getCurriculumCategoryGroupLabel(curriculum, q.category)?.trim() ||
        (q.category ?? '').trim() ||
        (isBasque ? 'Beste arauak' : 'Otras normas');
      if (!acc[law]) acc[law] = { total: 0, correct: 0, incorrect: 0, unanswered: 0 };
      acc[law].total += 1;
      const answer = answerMap.get(q.id) ?? null;
      if (!answer || answer.selectedOption == null) {
        acc[law].unanswered += 1;
      } else if (answer.isCorrect) {
        acc[law].correct += 1;
      } else {
        acc[law].incorrect += 1;
      }
      return acc;
    }, {} as Record<string, { total: number; correct: number; incorrect: number; unanswered: number }>);

    return Object.entries(lawStats)
      .map(([fullName, stats]) => {
        const lawNet = calculateNetScore({
          correct: stats.correct,
          incorrect: stats.incorrect,
          unanswered: stats.unanswered,
          total: stats.total,
          penaltyRule,
        });
        return {
          fullName,
          name: fullName.length > 36 ? `${fullName.substring(0, 33)}...` : fullName,
          accuracy: Math.round((stats.correct / Math.max(1, stats.total)) * 100),
          correct: stats.correct,
          incorrect: stats.incorrect,
          unanswered: stats.unanswered,
          total: stats.total,
          netScoreBase10: lawNet.scoreBase10,
        };
      })
      .sort((a, b) => b.total - a.total || b.accuracy - a.accuracy);
  }, [analysisHydrated, answerMap, curriculum, isBasque, penaltyRule, scorableQuestions]);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');

  const reviewItems = useMemo(() => {
    return scorableQuestions.map((q, index) => {
      const answer = answerMap.get(q.id) ?? null;
      const selected = answer?.selectedOption ?? null;
      const correct = q.correctAnswer;
      const isUnanswered = selected == null;
      const isCorrect = selected != null ? selected === correct : false;
      const isFlagged = flaggedSet.has(q.id);

      return {
        index: index + 1,
        id: q.id,
        topic:
          getCurriculumCategoryGroupLabel(curriculum, q.category) ??
          q.category ??
          (isBasque ? 'Orokorra' : 'General'),
        text: q.text,
        selected,
        correct,
        options: q.options,
        explanation: q.explanation,
        isCorrect,
        isUnanswered,
        isFlagged,
      };
    });
  }, [answerMap, curriculum, flaggedSet, isBasque, scorableQuestions]);

  const reviewableCount = useMemo(
    () => reviewItems.filter((item) => !item.isCorrect || item.isUnanswered || item.isFlagged).length,
    [reviewItems],
  );

  const reviewFiltered = useMemo(() => {
    switch (reviewFilter) {
      case 'incorrect':
        return reviewItems.filter((item) => !item.isCorrect && !item.isUnanswered);
      case 'unanswered':
        return reviewItems.filter((item) => item.isUnanswered);
      case 'flagged':
        return reviewItems.filter((item) => item.isFlagged);
      case 'all':
      default:
        return reviewItems;
    }
  }, [reviewFilter, reviewItems]);
  const currentReviewItem = reviewFiltered[reviewIndex] ?? null;

  useEffect(() => {
    markAnalysisLevel1Ready(analysisTrace);
    markAnalysisCtaVisible(analysisTrace);
    trackDecision({
      surface: 'session_end',
      curriculum,
      dominantState: sessionEnd.dominantState,
      primaryAction: coachContext?.primaryAction ?? null,
      tone: coachContext?.tone ?? null,
      visibleCta: sessionEnd.primaryCta,
      context: {
        mode,
        score,
        total,
        percentage,
        closeState: sessionEnd.dominantState,
        nextMoveKind: sessionEnd.nextMove.kind,
        nextMode: sessionEnd.nextMove.kind === 'start_session' ? sessionEnd.nextMove.mode : null,
      },
    });

    storeSessionCloseSummary({
      timestamp: new Date().toISOString(),
      curriculum,
      mode,
      dominantState: sessionEnd.dominantState,
      thesis: displayHeadline,
      nextCta: sessionEnd.primaryCta,
      score,
      total,
    });
  }, [
    analysisTrace,
    coachContext?.primaryAction,
    coachContext?.tone,
    curriculum,
    displayHeadline,
    mode,
    percentage,
    total,
    score,
    sessionEnd.dominantState,
    sessionEnd.primaryCta,
    sessionEnd.nextMove.kind,
    sessionEnd.nextMove.kind === 'start_session' ? sessionEnd.nextMove.mode : null,
  ]);

  useEffect(() => {
    if (!analysisHydrated) return;
    markAnalysisHydrated(analysisTrace);
  }, [analysisHydrated, analysisTrace]);

  useEffect(() => {
    if (!showReview) return;
    markAnalysisReviewVisible(analysisTrace);
  }, [analysisTrace, showReview]);

  useEffect(() => {
    setReviewIndex(0);
  }, [reviewFilter, showReview]);

  useEffect(() => {
    setShowReviewExplanation(false);
    setReviewNoteDrawerOpen(false);
  }, [reviewIndex, reviewFilter, showReview]);

  const openMistakeReview = (preferredFilter?: ReviewFilter) => {
    const nextFilter: ReviewFilter =
      preferredFilter ??
      (failed > 0
        ? 'incorrect'
        : flaggedCount > 0
          ? 'flagged'
          : unansweredCount > 0
            ? 'unanswered'
            : 'all');
    setReviewFilter(nextFilter);
    setAnalysisHydrated(true);
    setReviewIndex(0);
    setShowReview(true);
    requestAnimationFrame(() => {
      document.getElementById('session-end-review')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  };

  const shouldHideDuplicatePrimaryReviewCta =
    Boolean(topicReview) &&
    sessionEnd.nextMove.kind === 'start_session' &&
    sessionEnd.nextMove.mode === 'review';

  const reviewButtonLabel = (() => {
    if (failed > 0 && unansweredCount === 0 && flaggedCount === 0) {
      return isBasque
        ? `${failed} akatsak aztertu`
        : `Analizar ${failed} ${failed === 1 ? 'fallo' : 'fallos'}`;
    }
    if (failed === 0 && unansweredCount > 0 && flaggedCount === 0) {
      return isBasque
        ? `${unansweredCount} zuriak berrikusi`
        : `Revisar ${unansweredCount} en blanco`;
    }
    const parts: string[] = [];
    if (failed > 0) parts.push(isBasque ? `${failed} huts` : `${failed} ${failed === 1 ? 'fallo' : 'fallos'}`);
    if (unansweredCount > 0) parts.push(isBasque ? `${unansweredCount} zuri` : `${unansweredCount} en blanco`);
    if (flaggedCount > 0) parts.push(isBasque ? `${flaggedCount} zalantza` : `${flaggedCount} ${flaggedCount === 1 ? 'duda' : 'dudas'}`);
    return isBasque ? `Testa berrikusi (${parts.join(' · ')})` : `Revisar test (${parts.join(' · ')})`;
  })();

  const reviewTabs: Array<{ id: ReviewFilter; label: string; count: number; tone: string }> = [
    {
      id: 'all',
      label: isBasque ? 'Denak' : 'Todas',
      count: reviewItems.length,
      tone: 'border-indigo-600 bg-indigo-50 text-indigo-700',
    },
    ...(failed > 0
      ? [
          {
            id: 'incorrect' as const,
            label: isBasque ? 'Hutsak' : 'Fallos',
            count: failed,
            tone: 'border-rose-600 bg-rose-50 text-rose-700',
          },
        ]
      : []),
    ...(unansweredCount > 0
      ? [
          {
            id: 'unanswered' as const,
            label: isBasque ? 'Zuri' : 'En blanco',
            count: unansweredCount,
            tone: 'border-slate-600 bg-slate-100 text-slate-800',
          },
        ]
      : []),
    ...(flaggedCount > 0
      ? [
          {
            id: 'flagged' as const,
            label: isBasque ? 'Zalantzak' : 'Con duda',
            count: flaggedCount,
            tone: 'border-amber-600 bg-amber-50 text-amber-800',
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4 animate-in fade-in duration-150 pb-20 sm:space-y-6 sm:pb-24 pt-4 sm:pt-8">
      <div className="flex flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
        {/* TOP ROW: Score Badge + Continuity */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {hasPenalty ? (
              <>
                <div className="flex flex-col items-center justify-center px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 min-w-[4.5rem]">
                  <span
                    className={`text-[18px] leading-none font-black tabular-nums ${
                      netScore.scoreBase10 >= 7
                        ? 'text-emerald-600'
                        : netScore.scoreBase10 >= 5
                          ? 'text-amber-600'
                          : 'text-rose-600'
                    }`}
                  >
                    {formatNetScore(netScore.scoreBase10)}/10
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                      {isBasque ? 'Nota garbia' : 'Nota neta'}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-black text-amber-800 tabular-nums leading-none">
                      {penaltyMeta.shortLabel}
                    </span>
                  </div>
                  <div className="text-[13px] font-bold text-slate-600 leading-tight tabular-nums">
                    {percentage}% · {score}/{total} {isBasque ? 'zuzen' : 'aciertos'}
                  </div>
                  {netScore.rawNetPoints < 0 ? (
                    <div className="mt-0.5 text-[11px] font-semibold text-rose-600 tabular-nums">
                      {isBasque
                        ? `Garbi gordina: ${formatNetScore(netScore.rawScoreBase10)}/10`
                        : `Neto bruto: ${formatNetScore(netScore.rawScoreBase10)}/10`}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center justify-center px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 min-w-[3.5rem]">
                  <span
                    className={`text-[18px] leading-none font-black tabular-nums ${
                      percentage >= 70 ? 'text-emerald-600' : percentage >= 50 ? 'text-amber-600' : 'text-rose-600'
                    }`}
                  >
                    {percentage}%
                  </span>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">
                    {isBasque ? 'Emaitza' : 'Resultado'}
                  </div>
                  <div className="text-[13px] font-bold text-slate-600 leading-none tabular-nums">
                    {score}/{total} {isBasque ? 'zuzen' : 'aciertos'} · {formatNetScore(netScore.scoreBase10)}/10
                  </div>
                </div>
              </>
            )}
          </div>
          {sessionEnd.continuityLine ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-1.5 text-[11px] font-bold text-indigo-700">
              {sessionEnd.continuityLine}
            </div>
          ) : null}
        </div>

        <div className="mb-4 space-y-2">
          <h2 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
            {displayHeadline}
          </h2>
          <p className="text-sm font-medium leading-relaxed text-slate-600">
            {displaySummary}
          </p>
          {!mostlyBlank && sessionEnd.microReward ? (
            <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-2.5">
              <Zap size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <div className="text-xs leading-snug">
                <div className="font-black text-emerald-900">{sessionEnd.microReward.title}</div>
                <div className="font-medium text-emerald-700">{sessionEnd.microReward.detail}</div>
              </div>
            </div>
          ) : null}
        </div>

        {/* SINGLE METRICS STRIP (clickable shortcuts into review tabs) */}
        <div className="grid grid-cols-2 sm:flex sm:divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/70 py-3 px-2 gap-y-2 mb-5">
          <div className="flex-1 flex flex-col items-center px-1">
            <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-0.5">
              <CheckCircle2 size={12} /> {isBasque ? 'Zuzenak' : 'Aciertos'}
            </span>
            <span className="text-[14px] font-black text-emerald-600 tabular-nums">{score}</span>
          </div>
          <button
            type="button"
            disabled={failed === 0}
            onClick={() => openMistakeReview('incorrect')}
            className="flex-1 flex flex-col items-center px-1 rounded-lg transition hover:bg-white disabled:hover:bg-transparent"
          >
            <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-0.5">
              <XCircle size={12} /> {isBasque ? 'Hutsak' : 'Fallos'}
            </span>
            <span className="text-[14px] font-black text-rose-600 tabular-nums">{failed}</span>
          </button>
          {unansweredCount > 0 ? (
            <button
              type="button"
              onClick={() => openMistakeReview('unanswered')}
              className="flex-1 flex flex-col items-center px-1 rounded-lg transition hover:bg-white"
            >
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-0.5">
                {isBasque ? 'Zuri' : 'En blanco'}
              </span>
              <span className="text-[14px] font-black text-slate-700 tabular-nums">{unansweredCount}</span>
            </button>
          ) : null}
          {flaggedCount > 0 ? (
            <button
              type="button"
              onClick={() => openMistakeReview('flagged')}
              className="flex-1 flex flex-col items-center px-1 rounded-lg transition hover:bg-white"
            >
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-amber-700 mb-0.5">
                <Flag size={11} /> {isBasque ? 'Zalantzak' : 'Dudas'}
              </span>
              <span className="text-[14px] font-black text-amber-700 tabular-nums">{flaggedCount}</span>
            </button>
          ) : null}
          <div className="flex-1 flex flex-col items-center px-1">
            <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-0.5">
              <Clock size={12} /> {isBasque ? 'Seg/gal' : 'Seg/preg'}
            </span>
            <span className="text-[14px] font-black text-slate-700 tabular-nums">
              {answeredEntries.length > 0 ? `${avgTimeSec}s` : '—'}
            </span>
          </div>
        </div>

        {hasPenalty && (incorrectCount > 0 || unansweredCount > 0) ? (
          <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs font-semibold text-amber-950">
            <span className="inline-flex items-center gap-1.5 font-black text-amber-800">
              <Scale size={14} className="shrink-0" />
              {isBasque ? `Zigor-araua (${penaltyMeta.shortLabel}):` : `Penalización (${penaltyMeta.shortLabel}):`}
            </span>
            {incorrectCount > 0 ? (
              <span className="tabular-nums text-rose-700 font-bold">
                {isBasque
                  ? `-${formatNetScore(netScore.penaltyLostPoints)} pt (-${formatNetScore(netScore.penaltyLostBase10)}/10) ${incorrectCount} hutsegiteengatik`
                  : `-${formatNetScore(netScore.penaltyLostPoints)} pts (-${formatNetScore(netScore.penaltyLostBase10)}/10) por ${incorrectCount} ${incorrectCount === 1 ? 'fallo' : 'fallos'}`}
              </span>
            ) : null}
            {unansweredCount > 0 ? (
              <span className="tabular-nums text-slate-700 font-bold">
                {isBasque
                  ? `${unansweredCount} zuri zigorrik gabe (0 pt)`
                  : `${unansweredCount} en blanco sin penalización (0 pts)`}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* ACTIONS: At most 1 primary next-practice action + 1 secondary review-this-test action */}
        <div className="space-y-3">
          {topicReview}
          {!shouldHideDuplicatePrimaryReviewCta ? (
            <button
              onClick={() => {
                trackEffect({
                  surface: 'session_end',
                  curriculum,
                  action: 'cta_clicked',
                  context: { cta: sessionEnd.primaryCta, mode, nextMoveKind: sessionEnd.nextMove.kind },
                });
                if (sessionEnd.nextMove.kind === 'review_on_page') {
                  openMistakeReview();
                  return;
                }
                if (sessionEnd.nextMove.kind === 'start_session' && onStartNextSession) {
                  onStartNextSession({
                    mode: sessionEnd.nextMove.mode,
                    questionCount: sessionEnd.nextMove.questionCount,
                    syllabus: sessionEnd.nextMove.syllabus,
                  });
                  return;
                }
                onRestart();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-[15px] font-black text-white shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] transition-all active:scale-[0.98] hover:bg-indigo-700"
            >
              {sessionEnd.nextMove.kind === 'review_on_page' ? <RotateCcw size={18} /> : null}
              {sessionEnd.primaryCta}
            </button>
          ) : null}
          {reviewableCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                trackEffect({
                  surface: 'session_end',
                  curriculum,
                  action: 'cta_clicked',
                  context: { cta: 'analyze_mistakes', mode, failedCount: failed },
                });
                openMistakeReview();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-[14px] font-black text-slate-800 transition-all hover:border-indigo-200 hover:bg-indigo-50/50"
            >
              <XCircle size={18} className="text-rose-600" />
              {reviewButtonLabel}
            </button>
          ) : null}
        </div>
      </div>

      {/* Show breakdown only when the test actually covered >= 2 topics/laws */}
      {analysisHydrated && lawData.length >= 2 ? (
        <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart3 size={20} />
            </div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">
              {isBasque ? 'Gaika / Legez lege' : 'Por tema / ley'}
            </h3>
          </div>
          <div className="rounded-xl bg-slate-50 overflow-hidden text-sm">
            <div className="divide-y divide-slate-100">
              {lawData.slice(0, 12).map((law) => (
                <div key={law.fullName} className="px-4 py-3 flex items-center justify-between gap-4 bg-white">
                  <div className="truncate font-bold text-slate-700 text-xs sm:text-sm">{law.fullName}</div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-xs font-bold text-slate-500 tabular-nums">
                      {law.correct}/{law.total}
                    </span>
                    <span
                      className={`font-black text-sm lg:text-base tabular-nums ${
                        law.accuracy >= 80
                          ? 'text-emerald-600'
                          : law.accuracy >= 60
                            ? 'text-amber-600'
                            : 'text-rose-600'
                      }`}
                    >
                      {law.accuracy}%
                    </span>
                    {hasPenalty ? (
                      <span
                        className={`rounded-lg border px-2 py-0.5 text-xs font-black tabular-nums ${
                          law.netScoreBase10 >= 7
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : law.netScoreBase10 >= 5
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-rose-200 bg-rose-50 text-rose-700'
                        }`}
                      >
                        {formatNetScore(law.netScoreBase10)}/10
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showReview ? (
        <div id="session-end-review" className="space-y-6 rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:space-y-8 sm:rounded-[2.5rem] sm:p-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                {isBasque ? 'Orain zer berrikusi komeni den' : 'Revisión de preguntas'}
              </h3>
              <p className="text-slate-500 font-medium mt-1">
                {reviewCopy.line2 ?? reviewCopy.line1}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={isBasque ? 'Berrikuspen iragazkiak' : 'Filtros de revisión'}>
              {reviewTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={reviewFilter === tab.id}
                  onClick={() => {
                    setReviewFilter(tab.id);
                    setReviewIndex(0);
                  }}
                  className={`px-3.5 py-2.5 rounded-2xl border-2 font-black text-xs uppercase tracking-wider transition-all ${
                    reviewFilter === tab.id
                      ? tab.tone
                      : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {reviewFiltered.slice(reviewIndex, reviewIndex + 1).map((item) => (
              <div key={item.id} className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-lg bg-white border border-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        #{item.index}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest">
                        {item.topic}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                          item.isCorrect
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                            : item.isUnanswered
                              ? 'bg-slate-100 border-slate-200 text-slate-600'
                              : 'bg-rose-50 border-rose-100 text-rose-700'
                        }`}
                      >
                        {item.isCorrect
                          ? isBasque
                            ? 'ZUZEN'
                            : 'ACIERTO'
                          : item.isUnanswered
                            ? isBasque
                              ? 'ZURI'
                              : 'EN BLANCO'
                            : isBasque
                              ? 'HUTS'
                              : 'FALLO'}
                      </span>
                      {item.isFlagged ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-black uppercase tracking-widest">
                          <Flag size={11} />
                          {isBasque ? 'ZALANTZA' : 'DUDA'}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-lg font-black text-slate-900 leading-snug select-text">
                      <HighlightableText
                        text={item.text}
                        highlights={highlightsMap[item.id] ?? []}
                        onAddHighlight={(hl) =>
                          void addHighlight(item.id, hl, {
                            contentType: 'question',
                            category: item.topic ?? null,
                          })
                        }
                        onRemoveHighlight={(id) =>
                          void removeHighlight(item.id, id, {
                            contentType: 'question',
                            category: item.topic ?? null,
                          })
                        }
                        maxSelectionChars={120}
                      />
                    </div>
                  </div>

                  <div className="shrink-0">
                    {item.isCorrect ? (
                      <CheckCircle2 size={28} className="text-emerald-600" />
                    ) : (
                      <XCircle size={28} className={item.isUnanswered ? 'text-slate-400' : 'text-rose-600'} />
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {isBasque ? 'Erantzun aukerak' : 'Opciones de respuesta'}
                  </div>
                  {item.options.map((option, optionIndex) => {
                    const isSelected = option.id === item.selected;
                    const isCorrectOption = option.id === item.correct;
                    const optionClass = isCorrectOption
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                      : isSelected
                        ? 'border-rose-300 bg-rose-50 text-rose-950'
                        : 'border-slate-200 bg-white text-slate-700';
                    const answerKey = `${item.id}_ans_${optionIndex}`;

                    return (
                      <div
                        key={option.id}
                        className={`flex flex-col gap-3 rounded-2xl border-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${optionClass}`}
                      >
                        <div className="flex min-w-0 items-start gap-3 text-sm font-bold leading-relaxed select-text">
                          <span className="shrink-0 font-black uppercase">{option.id}.</span>
                          <span>
                            <HighlightableText
                              text={option.text}
                              highlights={highlightsMap[answerKey] ?? []}
                              onAddHighlight={(hl) =>
                                void addHighlight(item.id, hl, {
                                  contentType: 'answer',
                                  answerIndex: optionIndex,
                                  category: item.topic ?? null,
                                })
                              }
                              onRemoveHighlight={(id) =>
                                void removeHighlight(item.id, id, {
                                  contentType: 'answer',
                                  answerIndex: optionIndex,
                                  category: item.topic ?? null,
                                })
                              }
                              maxSelectionChars={90}
                            />
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700">
                              <XCircle size={13} />
                              {isBasque ? 'Zure erantzuna' : 'Tu respuesta'}
                            </span>
                          ) : null}
                          {isCorrectOption ? (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                              <CheckCircle2 size={13} />
                              {isBasque ? 'Erantzun zuzena' : 'Respuesta correcta'}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {!item.selected ? (
                    <div className="text-xs font-bold text-slate-500">
                      {isBasque ? 'Galdera erantzun gabe utzi zenuen.' : 'Dejaste esta pregunta sin responder.'}
                    </div>
                  ) : null}
                </div>

                {/* Active Study Bar: Note + Errata report */}
                <div className="mt-5 border-t border-slate-200/80 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewNoteDrawerOpen((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition ${
                          (notesMap[item.id] ?? '').trim()
                            ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <FileText size={14} />
                        {(notesMap[item.id] ?? '').trim()
                          ? isBasque
                            ? 'Oharra editatu'
                            : 'Editar nota'
                          : isBasque
                            ? 'Oharra gehitu'
                            : 'Añadir nota'}
                      </button>
                      <QuestionErrataPanel
                        key={item.id}
                        questionId={item.id}
                        curriculum={curriculum}
                        userId={userId}
                        existingReports={errataReportsMap[item.id] ?? []}
                        onSubmitted={(report) =>
                          setErrataReportsMap((prev) => ({
                            ...prev,
                            [item.id]: [report, ...(prev[item.id] ?? [])],
                          }))
                        }
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
                      {isBasque
                        ? 'Hautatu testua azpimarratzeko'
                        : 'Selecciona texto para subrayar'}
                    </span>
                  </div>

                  {(notesMap[item.id] ?? '').trim() && !reviewNoteDrawerOpen ? (
                    <div className="mt-2.5 rounded-2xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 text-xs font-medium text-amber-950">
                      <span className="font-black text-amber-800">
                        {isBasque ? 'Zure oharra: ' : 'Tu nota: '}
                      </span>
                      {notesMap[item.id]}
                    </div>
                  ) : null}

                  <QuestionNoteDrawer
                    open={reviewNoteDrawerOpen}
                    questionId={item.id}
                    questionNumber={item.index}
                    note={notesMap[item.id] ?? ''}
                    onClose={() => setReviewNoteDrawerOpen(false)}
                    onSave={(note) => saveNote(item.id, note)}
                  />
                </div>

                {item.explanation?.trim() ? (
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    {!showReviewExplanation ? (
                      <button
                        type="button"
                        onClick={() => setShowReviewExplanation(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-4 py-2.5 text-xs font-black text-indigo-600 transition-all hover:bg-indigo-50"
                      >
                        <Info size={15} />
                        {isBasque ? 'Azalpena ikusi' : 'Ver explicación'}
                      </button>
                    ) : (
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5">
                        <div className="mb-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-700">
                            <Info size={15} />
                            {isBasque ? 'Azalpena' : 'Explicación'}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowReviewExplanation(false)}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-indigo-600"
                          >
                            {isBasque ? 'Itxi' : 'Cerrar'}
                          </button>
                        </div>
                        <EditorialExplanation
                          text={item.explanation}
                          highlights={highlightsMap[`${item.id}_exp`] ?? []}
                          onAddHighlight={(hl) =>
                            void addHighlight(item.id, hl, {
                              contentType: 'explanation',
                              category: item.topic ?? null,
                            })
                          }
                          onRemoveHighlight={(id) =>
                            void removeHighlight(item.id, id, {
                              contentType: 'explanation',
                              category: item.topic ?? null,
                            })
                          }
                          readOnly={false}
                        />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
            {!currentReviewItem ? (
              <div className="rounded-2xl bg-emerald-50 p-5 text-center text-sm font-bold text-emerald-700">
                {isBasque ? 'Ez dago berrikusteko galderarik iragazki honetan.' : 'No hay preguntas que revisar en este filtro.'}
              </div>
            ) : null}
          </div>

          {reviewFiltered.length > 0 ? (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setReviewIndex((index) => Math.max(0, index - 1))}
                disabled={reviewIndex === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={16} />
                {isBasque ? 'Aurrekoa' : 'Anterior'}
              </button>
              <div className="text-center text-xs font-black uppercase tracking-widest text-slate-400">
                {reviewIndex + 1} / {reviewFiltered.length}
              </div>
              <button
                type="button"
                onClick={() => setReviewIndex((index) => Math.min(reviewFiltered.length - 1, index + 1))}
                disabled={reviewIndex >= reviewFiltered.length - 1}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isBasque ? 'Hurrengoa' : 'Siguiente'}
                <ArrowRight size={16} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`grid grid-cols-1 gap-3 pt-2 pb-6 ${homeVariant === 'dashboard' ? 'sm:grid-cols-2' : ''}`}>
        {homeVariant === 'dashboard' ? (
          <button
            onClick={() => {
              trackEffect({ surface: 'session_end', curriculum, action: 'cta_clicked', context: { mode, cta: 'go_back' } });
              onGoBack();
            }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[13px] font-black text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            {isBasque ? 'Itzuli' : 'Volver'}
          </button>
        ) : null}
        <button
          onClick={() => {
            trackEffect({ surface: 'session_end', curriculum, action: 'go_home', context: { mode } });
            onGoHome();
          }}
          className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[13px] font-black text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
        >
          <LayoutDashboard size={16} />
          {homeVariant === 'test-selection'
            ? isBasque
              ? 'Itzuli testeetara'
              : 'Volver a test'
            : isBasque
              ? 'Panel nagusira itzuli'
              : 'Volver al panel principal'}
        </button>
      </div>
    </div>
  );
}
