import { useEffect, useState } from 'react';
import type { Question } from '../types';
import { getChallengeTopicEnergy, getTopicQuestionsBelowPerfect } from '../lib/challengeTopicEnergy';

type Props = {
  questions: Question[];
  syncing: boolean;
  syncFailed: boolean;
  isBasque: boolean;
  onStart: (questions: Question[]) => void;
};

export default function TopicReviewAction({ questions, syncing, syncFailed, isBasque, onStart }: Props) {
  const [result, setResult] = useState<Question[] | 'error' | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (syncing || syncFailed) return;
    const controller = new AbortController();
    const gradable = questions.filter(question => question.correctAnswer != null);
    void getChallengeTopicEnergy(gradable.map(question => question.id), controller.signal).then(
      energy => {
        if (controller.signal.aborted) return;
        setResult(getTopicQuestionsBelowPerfect(gradable, energy));
      },
      () => { if (!controller.signal.aborted) setResult('error'); },
    );
    return () => controller.abort();
  }, [questions, retry, syncFailed, syncing]);

  if (syncFailed) {
    return <p className="text-sm text-slate-600">{isBasque ? 'Gaia errepasatzeko, saioa sinkronizatu behar da.' : 'El repaso estará disponible cuando se sincronice el test.'}</p>;
  }
  if (syncing || result === null) {
    return <p role="status" className="text-sm text-slate-600">{isBasque ? 'Gaiko emaitzak eguneratzen…' : 'Actualizando el acierto del tema…'}</p>;
  }
  if (result === 'error') {
    return (
      <div className="space-y-2">
        <p role="status" className="text-sm text-slate-600">{isBasque ? 'Ezin izan da errepasoa prestatu.' : 'No se ha podido preparar el repaso del tema.'}</p>
        <button type="button" className="text-sm font-bold text-indigo-700 underline" onClick={() => {
          setResult(null);
          setRetry(value => value + 1);
        }}>{isBasque ? 'Saiatu berriro' : 'Reintentar'}</button>
      </div>
    );
  }
  if (!result.length) {
    return <p className="text-sm font-medium text-emerald-800">{isBasque ? 'Landutako galdera guztietan % 100 asmatu duzu.' : 'Todas las preguntas practicadas de este tema están al 100 %.'}</p>;
  }
  return (
    <button type="button" onClick={() => onStart(result)}
      className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3.5 text-sm font-bold text-indigo-800 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
      {isBasque ? '% 100etik beherako galderak landu' : 'Repasar preguntas por debajo del 100 %'} ({result.length})
    </button>
  );
}
