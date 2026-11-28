import { useEffect, useState } from 'react';
import TestInterface from './TestInterface';
import { supabase } from '../lib/supabaseClient';
import { mapQuestion } from '../lib/quantiaMappers';
import { orderTopicQuestions } from '../lib/challenge';
import type { FinishedTestPayload, Question, TopicPracticeContext, OptionKey } from '../types';

type OfficialTopic = { id: string; topic_number: number; title: string };
type Topic = OfficialTopic & { own: Question[]; external: Question[] };
type ExternalRow = { origin_item_key: string; topic_number: number; original_number: number | null; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; answer: string; explanation: string | null; law_reference: string | null };
type Props = { userId: string | null; randomize: boolean; onRandomizeChange: (value: boolean) => void; onStart: (questions: Question[], title: string, topic: TopicPracticeContext) => void };

export default function C1TopicPractice({ userId, randomize, onRandomizeChange, onStart }: Props) {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [error, setError] = useState(false);
  const [externalError, setExternalError] = useState(false);
  const [session, setSession] = useState<{ label: string; questions: Question[] } | null>(null);
  const [result, setResult] = useState<{ score: number; answered: number; total: number } | null>(null);
  useEffect(() => {
    let active = true;
    setTopics(null); setError(false); setExternalError(false); setSession(null); setResult(null);
    const load = async () => {
      const [catalog, own, external] = await Promise.all([
        supabase.from('study_topics').select('id,topic_number,title').eq('curriculum_key', 'gv_adm_c1_2026').order('topic_number'),
        supabase.from('preguntas').select('*').eq('curriculum_key', 'gv_adm_c1_2026').eq('question_origin', 'own').eq('audit_status', 'approved').order('numero').limit(1000),
        supabase.from('external_question_preview').select('origin_item_key,topic_number,original_number,question_text,option_a,option_b,option_c,option_d,answer,explanation,law_reference').order('topic_number').order('original_number').order('origin_item_key').limit(1000),
      ]);
      if (!active) return;
      if (catalog.error || own.error) { setError(true); return; }
      setExternalError(Boolean(external.error));
      const mapped = (own.data ?? []).map(row => ({ topicId: row.study_topic_id, question: mapQuestion(row) }));
      const externalRows = (external.data ?? []) as ExternalRow[];
      setTopics(((catalog.data ?? []) as OfficialTopic[]).map<Topic>(t => ({
        ...t,
        own: mapped.filter(q => q.topicId === t.id && q.question?.correctAnswer != null).map(q => ({ ...q.question!, category: 'Tema ' + t.topic_number + '. ' + t.title, originLabel: 'Kuantia' as const })),
        external: externalRows.filter(q => q.topic_number === t.topic_number).map<Question>(q => ({
          id: 'external-preview:' + q.origin_item_key, number: q.original_number, text: q.question_text,
          options: [{id:'a',text:q.option_a},{id:'b',text:q.option_b},{id:'c',text:q.option_c},{id:'d',text:q.option_d}],
          correctAnswer: q.answer.toLowerCase() as OptionKey, explanation: [q.explanation,q.law_reference].filter(Boolean).join('\n\n'),
          syllabus: 'specific', category: 'Tema ' + t.topic_number + '. ' + t.title, questionScope: 'specific', originLabel: 'Externo',
        })),
      })));
    };
    void load().catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [userId]);
  const labelFor = (t: Topic) => 'Tema ' + t.topic_number + '. ' + t.title;
  const startOwn = (t: Topic) => {
    const label = labelFor(t);
    onStart(orderTopicQuestions(t.own, randomize), 'Temas · ' + label, { label, questions: t.own, randomize });
  };
  const start = (t: Topic) => {
    if (!t.external.length) { startOwn(t); return; }
    setSession({ label: labelFor(t), questions: orderTopicQuestions([...t.own, ...t.external], randomize) });
    setResult(null);
  };
  if (error) return <p role="alert" className="text-sm text-rose-700">No se han podido cargar los temas oficiales.</p>;
  if (!topics) return <p role="status" className="text-sm text-slate-600">Cargando temas oficiales…</p>;
  if (session) {
    const finish = (payload: FinishedTestPayload) => {
      setResult({ score: payload.score, answered: payload.answers.length, total: session.questions.length });
      setSession(null);
    };
    return <>
      <p className="text-xs text-slate-600">Práctica privada provisional: cotejo visual pendiente. Las respuestas, notas y subrayados de esta sesión no se guardan.</p>
      <TestInterface questions={session.questions} mode="custom" localOnly allowInSessionMistakeReview={session.questions.length > 40}
        onFinish={finish} onCancel={() => setSession(null)} />
    </>;
  }
  const total = topics.reduce((n,t)=>n+t.own.length+t.external.length,0);
  return <section className="space-y-4">
    <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-900 p-5 text-white"><h3 className="text-lg font-black">Temas oficiales · Administrativo C1</h3><p className="mt-1 text-sm text-indigo-100">{topics.length} temas · {total} preguntas disponibles</p></div>
    {result && <div role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm"><strong>Resultado de la práctica:</strong> {result.score}/{result.total} aciertos · {result.answered} respondidas. No guardado en estadísticas.</div>}
    {externalError && <p role="alert" className="text-sm text-rose-700">No se han podido cargar las preguntas externas.</p>}
    <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">Orden de las preguntas <select className="rounded-xl border border-slate-300 bg-white px-3 py-2" value={randomize?'random':'sequence'} onChange={e=>onRandomizeChange(e.target.value==='random')}><option value="sequence">En orden</option><option value="random">Aleatorio</option></select></label>
    <ul className="grid gap-3 lg:grid-cols-2">{topics.map(t => {
      const n=t.own.length+t.external.length;
      return <li key={t.id} className="rounded-2xl border border-slate-200 border-l-4 border-l-indigo-500 bg-white p-4 shadow-sm">
        <button type="button" disabled={!n} onClick={()=>start(t)} className="block w-full text-left disabled:opacity-60"><span className="block text-sm font-bold text-slate-900">{labelFor(t)}</span><span className="mt-2 block text-xs text-slate-600">{n} preguntas {n ? '· Practicar' : '· Sin preguntas disponibles'}</span></button>
        {t.own.length>0 && t.external.length>0 && <button type="button" className="mt-2 text-xs font-semibold text-indigo-700 underline" onClick={()=>startOwn(t)}>Practicar solo Kuantia (con progreso)</button>}
      </li>;
    })}</ul>
  </section>;
}
