import { useMemo, useState, type FormEvent } from 'react';
import type { Question } from '../types';
import { rankTopicMistakes, type QuestionEnergy } from '../lib/challengeTopicEnergy';

const ranges = [
  { min: 90, label: '90–100%', className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  { min: 60, label: '60–89%', className: 'border-sky-200 bg-sky-50 text-sky-900' },
  { min: 40, label: '40–59%', className: 'border-amber-200 bg-amber-50 text-amber-950' },
  { min: 0, label: '0–39%', className: 'border-rose-200 bg-rose-50 text-rose-900' },
];
const neutral = 'border-slate-200 bg-white text-slate-600';

type Props = {
  questions: Question[];
  energy: ReadonlyMap<string, QuestionEnergy> | null;
  isBasque: boolean;
  onStart: (questions: Question[]) => void;
};

export default function TopicQuestionBattery({ questions, energy, isBasque, onStart }: Props) {
  const [quantity, setQuantity] = useState('');
  const ranked = useMemo(() => energy ? rankTopicMistakes(questions, energy) : [], [questions, energy]);
  const count = Number(quantity);
  const valid = Number.isInteger(count) && count >= 1 && count <= ranked.length;
  const start = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (valid) onStart(ranked.slice(0, count));
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div>
        <h5 className="text-sm font-black text-slate-900">{isBasque ? 'Galderaz galdera' : 'Pregunta por pregunta'}</h5>
        <p className="mt-1 text-xs text-slate-600">{isBasque ? 'Galdera bakoitzeko azken hiru erantzunak, gehienez.' : 'Acierto en hasta las tres últimas respuestas de cada pregunta.'}</p>
      </div>
      <ul aria-label={isBasque ? 'Asmatze-tarteak' : 'Rangos de acierto'} className="flex flex-wrap gap-1.5">
        {ranges.map(({ label, className }) => <li key={label} className={`rounded-full border px-2 py-0.5 text-xs font-bold ${className}`}>{label}</li>)}
        <li className={`rounded-full border px-2 py-0.5 text-xs font-bold ${neutral}`}>{isBasque ? '— Daturik gabe' : '— Sin datos'}</li>
      </ul>
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(3.6rem,1fr))] gap-2">
        {questions.map((question, index) => {
          const result = question.correctAnswer == null ? undefined : energy?.get(question.id);
          const rate = result?.attempts ? Math.round(100 * result.correct / result.attempts) : null;
          const tone = rate == null ? neutral : ranges.find(range => rate >= range.min)?.className ?? neutral;
          const number = question.number ?? index + 1;
          const detail = result?.attempts ? `${result.correct}/${result.attempts}` : '—';
          const label = isBasque ? `${number}. galdera` : `Pregunta ${number}`;
          const unavailable = question.correctAnswer == null
            ? (isBasque ? 'Ebaluatu gabea' : 'No evaluable')
            : (isBasque ? 'Daturik gabe' : 'Sin datos');
          const description = rate == null ? unavailable : `${rate}% (${detail})`;
          return <li key={question.id} className={`rounded-xl border px-1.5 py-1.5 text-center shadow-sm ${tone}`} aria-label={`${label}: ${description}`} title={`${label}: ${description}`}>
            <span className="block text-[11px] font-semibold">#{number}</span>
            <span className="block text-sm font-black tabular-nums">{rate == null ? '—' : `${rate}%`}</span>
            {rate != null && <span className="block text-[10px] tabular-nums">{detail}</span>}
          </li>;
        })}
      </ol>
      <form onSubmit={start} className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-800">
          {isBasque ? 'Galdera kopurua' : 'Número de preguntas'}
          <input type="number" inputMode="numeric" min={1} max={Math.max(1, ranked.length)} step={1}
            value={quantity} onChange={event => setQuantity(event.target.value)} disabled={!ranked.length}
            className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            placeholder={ranked.length ? `1–${ranked.length}` : '—'} required />
        </label>
        <button type="submit" disabled={!valid} className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-50">
          {isBasque ? 'Huts gehienak landu' : 'Test de las más falladas'}
        </button>
        <p className="basis-full text-xs text-slate-600">
          {energy
            ? (isBasque ? `${ranked.length} galdera, gutxienez huts batekin.` : `${ranked.length} preguntas con algún fallo reciente disponibles.`)
            : (isBasque ? 'Ez dago emaitzarik erabilgarri.' : 'Aún no hay resultados disponibles.')}
        </p>
      </form>
    </div>
  );
}
