import { useEffect, useState } from 'react';
import { useAppLocale } from '../../lib/locale';
import { supabase } from '../../lib/supabaseClient';

type Period = { period: string; sessions: number; answered: number; correct: number; active_days: number };

export default function StudentProgress({userId}: {userId: string}) {
  const eu = useAppLocale() === 'eu';
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<Period[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setRows([]); setError('');
    void supabase.rpc('admin_student_progress', {p_student: userId, p_days: days}).then(result => {
      if (!active) return;
      if (result.error) setError(result.error.message);
      else setRows(result.data ?? []);
    });
    return () => { active = false; };
  }, [days, userId]);
  return <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
    <h3 className="font-bold">{eu ? 'Ikaslearen bilakaera' : 'Progreso del alumno'}</h3>
    <select aria-label={eu ? 'Aldia' : 'Periodo'} value={days} onChange={e => setDays(Number(e.target.value))}>
      {[7,30].map(n => <option key={n} value={n}>{eu ? 'Azken '+n+' egunak' : 'Últimos '+n+' días'}</option>)}
    </select>
    {error ? <p role="alert">{error}</p> : !rows.length ? <p>{eu ? 'Kargatzen…' : 'Cargando…'}</p> : <table className="w-full text-left text-sm">
      <thead><tr>{[eu?'Adierazlea':'Indicador',eu?'Oraingo':'Actual',eu?'Aurrekoa':'Anterior',eu?'Guztira':'Histórico'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{[
        [eu?'Amaitutako saioak':'Sesiones terminadas',(r:Period)=>r.sessions],
        [eu?'Egun aktiboak':'Días con respuestas',(r:Period)=>r.active_days],
        [eu?'Erantzunak':'Respuestas registradas',(r:Period)=>r.answered],
        [eu?'Asmatutakoak':'Aciertos',(r:Period)=>r.correct],
        [eu?'Asmatze-tasa':'Tasa de acierto',(r:Period)=>r.answered ? Math.round(100*r.correct/r.answered)+'%' : '—'],
      ].map(([label,format])=><tr className="border-t" key={String(label)}><th scope="row" className="py-2 font-medium">{String(label)}</th>{rows.map(r=><td key={r.period}>{(format as (r:Period)=>number|string)(r)}</td>)}</tr>)}</tbody>
    </table>}
  </section>;
}
