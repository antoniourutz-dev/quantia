import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toOptionKey } from '../lib/questionContracts';
import { syncQuestionActivity } from '../lib/questionActivity';
import type { Question } from '../types';
import { STAGES, eligibleConceptQuestions, assessStage, selectConceptSession, type ConceptQuestion, type ConceptAttempt, type OriginFilter, type Stage } from '../lib/conceptMastery';

const LABELS: Record<string,string> = { memorizar:'Memorizar', comprender:'Comprender', aplicar:'Aplicar', insufficient:'Cobertura insuficiente', pending:'Pendiente', reinforce:'Reforzar', practiced:'Practicado · falta repaso', consolidated:'Consolidado en test' };
type Topic = { id:string; title:string; topic_number:number };
const asQuestion = (r: Record<string,unknown>): ConceptQuestion | null => {
  const origin=r.question_origin, stage=r.learning_stage;
  if ((origin!=='own' && origin!=='academy' && origin!=='official') || (stage!=='memorizar'&&stage!=='comprender'&&stage!=='aplicar') || typeof r.knowledge_family_key!=='string' || typeof r.study_topic_id!=='string') return null;
  const options=(['a','b','c','d'] as const).map(id=>({id,text:String(r['opcion_'+id]??'').trim()}));
  const correctAnswer=toOptionKey(r.respuesta_correcta);
  if (!correctAnswer || options.some(o=>!o.text) || !String(r.pregunta??'').trim()) return null;
  return {id:String(r.id),number:typeof r.numero==='number'?r.numero:null,text:String(r.pregunta),options,correctAnswer,explanation:String(r.explicacion_editorial??r.explicacion??''),syllabus:'specific',category:String(r.temario_pregunta??''),questionScope:'specific',practiceSource:'editorial',studyTopicId:r.study_topic_id,conceptMetadata:{origin,family:r.knowledge_family_key,stage,section:String(r.study_section_key??'')}};
};
export default function ConceptMasteryPanel({curriculum,userId,onStart}:{curriculum:string;userId:string;onStart:(questions:Question[],title:string)=>void}) {
  const [questions,setQuestions]=useState<ConceptQuestion[]>([]);
  const [attempts,setAttempts]=useState<ConceptAttempt[]>([]);
  const [topics,setTopics]=useState<Topic[]>([]);
  const [topic,setTopic]=useState('');
  const [origin,setOrigin]=useState<OriginFilter>('all');
  const [family,setFamily]=useState('');
  const [stage,setStage]=useState<Stage|'all'>('all');
  const [count,setCount]=useState(6);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let live=true;
    setLoading(true);setError('');
    void (async()=>{
      try {
        const t=await supabase.from('study_topics').select('id,title,topic_number').eq('curriculum_key',curriculum).eq('status','published').order('topic_number');
        if(t.error)throw t.error;
        const all:ConceptQuestion[]=[];
        for(let from=0;;from+=500){
          const q=await supabase.from('preguntas').select('id,numero,pregunta,opcion_a,opcion_b,opcion_c,opcion_d,respuesta_correcta,explicacion,explicacion_editorial,temario_pregunta,question_origin,knowledge_family_key,learning_stage,study_topic_id,study_section_key').eq('curriculum',curriculum).eq('audit_status','approved').not('study_topic_id','is',null).order('id').range(from,from+499);
          if(q.error)throw q.error;
          for(const row of q.data??[]){const mapped=asQuestion(row as Record<string,unknown>);if(mapped)all.push(mapped);}
          if((q.data?.length??0)<500)break;
        }
        await syncQuestionActivity({userId,curriculum});
        const history:ConceptAttempt[]=[];
        for(let from=0;;from+=500){
          const h=await supabase.from('user_question_activity').select('question_id,session_id,answered_at,is_correct').eq('user_id',userId).eq('curriculum',curriculum).eq('mode','concept_mastery').eq('surface','test').not('answered_at','is',null).not('is_correct','is',null).order('answered_at').order('event_id').range(from,from+499);
          if(h.error)throw h.error;
          history.push(...(h.data??[]) as ConceptAttempt[]);
          if((h.data?.length??0)<500)break;
        }
        if(live){const available=(t.data??[]) as Topic[];setTopics(available);setQuestions(all);setAttempts(history);setTopic(old=>available.some(t=>t.id===old)?old:available.find(t=>all.some(q=>q.studyTopicId===t.id))?.id??available[0]?.id??'');}
      } catch {if(live)setError('No se ha podido consultar el banco autorizado o su historial. Reintenta antes de empezar.');}
      finally{if(live)setLoading(false);}
    })();
    return()=>{live=false;};
  },[curriculum,userId,revision]);
  const eligible=useMemo(()=>eligibleConceptQuestions(questions,origin,topic),[questions,origin,topic]);
  const families=useMemo(()=>[...new Set(eligible.map(q=>q.conceptMetadata.family))].sort(),[eligible]);
  const selectedFamily=families.includes(family)?family:families[0]??'';
  const selected=eligible.filter(q=>q.conceptMetadata.family===selectedFamily);
  const states=STAGES.map(s=>assessStage(selected,attempts,s));
  const batch=selectConceptSession(selected,attempts,stage,count);
  if(loading)return <section className="rounded-2xl border bg-white p-5">Cargando conceptos autorizados…</section>;
  if(error)return <section role="alert" className="rounded-2xl border bg-white p-5 space-y-3"><p>{error}</p><button type="button" className="underline" onClick={()=>setRevision(r=>r+1)}>Reintentar</button></section>;
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-5">
    <div><h3 className="text-xl font-black text-slate-900">Domina el tema</h3><p className="text-sm text-slate-600">Practica un concepto en tres fases. Los resultados son evidencia de entrenamiento, no una garantía de dominio.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-bold">Tema<select value={topic} onChange={e=>{setTopic(e.target.value);setFamily('');}} className="mt-1 w-full rounded-xl border p-3">{topics.map(t=><option key={t.id} value={t.id}>{t.topic_number}. {t.title}</option>)}</select></label>
      <label className="text-sm font-bold">Procedencia<select value={origin} onChange={e=>{setOrigin(e.target.value as OriginFilter);setFamily('');}} className="mt-1 w-full rounded-xl border p-3"><option value="all">Todas las autorizadas</option><option value="own">Propias GOLD</option><option value="academy">Academia</option></select></label>
    </div>
    {families.length===0?<p role="status" className="text-sm text-slate-600">No hay preguntas aprobadas para esta selección.</p>:<>
      <label className="block text-sm font-bold">Concepto<select value={selectedFamily} onChange={e=>setFamily(e.target.value)} className="mt-1 w-full rounded-xl border p-3">{families.map(f=><option key={f} value={f}>{f.replace(/^CE-/,'').replace(/-/g,' ')}</option>)}</select></label>
      <div className="grid gap-2 sm:grid-cols-3">{states.map(s=><div key={s.stage} className="rounded-xl border p-3"><div className="font-bold">{LABELS[s.stage]}</div><div className="text-sm">{s.correctDistinct}/{s.available} preguntas correctas distintas</div><div className="text-xs text-slate-600">{LABELS[s.state]}</div></div>)}</div>
      <p className="text-xs text-slate-600">La consolidación exige dos preguntas distintas correctas y una recuperación posterior, en otra sesión y al menos 24 horas después. Las fases sin suficiente material no se declaran superadas.</p>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Fase<select value={stage} onChange={e=>setStage(e.target.value as Stage|'all')} className="mt-1 w-full rounded-xl border p-3"><option value="all">Las tres fases</option>{STAGES.map(s=><option key={s} value={s}>{LABELS[s]}</option>)}</select></label><label className="text-sm font-bold">Máximo de preguntas<select value={count} onChange={e=>setCount(Number(e.target.value))} className="mt-1 w-full rounded-xl border p-3">{[3,6,12,20].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div>
      <button type="button" disabled={!batch.length} className="w-full rounded-xl bg-indigo-600 p-3 font-bold text-white disabled:bg-slate-300" onClick={()=>onStart(batch,'Domina el tema · '+selectedFamily)}>Empezar · {batch.length} preguntas</button>
    </>}
  </section>;
}
