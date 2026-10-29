import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, AlertTriangle, Save, ListChecks, SlidersHorizontal } from 'lucide-react';
import type { PracticeExamTarget } from '../types';
import { useAppLocale } from '../lib/locale';
import type { CurriculumOption } from '../lib/quantia/types';
import { PRACTICE_MODE_IDS, type PracticeModeVisibilityId } from '../lib/practiceModeVisibility';

interface SettingsPanelProps {
  examTarget: PracticeExamTarget | null;
  saving: boolean;
  notice: { kind: 'success' | 'error'; text: string } | null;
  curriculumOptions: CurriculumOption[];
  visibleCurriculumIds: string[];
  visiblePracticeModeIds: PracticeModeVisibilityId[];
  onSave: (next: {
    examDate: string | null;
    dailyReviewCapacity: number;
    dailyNewCapacity: number;
    visibleCurriculumIds: string[];
    visiblePracticeModeIds: PracticeModeVisibilityId[];
  }) => Promise<void>;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
  onOpenTelemetry?: () => void;
}

const clampInt = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
};

export default function SettingsPanel({ examTarget, saving, notice, curriculumOptions, visibleCurriculumIds, visiblePracticeModeIds, onSave, isAdmin = false, onOpenAdmin, onOpenTelemetry }: SettingsPanelProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const telemetryEnabled = useMemo(() => {
    if (isAdmin) return true;
    try {
      if (window.localStorage.getItem('quantia.debug.telemetry') === '1') return true;
    } catch {
      void 0;
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
  const [selectedCurriculumIds, setSelectedCurriculumIds] = useState<string[]>(visibleCurriculumIds);
  const [selectedPracticeModeIds, setSelectedPracticeModeIds] = useState<PracticeModeVisibilityId[]>(visiblePracticeModeIds);

  useEffect(() => {
    setExamDate(examTarget?.examDate ?? '');
    setDailyReviewCapacity(examTarget?.dailyReviewCapacity ?? 35);
    setDailyNewCapacity(examTarget?.dailyNewCapacity ?? 10);
  }, [examTarget]);

  useEffect(() => {
    setSelectedCurriculumIds(visibleCurriculumIds);
  }, [visibleCurriculumIds]);

  useEffect(() => {
    setSelectedPracticeModeIds(visiblePracticeModeIds);
  }, [visiblePracticeModeIds]);

  const practiceModeOptions: Array<{ id: PracticeModeVisibilityId; label: string; description: string }> = [
    {
      id: 'standard',
      label: isBasque ? 'Temario bidezko testa' : 'Test por temario',
      description: isBasque ? 'Aukeratu landu nahi duzun blokea.' : 'Elige el bloque que quieres trabajar.',
    },
    {
      id: 'quick',
      label: isBasque ? 'Bloke laburra' : 'Bloque corto',
      description: isBasque ? 'Bost galderako saio azkarra.' : 'Una sesión rápida de cinco preguntas.',
    },
    {
      id: 'errors',
      label: isBasque ? 'Hutsegiteak zuzendu' : 'Corregir fallos',
      description: isBasque ? 'Gehien kostatzen direnak errepasatu.' : 'Repasa las preguntas que más cuestan.',
    },
    {
      id: 'simulacro',
      label: isBasque ? 'Simulakroa' : 'Simulacro',
      description: isBasque ? 'Erantzunak amaieran ikusi.' : 'Responde sin ver el resultado hasta el final.',
    },
    {
      id: 'custom',
      label: isBasque ? 'Zure neurrira' : 'A tu medida',
      description: isBasque ? 'Aukeratu edukia, gaia eta laguntzak.' : 'Elige contenido, tema y ayudas.',
    },
  ];
  const allPracticeModesSelected = selectedPracticeModeIds.length === PRACTICE_MODE_IDS.length;

  const derived = useMemo(() => {
    const safeReview = clampInt(dailyReviewCapacity, 5, 200);
    const safeNew = clampInt(dailyNewCapacity, 0, 100);
    const total = safeReview + safeNew;
    return { safeReview, safeNew, total };
  }, [dailyNewCapacity, dailyReviewCapacity]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-10 sm:pb-20">
      <div className="rounded-[2.25rem] border border-slate-100 bg-white p-5 shadow-sm sm:rounded-[2.5rem] sm:p-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-slate-400">
              <Calendar size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">{isBasque ? 'Helburua' : 'Objetivo'}</span>
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
              {isBasque ? 'Azterketa plana' : 'Plan de examen'}
            </h2>
            <p className="mt-2 text-base font-medium leading-relaxed text-slate-500 sm:text-lg">
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

        <div className="mt-6 rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5 sm:mt-10 sm:rounded-[2rem] sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
              <ListChecks size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {isBasque ? 'Ikusgai dauden oposizioak' : 'Oposiciones visibles'}
              </div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                {isBasque
                  ? 'Aukeratu oposizioen goitibeherako menuan agertzea nahi dituzunak.'
                  : 'Elige cuáles quieres ver en el desplegable de oposiciones.'}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {curriculumOptions.map((option) => {
              const checked = selectedCurriculumIds.includes(option.id);
              const disableOnlySelected = checked && selectedCurriculumIds.length === 1;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-white px-4 py-4 transition-colors ${
                    checked ? 'border-indigo-300 text-slate-900' : 'border-slate-100 text-slate-500'
                  } ${disableOnlySelected ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disableOnlySelected}
                    onChange={() => {
                      setSelectedCurriculumIds((current) =>
                        checked ? current.filter((id) => id !== option.id) : [...current, option.id],
                      );
                    }}
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-black">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5 sm:mt-10 sm:rounded-[2rem] sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {isBasque ? 'Praktikatzeko moduak' : 'Formas de practicar'}
              </div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                {isBasque
                  ? 'Aukeratu praktikatzeko pantailan agertzea nahi dituzun aukerak.'
                  : 'Elige las opciones que quieres ver en la pantalla de práctica.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedPracticeModeIds([...PRACTICE_MODE_IDS])}
            className={`mt-5 flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-4 text-left transition-colors ${
              allPracticeModesSelected ? 'border-violet-300 text-slate-900' : 'border-slate-100 text-slate-500'
            }`}
          >
            <span>
              <span className="block text-sm font-black">{isBasque ? 'Dena ikusi' : 'Ver todo'}</span>
              <span className="mt-1 block text-xs font-medium">
                {isBasque ? 'Praktikatzeko modu guztiak erakusten ditu.' : 'Muestra todas las formas de practicar.'}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`h-5 w-5 rounded-full border-2 ${
                allPracticeModesSelected ? 'border-violet-600 bg-violet-600 ring-4 ring-violet-100' : 'border-slate-300'
              }`}
            />
          </button>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {practiceModeOptions.map((option) => {
              const checked = selectedPracticeModeIds.includes(option.id);
              const disableOnlySelected = checked && selectedPracticeModeIds.length === 1;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-white px-4 py-4 transition-colors ${
                    checked ? 'border-violet-300 text-slate-900' : 'border-slate-100 text-slate-500'
                  } ${disableOnlySelected ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disableOnlySelected}
                    onChange={() => {
                      setSelectedPracticeModeIds((current) =>
                        checked ? current.filter((id) => id !== option.id) : [...current, option.id],
                      );
                    }}
                    className="mt-0.5 h-5 w-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span>
                    <span className="block text-sm font-black">{option.label}</span>
                    <span className="mt-1 block text-xs font-medium leading-relaxed text-slate-500">{option.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-10 md:grid-cols-2 md:gap-8">
          <div className="space-y-5 rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5 sm:rounded-[2rem] sm:p-8 sm:space-y-6">
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

            <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 sm:px-6 sm:py-5">
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

          <div className="space-y-5 rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5 sm:rounded-[2rem] sm:p-8 sm:space-y-6">
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

        <div className="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row">
          <button
            onClick={() =>
              onSave({
                examDate: examDate ? examDate : null,
                dailyReviewCapacity: derived.safeReview,
                dailyNewCapacity: derived.safeNew,
                visibleCurriculumIds: selectedCurriculumIds,
                visiblePracticeModeIds: selectedPracticeModeIds,
              })
            }
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-3 rounded-[1.75rem] bg-indigo-600 px-6 py-4 text-lg font-black text-white shadow-xl shadow-indigo-200 transition-all hover:-translate-y-1 hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none sm:rounded-[2rem] sm:py-5 sm:text-xl"
          >
            <Save size={20} />
            {saving
              ? isBasque ? 'Gordetzen...' : 'Guardando...'
              : isBasque ? 'Doikuntzak gorde' : 'Guardar ajustes'}
          </button>
          {isAdmin && onOpenAdmin ? (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="flex items-center justify-center gap-3 rounded-[1.75rem] border border-slate-100 bg-white px-6 py-4 text-base font-black text-slate-700 shadow-lg transition-all hover:bg-slate-50 sm:w-auto sm:rounded-[2rem] sm:py-5"
            >
              <span>{isBasque ? 'BD kudeaketa' : 'Gestión BD'}</span>
            </button>
          ) : null}
          {telemetryEnabled && onOpenTelemetry ? (
            <button
              type="button"
              onClick={onOpenTelemetry}
              className="flex items-center justify-center gap-3 rounded-[1.75rem] border border-slate-100 bg-white px-6 py-4 text-base font-black text-slate-700 shadow-lg transition-all hover:bg-slate-50 sm:w-auto sm:rounded-[2rem] sm:py-5"
            >
              {isBasque ? 'Telemetria' : 'Telemetría'}
            </button>
          ) : null}
          <div className="flex-1 rounded-[1.75rem] border border-slate-100 bg-white px-5 py-4 sm:rounded-[2rem] sm:px-6 sm:py-5">
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
