import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, RefreshCcw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const STATES = ['PENDIENTE', 'CONFLICTIVA', 'DEVUELTA', 'APROBADA_FASE04', 'RECUPERADA_FASE05'];
const PAGE_SIZE = 20;

type AuditRow = {
  id: number;
  numero_original: number | null;
  estado: string;
  respuesta_autorizada: string | null;
  updated_at: string | null;
};

export default function AdminQuality({
  onClose,
  onOpenQuestions,
  canOpenQuestions,
}: {
  onClose: () => void;
  onOpenQuestions: () => void;
  canOpenQuestions: boolean;
}) {
  const [status, setStatus] = useState('PENDIENTE');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let request = supabase.schema('app').from('osa_question_audit')
        .select('id,numero_original,estado,respuesta_autorizada,updated_at', { count: 'exact' });
      if (status !== 'TODAS') request = request.eq('estado', status);
      const { data, count: total, error: fetchError } = await request
        .order('updated_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (fetchError) throw fetchError;
      setRows((data ?? []) as AuditRow[]);
      setCount(total ?? 0);
    } catch (caught) {
      setRows([]);
      setCount(0);
      setError(caught instanceof Error ? caught.message : 'No se ha podido consultar la auditoría.');
    } finally {
      setLoading(false);
    }
  }, [page, status, revision]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <section className="mx-auto max-w-6xl space-y-6 pb-20">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button type="button" onClick={onClose}
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
            <ArrowLeft size={16} /> Volver al panel
          </button>
          <div className="flex items-center gap-3">
            <ClipboardCheck className="text-indigo-600" size={28} />
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Control de calidad</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Revisa las preguntas pendientes, conflictivas y devueltas. Los dictámenes
            se mantienen intactos: no se modifican automáticamente desde esta vista.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRevision((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCcw size={16} /> Actualizar
          </button>
          {canOpenQuestions ? <button type="button" onClick={onOpenQuestions}
            className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">
            Abrir editor de preguntas
          </button> : null}
        </div>
      </header>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex flex-col gap-1 text-sm font-bold text-slate-700">
            Estado del dictamen
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}
              className="min-w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800">
              <option value="TODAS">Todos</option>
              {STATES.map((state) => <option key={state} value={state}>{state.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <div className="text-sm text-slate-500">
            {loading ? 'Consultando…' : `${count.toLocaleString('es-ES')} registros`}
          </div>
        </div>
        {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
        {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-600" size={30} /></div> : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="py-3 pr-4">N.º original</th><th className="py-3 pr-4">Estado</th>
                  <th className="py-3 pr-4">Respuesta</th><th className="py-3">Actualización</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-4 pr-4 font-bold text-slate-900">{row.numero_original ?? '—'}</td>
                    <td className="py-4 pr-4 font-semibold text-slate-700">{row.estado.replaceAll('_', ' ')}</td>
                    <td className="py-4 pr-4 text-slate-700">{row.respuesta_autorizada ?? 'Sin confirmar'}</td>
                    <td className="py-4 text-slate-500">{row.updated_at ? new Date(row.updated_at).toLocaleDateString('es-ES') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && !error ? <p className="py-12 text-center text-sm text-slate-500">No hay registros con este filtro.</p> : null}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">Página {page + 1} de {Math.max(1, Math.ceil(count / PAGE_SIZE))}</span>
          <div className="flex gap-2">
            <button aria-label="Página anterior" type="button" disabled={loading || page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft size={18} /></button>
            <button aria-label="Página siguiente" type="button"
              disabled={loading || (page + 1) * PAGE_SIZE >= count}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
