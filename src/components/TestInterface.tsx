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
    <div className={`max-w-6xl mx-auto space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all ${isFocusMode ? 'py-8' : ''}`}>
      {!isFocusMode && (
        <div className="animate-in slide-in-from-top-4 duration-500">
          <div className="flex justify-between items-center bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-6">
              {isSimulacro && (
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                  <Timer size={18} className="text-indigo-600" />
                  {formatTime(timeLeft)}
                </div>
              )}
              {isSimulacro ? (
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                  <Trophy size={18} className="text-slate-400" />
                  {isBasque ? 'Erantzunda' : 'Respondidas'} {answeredCount}/{questions.length}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                  <Trophy size={18} className="text-emerald-600" />
                  {score}/{questions.length} {isBasque ? 'zuzen' : 'correctas'}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsFocusMode(true)}
                disabled={closingSession}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
                  closingSession
                    ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed'
                    : 'bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border-slate-100'
                }`}
              >
                <Zap size={14} />
                {isBasque ? 'Focus modua' : 'Modo Focus'}
              </button>
              <div className="h-6 w-px bg-slate-100" />
              <span className="text-sm font-bold text-slate-400">
                {isBasque ? 'Galdera' : 'Pregunta'} {currentIndex + 1} {isBasque ? '/' : 'de'} {questions.length}
              </span>
              <button
                onClick={onCancel}
                disabled={closingSession}
                className={`text-sm font-semibold transition-colors ${
                  closingSession ? 'text-rose-200 cursor-not-allowed' : 'text-rose-500 hover:text-rose-600'
                }`}
              >
                {isBasque ? 'Irten' : 'Salir'}
              </button>
            </div>
          </div>

          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-indigo-600 h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {isFocusMode && (
        <div className="fixed top-8 right-8 z-50">
          <button
            onClick={() => setIsFocusMode(false)}
            disabled={closingSession}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm shadow-xl border transition-all ${
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

      <div className={`bg-white rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4 transition-all duration-500 ${isFocusMode ? 'p-16 shadow-2xl scale-[1.02]' : 'p-6'}`}>
        {closingSession ? (
          <div className="flex min-h-[420px] flex-col justify-between gap-8 py-4">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <Loader2 size={14} className="animate-spin text-indigo-500" />
              {isBasque ? 'Saioa ixten' : 'Cierre de sesion'}
            </div>

            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.75rem] border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/60">
                <Loader2 size={28} className="animate-spin" />
              </div>
              <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">
                {isBasque ? 'Zure analisia prestatzen' : 'Preparando tu analisis'}
              </h2>
              <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-slate-500">
                {isBasque
                  ? 'Emaitzak gordetzen ari gara eta benetan axola duena kalkulatzen.'
                  : 'Guardando resultados y calculando lo importante.'}
              </p>

              <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
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
            <div className={`px-2 ${isFocusMode ? '' : 'sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-slate-100 -mx-6 px-6 pt-4 pb-4 rounded-t-[2.5rem]'}`}>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <AlertCircle size={14} />
                {currentQuestion.category || (isBasque ? 'Praktika-galdera' : 'Pregunta de practica')}
                {selectedAnswer !== null && !isSimulacro && (
                  <div className={`px-2 py-0.5 rounded ml-2 ${selectedAnswer === currentQuestion.correctAnswer ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {selectedAnswer === currentQuestion.correctAnswer
                      ? isBasque ? 'Zuzena' : 'Correcto'
                      : isBasque ? 'Okerra' : 'Incorrecto'}
                  </div>
                )}
              </div>

              <h2 className="text-xl font-bold text-slate-800 leading-tight">
                {currentQuestion.text}
              </h2>
            </div>

            <div className="bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100 max-h-[calc(100svh-360px)] sm:max-h-none overflow-y-auto">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedAnswer === option.id;
                const isAnswerCorrect = option.id === currentQuestion.correctAnswer;

                let itemClass = 'w-full p-5 transition-all duration-300 flex items-center justify-between text-left group relative overflow-hidden ';

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

                    <div className="flex items-center gap-5 relative z-10">
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 transition-all duration-500 ${
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
                        className={`font-bold text-lg leading-snug transition-colors duration-300 ${
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
              <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                {!manualExplanationOpen ? (
                  <button
                    onClick={() => setManualExplanationOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-50 transition-all border border-indigo-100 ml-2"
                  >
                    <Info size={14} />
                    {isBasque ? 'Azalpen teknikoa ikusi' : 'Ver explicacion tecnica'}
                  </button>
                ) : (
                  <div className="p-6 bg-slate-50 text-slate-800 rounded-2xl border border-slate-200 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                        <Info size={18} />
                        {isBasque ? 'Erantzunaren azalpena' : 'Explicacion de la respuesta'}
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
        <div className="flex justify-end">
          <button
            disabled
            className="flex min-w-[260px] items-center justify-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 font-bold text-white shadow-lg shadow-slate-900/10 cursor-wait"
          >
            <Loader2 size={20} className="animate-spin" />
            {isBasque ? 'Saioa ixten...' : 'Cerrando sesion...'}
          </button>
        </div>
      ) : (
        <div className="flex justify-between items-center gap-4">
          <button
            onClick={prevQuestion}
            disabled={closingSession || currentIndex === 0}
            className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all ${
              closingSession || currentIndex === 0
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'
            }`}
          >
            <ChevronLeft size={20} />
            {isBasque ? 'Aurrekoa' : 'Anterior'}
          </button>

          <button
            onClick={nextQuestion}
            disabled={closingSession || selectedAnswer === null}
            className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all shadow-lg ${
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
                {isBasque ? 'Saioa ixten...' : 'Cerrando sesion...'}
              </>
            ) : (
              <>
                {currentIndex === questions.length - 1
                  ? isBasque ? 'Amaitu' : 'Finalizar'
                  : isBasque ? 'Hurrengoa' : 'Siguiente'}
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
