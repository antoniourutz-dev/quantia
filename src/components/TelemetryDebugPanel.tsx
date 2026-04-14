import { useMemo, useState } from 'react';
import { BarChart3, Filter, ShieldAlert, X } from 'lucide-react';
import { useAppLocale } from '../lib/locale';
import { getTelemetryEvents } from '../lib/telemetry';
import type { TelemetrySurface } from '../lib/telemetry';
import { buildTelemetryReport, type TelemetryFilters } from '../lib/telemetryAnalytics';

type SortKey =
  | 'shown'
  | 'clickRate'
  | 'sessionsStarted'
  | 'sessionsCompleted'
  | 'completionRate'
  | 'returnedNextDay';

const formatPct = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function TelemetryDebugPanel({ onClose }: { onClose: () => void }) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const [filters, setFilters] = useState<TelemetryFilters>({
    surfaces: 'all',
    primaryAction: 'all',
    dominantState: 'all',
    visibleCta: '',
    sinceDays: 30,
  });
  const [sortKey, setSortKey] = useState<SortKey>('shown');

  const events = useMemo(() => getTelemetryEvents(), []);
  const report = useMemo(() => buildTelemetryReport(events, filters), [events, filters]);

  const availablePrimaryActions = useMemo(() => {
    const set = new Set<string>();
    for (const d of report.decisions) {
      if (d.primaryAction) set.add(d.primaryAction);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [report.decisions]);

  const availableStates = useMemo(() => {
    const set = new Set<string>();
    for (const d of report.decisions) {
      if (d.dominantState) set.add(d.dominantState);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [report.decisions]);

  const sortedRows = useMemo(() => {
    const rows = [...report.rows];
    const by = (row: (typeof rows)[number]) => {
      switch (sortKey) {
        case 'shown':
          return row.shown;
        case 'clickRate':
          return row.clickRate;
        case 'sessionsStarted':
          return row.sessionsStarted;
        case 'sessionsCompleted':
          return row.sessionsCompleted;
        case 'completionRate':
          return row.completionRate;
        case 'returnedNextDay':
          return row.returnedNextDay;
        default:
          return row.shown;
      }
    };
    return rows.sort((a, b) => by(b) - by(a));
  }, [report.rows, sortKey]);

  const clickRate = report.funnel.decisionsShown > 0 ? report.funnel.ctaClicked / report.funnel.decisionsShown : 0;
  const completionRate = report.funnel.decisionsShown > 0 ? report.funnel.sessionsCompleted / report.funnel.decisionsShown : 0;

  const updateSurfaces = (value: string) => {
    if (value === 'all') {
      setFilters((prev) => ({ ...prev, surfaces: 'all' }));
      return;
    }
    setFilters((prev) => ({ ...prev, surfaces: [value as TelemetrySurface] }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-[2.5rem] bg-white border border-slate-100 shadow-sm p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-slate-400">
              <ShieldAlert size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                {t('Panel interno', 'Barne panela')}
              </span>
            </div>
            <h2 className="mt-3 text-3xl font-black text-slate-900 tracking-tight">
              {t('Telemetría local', 'Tokiko telemetria')}
            </h2>
            <p className="mt-2 text-slate-500 text-lg font-medium leading-relaxed">
              {t(
                'Esto no es un panel bonito: es un cockpit para calibrar decisiones y copy con evidencia local.',
                'Hau ez da panel polit bat: tokiko ebidentziarekin erabakiak eta copy-a doitzeko cockpit bat da.',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-white border border-slate-100 shadow-sm p-8">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            <Filter size={14} />
            {t('Filtros', 'Iragazkiak')}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
              {t('Surface', 'Surface')}
            </div>
            <select
              value={filters.surfaces === 'all' ? 'all' : filters.surfaces[0]}
              onChange={(e) => updateSurfaces(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
            >
              <option value="all">{t('Todas', 'Guztiak')}</option>
              <option value="home">home</option>
              <option value="stats">stats</option>
              <option value="review">review</option>
              <option value="session_end">session_end</option>
              <option value="test">test</option>
            </select>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
              {t('Primary action', 'Primary action')}
            </div>
            <select
              value={filters.primaryAction}
              onChange={(e) => setFilters((prev) => ({ ...prev, primaryAction: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
            >
              <option value="all">{t('Todas', 'Guztiak')}</option>
              {availablePrimaryActions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
              {t('Dominant state', 'Dominant state')}
            </div>
            <select
              value={filters.dominantState}
              onChange={(e) => setFilters((prev) => ({ ...prev, dominantState: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
            >
              <option value="all">{t('Todos', 'Guztiak')}</option>
              {availableStates.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
              {t('Periodo', 'Aldia')}
            </div>
            <select
              value={String(filters.sinceDays)}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  sinceDays: e.target.value === 'all' ? 'all' : Number(e.target.value),
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
            >
              <option value="7">{t('7 días', '7 egun')}</option>
              <option value="30">{t('30 días', '30 egun')}</option>
              <option value="all">{t('Todo', 'Dena')}</option>
            </select>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
              {t('Buscar CTA', 'CTA bilatu')}
            </div>
            <input
              value={filters.visibleCta}
              onChange={(e) => setFilters((prev) => ({ ...prev, visibleCta: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
              placeholder={t('Texto visible...', 'Testu ikusgarria...')}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-[2.5rem] bg-white border border-slate-100 shadow-sm p-8 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              <BarChart3 size={14} />
              {t('Resumen ejecutivo', 'Laburpen exekutiboa')}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 px-5 py-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
                {t('Decisiones', 'Erabakiak')}
              </div>
              <div className="text-2xl font-black text-slate-900">{report.funnel.decisionsShown}</div>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-slate-50 px-5 py-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
                {t('Clicks CTA', 'CTA klikak')}
              </div>
              <div className="text-2xl font-black text-slate-900">{report.funnel.ctaClicked}</div>
              <div className="mt-1 text-xs font-bold text-slate-500">{formatPct(clickRate)}</div>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-slate-50 px-5 py-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
                {t('Sesiones iniciadas', 'Hasierak')}
              </div>
              <div className="text-2xl font-black text-slate-900">{report.funnel.sessionsStarted}</div>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-slate-50 px-5 py-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
                {t('Sesiones completas', 'Amaierak')}
              </div>
              <div className="text-2xl font-black text-slate-900">{report.funnel.sessionsCompleted}</div>
              <div className="mt-1 text-xs font-bold text-slate-500">{formatPct(completionRate)}</div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-100 bg-white px-6 py-5">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">
              {t('Funnel', 'Funnel')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {[
                { label: 'decision_shown', value: report.funnel.decisionsShown },
                { label: 'cta_clicked', value: report.funnel.ctaClicked },
                { label: 'session_started', value: report.funnel.sessionsStarted },
                { label: 'session_completed', value: report.funnel.sessionsCompleted },
                { label: 'returned_next_day', value: report.funnel.returnedNextDay ?? '—' },
              ].map((step) => (
                <div key={step.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
                    {step.label}
                  </div>
                  <div className="text-xl font-black text-slate-900">{String(step.value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white border border-slate-100 shadow-sm p-8">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">
            {t('Señales de calibración', 'Kalibrazio seinaleak')}
          </div>
          <div className="space-y-3">
            {report.signals.length === 0 ? (
              <div className="rounded-3xl border border-slate-100 bg-slate-50 px-6 py-5 text-sm font-bold text-slate-600">
                {t('Aún no hay base suficiente para observaciones útiles.', 'Oraindik ez dago oinarri nahikorik behaketa erabilgarrietarako.')}
              </div>
            ) : (
              report.signals.slice(0, 6).map((signal, index) => (
                <div
                  key={String(index)}
                  className={`rounded-3xl border px-6 py-5 ${
                    signal.kind === 'warn'
                      ? 'border-amber-100 bg-amber-50 text-amber-900'
                      : 'border-slate-100 bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="text-sm font-black">{signal.title}</div>
                  <div className="mt-2 text-sm font-medium opacity-90 leading-relaxed">{signal.detail}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-white border border-slate-100 shadow-sm p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              {t('Efectividad por decisión', 'Erabakiaren eraginkortasuna')}
            </div>
            <div className="mt-2 text-sm font-medium text-slate-500">
              {t('Cuando mostramos X, qué pasa después.', 'X erakusten dugunean, zer gertatzen da gero.')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              {t('Ordenar', 'Ordenatu')}
            </div>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
            >
              <option value="shown">{t('Más mostradas', 'Gehien erakutsi')}</option>
              <option value="clickRate">{t('Mejor click rate', 'Klik onena')}</option>
              <option value="completionRate">{t('Mejor completion', 'Amaiera onena')}</option>
              <option value="sessionsCompleted">{t('Más completadas', 'Amaiera gehien')}</option>
              <option value="returnedNextDay">{t('Mejor vuelta', 'Itzulera onena')}</option>
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-[980px] w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                <th className="pb-3">{t('Surface', 'Surface')}</th>
                <th className="pb-3">{t('Primary action', 'Primary action')}</th>
                <th className="pb-3">{t('CTA visible', 'CTA ikusgarria')}</th>
                <th className="pb-3">{t('Estado', 'Egoera')}</th>
                <th className="pb-3 text-right">{t('Shown', 'Shown')}</th>
                <th className="pb-3 text-right">{t('Clicked', 'Clicked')}</th>
                <th className="pb-3 text-right">{t('Click rate', 'Click rate')}</th>
                <th className="pb-3 text-right">{t('Started', 'Started')}</th>
                <th className="pb-3 text-right">{t('Completed', 'Completed')}</th>
                <th className="pb-3 text-right">{t('Completion', 'Completion')}</th>
                <th className="pb-3 text-right">{t('Vuelta +1d', 'Itzuli +1d')}</th>
              </tr>
            </thead>
            <tbody className="text-sm font-bold text-slate-700">
              {sortedRows.slice(0, 60).map((row, index) => (
                <tr key={String(index)} className="border-t border-slate-100">
                  <td className="py-4 pr-4">{row.surface}</td>
                  <td className="py-4 pr-4">{row.primaryAction}</td>
                  <td className="py-4 pr-4 max-w-[360px]">
                    <div className="truncate" title={row.visibleCta}>
                      {row.visibleCta}
                    </div>
                  </td>
                  <td className="py-4 pr-4">{row.dominantState}</td>
                  <td className="py-4 text-right">{row.shown}</td>
                  <td className="py-4 text-right">{row.clicked}</td>
                  <td className="py-4 text-right">{formatPct(row.clickRate)}</td>
                  <td className="py-4 text-right">{row.sessionsStarted}</td>
                  <td className="py-4 text-right">{row.sessionsCompleted}</td>
                  <td className="py-4 text-right">{formatPct(row.completionRate)}</td>
                  <td className="py-4 text-right">{row.returnedNextDay}</td>
                </tr>
              ))}
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-slate-500 font-bold">
                    {t('No hay decisiones con estos filtros.', 'Ez dago erabakirik iragazki hauekin.')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

