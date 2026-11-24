import { useState } from 'react';
import { startCaseQuestions, type PracticalCase } from '../lib/practicalCases';
import type { Question } from '../types';

export default function PracticalCaseSelector({ cases, curriculum, onStart, syncing = false }: {
  cases: PracticalCase[]; curriculum: string; syncing?: boolean;
  onStart: (questions: Question[], title: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalQuestions = cases.reduce((total, c) => total + (c.practical_case_questions?.[0]?.count ?? 0), 0);
  const start = async (selected: PracticalCase[]) => {
    if (busy || syncing) return;
    setBusy(true); setError(null);
    try {
      const questions = await startCaseQuestions(curriculum, selected);
      onStart(questions, selected.length === 1 ? `Caso ${selected[0].case_number} · ${selected[0].title}` : 'Todos los casos prácticos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se han podido cargar los casos. Vuelve a intentarlo.');
    } finally { setBusy(false); }
  };
  return <section aria-label="Selección de casos prácticos" className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-8">
    <h2 className="text-xl font-black text-slate-900">Casos prácticos</h2>
    {totalQuestions > 0 && <p className="mt-1 text-sm font-bold text-indigo-700">{cases.length} casos · {totalQuestions} preguntas</p>}
    <p className="mt-2 text-sm text-slate-600">Elige un caso o resuélvelos todos en el orden del documento original.</p>
    {error && <p role="alert" className="my-4 text-rose-700">{error}</p>}
    <button type="button" disabled={busy || syncing} onClick={() => void start(cases)} className="my-5 w-full rounded-2xl bg-indigo-600 p-4 font-bold text-white disabled:opacity-50">{busy ? 'Cargando preguntas…' : `Todos los casos · ${cases.length} casos consecutivos`}</button>
    <div className="grid gap-3 sm:grid-cols-2">
      {cases.map(c => <button key={c.id} type="button" aria-label={`Caso ${c.case_number} ${c.title}`} disabled={busy || syncing} onClick={() => void start([c])} className="rounded-2xl border border-slate-200 p-4 text-left hover:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50">
        <span className="text-xs font-bold uppercase text-indigo-600">Caso {c.case_number}</span>
        <span className="mt-1 block font-bold text-slate-900">{c.title}</span>
        {c.practical_case_questions?.[0] && <span className="mt-1 block text-sm text-slate-600">{c.practical_case_questions[0].count} preguntas</span>}
        <span className="mt-2 block text-xs text-slate-500">Fuente original · págs. {c.source_pages.join(', ')}</span>
      </button>)}
    </div>
  </section>;
}
