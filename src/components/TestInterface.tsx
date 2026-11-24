import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flag,
  Highlighter,
  LayoutGrid,
  RotateCcw,
  Info,
  Loader2,
  Timer,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react';
import { FinishedTestPayload, OptionKey, PracticeMode, Question, TestAnswer } from '../types';
import { useAppLocale } from '../lib/locale';
import type { StudyQuestionData } from '../lib/quantiaApi';
import HighlightableText, { type TextHighlight } from './HighlightableText';
import EditorialExplanation from './EditorialExplanation';
import QuestionNoteDrawer from './QuestionNoteDrawer';
import QuestionErrataPanel from './QuestionErrataPanel';
import { useStudyAnnotations } from '../hooks/useStudyAnnotations';
import {
  getUserErrataReportsForQuestions,
  type QuestionErrataReport,
} from '../lib/questionErrataApi';
import { recordQuestionAnswer, recordQuestionView } from '../lib/questionActivity';
import PracticalCaseContext from './PracticalCaseContext';

interface TestInterfaceProps {
  questions: Question[];
  mode: PracticeMode;
  reviewPriority?: 'most_problematic' | null;
  frictionByQuestionId?: Record<
    string,
    {
      frictionScore: number;
      primaryTag: 'repeated_error' | 'recent_trouble' | 'pressure_trouble' | 'memory_fragile' | 'mixed';
    }
  > | null;
  supportMode?: { showMarks: boolean; showNotes: boolean } | null;
  studyData?: StudyQuestionData | null;
  allowInSessionMistakeReview?: boolean;
  onFinish: (payload: FinishedTestPayload) => void | Promise<void>;
  onCancel: () => void;
  isFinishing?: boolean;
  activityContext?: { userId: string; curriculum: string; sessionId: string } | null;
}

type FocusTextSize = 'compact' | 'normal' | 'large';

export default function TestInterface({
  questions,
  mode,
  reviewPriority = null,
  frictionByQuestionId = null,
  supportMode = null,
  studyData = null,
  allowInSessionMistakeReview = false,
  onFinish,
  onCancel,
  isFinishing = false,
  activityContext = null,
}: TestInterfaceProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(OptionKey | null)[]>(
    new Array(questions.length).fill(null),
  );
  const [answerDetails, setAnswerDetails] = useState<Array<TestAnswer | null>>(
    new Array(questions.length).fill(null),
  );
  const [showExplanation, setShowExplanation] = useState(false);
  const [manualExplanationOpen, setManualExplanationOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isAnalysisMode, setIsAnalysisMode] = useState(false);
  const [focusTextSize, setFocusTextSize] = useState<FocusTextSize>('normal');
  const [timeLeft, setTimeLeft] = useState(() => (mode === 'simulacro' ? questions.length * 90 : questions.length * 60));
  const [questionStartAt, setQuestionStartAt] = useState(() => Date.now());
  const [finishRequested, setFinishRequested] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [mistakeReview, setMistakeReview] = useState<{
    kind: 'pending' | 'all';
    questions: Question[];
    returnIndex: number;
    selectedAnswers: (OptionKey | null)[];
    answerDetails: Array<TestAnswer | null>;
  } | null>(null);
  const [resolvedMistakeQuestionIds, setResolvedMistakeQuestionIds] = useState<string[]>([]);
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<string[]>([]);
  const [isGridOpen, setIsGridOpen] = useState(false);
  const finishStartedRef = useRef(false);
  const wasFinishingRef = useRef(false);
  const viewOccurrencesRef = useRef(new Map<string, number>());
  const currentViewEventIdRef = useRef<string | null>(null);

  const activeQuestions = mistakeReview?.questions ?? questions;
  const activeSelectedAnswers = mistakeReview?.selectedAnswers ?? selectedAnswers;
  const activeAnswerDetails = mistakeReview?.answerDetails ?? answerDetails;
  const currentQuestion = activeQuestions[currentIndex];
  const currentFriction = currentQuestion ? frictionByQuestionId?.[currentQuestion.id] ?? null : null;
  const officialMetadata = currentQuestion?.practiceSource === 'official' ? currentQuestion.officialMetadata ?? null : null;
  const selectedAnswer = activeSelectedAnswers[currentIndex];
  const isSimulacro = mode === 'simulacro';
  const isMistakeReview = Boolean(mistakeReview);
  const closingSession = finishRequested || isFinishing;
  const showMarks = Boolean(supportMode?.showMarks);
  const showNotes = Boolean(supportMode?.showNotes);
  const activityUserId = activityContext?.userId ?? null;
  const activityCurriculum = activityContext?.curriculum ?? null;
  const activitySessionId = activityContext?.sessionId ?? null;
  const [caseReadyQuestionId, setCaseReadyQuestionId] = useState<string | null>(null);
  const onCaseStatus = useCallback((id: string, ready: boolean) => {
    setCaseReadyQuestionId(ready ? id : null);
  }, []);
  const needsCaseContext = Boolean(activityUserId) && currentQuestion?.practiceSource !== 'official';
  const waitingForCase = needsCaseContext && caseReadyQuestionId !== currentQuestion?.id;
  const canActiveStudyCurrent =
    !isSimulacro && (selectedAnswer !== null || isMistakeReview);

  const allQuestionIds = useMemo(() => questions.map((q) => q.id), [questions]);
  const {
    highlightsMap,
    notesMap,
    addHighlight,
    removeHighlight,
    saveNote,
  } = useStudyAnnotations({
    questionIds: allQuestionIds,
    initialData: studyData,
    enabled: !isSimulacro || showMarks || showNotes,
  });

  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false);
  const [ephemeralHighlights, setEphemeralHighlights] = useState<TextHighlight[]>([]);
  const [ephemeralOptionHighlights, setEphemeralOptionHighlights] = useState<
    Record<number, TextHighlight[]>
  >({});
  const [errataReportsMap, setErrataReportsMap] = useState<
    Record<string, QuestionErrataReport[]>
  >({});

  useEffect(() => {
    setNoteDrawerOpen(false);
    setEphemeralHighlights([]);
    setEphemeralOptionHighlights({});
  }, [currentIndex, currentQuestion?.id, isMistakeReview]);

  useEffect(() => {
    if (allQuestionIds.length === 0) return;
    let cancelled = false;
    getUserErrataReportsForQuestions(allQuestionIds, activityUserId)
      .then((reports) => {
        if (!cancelled) setErrataReportsMap(reports);
      })
      .catch(() => {
        // Ignore
      });
    return () => {
      cancelled = true;
    };
  }, [activityUserId, allQuestionIds]);
  const questionTextSizeClass = isFocusMode
    ? focusTextSize === 'large'
      ? 'text-lg sm:text-xl'
      : focusTextSize === 'normal'
        ? 'text-base sm:text-lg'
        : 'text-[15px] sm:text-lg'
    : 'text-[15px] sm:text-lg';
  const answerTextSizeClass = isFocusMode
    ? focusTextSize === 'large'
      ? 'text-lg sm:text-xl'
      : focusTextSize === 'normal'
        ? 'text-base sm:text-lg'
        : 'text-[15px] sm:text-base'
    : 'text-base sm:text-lg';

  const mainScore = useMemo(
    () => answerDetails.filter((answer) => answer?.isCorrect).length,
    [answerDetails],
  );
  const score = useMemo(
    () => activeAnswerDetails.filter((answer) => answer?.isCorrect).length,
    [activeAnswerDetails],
  );
  const activeScorableCount = useMemo(
    () => activeQuestions.filter((question) => question.correctAnswer != null).length,
    [activeQuestions],
  );
  const answeredCount = useMemo(
    () => activeSelectedAnswers.filter((answer) => answer !== null).length,
    [activeSelectedAnswers],
  );
  const blankCount = activeQuestions.length - answeredCount;
  const flaggedQuestionIdSet = useMemo(
    () => new Set(flaggedQuestionIds),
    [flaggedQuestionIds],
  );
  const isCurrentQuestionFlagged = Boolean(
    currentQuestion && flaggedQuestionIdSet.has(currentQuestion.id),
  );
  const flaggedCount = useMemo(
    () => activeQuestions.filter((q) => flaggedQuestionIdSet.has(q.id)).length,
    [activeQuestions, flaggedQuestionIdSet],
  );
  const resolvedMistakeQuestionIdSet = useMemo(
    () => new Set(resolvedMistakeQuestionIds),
    [resolvedMistakeQuestionIds],
  );
  const accumulatedMistakeQuestions = useMemo(() => {
    if (!allowInSessionMistakeReview || isSimulacro || isMistakeReview || questions.length <= 40 || currentIndex + 1 < 20) return [];
    return answerDetails
      .slice(0, currentIndex + 1)
      .map((answer, index) => (answer && !answer.isCorrect && questions[index]?.correctAnswer != null ? questions[index] : null))
      .filter((question): question is Question => Boolean(question))
      .filter((question) => !resolvedMistakeQuestionIdSet.has(question.id));
  }, [allowInSessionMistakeReview, answerDetails, currentIndex, isMistakeReview, isSimulacro, questions, resolvedMistakeQuestionIdSet]);
  const allAccumulatedMistakeQuestions = useMemo(() => {
    if (!allowInSessionMistakeReview || isSimulacro || isMistakeReview || questions.length <= 40 || currentIndex + 1 < 20) return [];
    return answerDetails
      .slice(0, currentIndex + 1)
      .map((answer, index) => (answer && !answer.isCorrect && questions[index]?.correctAnswer != null ? questions[index] : null))
      .filter((question): question is Question => Boolean(question));
  }, [allowInSessionMistakeReview, answerDetails, currentIndex, isMistakeReview, isSimulacro, questions]);
  const canStartMistakeReview = accumulatedMistakeQuestions.length > 0 && !closingSession;
  const canStartFullMistakeReview = allAccumulatedMistakeQuestions.length > 0 && !closingSession;

  const finishPayload = useMemo(
    () => ({
      score: mainScore,
      answers: answerDetails.filter(
        (answer): answer is TestAnswer => Boolean(answer?.correctOption && answer?.selectedOption),
      ),
      flaggedQuestionIds: flaggedQuestionIds.length > 0 ? [...flaggedQuestionIds] : undefined,
    }),
    [answerDetails, flaggedQuestionIds, mainScore],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      if (isSimulacro && !finishStartedRef.current) {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isSimulacro]);

  useEffect(() => {
    if (wasFinishingRef.current && !isFinishing) {
      setFinishRequested(false);
      finishStartedRef.current = false;
    }
    wasFinishingRef.current = isFinishing;
  }, [isFinishing]);

  useEffect(() => {
    setFinishRequested(false);
    finishStartedRef.current = false;
    setMistakeReview(null);
    setResolvedMistakeQuestionIds([]);
    setFlaggedQuestionIds([]);
    setIsGridOpen(false);
  }, [mode, questions]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentIndex]);

  useEffect(() => {
    setNoteOpen(false);
  }, [currentQuestion?.id]);

  useEffect(() => {
    if (!activityUserId || !activityCurriculum || !activitySessionId || !currentQuestion?.correctAnswer) return;
    const phase = isMistakeReview ? 'mistake-review' : 'test';
    const occurrenceKey = `${phase}:${currentQuestion.id}`;
    const occurrence = (viewOccurrencesRef.current.get(occurrenceKey) ?? 0) + 1;
    viewOccurrencesRef.current.set(occurrenceKey, occurrence);
    const eventId = `${activitySessionId}:${occurrenceKey}:${occurrence}`;
    currentViewEventIdRef.current = eventId;
    recordQuestionView({
      userId: activityUserId,
      curriculum: activityCurriculum,
      sessionId: activitySessionId,
      eventId,
      surface: phase,
      mode,
      question: currentQuestion,
    });
  }, [activityCurriculum, activitySessionId, activityUserId, currentIndex, currentQuestion, isMistakeReview]);

  const requestFinish = useCallback(() => {
    if (mistakeReview) {
      setCurrentIndex(mistakeReview.returnIndex);
      setMistakeReview(null);
      setShowExplanation(!isSimulacro && selectedAnswers[mistakeReview.returnIndex] !== null);
      setManualExplanationOpen(false);
      setQuestionStartAt(Date.now());
      return;
    }
    if (finishStartedRef.current) return;
    finishStartedRef.current = true;
    setFinishRequested(true);
    void onFinish(finishPayload);
  }, [finishPayload, isSimulacro, mistakeReview, onFinish, selectedAnswers]);

  useEffect(() => {
    if (isSimulacro && timeLeft === 0) {
      requestFinish();
    }
  }, [isSimulacro, requestFinish, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleDoubtFlag = useCallback(
    (questionId?: string) => {
      const targetId = questionId ?? currentQuestion?.id;
      if (!targetId || closingSession) return;
      setFlaggedQuestionIds((prev) =>
        prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId],
      );
    },
    [closingSession, currentQuestion?.id],
  );

  const goToQuestion = useCallback(
    (nextIndex: number) => {
      if (closingSession || nextIndex < 0 || nextIndex >= activeQuestions.length) return;
      setCurrentIndex(nextIndex);
      setShowExplanation(!isSimulacro && activeSelectedAnswers[nextIndex] !== null);
      setManualExplanationOpen(false);
      setQuestionStartAt(Date.now());
      setIsGridOpen(false);
    },
    [activeQuestions.length, activeSelectedAnswers, closingSession, isSimulacro],
  );

  const clearCurrentAnswer = useCallback(() => {
    if (closingSession || !isSimulacro || selectedAnswer === null) return;
    const nextSelected = [...activeSelectedAnswers];
    nextSelected[currentIndex] = null;
    const nextDetails = [...activeAnswerDetails];
    nextDetails[currentIndex] = null;
    setSelectedAnswers(nextSelected);
    setAnswerDetails(nextDetails);
  }, [activeAnswerDetails, activeSelectedAnswers, closingSession, currentIndex, isSimulacro, selectedAnswer]);

  const handleAnswer = useCallback(
    (optionId: OptionKey) => {
      if (closingSession || waitingForCase || !currentQuestion) return;
      if (!isSimulacro && selectedAnswer !== null) return;
      if (isSimulacro && selectedAnswer === optionId) {
        clearCurrentAnswer();
        return;
      }

      const answeredAt = new Date().toISOString();
      const responseTimeMs = Math.max(0, Date.now() - questionStartAt);
      const previousDetail = activeAnswerDetails[currentIndex];
      const isCorrect = optionId === currentQuestion.correctAnswer;
      const changedAnswer = previousDetail ? previousDetail.selectedOption !== optionId : false;
      const changedFromCorrect =
        !isCorrect &&
        Boolean(
          previousDetail &&
            ((previousDetail.selectedOption !== optionId && previousDetail.isCorrect) ||
              previousDetail.changedFromCorrect),
        );
      const detail: TestAnswer = {
        questionId: currentQuestion.id,
        selectedOption: optionId,
        correctOption: currentQuestion.correctAnswer,
        isCorrect,
        answeredAt,
        responseTimeMs,
        timeToFirstSelectionMs: previousDetail?.timeToFirstSelectionMs ?? responseTimeMs,
        changedAnswer,
        changedFromCorrect,
      };
      if (currentQuestion.correctAnswer && activityUserId && activityCurriculum && currentViewEventIdRef.current) {
        recordQuestionAnswer({
          userId: activityUserId,
          curriculum: activityCurriculum,
          eventId: currentViewEventIdRef.current,
          isCorrect: detail.isCorrect,
        });
      }

      const nextSelected = [...activeSelectedAnswers];
      nextSelected[currentIndex] = optionId;

      const nextDetails = [...activeAnswerDetails];
      nextDetails[currentIndex] = detail;
      if (mistakeReview) {
        setMistakeReview({
          ...mistakeReview,
          selectedAnswers: nextSelected,
          answerDetails: nextDetails,
        });
      } else {
        setSelectedAnswers(nextSelected);
        setAnswerDetails(nextDetails);
      }
      setEphemeralHighlights([]);
      setEphemeralOptionHighlights({});
      setShowExplanation(!isSimulacro);
      setManualExplanationOpen(false);

      if (navigator.vibrate) {
        navigator.vibrate(isSimulacro ? 10 : optionId === currentQuestion.correctAnswer ? 10 : [10, 30, 10]);
      }
    },
    [
      activeAnswerDetails,
      activeSelectedAnswers,
      activityCurriculum,
      activityUserId,
      clearCurrentAnswer,
      closingSession,
      waitingForCase,
      currentIndex,
      currentQuestion,
      isSimulacro,
      mistakeReview,
      questionStartAt,
      selectedAnswer,
    ],
  );

  const nextQuestion = useCallback(() => {
    if (closingSession) return;
    if (mistakeReview && selectedAnswer === null) return;
    if (mistakeReview) {
      const currentDetail = activeAnswerDetails[currentIndex];
      if (!currentDetail) return;

      if (mistakeReview.kind === 'all') {
        if (currentIndex < mistakeReview.questions.length - 1) {
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);
          setShowExplanation(false);
          setManualExplanationOpen(false);
          setQuestionStartAt(Date.now());
        } else {
          requestFinish();
        }
        return;
      }

      const currentReviewQuestion = mistakeReview.questions[currentIndex];
      if (currentReviewQuestion) {
        setResolvedMistakeQuestionIds((ids) => {
          if (currentDetail.isCorrect) {
            return ids.includes(currentReviewQuestion.id) ? ids : [...ids, currentReviewQuestion.id];
          }
          return ids.filter((id) => id !== currentReviewQuestion.id);
        });
      }

      const nextReview = currentDetail.isCorrect
        ? {
            questions: mistakeReview.questions.filter((_, index) => index !== currentIndex),
            selectedAnswers: mistakeReview.selectedAnswers.filter((_, index) => index !== currentIndex),
            answerDetails: mistakeReview.answerDetails.filter((_, index) => index !== currentIndex),
          }
        : {
            questions: mistakeReview.questions,
            selectedAnswers: mistakeReview.selectedAnswers.map((answer, index) => (index === currentIndex ? null : answer)),
            answerDetails: mistakeReview.answerDetails.map((answer, index) => (index === currentIndex ? null : answer)),
          };

      if (nextReview.questions.length === 0) {
        requestFinish();
        return;
      }

      const nextIndex = currentDetail.isCorrect
        ? currentIndex >= nextReview.questions.length
          ? 0
          : currentIndex
        : currentIndex < nextReview.questions.length - 1
          ? currentIndex + 1
          : 0;

      setMistakeReview({
        ...mistakeReview,
        ...nextReview,
      });
      setCurrentIndex(nextIndex);
      setShowExplanation(false);
      setManualExplanationOpen(false);
      setQuestionStartAt(Date.now());
      return;
    }
    if (currentIndex < activeQuestions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setShowExplanation(!isSimulacro && activeSelectedAnswers[nextIndex] !== null);
      setManualExplanationOpen(false);
      setQuestionStartAt(Date.now());
    } else {
      requestFinish();
    }
  }, [
    activeAnswerDetails,
    activeQuestions.length,
    activeSelectedAnswers,
    closingSession,
    currentIndex,
    isSimulacro,
    mistakeReview,
    requestFinish,
    selectedAnswer,
  ]);

  const prevQuestion = useCallback(() => {
    if (closingSession) return;
    if (currentIndex > 0) {
      const nextIndex = currentIndex - 1;
      setCurrentIndex(nextIndex);
      setShowExplanation(!isSimulacro && activeSelectedAnswers[nextIndex] !== null);
      setManualExplanationOpen(false);
      setQuestionStartAt(Date.now());
    }
  }, [activeSelectedAnswers, closingSession, currentIndex, isSimulacro]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || closingSession) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="dialog"]'))
      ) {
        return;
      }

      const key = event.key;
      const lowerKey = key.toLowerCase();

      const optionMap: Record<string, number> = {
        '1': 0,
        a: 0,
        '2': 1,
        b: 1,
        '3': 2,
        c: 2,
        '4': 3,
        d: 3,
      };
      if (lowerKey in optionMap) {
        const optionIndex = optionMap[lowerKey];
        const targetOption = currentQuestion?.options[optionIndex];
        if (targetOption && (isSimulacro || selectedAnswer === null)) {
          event.preventDefault();
          handleAnswer(targetOption.id);
        }
        return;
      }

      if (lowerKey === 'e') {
        if (showExplanation && !isSimulacro) {
          event.preventDefault();
          setManualExplanationOpen((prev) => !prev);
        }
        return;
      }

      if (key === 'ArrowLeft') {
        if (currentIndex > 0) {
          event.preventDefault();
          prevQuestion();
        }
        return;
      }

      if (key === 'ArrowRight') {
        if (!isMistakeReview || selectedAnswer !== null) {
          if (currentIndex < activeQuestions.length - 1) {
            event.preventDefault();
            nextQuestion();
          }
        }
        return;
      }

      if (key === 'Enter') {
        if (target instanceof HTMLElement && target.closest('button, a, [role="button"]')) {
          return;
        }
        if (!isMistakeReview || selectedAnswer !== null) {
          event.preventDefault();
          nextQuestion();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeQuestions.length,
    closingSession,
    currentIndex,
    currentQuestion,
    handleAnswer,
    isMistakeReview,
    isSimulacro,
    nextQuestion,
    prevQuestion,
    selectedAnswer,
    showExplanation,
  ]);

  const startMistakeReview = () => {
    if (!canStartMistakeReview) return;
    setMistakeReview({
      kind: 'pending',
      questions: accumulatedMistakeQuestions,
      returnIndex: currentIndex,
      selectedAnswers: new Array(accumulatedMistakeQuestions.length).fill(null),
      answerDetails: new Array(accumulatedMistakeQuestions.length).fill(null),
    });
    setCurrentIndex(0);
    setShowExplanation(false);
    setManualExplanationOpen(false);
    setQuestionStartAt(Date.now());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startFullMistakeReview = () => {
    if (!canStartFullMistakeReview) return;
    setMistakeReview({
      kind: 'all',
      questions: allAccumulatedMistakeQuestions,
      returnIndex: currentIndex,
      selectedAnswers: new Array(allAccumulatedMistakeQuestions.length).fill(null),
      answerDetails: new Array(allAccumulatedMistakeQuestions.length).fill(null),
    });
    setCurrentIndex(0);
    setShowExplanation(false);
    setManualExplanationOpen(false);
    setQuestionStartAt(Date.now());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const progress = ((currentIndex + 1) / activeQuestions.length) * 100;

  const frictionBadgeLabel = useMemo(() => {
    if (!currentFriction) return null;
    if (currentFriction.primaryTag === 'repeated_error') {
      return isBasque ? 'Berriro erortzen zara' : 'Te vuelve a caer';
    }
    if (currentFriction.primaryTag === 'recent_trouble') {
      return isBasque ? 'Akats berria' : 'Fallo reciente';
    }
    if (currentFriction.primaryTag === 'pressure_trouble') {
      return isBasque ? 'Simulakroan erortzen zara' : 'Te cae en simulacro';
    }
    if (currentFriction.primaryTag === 'memory_fragile') {
      return isBasque ? 'Oraindik ez duzu finkatu' : 'Todavía no la fijas';
    }
    return isBasque ? 'Mistoa' : 'Mixta';
  }, [currentFriction, isBasque]);

  if (!currentQuestion) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        {isBasque ? 'Ez dago galderarik kargatuta saio honetarako.' : 'No hay preguntas cargadas para esta sesion.'}
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all ${isFocusMode ? '-mt-4 space-y-1 pb-8 sm:-mt-8' : 'space-y-2.5 pb-24'}`}>
      {!isFocusMode && (
        <div className="animate-in slide-in-from-top-4 duration-500 px-2 sm:px-0">
          <div className="rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm sm:p-4 mt-2 sm:mt-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {isSimulacro ? (
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-500">
                    <Timer size={14} className="text-indigo-600" />
                    <span className="w-8 sm:w-9 font-mono tabular-nums">{formatTime(timeLeft)}</span>
                    <span className="mx-0.5 text-slate-200">|</span>
                    <Trophy size={14} className="text-slate-400" />
                    <span>{answeredCount}/{activeQuestions.length}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-600">
                    <Trophy size={14} className="text-emerald-600" />
                    <span>{score}/{activeScorableCount}</span>
                    {isMistakeReview ? (
                      <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                        {mistakeReview?.kind === 'all'
                          ? isBasque ? 'Akats guztiak' : 'Todos los fallos'
                          : isBasque ? 'Akatsak' : 'Fallos pendientes'}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsFocusMode(true)}
                  disabled={closingSession}
                  className={`hidden sm:flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-all ${
                    closingSession
                      ? 'cursor-not-allowed bg-slate-50 text-slate-300'
                      : 'bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  <Zap size={12} />
                  Focus
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnalysisMode((prev) => !prev)}
                  disabled={closingSession}
                  aria-pressed={isAnalysisMode}
                  title={
                    isBasque
                      ? 'Analisi modua: azpimarratu aukerak zirriborro gisa eta sakatu A, B, C edo D erantzuteko'
                      : 'Modo Análisis: subraya también las opciones en borrador y pulsa A, B, C o D para responder'
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-all ${
                    closingSession
                      ? 'cursor-not-allowed border-transparent bg-slate-50 text-slate-300'
                      : isAnalysisMode
                        ? 'border-amber-300 bg-amber-50 text-amber-800 shadow-2xs'
                        : 'border-transparent bg-slate-50 text-slate-500 hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <Highlighter size={12} />
                  {isBasque ? 'Analisia' : 'Análisis'}
                </button>
                {isMistakeReview ? (
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {currentIndex + 1} / {activeQuestions.length}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsGridOpen((prev) => !prev)}
                    disabled={closingSession}
                    aria-expanded={isGridOpen}
                    aria-label={isBasque ? 'Galderen mapa' : 'Mapa de preguntas'}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all ${
                      isGridOpen
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutGrid size={13} />
                    <span>{currentIndex + 1} / {activeQuestions.length}</span>
                    {flaggedCount > 0 ? (
                      <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800">
                        <Flag size={10} className="fill-amber-500 text-amber-600" />
                        {flaggedCount}
                      </span>
                    ) : null}
                  </button>
                )}
                <button
                  onClick={onCancel}
                  disabled={closingSession}
                  className={`text-xs mx-1 font-bold transition-colors ${
                    closingSession ? 'cursor-not-allowed text-rose-200' : 'text-rose-500 hover:text-rose-600'
                  }`}
                >
                  {isBasque ? 'Irten' : 'Salir'}
                </button>
              </div>
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {canStartMistakeReview || canStartFullMistakeReview ? (
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {canStartMistakeReview ? (
                  <button
                    type="button"
                    onClick={startMistakeReview}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 transition-all hover:bg-amber-100 sm:px-4"
                  >
                    <RotateCcw size={14} />
                    {isBasque
                      ? `${accumulatedMistakeQuestions.length} akats pendiente berrikusi`
                      : `Repasar ${accumulatedMistakeQuestions.length} fallos pendientes`}
                  </button>
                ) : null}
                {canStartFullMistakeReview ? (
                  <button
                    type="button"
                    onClick={startFullMistakeReview}
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-800 transition-all hover:bg-indigo-100 sm:px-4"
                  >
                    <RotateCcw size={14} />
                    {isBasque
                      ? `${allAccumulatedMistakeQuestions.length} akats guztiak berriro`
                      : `Repasar siempre ${allAccumulatedMistakeQuestions.length} fallos`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {isGridOpen && !isMistakeReview && !closingSession ? (
        <div className="mx-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:mx-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                {isBasque ? `Erantzunda: ${answeredCount}` : `Contestadas: ${answeredCount}`}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-slate-100" />
                {isBasque ? `Zuri: ${blankCount}` : `En blanco: ${blankCount}`}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                {isBasque ? `Zalantzan: ${flaggedCount}` : `Con duda: ${flaggedCount}`}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
            {activeQuestions.map((question, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = activeSelectedAnswers[idx] !== null;
              const isFlagged = flaggedQuestionIdSet.has(question.id);
              const detail = activeAnswerDetails[idx];

              let cellStyle = 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100';
              if (isFlagged) {
                cellStyle = 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100';
              } else if (isAnswered) {
                if (isSimulacro) {
                  cellStyle = 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100';
                } else if (detail?.isCorrect) {
                  cellStyle = 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
                } else {
                  cellStyle = 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100';
                }
              }

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => goToQuestion(idx)}
                  aria-label={`${isBasque ? 'Galdera' : 'Pregunta'} ${idx + 1}`}
                  className={`relative flex h-9 items-center justify-center rounded-xl border text-xs font-black transition-all ${cellStyle} ${
                    isCurrent ? 'ring-2 ring-indigo-600 ring-offset-1' : ''
                  }`}
                >
                  {idx + 1}
                  {isFlagged ? (
                    <Flag size={10} className="absolute right-1 top-1 fill-amber-500 text-amber-600" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className={`mx-2 flex flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all duration-500 sm:mx-0 sm:rounded-[2.25rem] ${isFocusMode ? 'gap-2 p-4 shadow-xl sm:p-5' : 'pb-4 sm:gap-4 sm:p-6 sm:pb-6'}`}>
        {closingSession ? null : (
          <>
            {needsCaseContext && <PracticalCaseContext questionId={currentQuestion.id} onStatusChange={onCaseStatus} />}
            <div className={`px-4 sm:px-0 ${isFocusMode ? 'pb-2 pt-0' : 'sticky top-0 z-30 border-b border-slate-100 bg-white/95 pb-4 pt-4 shadow-sm backdrop-blur-xl transition-all sm:border-transparent sm:shadow-none'}`}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  {officialMetadata ? (
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                        OFICIAL
                      </span>
                      <span className="truncate text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {officialMetadata.sourceInstitution} {officialMetadata.sourceYear ?? ''}
                        {officialMetadata.sourceThemeNumber ? ` · Tema ${officialMetadata.sourceThemeNumber}` : ''}
                        {` · Pregunta ${officialMetadata.officialQuestionNumber}`}
                      </span>
                    </div>
                  ) : null}
                  <span className="block truncate text-[10px] font-black uppercase tracking-widest text-slate-400 max-w-[220px] sm:max-w-xs">
                    {isFocusMode
                      ? `${answeredCount} / ${activeQuestions.length}`
                      : currentIndex + 1}
                    {' · '}
                    {currentQuestion.category || (isBasque ? 'Praktika' : 'Practica')}
                  </span>
                  {officialMetadata ? (
                    <span className="mt-1 block truncate text-xs font-bold text-slate-500">
                      {[officialMetadata.lawShortTitle, officialMetadata.articleLabels?.join(', ')].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {reviewPriority === 'most_problematic' && frictionBadgeLabel ? (
                    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                      {frictionBadgeLabel}
                    </span>
                  ) : null}
                  {selectedAnswer !== null && !isSimulacro && (
                    <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest ${selectedAnswer === currentQuestion.correctAnswer ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {selectedAnswer === currentQuestion.correctAnswer
                        ? isBasque ? '✓ Zuzena' : '✓ Correcto'
                        : isBasque ? '✗ Okerra' : '✗ Incorrecto'}
                    </span>
                  )}
                  {isSimulacro && selectedAnswer !== null && !isMistakeReview ? (
                    <button
                      type="button"
                      onClick={clearCurrentAnswer}
                      disabled={closingSession}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-700"
                    >
                      <RotateCcw size={12} />
                      <span>{isBasque ? 'Erantzuna ezabatu' : 'Borrar respuesta'}</span>
                    </button>
                  ) : null}
                  {!isMistakeReview ? (
                    <button
                      type="button"
                      onClick={() => toggleDoubtFlag()}
                      disabled={closingSession}
                      aria-pressed={isCurrentQuestionFlagged}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all ${
                        isCurrentQuestionFlagged
                          ? 'border-amber-300 bg-amber-50 text-amber-800 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                      }`}
                    >
                      <Flag size={13} className={isCurrentQuestionFlagged ? 'fill-amber-500 text-amber-600' : ''} />
                      <span>{isCurrentQuestionFlagged ? (isBasque ? 'Zalantzan' : 'En duda') : (isBasque ? 'Zalantza' : 'Duda')}</span>
                    </button>
                  ) : null}
                </div>
              </div>

              <h2 className={`${questionTextSizeClass} flex items-start gap-1.5 max-h-[35vh] overflow-y-auto pr-1 font-extrabold leading-[1.35] text-slate-800`}>
                {currentQuestion.auditIncident && <span role="img" aria-label={isBasque ? 'Gorabehera duen galdera' : 'Pregunta con incidencia'} className="shrink-0 font-black text-amber-600">*</span>}
                <div className="min-w-0 flex-1">
                {canActiveStudyCurrent ? (
                  <HighlightableText
                    text={currentQuestion.text}
                    highlights={highlightsMap[currentQuestion.id] ?? []}
                    onAddHighlight={(hl) =>
                      void addHighlight(currentQuestion.id, hl, {
                        contentType: 'question',
                        category: currentQuestion.category ?? null,
                      })
                    }
                    onRemoveHighlight={(id) =>
                      void removeHighlight(currentQuestion.id, id, {
                        contentType: 'question',
                        category: currentQuestion.category ?? null,
                      })
                    }
                    readOnly={false}
                    maxSelectionChars={120}
                  />
                ) : selectedAnswer === null && !isMistakeReview ? (
                  <HighlightableText
                    text={currentQuestion.text}
                    highlights={
                      showMarks
                        ? [...(highlightsMap[currentQuestion.id] ?? []), ...ephemeralHighlights]
                        : ephemeralHighlights
                    }
                    onAddHighlight={(hl) =>
                      setEphemeralHighlights((prev) => [
                        ...prev,
                        {
                          ...hl,
                          id: `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        },
                      ])
                    }
                    onRemoveHighlight={(id) =>
                      setEphemeralHighlights((prev) => prev.filter((item) => item.id !== id))
                    }
                    ephemeral={true}
                    maxSelectionChars={120}
                  />
                ) : showMarks ? (
                  <HighlightableText
                    text={currentQuestion.text}
                    highlights={highlightsMap[currentQuestion.id] ?? []}
                    onAddHighlight={() => {}}
                    onRemoveHighlight={() => {}}
                    readOnly={true}
                    maxSelectionChars={120}
                  />
                ) : (
                  currentQuestion.text
                )}
                </div>
              </h2>
              {selectedAnswer === null && !isMistakeReview && ephemeralHighlights.length > 0 ? (
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                  <span>
                    {isBasque
                      ? 'Zirriborro-azpimarrak · erantzutean ezabatuko dira'
                      : 'Subrayado borrador · se borrará al responder'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEphemeralHighlights([])}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-black text-slate-600 hover:bg-slate-50"
                  >
                    {isBasque ? 'Garbitu' : 'Limpiar'}
                  </button>
                </div>
              ) : null}
              {currentQuestion.auditIncident && <p className="mt-2 text-sm font-medium text-amber-800">{currentQuestion.auditSeverity === 'warning' ? (isBasque ? 'Erantzun balioztatua araudi-oharrarekin. Ikusi azalpena.' : 'Respuesta validada con advertencia normativa. Consulta la explicación.') : currentQuestion.auditSeverity === 'pending' ? (isBasque ? 'Dokumentazioaren zain: gordetako erantzuna ez dago balioztatuta. Ikusi azalpena.' : 'Pendiente de documentación: la letra registrada es orientativa y no está validada. Consulta la explicación.') : (isBasque ? 'Galdera gatazkatsua: bankuko erantzuna ez da zalantzarik gabekoa.' : 'Pregunta conflictiva: la clave registrada es operativa y puede no ser jurídicamente inequívoca. Consulta la explicación.')}</p>}
              {showNotes && !canActiveStudyCurrent ? (
                <div className="mt-3">
                  {(() => {
                    const note = notesMap[currentQuestion.id] ?? '';
                    const trimmed = String(note).trim();
                    if (!trimmed) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => setNoteOpen((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
                      >
                        <Info size={14} className="text-indigo-600" />
                        {noteOpen
                          ? isBasque
                            ? 'Oharra ezkutatu'
                            : 'Ocultar nota'
                          : isBasque
                            ? 'Oharra ikusi'
                            : 'Ver nota'}
                      </button>
                    );
                  })()}
                </div>
              ) : null}
              {showNotes && !canActiveStudyCurrent && noteOpen ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                  {notesMap[currentQuestion.id]}
                </div>
              ) : null}
            </div>

            {currentQuestion.correctAnswer == null ? (
              <div className="mx-4 mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 sm:mx-0">
                Esta pregunta no tiene una respuesta asignada. Puedes marcar cualquier opción: se mostrará como incorrecta y no contará en las estadísticas.
              </div>
            ) : null}

            {isAnalysisMode && (selectedAnswer === null || isSimulacro) && !isMistakeReview ? (
              <div className="mx-4 mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-[11px] font-bold text-amber-900 sm:mx-0">
                <span className="inline-flex items-center gap-1.5">
                  <Highlighter size={13} className="shrink-0 text-amber-700" />
                  {isBasque
                    ? 'Analisi modua: azpimarratu enuntziatua eta aukerak zirriborro gisa · Sakatu A, B, C edo D erantzuteko'
                    : 'Modo Análisis: subraya enunciado y opciones en borrador · Pulsa A, B, C o D para responder'}
                </span>
                {ephemeralHighlights.length > 0 ||
                Object.values(ephemeralOptionHighlights).some((list) => list.length > 0) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEphemeralHighlights([]);
                      setEphemeralOptionHighlights({});
                    }}
                    className="rounded-lg border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-black text-amber-800 hover:bg-amber-100"
                  >
                    {isBasque ? 'Garbitu zirriborroa' : 'Limpiar borrador'}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col flex-1 divide-y divide-slate-100 bg-slate-50/30 sm:rounded-2xl sm:border sm:border-slate-100 overflow-hidden">
              {currentQuestion.options.map((option, optionIndex) => {
                const isSelected = selectedAnswer === option.id;
                const isAnswerCorrect = option.id === currentQuestion.correctAnswer;
                const isLockedAnswered = !isSimulacro && selectedAnswer !== null;
                const isAnalysisInteractive = isAnalysisMode && !isLockedAnswered && !isMistakeReview;

                let itemClass = `relative flex w-full items-center justify-between overflow-hidden text-left transition-all duration-300 group ${
                  isFocusMode ? 'p-3 sm:p-3.5' : 'p-4 sm:p-5'
                } `;

                if (selectedAnswer === null) {
                  itemClass += isAnalysisInteractive
                    ? 'bg-white/70 hover:bg-white border-transparent'
                    : 'hover:bg-white hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5 cursor-pointer border-transparent';
                } else if (isSimulacro) {
                  itemClass += isSelected
                    ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                    : 'bg-transparent text-slate-700 border-transparent';
                } else if (isSelected) {
                  itemClass += isAnswerCorrect
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200';
                } else if (isAnswerCorrect) {
                  itemClass += 'bg-emerald-50/40 text-emerald-800 border-emerald-100/50';
                } else {
                  itemClass += 'opacity-30 grayscale-[0.8] border-transparent';
                }

                const answerKey = `${currentQuestion.id}_ans_${optionIndex}`;
                const optionEphemeralList = ephemeralOptionHighlights[optionIndex] ?? [];
                const letterBadgeClass = `flex flex-shrink-0 items-center justify-center rounded-xl text-sm font-black transition-all duration-300 ${isFocusMode ? 'h-8 w-8' : 'h-9 w-9'} ${
                  isSimulacro && isSelected
                    ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-200'
                    : isSelected
                      ? isAnswerCorrect
                        ? 'bg-emerald-500 text-white scale-110 rotate-[360deg] shadow-lg shadow-emerald-200'
                        : 'bg-rose-500 text-white scale-110 shadow-lg shadow-rose-200'
                      : !isSimulacro && isAnswerCorrect && selectedAnswer !== null
                        ? 'bg-emerald-500 text-white scale-105 shadow-md shadow-emerald-100'
                        : isAnalysisInteractive
                          ? 'bg-white text-indigo-700 border-2 border-indigo-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:scale-105 cursor-pointer shadow-xs'
                          : selectedAnswer === null
                            ? 'bg-white text-slate-400 border border-slate-200 group-hover:border-indigo-400 group-hover:text-indigo-600 group-hover:scale-110 group-hover:shadow-md'
                            : 'bg-slate-50 text-slate-300'
                }`;

                const optionInner = (
                  <>
                    {isSelected && (
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 ${
                          isSimulacro ? 'bg-indigo-600' : isAnswerCorrect ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                    )}

                    <div className={`relative z-10 flex items-center ${isFocusMode ? 'gap-3' : 'gap-4 sm:gap-5'}`}>
                      {isAnalysisInteractive ? (
                        <button
                          type="button"
                          onClick={() => handleAnswer(option.id)}
                          disabled={closingSession}
                          aria-label={`${isBasque ? 'Erantzun aukera' : 'Responder opción'} ${option.id.toUpperCase()}`}
                          className={letterBadgeClass}
                        >
                          {option.id.toUpperCase()}
                        </button>
                      ) : (
                        <span className={letterBadgeClass}>
                          {option.id.toUpperCase()}
                        </span>
                      )}
                      <span
                        onMouseDown={(event) => {
                          if (canActiveStudyCurrent || isAnalysisInteractive) event.stopPropagation();
                        }}
                        onClick={(event) => {
                          if (canActiveStudyCurrent || isAnalysisInteractive) event.stopPropagation();
                        }}
                        className={`select-text font-bold leading-snug transition-colors duration-300 ${answerTextSizeClass} ${
                          isSelected || (!isSimulacro && isAnswerCorrect && selectedAnswer !== null) ? 'text-inherit' : 'text-slate-600'
                        }`}
                      >
                        {canActiveStudyCurrent ? (
                          <HighlightableText
                            text={option.text}
                            highlights={highlightsMap[answerKey] ?? []}
                            onAddHighlight={(hl) =>
                              void addHighlight(currentQuestion.id, hl, {
                                contentType: 'answer',
                                answerIndex: optionIndex,
                                category: currentQuestion.category ?? null,
                              })
                            }
                            onRemoveHighlight={(id) =>
                              void removeHighlight(currentQuestion.id, id, {
                                contentType: 'answer',
                                answerIndex: optionIndex,
                                category: currentQuestion.category ?? null,
                              })
                            }
                            readOnly={false}
                            maxSelectionChars={90}
                          />
                        ) : isAnalysisInteractive ? (
                          <HighlightableText
                            text={option.text}
                            highlights={
                              showMarks
                                ? [...(highlightsMap[answerKey] ?? []), ...optionEphemeralList]
                                : optionEphemeralList
                            }
                            onAddHighlight={(hl) =>
                              setEphemeralOptionHighlights((prev) => ({
                                ...prev,
                                [optionIndex]: [
                                  ...(prev[optionIndex] ?? []),
                                  {
                                    ...hl,
                                    id: `ephemeral-opt-${optionIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                                  },
                                ],
                              }))
                            }
                            onRemoveHighlight={(id) =>
                              setEphemeralOptionHighlights((prev) => ({
                                ...prev,
                                [optionIndex]: (prev[optionIndex] ?? []).filter(
                                  (item) => item.id !== id,
                                ),
                              }))
                            }
                            ephemeral={true}
                            maxSelectionChars={90}
                          />
                        ) : showMarks ? (
                          <HighlightableText
                            text={option.text}
                            highlights={highlightsMap[answerKey] ?? []}
                            onAddHighlight={() => {}}
                            onRemoveHighlight={() => {}}
                            readOnly={true}
                            maxSelectionChars={90}
                          />
                        ) : (
                          option.text
                        )}
                      </span>
                    </div>

                    <div className="relative z-10">
                      {selectedAnswer !== null && !isSimulacro && (
                        <div className="animate-in zoom-in duration-300">
                          {isSelected && !isAnswerCorrect && (
                            <XCircle className="text-rose-500 flex-shrink-0" size={24} />
                          )}
                          {isAnswerCorrect && (
                            <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={26} />
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );

                // When answered in non-simulacro mode OR in Analysis mode, render as a non-button container so browsers allow text selection for highlighting
                if (isLockedAnswered || isAnalysisInteractive) {
                  return (
                    <div
                      key={option.id}
                      role="group"
                      aria-label={`${option.id.toUpperCase()}. ${option.text}`}
                      className={`${itemClass} select-text`}
                    >
                      {optionInner}
                    </div>
                  );
                }

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleAnswer(option.id)}
                    disabled={closingSession || waitingForCase}
                    className={itemClass}
                  >
                    {optionInner}
                  </button>
                );
              })}
            </div>

            {canActiveStudyCurrent ? (
              <div className="px-4 sm:px-0 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNoteDrawerOpen((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition ${
                        (notesMap[currentQuestion.id] ?? '').trim()
                          ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <FileText size={14} />
                      {(notesMap[currentQuestion.id] ?? '').trim()
                        ? isBasque
                          ? 'Oharra editatu'
                          : 'Editar nota'
                        : isBasque
                          ? 'Oharra gehitu'
                          : 'Añadir nota'}
                    </button>
                    <QuestionErrataPanel
                      key={currentQuestion.id}
                      questionId={currentQuestion.id}
                      curriculum={activityCurriculum ?? 'osakidetza_admin'}
                      userId={activityUserId}
                      existingReports={errataReportsMap[currentQuestion.id] ?? []}
                      onSubmitted={(report) =>
                        setErrataReportsMap((prev) => ({
                          ...prev,
                          [currentQuestion.id]: [report, ...(prev[currentQuestion.id] ?? [])],
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

                {(notesMap[currentQuestion.id] ?? '').trim() && !noteDrawerOpen ? (
                  <div className="mt-2.5 rounded-2xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 text-xs font-medium text-amber-950">
                    <span className="font-black text-amber-800">
                      {isBasque ? 'Zure oharra: ' : 'Tu nota: '}
                    </span>
                    {notesMap[currentQuestion.id]}
                  </div>
                ) : null}

                <QuestionNoteDrawer
                  open={noteDrawerOpen}
                  questionId={currentQuestion.id}
                  questionNumber={currentQuestion.number}
                  note={notesMap[currentQuestion.id] ?? ''}
                  onClose={() => setNoteDrawerOpen(false)}
                  onSave={(note) => saveNote(currentQuestion.id, note)}
                />
              </div>
            ) : null}

            {showExplanation && !isSimulacro && (!isFocusMode || manualExplanationOpen) && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-500 px-4 sm:px-0 py-4 sm:py-0 sm:mt-4">
                {!manualExplanationOpen ? (
                  <button
                    onClick={() => setManualExplanationOpen(true)}
                    className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-4 py-2 text-xs font-bold text-indigo-600 transition-all hover:bg-indigo-50"
                  >
                    <Info size={14} />
                    {isBasque ? 'Azalpena ikusi' : 'Ver explicación'}
                  </button>
                ) : (
                  <div className="animate-in zoom-in-95 rounded-2xl border border-slate-200 bg-indigo-50/30 p-4 text-slate-800 duration-300 sm:p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
                        <Info size={16} />
                        {isBasque ? 'Azalpena' : 'Explicación'}
                      </div>
                      <button
                        onClick={() => setManualExplanationOpen(false)}
                        className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-[0.2em] transition-colors"
                      >
                        {isBasque ? 'Ezkutatu' : 'Ocultar'}
                      </button>
                    </div>
                    <EditorialExplanation
                      text={currentQuestion.explanation}
                      highlights={
                        canActiveStudyCurrent || showMarks
                          ? highlightsMap[`${currentQuestion.id}_exp`] ?? []
                          : []
                      }
                      onAddHighlight={(hl) =>
                        void addHighlight(currentQuestion.id, hl, {
                          contentType: 'explanation',
                          category: currentQuestion.category ?? null,
                        })
                      }
                      onRemoveHighlight={(id) =>
                        void removeHighlight(currentQuestion.id, id, {
                          contentType: 'explanation',
                          category: currentQuestion.category ?? null,
                        })
                      }
                      readOnly={!canActiveStudyCurrent}
                      emptyLabel={isBasque ? 'Ez dago azalpenik.' : 'Sin explicación disponible.'}
                    />
                    {officialMetadata ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          Respuesta oficial
                        </div>
                        <div className="mt-1 text-slate-900">{currentQuestion.correctAnswer?.toUpperCase() ?? 'Sin respuesta asignada'}</div>
                        <div className="mt-3 text-xs leading-relaxed text-slate-500">
                          Fuente: {officialMetadata.sourceTitle}
                          {officialMetadata.licenseLabel ? ` · Licencia: ${officialMetadata.licenseLabel}` : ''}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {closingSession ? (
        <div className="flex justify-end px-4 sm:px-0">
          <button
            disabled
            className="flex min-w-[240px] items-center justify-center gap-3 rounded-2xl bg-slate-900 px-6 py-4 font-bold text-white shadow-lg shadow-slate-900/10 cursor-wait sm:min-w-[260px] sm:px-8"
          >
            <Loader2 size={20} className="animate-spin" />
            {isBasque ? 'Saioa ixten...' : 'Cerrando sesion...'}
          </button>
        </div>
      ) : (
        <>
          <div className="hidden items-center justify-between gap-4 px-4 pt-2 mb-safe sm:flex sm:px-0">
            {!isFocusMode ? (
              <button
                onClick={prevQuestion}
                disabled={closingSession || currentIndex === 0}
                className={`flex items-center gap-2 rounded-2xl px-6 py-4 font-bold transition-all ${
                  closingSession || currentIndex === 0
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100 shadow-sm'
                }`}
              >
                <ChevronLeft size={20} />
                <span>{isBasque ? 'Aurrekoa' : 'Anterior'}</span>
              </button>
            ) : null}

            {isFocusMode ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFocusMode(false)}
                  disabled={closingSession}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                    closingSession
                      ? 'cursor-not-allowed text-slate-300'
                      : 'text-slate-400 hover:bg-white hover:text-slate-600'
                  }`}
                >
                  <XCircle size={15} />
                  <span>{isBasque ? 'Irten Focus modutik' : 'Salir de Focus'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnalysisMode((prev) => !prev)}
                  disabled={closingSession}
                  aria-pressed={isAnalysisMode}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                    closingSession
                      ? 'cursor-not-allowed border-transparent text-slate-300'
                      : isAnalysisMode
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <Highlighter size={13} />
                  <span>{isBasque ? 'Analisia' : 'Análisis'}</span>
                </button>
                {!isMistakeReview ? (
                  <button
                    type="button"
                    onClick={() => setIsGridOpen((prev) => !prev)}
                    disabled={closingSession}
                    aria-expanded={isGridOpen}
                    aria-label={isBasque ? 'Galderen mapa' : 'Mapa de preguntas'}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all ${
                      isGridOpen
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <LayoutGrid size={13} />
                    <span>{currentIndex + 1} / {activeQuestions.length}</span>
                    {flaggedCount > 0 ? (
                      <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800">
                        <Flag size={10} className="fill-amber-500 text-amber-600" />
                        {flaggedCount}
                      </span>
                    ) : null}
                  </button>
                ) : null}
                <div
                  role="group"
                  aria-label={isBasque ? 'Testuaren tamaina' : 'Tamaño del texto'}
                  className="flex items-center rounded-xl border border-slate-200 bg-white/70 p-1"
                >
                  {([
                    { id: 'compact', label: 'A', className: 'text-[11px]' },
                    { id: 'normal', label: 'A', className: 'text-sm' },
                    { id: 'large', label: 'A', className: 'text-lg' },
                  ] as const).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setFocusTextSize(option.id)}
                      aria-pressed={focusTextSize === option.id}
                      aria-label={
                        option.id === 'compact'
                          ? isBasque ? 'Testu trinkoa' : 'Texto compacto'
                          : option.id === 'normal'
                            ? isBasque ? 'Testu normala' : 'Texto normal'
                            : isBasque ? 'Testu handia' : 'Texto grande'
                      }
                      title={
                        option.id === 'compact'
                          ? isBasque ? 'Trinkoa' : 'Compacto'
                          : option.id === 'normal'
                            ? isBasque ? 'Normala' : 'Normal'
                            : isBasque ? 'Handia' : 'Grande'
                      }
                      className={`flex h-7 w-8 items-center justify-center rounded-lg font-black transition-colors ${option.className} ${
                        focusTextSize === option.id
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              onClick={nextQuestion}
              disabled={closingSession || (isMistakeReview && selectedAnswer === null)}
              className={`flex items-center gap-2 rounded-2xl px-8 py-4 font-bold transition-all shadow-lg ${
                closingSession
                  ? 'bg-slate-900 text-white cursor-wait'
                  : isMistakeReview && selectedAnswer === null
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : selectedAnswer === null && currentIndex < activeQuestions.length - 1
                      ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:translate-y-[-2px]'
              }`}
            >
              {closingSession ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>{isBasque ? 'Saioa ixten...' : 'Cerrando sesion...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {isMistakeReview
                      ? mistakeReview?.kind === 'all' && currentIndex === activeQuestions.length - 1
                        ? isBasque ? 'Repasoa amaitu' : 'Terminar repaso'
                        : isBasque ? 'Repasoa jarraitu' : 'Continuar repaso'
                      : currentIndex === activeQuestions.length - 1
                        ? isBasque ? 'Amaitu' : 'Finalizar'
                        : selectedAnswer === null
                          ? isBasque ? 'Zuri utzi' : 'Dejar en blanco'
                          : isBasque ? 'Hurrengoa' : 'Siguiente'}
                  </span>
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </div>

          {/* ÚNICA NAVEGACIÓN EN MÓVIL (flotante) */}
          {!closingSession && (
            <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300 sm:hidden">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-900/95 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl ring-1 ring-white/10">
                {currentIndex > 0 && !isFocusMode && (
                  <button
                    onClick={prevQuestion}
                    className="flex shrink-0 items-center justify-center rounded-xl p-3.5 text-slate-300 transition-all hover:bg-white/10 hover:text-white"
                    aria-label="Anterior"
                  >
                    <ChevronLeft size={22} className="relative -left-[1px]" />
                  </button>
                )}
                
                <button
                  onClick={nextQuestion}
                  disabled={closingSession || (isMistakeReview && selectedAnswer === null)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3.5 text-[15px] font-bold text-white shadow-md shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isMistakeReview
                    ? mistakeReview?.kind === 'all' && currentIndex === activeQuestions.length - 1
                      ? isBasque ? 'Repasoa amaitu' : 'Terminar repaso'
                      : isBasque ? 'Repasoa jarraitu' : 'Continuar repaso'
                    : currentIndex === activeQuestions.length - 1
                      ? isBasque ? 'Amaitu test' : 'Finalizar test'
                      : selectedAnswer === null
                        ? isBasque ? 'Zuri utzi' : 'Dejar en blanco'
                        : isBasque ? 'Hurrengo galdera' : 'Siguiente'}
                  <ChevronRight size={20} className="relative left-[1px]" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

