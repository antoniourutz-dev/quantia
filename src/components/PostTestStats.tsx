import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  BarChart3,
  RotateCcw,
  LayoutDashboard,
  Clock,
  Zap,
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

interface PostTestStatsProps {
  payload: FinishedTestPayload;
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
  onGoHome: () => void;
}

export default function PostTestStats({
  payload,
  questions,
  mode,
  curriculum,
  username,
  coachContext = null,
  onStartNextSession,
  onRestart,
  onGoHome,
}: PostTestStatsProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const { score, answers } = payload;
  const total = Math.max(questions.length, 1);
  const percentage = Math.round((score / total) * 100);
  const failed = total - score;
  const avgTimeMs = answers.length > 0
    ? answers.reduce((acc, curr) => acc + (curr.responseTimeMs ?? 0), 0) / answers.length
    : 0;
  const avgTimeSec = (avgTimeMs / 1000).toFixed(1);

  const sessionEnd = useMemo(
    () =>
      buildSessionEndExperience({
        locale,
        payload,
        questionsCount: questions.length,
        mode,
        curriculum,
        username,
        coachContext,
      }),
    [coachContext, curriculum, locale, mode, payload, questions.length, username],
  );

  const reviewCopy = buildReviewSurfaceCopy({
    locale,
    failedCount: failed,
    curriculum,
    username,
  });

  const lawStats = questions.reduce((acc, q) => {
    const law = (q.category ?? '').trim() || (isBasque ? 'Beste arauak' : 'Otras normas');
    if (!acc[law]) acc[law] = { total: 0, correct: 0 };
    acc[law].total += 1;
    const answer = answers.find((a) => a.questionId === q.id);
    if (answer?.isCorrect) acc[law].correct += 1;
    return acc;
  }, {} as Record<string, { total: number; correct: number }>);

  const lawData = Object.entries(lawStats)
    .map(([fullName, stats]) => ({
      fullName,
      name: fullName.length > 36 ? `${fullName.substring(0, 33)}...` : fullName,
      accuracy: Math.round((stats.correct / Math.max(1, stats.total)) * 100),
      total: stats.total,
    }))
    .sort((a, b) => b.total - a.total || b.accuracy - a.accuracy);

  const lawsSeen = lawData.map((item) => item.fullName).filter(Boolean);
  const [showOnlyIncorrect, setShowOnlyIncorrect] = useState(false);

  const reviewItems = useMemo(() => {
    const answerMap = new Map(answers.map((a) => [a.questionId, a]));
    return questions.map((q, index) => {
      const answer = answerMap.get(q.id) ?? null;
      const selected = answer?.selectedOption ?? null;
      const correct = q.correctAnswer;
      const isCorrect = selected != null ? selected === correct : false;
      const findOptionText = (key: string | null) =>
        key ? q.options.find((opt) => opt.id === key)?.text ?? '' : '';

      return {
        index: index + 1,
        id: q.id,
        topic: q.category ?? (isBasque ? 'Orokorra' : 'General'),
        text: q.text,
        selected,
        selectedText: findOptionText(selected),
        correct,
        correctText: findOptionText(correct),
        isCorrect,
      };
    });
  }, [answers, isBasque, questions]);

  const reviewFiltered = useMemo(() => {
    if (!showOnlyIncorrect) return reviewItems;
    return reviewItems.filter((item) => !item.isCorrect);
  }, [reviewItems, showOnlyIncorrect]);

  const summaryLine = isBasque
    ? `${questions.length} galderatik ${score} asmatu dituzu.`
    : `Has acertado ${score} de ${questions.length} preguntas.`;

  const speedMessage = Number(avgTimeSec) < 30
    ? isBasque
      ? 'Erritmo ona izan duzu. Merezi du horri eustea.'
      : 'Has ido con buen ritmo. Merece la pena mantenerlo.'
    : isBasque
      ? 'Erritmo ona da, baina errazetan denbora pixka bat gehiago aurreztu dezakezu.'
      : 'El ritmo es bueno, pero aun puedes ahorrar tiempo en las faciles.';

  useEffect(() => {
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
        total: questions.length,
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
      thesis: sessionEnd.headline,
      nextCta: sessionEnd.primaryCta,
      score,
      total: questions.length,
    });
  }, [
    coachContext?.primaryAction,
    coachContext?.tone,
    curriculum,
    mode,
    percentage,
    questions.length,
    score,
    sessionEnd.dominantState,
    sessionEnd.headline,
    sessionEnd.primaryCta,
    sessionEnd.nextMove.kind,
    sessionEnd.nextMove.kind === 'start_session' ? sessionEnd.nextMove.mode : null,
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      <div className="relative overflow-hidden bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col md:flex-row items-center gap-12">
        <div className="relative flex-shrink-0">
          <svg className="w-48 h-48 transform -rotate-90">
            <circle cx="96" cy="96" r="88" stroke="#f1f5f9" strokeWidth="16" fill="transparent" />
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke={percentage >= 70 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444'}
              strokeWidth="16"
              fill="transparent"
              strokeDasharray={552.9}
              strokeDashoffset={552.9 * (1 - percentage / 100)}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-slate-800">{percentage}%</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
              {isBasque ? 'Emaitza' : 'Resultado'}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-6 text-center md:text-left">
          <div>
            {sessionEnd.continuityLine ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-indigo-700 mb-5">
                <Zap size={14} />
                {sessionEnd.continuityLine}
              </div>
            ) : null}
            <h2 className="text-4xl font-black text-slate-800 mb-2">{sessionEnd.headline}</h2>
            <p className="text-xl text-slate-500 font-medium leading-relaxed">
              {sessionEnd.summary || summaryLine}
            </p>
            {sessionEnd.microReward ? (
              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  {isBasque ? 'Aurrerapen txikia' : 'Progreso de proceso'}
                </div>
                <div className="mt-2 text-sm font-black text-slate-900">{sessionEnd.microReward.title}</div>
                <div className="mt-1 text-sm font-medium text-slate-500">{sessionEnd.microReward.detail}</div>
              </div>
            ) : null}
            {sessionEnd.continuityMessage ? (
              <p className="text-sm text-slate-500 font-bold mt-4">{sessionEnd.continuityMessage}</p>
            ) : null}
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-4">{summaryLine}</p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <div className="flex items-center gap-2 px-5 py-3 bg-emerald-50 text-emerald-700 rounded-2xl font-bold border border-emerald-100">
              <CheckCircle2 size={20} />
              {score} {isBasque ? 'Asmatuta' : 'Aciertos'}
            </div>
            <div className="flex items-center gap-2 px-5 py-3 bg-rose-50 text-rose-700 rounded-2xl font-bold border border-rose-100">
              <XCircle size={20} />
              {failed} {isBasque ? 'Huts' : 'Fallos'}
            </div>
            <div className="flex items-center gap-2 px-5 py-3 bg-indigo-50 text-indigo-700 rounded-2xl font-bold border border-indigo-100">
              <Clock size={20} />
              {avgTimeSec}s / {isBasque ? 'gal.' : 'preg.'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">
              {isBasque ? 'Nola joan den legez lege' : 'Como ha ido por ley'}
            </h3>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <BarChart3 size={24} />
            </div>
          </div>
          {lawsSeen.length === 0 ? (
            <div className="mb-8 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-600">
              {isBasque
                ? 'Saio honetan ez da legeka irakurketa argirik atera.'
                : 'En esta sesion no se ha podido sacar una lectura por ley.'}
            </div>
          ) : (
            <div className="mb-8 rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {isBasque ? 'Landutako legea' : 'Ley trabajada'}
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {isBasque ? 'Acierto' : 'Acierto'}
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {lawData.slice(0, 12).map((law) => (
                  <div key={law.fullName} className="px-6 py-4 bg-white flex items-center justify-between gap-6">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900 truncate">{law.fullName}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {law.total} {isBasque ? 'gal.' : 'preg.'}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 text-xl font-black ${
                        law.accuracy >= 80
                          ? 'text-emerald-600'
                          : law.accuracy >= 60
                            ? 'text-amber-600'
                            : 'text-rose-600'
                      }`}
                    >
                      {law.accuracy}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">
              {isBasque ? 'Galdera bakoitzeko denbora' : 'Tiempo por pregunta'}
            </h3>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Zap size={24} />
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center space-y-6">
            <div className="text-center">
              <span className="text-7xl font-black text-slate-800">{avgTimeSec}</span>
              <span className="text-2xl font-bold text-slate-400 ml-2">{isBasque ? 'segundo' : 'segundos'}</span>
              <p className="text-slate-500 font-medium mt-2">
                {isBasque ? 'Galdera bakoitzeko batez bestekoa' : 'Media por pregunta'}
              </p>
            </div>

            <div className={`p-6 rounded-[2rem] w-full text-center border-2 ${
              Number(avgTimeSec) < 30 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'
            }`}>
              <p className="font-bold">{speedMessage}</p>
            </div>
          </div>
        </div>
      </div>

      {mode === 'simulacro' ? (
        <div id="session-end-review" className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                {isBasque ? 'Orain zer berrikusi komeni den' : 'Lo que conviene revisar ahora'}
              </h3>
              <p className="text-slate-500 font-medium mt-1">
                {reviewCopy.line2 ?? reviewCopy.line1}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOnlyIncorrect(false)}
                className={`px-5 py-3 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${
                  !showOnlyIncorrect
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {isBasque ? 'Denak' : 'Ver todo'}
              </button>
              <button
                onClick={() => setShowOnlyIncorrect(true)}
                className={`px-5 py-3 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${
                  showOnlyIncorrect
                    ? 'border-rose-600 bg-rose-50 text-rose-700'
                    : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {isBasque ? 'Bakarrik hutsak' : 'Solo lo fallado'}
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-4">
            {reviewFiltered.map((item) => (
              <div key={item.id} className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
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
                            : 'bg-rose-50 border-rose-100 text-rose-700'
                        }`}
                      >
                        {item.isCorrect ? (isBasque ? 'ZUZEN' : 'ACIERTO') : (isBasque ? 'HUTS' : 'FALLO')}
                      </span>
                    </div>
                    <div className="text-lg font-black text-slate-900 leading-snug">{item.text}</div>
                  </div>

                  <div className="shrink-0">
                    {item.isCorrect ? (
                      <CheckCircle2 size={28} className="text-emerald-600" />
                    ) : (
                      <XCircle size={28} className="text-rose-600" />
                    )}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      {isBasque ? 'Zure erantzuna' : 'Tu respuesta'}
                    </div>
                    <div className="text-sm font-bold text-slate-700 leading-relaxed">
                      {item.selected ? (
                        <>
                          {item.selected.toUpperCase()}. {item.selectedText}
                        </>
                      ) : (
                        <span className="text-slate-400">{isBasque ? 'Erantzun gabe' : 'Sin responder'}</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
                    <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-2">
                      {isBasque ? 'Erantzun zuzena' : 'Respuesta correcta'}
                    </div>
                    <div className="text-sm font-black text-emerald-900 leading-relaxed">
                      {item.correct.toUpperCase()}. {item.correctText}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-4 pt-4 items-stretch">
        <button
          onClick={() => {
            trackEffect({
              surface: 'session_end',
              curriculum,
              action: 'cta_clicked',
              context: {
                cta: sessionEnd.primaryCta,
                mode,
                nextMoveKind: sessionEnd.nextMove.kind,
                nextMode: sessionEnd.nextMove.kind === 'start_session' ? sessionEnd.nextMove.mode : null,
              },
            });
            if (sessionEnd.nextMove.kind === 'go_home') {
              onGoHome();
              return;
            }
            if (sessionEnd.nextMove.kind === 'review_on_page') {
              setShowOnlyIncorrect(true);
              const anchor = document.getElementById('session-end-review');
              anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          className="flex-1 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 hover:-translate-y-1"
        >
          <RotateCcw size={24} />
          {sessionEnd.primaryCta}
        </button>
        <button
          onClick={() => {
            trackEffect({ surface: 'session_end', curriculum, action: 'go_home', context: { mode } });
            onGoHome();
          }}
          className="py-4 px-6 bg-white text-slate-600 rounded-[2rem] font-black text-base shadow-lg border border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
        >
          <LayoutDashboard size={24} />
          {isBasque ? 'Panela berriz ikusi' : 'Volver al panel'}
        </button>
      </div>
    </div>
  );
}
