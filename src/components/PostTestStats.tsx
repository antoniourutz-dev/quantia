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
  const continuityFocus = sessionEnd.nextMove.kind === 'start_session' && mode !== 'simulacro';

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
    <div className="mx-auto max-w-3xl space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20 sm:space-y-6 sm:pb-24 pt-4 sm:pt-8">
      <div className="flex flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
        
        {/* TOP ROW: Continuity & Metrics Compact */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-100 min-w-[3rem]">
                <span className={`text-[17px] leading-none font-black ${percentage >= 70 ? 'text-emerald-500' : percentage >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                  {percentage}%
                </span>
             </div>
             <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">{isBasque ? 'Emaitza' : 'Resultado'}</div>
                <div className="text-[13px] font-bold text-slate-600 leading-none">
                  {score} {isBasque ? 'zuzen' : 'bien'} · {failed} {isBasque ? 'huts' : 'mal'}
                </div>
             </div>
          </div>
          {sessionEnd.continuityLine && (
             <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-indigo-600">
               <Zap size={12} />
               {sessionEnd.continuityLine}
             </div>
          )}
        </div>

        {/* HEADLINE & MACRO LECTURE */}
        <div className="mb-6 mt-1">
          <h2 className="text-[22px] sm:text-[28px] font-black text-slate-900 tracking-tight leading-[1.15] mb-2.5">{sessionEnd.headline}</h2>
          <p className="text-[15px] font-medium text-slate-500 leading-snug">{sessionEnd.summary || summaryLine}</p>
        </div>

        {/* CTA INTEGRADO & NEXT STEP */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 mb-5">
           {(sessionEnd.continuityMessage || sessionEnd.microReward) && (
             <div className="mb-4 space-y-3">
               {sessionEnd.continuityMessage && (
                 <p className="text-[13px] font-bold text-slate-700 leading-snug">{sessionEnd.continuityMessage}</p>
               )}
               {sessionEnd.microReward && (
                 <div className="inline-flex items-center gap-2 text-[10px] font-extrabold text-slate-500 uppercase tracking-[0.15em] bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                   {sessionEnd.microReward.title}
                 </div>
               )}
             </div>
           )}
           
           <button
             onClick={() => {
               trackEffect({
                 surface: 'session_end',
                 curriculum,
                 action: 'cta_clicked',
                 context: { cta: sessionEnd.primaryCta, mode, nextMoveKind: sessionEnd.nextMove.kind }
               });
               if (sessionEnd.nextMove.kind === 'review_on_page') {
                 setShowOnlyIncorrect(true);
                 document.getElementById('session-end-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 return;
               }
               if (sessionEnd.nextMove.kind === 'start_session' && onStartNextSession) {
                 onStartNextSession({ mode: sessionEnd.nextMove.mode, questionCount: sessionEnd.nextMove.questionCount, syllabus: sessionEnd.nextMove.syllabus });
                 return;
               }
               onRestart();
             }}
             className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-[15px] font-black text-white shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] transition-all active:scale-[0.98] hover:bg-indigo-700"
           >
             {sessionEnd.nextMove.kind === 'review_on_page' && <RotateCcw size={18} />}
             {sessionEnd.primaryCta}
           </button>
        </div>

        {/* SECONDARY MINIMAL METRICS */}
        <div className="flex divide-x divide-slate-100 border-t border-slate-100 pt-4">
           <div className="flex-1 flex flex-col items-center px-1">
             <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">
               <Clock size={12} /> {isBasque ? 'Seg/gal' : 'Seg/preg'}
             </span>
             <span className="text-[13px] font-black text-slate-700">{avgTimeSec}s</span>
           </div>
           <div className="flex-1 flex flex-col items-center px-1">
             <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">
               <CheckCircle2 size={12} /> {isBasque ? 'Zuzenak' : 'Aciertos'}
             </span>
             <span className="text-[13px] font-bold text-emerald-600">{score} </span>
           </div>
           <div className="flex-1 flex flex-col items-center px-1">
             <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">
               <XCircle size={12} /> {isBasque ? 'Hutsak' : 'Fallos'}
             </span>
             <span className="text-[13px] font-bold text-rose-600">{failed}</span>
           </div>
        </div>
      </div>

      {!continuityFocus ? (
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart3 size={20} />
            </div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">
              {isBasque ? 'Legez lege' : 'Por ley'}
            </h3>
          </div>
          {lawsSeen.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-4 text-xs font-medium text-slate-500">
              {isBasque ? 'Ez dago datu nahikorik.' : 'Sin datos por ley.'}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 overflow-hidden text-sm">
              <div className="divide-y divide-slate-100">
                {lawData.slice(0, 12).map((law) => (
                  <div key={law.fullName} className="px-4 py-3 flex items-center justify-between gap-4 bg-white">
                    <div className="truncate font-bold text-slate-700 text-xs sm:text-sm">{law.fullName}</div>
                    <div className={`shrink-0 font-black text-sm lg:text-base ${law.accuracy >= 80 ? 'text-emerald-600' : law.accuracy >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{law.accuracy}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Zap size={20} />
            </div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">
              {isBasque ? 'Denbora' : 'Tiempo'}
            </h3>
          </div>
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 text-center mt-2 border border-slate-100/60">
             <span className="text-4xl font-black text-slate-800 tracking-tight">{avgTimeSec}s</span>
             <span className="text-[11px] font-extrabold text-slate-400 mt-1 uppercase tracking-widest">{isBasque ? 'Galderako' : 'Por pregunta'}</span>
             <p className={`mt-5 text-[13px] font-bold leading-snug px-3 py-2 rounded-xl text-center shadow-sm w-full max-w-[240px] ${Number(avgTimeSec) < 30 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
               {speedMessage}
             </p>
          </div>
        </div>
      </div>
      ) : null}

      {mode === 'simulacro' ? (
        <div id="session-end-review" className="space-y-6 rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:space-y-8 sm:rounded-[2.5rem] sm:p-10">
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

      <div className="flex justify-center pt-2 pb-6">
        <button
          onClick={() => {
            trackEffect({ surface: 'session_end', curriculum, action: 'go_home', context: { mode } });
            onGoHome();
          }}
          className="text-[12px] font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest px-6 py-4"
        >
          {isBasque ? 'Panelera itzuli' : 'Volver al panel principal'}
        </button>
      </div>
    </div>
  );
}
