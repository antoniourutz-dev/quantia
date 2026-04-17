import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Timer,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react';
import { FinishedTestPayload, OptionKey, PracticeMode, Question, TestAnswer } from '../types';
import { useAppLocale } from '../lib/locale';

interface TestInterfaceProps {
  questions: Question[];
  mode: PracticeMode;
  onFinish: (payload: FinishedTestPayload) => void | Promise<void>;
  onCancel: () => void;
  isFinishing?: boolean;
}

export default function TestInterface({
  questions,
  mode,
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
  const finishStartedRef = useRef(false);
  const wasFinishingRef = useRef(false);

  const currentQuestion = questions[currentIndex];
  const selectedAnswer = selectedAnswers[currentIndex];
  const isSimulacro = mode === 'simulacro';
  const closingSession = finishRequested || isFinishing;

  const score = useMemo(
    () => answerDetails.filter((answer) => answer?.isCorrect).length,
    [answerDetails],
  );
  const answeredCount = useMemo(
    () => selectedAnswers.filter((answer) => answer !== null).length,
    [selectedAnswers],
  );

  const finishPayload = useMemo(
    () => ({
      score,
      answers: answerDetails.filter((answer): answer is TestAnswer => Boolean(answer)),
    }),
    [answerDetails, score],
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
  }, [mode, questions]);

  const requestFinish = useCallback(() => {
    if (finishStartedRef.current) return;
    finishStartedRef.current = true;
    setFinishRequested(true);
    void onFinish(finishPayload);
  }, [finishPayload, onFinish]);

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
    const previousDetail = answerDetails[currentIndex];
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

    const nextSelected = [...selectedAnswers];
    nextSelected[currentIndex] = optionId;
    setSelectedAnswers(nextSelected);

    const nextDetails = [...answerDetails];
    nextDetails[currentIndex] = detail;
    setAnswerDetails(nextDetails);
    setShowExplanation(!isSimulacro);
    setManualExplanationOpen(false);

    if (navigator.vibrate) {
      navigator.vibrate(isSimulacro ? 10 : optionId === currentQuestion.correctAnswer ? 10 : [10, 30, 10]);
    }
  };

  const nextQuestion = () => {
    if (closingSession) return;
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setShowExplanation(!isSimulacro && selectedAnswers[nextIndex] !== null);
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
      setShowExplanation(!isSimulacro && selectedAnswers[nextIndex] !== null);
      setManualExplanationOpen(false);
      setQuestionStartAt(Date.now());
    }
  };

  const progress = ((currentIndex + 1) / questions.length) * 100;

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
                    <span>{answeredCount}/{questions.length}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-600">
                    <Trophy size={14} className="text-emerald-600" />
                    <span>{score}/{questions.length}</span>
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
                  {currentIndex + 1} / {questions.length}
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
        {closingSession ? (
          <div className="flex min-h-[360px] flex-col justify-between gap-8 py-2 sm:min-h-[420px] sm:py-4">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <Loader2 size={14} className="animate-spin text-indigo-500" />
              {isBasque ? 'Saioa ixten' : 'Cierre de sesion'}
            </div>

            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.75rem] border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/60">
                <Loader2 size={28} className="animate-spin" />
              </div>
              <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                {isBasque ? 'Zure analisia prestatzen' : 'Preparando tu analisis'}
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
                {isBasque
                  ? 'Emaitzak gordetzen ari gara eta benetan axola duena kalkulatzen.'
                  : 'Guardando resultados y calculando lo importante.'}
              </p>

              <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-3 md:mt-10 md:grid-cols-3 md:gap-4">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="rounded-[1.75rem] border border-slate-100 bg-slate-50/80 p-5 shadow-inner shadow-white/70"
                  >
                    <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-200" />
                    <div className="mt-4 h-8 w-24 animate-pulse rounded-2xl bg-slate-200" />
                    <div className="mt-6 space-y-2">
                      <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-200" />
                      <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={`px-4 sm:px-0 pb-4 pt-4 ${isFocusMode ? '' : 'sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-100 sm:border-transparent transition-all shadow-sm sm:shadow-none'}`}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-black uppercase tracking-widest text-slate-400 max-w-[220px] sm:max-w-xs">
                  {currentIndex + 1} · {currentQuestion.category || (isBasque ? 'Praktika' : 'Practica')}
                </span>
                {selectedAnswer !== null && !isSimulacro && (
                  <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest ${selectedAnswer === currentQuestion.correctAnswer ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {selectedAnswer === currentQuestion.correctAnswer
                      ? isBasque ? '✓ Zuzena' : '✓ Correcto'
                      : isBasque ? '✗ Okerra' : '✗ Incorrecto'}
                  </span>
                )}
              </div>

              <h2 className="text-[15px] font-extrabold leading-[1.35] text-slate-800 sm:text-lg max-h-[35vh] overflow-y-auto pr-1">
                {currentQuestion.text}
              </h2>
            </div>

            <div className="flex flex-col flex-1 divide-y divide-slate-100 bg-slate-50/30 sm:rounded-2xl sm:border sm:border-slate-100 overflow-hidden">
              {currentQuestion.options.map((option) => {
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
                        {option.text}
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
                    <p className="text-slate-600 leading-relaxed font-medium text-sm antialiased">{currentQuestion.explanation}</p>
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
                    {currentIndex === questions.length - 1
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
                  {currentIndex === questions.length - 1
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
