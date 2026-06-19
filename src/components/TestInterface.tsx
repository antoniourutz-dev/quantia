import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
import HighlightableText from './HighlightableText';
import EditorialExplanation from './EditorialExplanation';

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
}

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
  const finishStartedRef = useRef(false);
  const wasFinishingRef = useRef(false);

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

  const mainScore = useMemo(
    () => answerDetails.filter((answer) => answer?.isCorrect).length,
    [answerDetails],
  );
  const score = useMemo(
    () => activeAnswerDetails.filter((answer) => answer?.isCorrect).length,
    [activeAnswerDetails],
  );
  const answeredCount = useMemo(
    () => activeSelectedAnswers.filter((answer) => answer !== null).length,
    [activeSelectedAnswers],
  );
  const resolvedMistakeQuestionIdSet = useMemo(
    () => new Set(resolvedMistakeQuestionIds),
    [resolvedMistakeQuestionIds],
  );
  const accumulatedMistakeQuestions = useMemo(() => {
    if (!allowInSessionMistakeReview || isSimulacro || isMistakeReview || questions.length <= 40 || currentIndex + 1 < 20) return [];
    return answerDetails
      .slice(0, currentIndex + 1)
      .map((answer, index) => (answer && !answer.isCorrect ? questions[index] : null))
      .filter((question): question is Question => Boolean(question))
      .filter((question) => !resolvedMistakeQuestionIdSet.has(question.id));
  }, [allowInSessionMistakeReview, answerDetails, currentIndex, isMistakeReview, isSimulacro, questions, resolvedMistakeQuestionIdSet]);
  const allAccumulatedMistakeQuestions = useMemo(() => {
    if (!allowInSessionMistakeReview || isSimulacro || isMistakeReview || questions.length <= 40 || currentIndex + 1 < 20) return [];
    return answerDetails
      .slice(0, currentIndex + 1)
      .map((answer, index) => (answer && !answer.isCorrect ? questions[index] : null))
      .filter((question): question is Question => Boolean(question));
  }, [allowInSessionMistakeReview, answerDetails, currentIndex, isMistakeReview, isSimulacro, questions]);
  const canStartMistakeReview = accumulatedMistakeQuestions.length > 0 && !closingSession;
  const canStartFullMistakeReview = allAccumulatedMistakeQuestions.length > 0 && !closingSession;

  const finishPayload = useMemo(
    () => ({
      score: mainScore,
      answers: answerDetails.filter((answer): answer is TestAnswer => Boolean(answer)),
    }),
    [answerDetails, mainScore],
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
  }, [mode, questions]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentIndex]);

  useEffect(() => {
    setNoteOpen(false);
  }, [currentQuestion?.id]);

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

  const handleAnswer = (optionId: OptionKey) => {
    if (closingSession) return;
    if (!isSimulacro && selectedAnswer !== null) return;

    const answeredAt = new Date().toISOString();
    const responseTimeMs = Math.max(0, Date.now() - questionStartAt);
    const previousDetail = activeAnswerDetails[currentIndex];
    const detail: TestAnswer = {
      questionId: currentQuestion.id,
      selectedOption: optionId,
      correctOption: currentQuestion.correctAnswer,
      isCorrect: optionId === currentQuestion.correctAnswer,
      answeredAt,
      responseTimeMs,
      timeToFirstSelectionMs: previousDetail?.timeToFirstSelectionMs ?? responseTimeMs,
      changedAnswer: previousDetail ? previousDetail.selectedOption !== optionId : false,
    };

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
    setShowExplanation(!isSimulacro);
    setManualExplanationOpen(false);

    if (navigator.vibrate) {
      navigator.vibrate(isSimulacro ? 10 : optionId === currentQuestion.correctAnswer ? 10 : [10, 30, 10]);
    }
  };

  const nextQuestion = () => {
    if (closingSession) return;
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
  };

  const prevQuestion = () => {
    if (closingSession) return;
    if (currentIndex > 0) {
      const nextIndex = currentIndex - 1;
      setCurrentIndex(nextIndex);
      setShowExplanation(!isSimulacro && activeSelectedAnswers[nextIndex] !== null);
      setManualExplanationOpen(false);
      setQuestionStartAt(Date.now());
    }
  };

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
    <div className={`mx-auto max-w-6xl space-y-2.5 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all pb-24 ${isFocusMode ? 'py-4 sm:py-8' : ''}`}>
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
                    <span>{score}/{activeQuestions.length}</span>
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
              <div className="flex items-center gap-3">
                <button
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
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {currentIndex + 1} / {activeQuestions.length}
                </span>
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

      {isFocusMode && (
        <div className="fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 sm:right-8 sm:top-8">
          <button
            onClick={() => setIsFocusMode(false)}
            disabled={closingSession}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold shadow-xl transition-all sm:px-6 sm:py-3 ${
              closingSession
                ? 'bg-white/70 backdrop-blur-md text-slate-300 border-white cursor-not-allowed'
                : 'bg-white/80 backdrop-blur-md text-slate-600 border-white hover:bg-white'
            }`}
          >
            <XCircle size={18} />
            {isBasque ? 'Irten Focus modutik' : 'Salir de Focus'}
          </button>
        </div>
      )}

      <div className={`mx-2 sm:mx-0 flex flex-col bg-white transition-all duration-500 rounded-3xl sm:rounded-[2.25rem] border border-slate-100 shadow-sm sm:p-6 overflow-hidden sm:gap-4 ${isFocusMode ? 'p-8 shadow-2xl scale-[1.02]' : 'pb-4 sm:pb-6'}`}>
        {closingSession ? null : (
          <>
            <div className={`px-4 sm:px-0 pb-4 pt-4 ${isFocusMode ? '' : 'sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-100 sm:border-transparent transition-all shadow-sm sm:shadow-none'}`}>
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
                    {currentIndex + 1} · {currentQuestion.category || (isBasque ? 'Praktika' : 'Practica')}
                  </span>
                  {officialMetadata ? (
                    <span className="mt-1 block truncate text-xs font-bold text-slate-500">
                      {[officialMetadata.lawShortTitle, officialMetadata.articleLabels?.join(', ')].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </div>
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
              </div>

              <h2 className="text-[15px] font-extrabold leading-[1.35] text-slate-800 sm:text-lg max-h-[35vh] overflow-y-auto pr-1">
                {showMarks ? (
                  <HighlightableText
                    text={currentQuestion.text}
                    highlights={studyData?.highlights?.[currentQuestion.id] ?? []}
                    onAddHighlight={() => {}}
                    onRemoveHighlight={() => {}}
                    readOnly
                    maxSelectionChars={120}
                  />
                ) : (
                  currentQuestion.text
                )}
              </h2>
              {showNotes ? (
                <div className="mt-3">
                  {(() => {
                    const note = studyData?.notes?.[currentQuestion.id] ?? '';
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
              {showNotes && noteOpen ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                  {studyData?.notes?.[currentQuestion.id]}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col flex-1 divide-y divide-slate-100 bg-slate-50/30 sm:rounded-2xl sm:border sm:border-slate-100 overflow-hidden">
              {currentQuestion.options.map((option, optionIndex) => {
                const isSelected = selectedAnswer === option.id;
                const isAnswerCorrect = option.id === currentQuestion.correctAnswer;

                let itemClass = 'relative flex w-full items-center justify-between overflow-hidden p-4 text-left transition-all duration-300 group sm:p-5 ';

                if (selectedAnswer === null) {
                  itemClass += 'hover:bg-white hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5 cursor-pointer border-transparent';
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

                return (
                  <button
                    key={option.id}
                    onClick={() => handleAnswer(option.id)}
                    disabled={closingSession || (!isSimulacro && selectedAnswer !== null)}
                    className={itemClass}
                  >
                    {isSelected && (
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 ${
                          isSimulacro ? 'bg-indigo-600' : isAnswerCorrect ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                    )}

                    <div className="relative z-10 flex items-center gap-4 sm:gap-5">
                      <span
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black transition-all duration-500 ${
                          isSimulacro && isSelected
                            ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-200'
                            : isSelected
                              ? isAnswerCorrect
                                ? 'bg-emerald-500 text-white scale-110 rotate-[360deg] shadow-lg shadow-emerald-200'
                                : 'bg-rose-500 text-white scale-110 shadow-lg shadow-rose-200'
                              : !isSimulacro && isAnswerCorrect && selectedAnswer !== null
                                ? 'bg-emerald-500 text-white scale-105 shadow-md shadow-emerald-100'
                                : selectedAnswer === null
                                  ? 'bg-white text-slate-400 border border-slate-200 group-hover:border-indigo-400 group-hover:text-indigo-600 group-hover:scale-110 group-hover:shadow-md'
                                  : 'bg-slate-50 text-slate-300'
                        }`}
                      >
                        {option.id.toUpperCase()}
                      </span>
                      <span
                        className={`text-base font-bold leading-snug transition-colors duration-300 sm:text-lg ${
                          isSelected || (!isSimulacro && isAnswerCorrect && selectedAnswer !== null) ? 'text-inherit' : 'text-slate-600'
                        }`}
                      >
                        {showMarks ? (
                          <HighlightableText
                            text={option.text}
                            highlights={studyData?.highlights?.[`${currentQuestion.id}_ans_${optionIndex}`] ?? []}
                            onAddHighlight={() => {}}
                            onRemoveHighlight={() => {}}
                            readOnly
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
                  </button>
                );
              })}
            </div>

            {showExplanation && !isSimulacro && (
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
                        {isBasque ? 'Itxi' : 'Cerrar'}
                      </button>
                    </div>
                    <EditorialExplanation
                      text={currentQuestion.explanation}
                      highlights={showMarks ? studyData?.highlights?.[`${currentQuestion.id}_exp`] ?? [] : []}
                      readOnly
                      emptyLabel={isBasque ? 'Ez dago azalpenik.' : 'Sin explicación disponible.'}
                    />
                    {officialMetadata ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          Respuesta oficial
                        </div>
                        <div className="mt-1 text-slate-900">{currentQuestion.correctAnswer.toUpperCase()}</div>
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
          <div className="hidden sm:flex items-center justify-between gap-4 px-4 sm:px-0 pt-2 mb-safe">
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

            <button
              onClick={nextQuestion}
              disabled={closingSession || selectedAnswer === null}
              className={`flex items-center gap-2 rounded-2xl px-8 py-4 font-bold transition-all shadow-lg ${
                closingSession
                  ? 'bg-slate-900 text-white cursor-wait'
                : selectedAnswer === null
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
                        : isBasque ? 'Hurrengoa' : 'Siguiente'}
                  </span>
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </div>

          {/* ÚNICA NAVEGACIÓN EN MÓVIL (flotante tras responder) */}
          {!closingSession && selectedAnswer !== null && (
            <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300 sm:hidden">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-900/95 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl ring-1 ring-white/10">
                {currentIndex > 0 && (
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
                  disabled={closingSession}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3.5 text-[15px] font-bold text-white shadow-md shadow-indigo-500/20 transition-all active:scale-[0.98]"
                >
                  {isMistakeReview
                    ? mistakeReview?.kind === 'all' && currentIndex === activeQuestions.length - 1
                      ? isBasque ? 'Repasoa amaitu' : 'Terminar repaso'
                      : isBasque ? 'Repasoa jarraitu' : 'Continuar repaso'
                    : currentIndex === activeQuestions.length - 1
                      ? isBasque ? 'Amaitu test' : 'Finalizar test'
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
