import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, AlertTriangle, Save } from 'lucide-react';
import type { PracticeExamTarget } from '../types';
import { useAppLocale } from '../lib/locale';

interface SettingsPanelProps {
  examTarget: PracticeExamTarget | null;
  saving: boolean;
  notice: { kind: 'success' | 'error'; text: string } | null;
  onSave: (next: { examDate: string | null; dailyReviewCapacity: number; dailyNewCapacity: number }) => Promise<void>;
  isAdmin?: boolean;
  onOpenTelemetry?: () => void;
}

const clampInt = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
};

export default function SettingsPanel({ examTarget, saving, notice, onSave, isAdmin = false, onOpenTelemetry }: SettingsPanelProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const telemetryEnabled = useMemo(() => {
    if (isAdmin) return true;
    try {
      if (window.localStorage.getItem('quantia.debug.telemetry') === '1') return true;
    } catch {
    }
    try {
      return new URLSearchParams(window.location.search).get('telemetry') === '1';
    } catch {
      return false;
    }
  }, [isAdmin]);
  const initialExamDate = examTarget?.examDate ?? '';
  const initialDailyReview = examTarget?.dailyReviewCapacity ?? 35;
  const initialDailyNew = examTarget?.dailyNewCapacity ?? 10;

  const [examDate, setExamDate] = useState<string>(initialExamDate);
  const [dailyReviewCapacity, setDailyReviewCapacity] = useState<number>(initialDailyReview);
  const [dailyNewCapacity, setDailyNewCapacity] = useState<number>(initialDailyNew);

  useEffect(() => {
    setExamDate(examTarget?.examDate ?? '');
    setDailyReviewCapacity(examTarget?.dailyReviewCapacity ?? 35);
    setDailyNewCapacity(examTarget?.dailyNewCapacity ?? 10);
  }, [examTarget]);

  const derived = useMemo(() => {
    const safeReview = clampInt(dailyReviewCapacity, 5, 200);
    const safeNew = clampInt(dailyNewCapacity, 0, 100);
    const total = safeReview + safeNew;
    return { safeReview, safeNew, total };
  }, [dailyNewCapacity, dailyReviewCapacity]);

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-slate-400">
              <Calendar size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">{isBasque ? 'Helburua' : 'Objetivo'}</span>
            </div>
            <h2 className="mt-3 text-3xl font-black text-slate-900 tracking-tight">
              {isBasque ? 'Azterketa plana' : 'Plan de examen'}
            </h2>
            <p className="mt-2 text-slate-500 text-lg font-medium leading-relaxed">
              {isBasque
                ? 'Hemen jartzen duzu zure data eta egunean benetan egin dezakezun kopurua. Horrekin hobeto doitzen dira gomendioak.'
                : 'Aqui ajustas la fecha y la cantidad real que puedes sostener cada dia. Con eso la app afina mejor lo que te conviene hacer.'}
            </p>
          </div>
          {notice ? (
            <div
              className={`hidden md:flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold ${
                notice.kind === 'success'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                  : 'border-rose-100 bg-rose-50 text-rose-800'
              }`}
            >
              {notice.kind === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-600" />
              ) : (
                <AlertTriangle size={18} className="text-rose-600" />
              )}
              {notice.text}
            </div>
          ) : null}
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-8 space-y-6">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                {isBasque ? 'Azterketa data' : 'Fecha de examen'}
              </div>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
              />
              <div className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                {examDate
                  ? isBasque
                    ? `Helburua: ${examDate}`
                    : `Objetivo: ${examDate}`
                  : isBasque
                    ? 'Datarik gabe: aplikazioak erritmo ona mantentzea lehenesten du'
                    : 'Sin fecha: la app prioriza mantener buen ritmo'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white px-6 py-5">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                {isBasque ? 'Eguneko gaitasun osoa' : 'Capacidad diaria total'}
              </div>
              <div className="text-4xl font-black text-slate-900">{derived.total}</div>
              <div className="mt-2 text-sm font-medium text-slate-600 leading-relaxed">
                {isBasque
                  ? 'Errepasoa + berriak. Erabili benetan eutsi diezaiokezun zenbaki bat.'
                  : 'Repaso + nuevas. Usa un numero realista para no ir a tirones.'}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-8 space-y-6">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                {isBasque ? 'Errepasoa (galdera/egun)' : 'Repaso (preguntas/dia)'}
              </div>
              <input
                type="number"
                min={5}
                max={200}
                value={dailyReviewCapacity}
                onChange={(e) => setDailyReviewCapacity(Number(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
              />
              <div className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                {isBasque ? 'Igo ezazu gauzak pilatzen bazaizkizu errepasatzeko.' : 'Subelo si se te acumulan cosas por repasar.'}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                {isBasque ? 'Berriak (galdera/egun)' : 'Nuevas (preguntas/dia)'}
              </div>
              <input
                type="number"
                min={0}
                max={100}
                value={dailyNewCapacity}
                onChange={(e) => setDailyNewCapacity(Number(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
              />
              <div className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                {isBasque ? 'Igo ezazu gai berria ireki badezakezu haria galdu gabe.' : 'Subelo si puedes abrir materia nueva sin perder el hilo.'}
              </div>
            </div>
          </div>
        </div>

        {notice ? (
          <div
            className={`mt-8 md:hidden rounded-2xl border px-5 py-4 text-sm font-bold ${
              notice.kind === 'success'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                : 'border-rose-100 bg-rose-50 text-rose-800'
            }`}
          >
            {notice.text}
          </div>
        ) : null}

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <button
            onClick={() =>
              onSave({
                examDate: examDate ? examDate : null,
                dailyReviewCapacity: derived.safeReview,
                dailyNewCapacity: derived.safeNew,
              })
            }
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-3 rounded-[2rem] bg-indigo-600 px-6 py-5 text-white font-black text-xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-1 disabled:bg-slate-300 disabled:shadow-none"
          >
            <Save size={20} />
            {saving
              ? isBasque ? 'Gordetzen...' : 'Guardando...'
              : isBasque ? 'Doikuntzak gorde' : 'Guardar ajustes'}
          </button>
          {telemetryEnabled && onOpenTelemetry ? (
            <button
              type="button"
              onClick={onOpenTelemetry}
              className="sm:w-auto px-6 py-5 rounded-[2rem] bg-white text-slate-700 font-black text-base shadow-lg border border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
            >
              {isBasque ? 'Telemetria' : 'Telemetría'}
            </button>
          ) : null}
          <div className="flex-1 rounded-[2rem] border border-slate-100 bg-white px-6 py-5">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
              {isBasque ? 'Honek zer aldatzen duen' : 'Que cambia con esto'}
            </div>
            <div className="text-sm font-medium text-slate-600 leading-relaxed">
              {isBasque
                ? 'Datu hauekin aplikazioak hobeto erabakitzen du noiz komeni zaizun errepasatzea, noiz aurrera egitea eta zenbat eskatu behar dizun. Zenbat eta errealistagoa izan, orduan eta erabilgarriagoak dira gomendioak.'
                : 'Con estos datos la app decide mejor cuando te conviene repasar, cuando seguir avanzando y cuanto pedirte. Cuanto mas realista sea, mas utiles seran las recomendaciones.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
