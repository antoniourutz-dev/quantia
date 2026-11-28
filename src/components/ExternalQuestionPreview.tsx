import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Row = {
  origin_item_key: string; topic_number: number; topic_title: string;
  original_number: number | null; question_text: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  answer: string; explanation: string | null; law_reference: string | null;
};

export default function ExternalQuestionPreview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [topic, setTopic] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    let seq = 0;
    const refresh = async (userId?: string) => {
      const ticket = ++seq;
      setRows([]); setChoice(null); setIndex(0); setError(false);
      if (!userId) return;
      const { data, error } = await supabase.from('external_question_preview')
        .select('origin_item_key,topic_number,topic_title,original_number,question_text,option_a,option_b,option_c,option_d,answer,explanation,law_reference')
        .eq('owner_user_id', userId).order('topic_number').order('original_number').order('origin_item_key').limit(1000);
      if (!alive || ticket !== seq) return;
      if (error) { setError(true); return; }
      setRows((data ?? []) as Row[]);
    };
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        void Promise.resolve().then(() => { if (alive) void refresh(session?.user.id); });
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);
  const topics = useMemo(() => {
    const result = new Map<number, { title: string; count: number }>();
    for (const q of rows) {
      const previous = result.get(q.topic_number);
      result.set(q.topic_number, { title: q.topic_title, count: (previous?.count ?? 0) + 1 });
    }
    return Array.from(result.entries());
  }, [rows]);
  const filtered = rows.filter(q => topic === null || q.topic_number === topic);
  const current = filtered[index];
  const move = (next: number) => { setIndex(next); setChoice(null); };
  if (error) return <p role="status" className="text-sm text-slate-600">No se pudo consultar el banco externo privado.</p>;
  if (!rows.length) return null;
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
    <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between gap-3 text-left">
      <span className="font-bold text-slate-900">Externo · {rows.length} preguntas</span>
      <span className="text-sm font-semibold text-indigo-600">{open ? 'Cerrar' : 'Abrir'}</span>
    </button>
    {open && <>
      <p className="text-xs text-slate-600">Consulta privada provisional. Respuestas revisadas textualmente; cotejo visual pendiente. No se contabiliza en el progreso.</p>
      <label className="block text-sm font-semibold text-slate-700">Tema
        <select className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm" value={topic ?? ''} onChange={e => { setTopic(e.target.value ? Number(e.target.value) : null); move(0); }}>
          <option value="">Todos ({rows.length})</option>
          {topics.map(([n, t]) => <option key={n} value={n}>{n}. {t.title} ({t.count})</option>)}
        </select>
      </label>
      {current && <div className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>Tema {current.topic_number} · Externo</span><span>{index + 1} / {filtered.length}</span></div>
        <p className="font-semibold text-slate-900 whitespace-pre-wrap">{current.question_text}</p>
        <div className="grid gap-2">
          {([['A', current.option_a], ['B', current.option_b], ['C', current.option_c], ['D', current.option_d]] as const).map(([letter, value]) => <button key={letter} type="button" disabled={choice !== null} onClick={() => setChoice(letter)} className={'rounded-lg border p-3 text-left text-sm whitespace-pre-wrap ' + (choice && letter === current.answer ? 'border-emerald-500 bg-emerald-50' : choice === letter ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:bg-slate-50')}>{letter}. {value}</button>)}
        </div>
        {choice !== null && <div aria-live="polite" className="space-y-2 text-sm text-slate-700">
          <p className="font-bold">{choice === current.answer ? 'Correcta según la revisión textual.' : 'Respuesta registrada: ' + current.answer}</p>
          {current.explanation && <p className="whitespace-pre-wrap">{current.explanation}</p>}
          {current.law_reference && <p className="text-xs">{current.law_reference}</p>}
        </div>}
        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" disabled={index === 0} onClick={() => move(index - 1)}>Anterior</button>
          <button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" disabled={index >= filtered.length - 1} onClick={() => move(index + 1)}>Siguiente</button>
        </div>
      </div>}
    </>}
  </section>;
}
