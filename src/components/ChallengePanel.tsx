import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { CHALLENGE_OPTIONS, loadChallengeQuestions, shuffleChallengeQuestions, type ChallengeResult, type ChallengeScope } from '../lib/challenge';
import { getChallengeRanking } from '../lib/challengeRanking';
import { getQuestionBankSnapshot } from '../lib/quantiaApi';
import type { Question } from '../types';

type Props = {
  curriculum: string;
  userId: string | null;
  isBasque: boolean;
  syncing: boolean;
  scope: ChallengeScope;
  onScopeChange: (scope: ChallengeScope) => void;
  randomize: boolean;
  onRandomizeChange: (randomize: boolean) => void;
  onStart: (questions: Question[], title: string) => void;
};

export default function ChallengePanel({ scope, onScopeChange, ...props }: Props) {
  const { isBasque } = props;
  return (
    <section className="space-y-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
      <div>
        <h3 className="text-xl font-black text-slate-900">{isBasque ? 'Erronka' : 'Desafío'}</h3>
        <p className="mt-1 text-sm text-slate-600">{isBasque ? 'Egin proba osoa eta gainditu zure marka.' : 'Completa el bloque entero y supera tu mejor marca.'}</p>
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <legend className="mb-2 text-sm font-bold text-slate-800">{isBasque ? 'Gai-zerrenda' : 'Temario'}</legend>
        {(Object.keys(CHALLENGE_OPTIONS) as ChallengeScope[]).map((key) => {
          const item = CHALLENGE_OPTIONS[key];
          return (
            <button key={key} type="button" aria-pressed={scope === key}
              onClick={() => onScopeChange(key)}
              className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-bold ${scope === key ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 text-slate-700'}`}>
              {isBasque ? item.labelEu : item.label} · {item.count}
            </button>
          );
        })}
      </fieldset>
      <FullChallenge {...props} scope={scope} />
    </section>
  );
}

function FullChallenge({ curriculum, userId, isBasque, syncing, scope, randomize, onRandomizeChange, onStart }: Omit<Props, 'scope' | 'onScopeChange'> & { scope: ChallengeScope }) {
  const bankKey = JSON.stringify([curriculum, scope]);
  const [bank, setBank] = useState<{ key: string; questions: Question[]; error: boolean } | null>(null);
  const currentBank = bank?.key === bankKey ? bank : null;
  const gradedTotal = currentBank?.questions.filter((question) => question.correctAnswer != null).length ?? 0;
  const rankingKey = JSON.stringify([curriculum, userId, scope]);
  const [ranking, setRanking] = useState<{ key: string; rows: ChallengeResult[]; error: boolean } | null>(null);
  const current = ranking?.key === rankingKey ? ranking : null;
  const option = CHALLENGE_OPTIONS[scope];
  const locale = isBasque ? 'eu-ES' : 'es-ES';
  const percentage = (value: number, total: number) =>
    new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(value / total);

  useEffect(() => {
    let active = true;
    void loadChallengeQuestions(scope, (questionScope) =>
      getQuestionBankSnapshot({ curriculum, questionScope }),
    ).then(
      (questions) => { if (active) setBank({ key: bankKey, questions, error: false }); },
      () => { if (active) setBank({ key: bankKey, questions: [], error: true }); },
    );
    return () => { active = false; };
  }, [bankKey, curriculum, scope]);

  useEffect(() => {
    if (!userId || syncing || gradedTotal === 0) return;
    const controller = new AbortController();
    void getChallengeRanking(curriculum, userId, scope, gradedTotal, controller.signal).then(
      (rows) => { if (!controller.signal.aborted) setRanking({ key: rankingKey, rows, error: false }); },
      () => { if (!controller.signal.aborted) setRanking({ key: rankingKey, rows: [], error: true }); },
    );
    return () => controller.abort();
  }, [curriculum, gradedTotal, rankingKey, scope, syncing, userId]);

  return (
    <>
      <label className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-800">
        {isBasque ? 'Galderen ordena' : 'Orden de las preguntas'}
        <select value={randomize ? 'random' : 'sequence'} onChange={(event) => onRandomizeChange(event.target.value === 'random')}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2">
          <option value="sequence">{isBasque ? 'Ordenan' : 'En orden'}</option>
          <option value="random">{isBasque ? 'Ausaz' : 'Aleatorio'}</option>
        </select>
      </label>
      {currentBank?.error ? <p role="alert" className="text-sm text-rose-700">{isBasque ? 'Ezin izan da erronka kargatu.' : 'No se ha podido cargar el desafío.'}</p>
        : currentBank && gradedTotal === 0 ? <p role="alert" className="text-sm text-rose-700">{isBasque ? 'Galdera sorta osoa ez dago erabilgarri oposizio honetan.' : 'El bloque completo no está disponible para esta oposición.'}</p>
        : currentBank && gradedTotal < option.count ? <p className="text-sm text-slate-600">
          {isBasque ? `${gradedTotal} galdera ebaluagarri. Erantzunik esleitu gabekoak ez dira puntuatzen.` : `${gradedTotal} preguntas evaluables. Las que no tienen respuesta asignada quedan fuera de la puntuación.`}
        </p> : null}
      <button type="button" disabled={!currentBank || gradedTotal === 0}
        onClick={() => currentBank && onStart(randomize ? shuffleChallengeQuestions(currentBank.questions) : currentBank.questions, option.title)}
        className="rounded-xl bg-indigo-700 px-5 py-3 font-bold text-white hover:bg-indigo-800 disabled:opacity-60">
        {!currentBank ? (isBasque ? 'Kargatzen…' : 'Cargando…') : (isBasque ? 'Erronka hasi' : 'Empezar desafío')} · {option.count}
      </button>
      {gradedTotal > 0 && <div aria-live="polite" className="space-y-2 border-t border-slate-100 pt-4">
        <h4 className="flex items-center gap-2 font-bold text-slate-900"><Trophy size={18} aria-hidden="true" />{isBasque ? 'Zure hiru marka onenak' : 'Tus tres mejores marcas'}</h4>
        {syncing || (userId && !current) ? <p className="text-sm text-slate-600">{isBasque ? 'Sailkapena kargatzen…' : 'Cargando clasificación…'}</p>
          : current?.error ? <p className="text-sm text-rose-700">{isBasque ? 'Ezin izan da sailkapena kargatu.' : 'No se ha podido cargar la clasificación.'}</p>
          : !current?.rows.length ? <p className="text-sm text-slate-600">{isBasque ? 'Lehen proba osoak zure lehen marka ezarriko du.' : 'Tu primer desafío completo establecerá la primera marca.'}</p>
          : <ol className="space-y-2">
              {current.rows.map((row, index) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">
                <span className="font-bold">#{index + 1} · {percentage(row.correct, row.total)} {isBasque ? 'zuzen' : 'de acierto'}</span>
                <span>{row.correct} {isBasque ? 'zuzen' : 'aciertos'} · {row.total - row.correct} {isBasque ? 'oker' : 'fallos'} ({percentage(row.total - row.correct, row.total)})</span>
                <time className="text-slate-600" dateTime={row.startedAt}>{new Date(row.startedAt).toLocaleDateString(locale)}</time>
              </li>)}
            </ol>}
      </div>}
    </>
  );
}
