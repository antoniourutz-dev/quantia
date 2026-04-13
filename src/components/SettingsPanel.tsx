import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, AlertTriangle, Save } from 'lucide-react';
import type { PracticeExamTarget } from '../types';

interface SettingsPanelProps {
  examTarget: PracticeExamTarget | null;
  saving: boolean;
  notice: { kind: 'success' | 'error'; text: string } | null;
  onSave: (next: { examDate: string | null; dailyReviewCapacity: number; dailyNewCapacity: number }) => Promise<void>;
}

const clampInt = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
};

export default function SettingsPanel({ examTarget, saving, notice, onSave }: SettingsPanelProps) {
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
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Objetivo</span>
            </div>
            <h2 className="mt-3 text-3xl font-black text-slate-900 tracking-tight">Plan de examen</h2>
            <p className="mt-2 text-slate-500 text-lg font-medium leading-relaxed">
              Esto guía el Coach y las recomendaciones diarias. Ajusta tu fecha y tu capacidad real.
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
                Fecha de examen
              </div>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
              />
              <div className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                {examDate ? `Objetivo: ${examDate}` : 'Sin fecha: el sistema optimiza por continuidad'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white px-6 py-5">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                Capacidad diaria total
              </div>
              <div className="text-4xl font-black text-slate-900">{derived.total}</div>
              <div className="mt-2 text-sm font-medium text-slate-600 leading-relaxed">
                Suma de repaso + nuevas. Úsalo como número realista que puedas sostener.
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-8 space-y-6">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                Repaso (preguntas/día)
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
                Recomendado si fallas por olvido.
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                Nuevas (preguntas/día)
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
                Recomendado si tu cobertura es baja.
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
            {saving ? 'Guardando…' : 'Guardar ajustes'}
          </button>
          <div className="flex-1 rounded-[2rem] border border-slate-100 bg-white px-6 py-5">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
              Impacto esperado
            </div>
            <div className="text-sm font-medium text-slate-600 leading-relaxed">
              El Coach prioriza repaso vs nuevas según tu cobertura, fragilidad y presión. Ajustes coherentes hacen que el
              panel deje de mostrar valores “vacíos”.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
