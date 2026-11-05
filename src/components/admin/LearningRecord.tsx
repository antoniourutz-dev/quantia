import { useEffect, useState } from 'react';
import { adminLearningRecord } from '../../lib/quantiaApi';
import { useAppLocale } from '../../lib/locale';

const sections = [
  ['sessions','Sesiones','Saioak'],['answers','Respuestas','Erantzunak'],['visits','Actividad de estudio','Ikasketa-jarduera'],
  ['legacy','Intentos del registro anterior','Aurreko saiakerak'],['notes','Notas','Oharrak'],
  ['highlights','Subrayados','Azpimarrak'],['goals','Objetivos','Helburuak'],
];
const labels:Record<string,[string,string]> = {
  started_at:['Inicio','Hasiera'],finished_at:['Fin','Amaiera'],answered_at:['Respuesta','Erantzuna'],viewed_at:['Consulta','Kontsulta'],updated_at:['Actualización','Eguneratzea'],
  curriculum:['Oposición','Oposizioa'],mode:['Modalidad','Modalitatea'],title:['Título','Izenburua'],score:['Puntuación','Puntuazioa'],total:['Total','Guztira'],
  question_id:['ID de pregunta','Galderaren IDa'],question_number:['Pregunta','Galdera'],selected_option:['Opción elegida','Aukeratutako atala'],correct_option:['Opción correcta','Aukera zuzena'],
  is_correct:['Acierto','Asmatua'],surface:['Actividad','Jarduera'],category:['Categoría','Kategoria'],content:['Nota','Oharra'],content_type:['Contenido','Edukia'],
  exam_date:['Examen','Azterketa'],daily_new_capacity:['Preguntas nuevas al día','Eguneko galdera berriak'],daily_review_capacity:['Repasos al día','Eguneko errepasoak'],
};
export default function LearningRecord({userId}:{userId:string}) {
  const eu = useAppLocale()==='eu';
  const [section,setSection]=useState('sessions');
  const [page,setPage]=useState(1);
  const [retry,setRetry]=useState(0);
  const [data,setData]=useState<Awaited<ReturnType<typeof adminLearningRecord>> | null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    setData(null); setError('');
    adminLearningRecord(userId,section,page).then(result=>{if(active)setData(result);})
      .catch(e=>{if(active)setError(e.message || String(e));});
    return ()=>{active=false;};
  },[userId,section,page,retry]);
  function format(key:string,value:unknown) {
    if(value==null)return '—';
    if(typeof value==='boolean')return value ? (eu?'Bai':'Sí') : (eu?'Ez':'No');
    if(key.endsWith('_at'))return new Date(String(value)).toLocaleString(eu?'eu-ES':'es-ES');
    return String(value);
  }
  return <section className="rounded-2xl border p-4 space-y-3">
    <h3 className="font-bold">{eu?'Ikasketa-historiala':'Historial de aprendizaje'}</h3>
    <select aria-label={eu?'Erregistroa':'Tipo de registro'} value={section} onChange={e=>{setPage(1);setSection(e.target.value);}}>
      {sections.map(([id,es,b])=><option key={id} value={id}>{eu?b:es}</option>)}
    </select>
    {error ? <p role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>{eu?'Saiatu berriro':'Reintentar'}</button></p>
      : !data ? <p>{eu?'Kargatzen…':'Cargando historial…'}</p> : <>
      <p>{data.count} {eu?'erregistro':'registros en todo el historial'}</p>
      <div className="max-h-96 overflow-y-auto">{data.rows.map((row,i)=><dl key={i} className="grid grid-cols-2 gap-1 border-t py-2 text-sm">
        {Object.entries(row).map(([k,v])=><div key={k} className="min-w-0"><dt className="text-slate-500">{labels[k]?.[eu?1:0]??k}</dt><dd className="break-words">{format(k,v)}</dd></div>)}
      </dl>)}</div>
      {data.count>20 && <div className="flex justify-between"><button disabled={page===1} onClick={()=>setPage(page-1)}>{eu?'Aurrekoa':'Anterior'}</button>
      <span>{page} / {Math.ceil(data.count/20)}</span><button disabled={page*20>=data.count} onClick={()=>setPage(page+1)}>{eu?'Hurrengoa':'Siguiente'}</button></div>}
    </>}
  </section>;
}
