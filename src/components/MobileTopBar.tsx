import { useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2, LogOut, ShieldCheck, User } from 'lucide-react';
import { useAppLocale } from '../lib/locale';
import type { CurriculumOption } from '../lib/quantiaApi';

export default function MobileTopBar({
  title,
  readingLabel,
  dotClass,
  curriculumLabel,
  curriculumId,
  curriculumOptions,
  curriculumOptionsLoading,
  onSelectCurriculum,
  onLogout,
}: {
  title: string;
  readingLabel: string;
  dotClass: string;
  curriculumLabel: string;
  curriculumId: string;
  curriculumOptions: CurriculumOption[];
  curriculumOptionsLoading: boolean;
  onSelectCurriculum: (next: string) => void;
  onLogout: () => void;
}) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return curriculumOptions;
    return curriculumOptions.filter((opt) => opt.label.toLowerCase().includes(q) || opt.id.toLowerCase().includes(q));
  }, [curriculumOptions, query]);

  const shortCurriculumLabel = useMemo(() => {
    const base = (curriculumLabel || '').trim();
    const lower = base.toLowerCase();
    if (!base) return base;
    if (lower.includes('auxiliar')) return 'Aux.';
    if (lower.includes('administrativo')) return 'Adm.';
    if (lower.includes('leyes')) return 'Leyes';
    if (lower.includes('general')) return 'Gen.';
    if (base.length <= 10) return base;
    const first = base.split(/\s+/)[0] ?? base;
    const cut = first.slice(0, 4);
    return `${cut}.`;
  }, [curriculumLabel]);

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/92 backdrop-blur-xl border-b border-slate-200">
        <div className="px-4 pt-[calc(0.4rem+env(safe-area-inset-top))] pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-900 truncate">
                {title}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                className="h-10 w-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600"
              >
                <User size={16} />
              </button>
              <div
                title={readingLabel}
                className="relative h-10 w-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center"
              >
                <ShieldCheck size={16} className="text-slate-600" />
                <span className={`absolute top-2 right-2 h-2 w-2 ${dotClass} rounded-full`} />
              </div>

              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                title={curriculumLabel}
                className="h-10 max-w-[9.5rem] rounded-2xl border border-indigo-100 bg-indigo-50 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700 inline-flex items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate">{shortCurriculumLabel}</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {accountOpen ? (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setAccountOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-hidden="true"
          />
          <div className="absolute left-0 right-0 bottom-0 rounded-t-[2.5rem] border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                {t('Cuenta', 'Kontua')}
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">
                {t('Acciones', 'Ekintzak')}
              </div>
            </div>
            <div className="px-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(false);
                  onLogout();
                }}
                className="w-full rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-5 text-rose-700 font-black text-lg flex items-center justify-center gap-3"
              >
                <LogOut size={18} />
                {t('Cerrar sesión', 'Saioa itxi')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sheetOpen ? (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-hidden="true"
          />
          <div className="absolute left-0 right-0 bottom-0 rounded-t-[2.5rem] border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                {t('Selecciona oposición', 'Hautatu oposizioa')}
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">
                {t('Temarios', 'Temarioak')}
              </div>
              <div className="mt-4">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder={t('Buscar...', 'Bilatu...')}
                />
              </div>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {curriculumOptionsLoading ? (
                <div className="px-6 py-10 text-slate-500 flex items-center justify-center gap-3 font-bold">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('Cargando...', 'Kargatzen...')}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onSelectCurriculum(opt.id);
                        setSheetOpen(false);
                        setQuery('');
                      }}
                      className="w-full flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 hover:bg-slate-100 transition-all"
                    >
                      <div className="min-w-0 text-left">
                        <div className="text-sm font-black text-slate-900 truncate">{opt.label}</div>
                        <div className="mt-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 truncate">{opt.id}</div>
                      </div>
                      {opt.id === curriculumId ? (
                        <div className="h-10 w-10 rounded-2xl border border-emerald-200 bg-emerald-50 flex items-center justify-center">
                          <Check className="h-5 w-5 text-emerald-700" />
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
