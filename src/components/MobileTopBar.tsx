import { useMemo, useState } from 'react';
import Check from 'lucide-react/dist/esm/icons/check';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import LogOut from 'lucide-react/dist/esm/icons/log-out';
import User from 'lucide-react/dist/esm/icons/user';
import { useAppLocale } from '../lib/locale';
import type { CurriculumOption } from '../lib/quantiaApi';

export default function MobileTopBar({
  title,
  subtitle,
  statusLabel,
  dotClass,
  curriculumId,
  curriculumOptions,
  curriculumOptionsLoading,
  compact = false,
  onSelectCurriculum,
  onLogout,
}: {
  title: string;
  subtitle: string;
  statusLabel?: string | null;
  dotClass: string;
  curriculumId: string;
  curriculumOptions: CurriculumOption[];
  curriculumOptionsLoading: boolean;
  compact?: boolean;
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

  return (
    <>
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 border-b border-slate-200/80 bg-white/94 backdrop-blur-xl shadow-[0_10px_30px_-28px_rgba(15,23,42,0.45)]">
        <div
          className={`mx-auto max-w-7xl px-4 transition-[padding] duration-200 ${
            compact
              ? 'pb-2 pt-[calc(0.3rem+env(safe-area-inset-top))]'
              : 'pb-3 pt-[calc(0.55rem+env(safe-area-inset-top))]'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className={`truncate font-black tracking-tight text-slate-900 ${compact ? 'text-[1rem]' : 'text-[1.08rem]'}`}>
                {title}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] font-bold leading-none text-slate-500">
                {statusLabel ? <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} /> : null}
                {statusLabel ? <span className="truncate">{statusLabel}</span> : null}
                {statusLabel ? <span className="shrink-0 text-slate-300">/</span> : null}
                <span className="truncate">{subtitle}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label={t('Cambiar oposicion', 'Oposizioa aldatu')}
                className={`inline-flex items-center gap-2 rounded-[1.15rem] border border-indigo-100 bg-indigo-50 px-3 font-black text-indigo-700 shadow-sm shadow-indigo-100/50 transition-all ${
                  compact ? 'h-10 max-w-[8.5rem] text-[11px]' : 'h-11 max-w-[9.75rem] text-[11px]'
                }`}
              >
                <span className="min-w-0 truncate">{t('Oposición', 'Oposizioa')}</span>
                <ChevronDown size={14} className="shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                aria-label={t('Abrir cuenta', 'Kontua ireki')}
                className={`flex items-center justify-center rounded-[1.15rem] border border-slate-200 bg-white text-slate-600 shadow-sm transition-all ${
                  compact ? 'h-10 w-10' : 'h-11 w-11'
                }`}
              >
                <User size={16} />
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
          <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[2.5rem] border border-slate-200 bg-white shadow-2xl">
            <div className="px-6 pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
            </div>
            <div className="px-6 pt-5 pb-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Cuenta', 'Kontua')}</div>
              <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">{t('Acciones rapidas', 'Ekintza azkarrak')}</div>
            </div>
            <div className="px-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center justify-center gap-3 rounded-[1.75rem] border border-rose-200 bg-rose-50 px-6 py-5 text-lg font-black text-rose-700"
              >
                <LogOut size={18} />
                {t('Cerrar sesion', 'Saioa itxi')}
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
          <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[2.5rem] border border-slate-200 bg-white shadow-2xl">
            <div className="px-6 pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
            </div>
            <div className="px-6 pt-5 pb-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                {t('Selecciona oposicion', 'Hautatu oposizioa')}
              </div>
              <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">{t('Temarios', 'Temarioak')}</div>
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
                <div className="flex items-center justify-center gap-3 px-6 py-10 font-bold text-slate-500">
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
                      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left transition-all hover:bg-slate-100"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-900">{opt.label}</div>
                        <div className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{opt.id}</div>
                      </div>
                      {opt.id === curriculumId ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
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
