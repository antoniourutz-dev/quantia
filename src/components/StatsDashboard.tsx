import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Filter,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { TestResult } from '../types';
import { DashboardBundle } from '../lib/quantiaApi';
import {
  formatLongDate,
  formatMonthYear,
  getCalendarWeekdayLabels,
  getIntlLocale,
  useAppLocale,
} from '../lib/locale';

interface StatsDashboardProps {
  results: TestResult[];
  bundle: DashboardBundle | null;
  levelLabel?: string;
}

export default function StatsDashboard({
  results,
  bundle,
  levelLabel = 'Preparacion activa',
}: StatsDashboardProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const totalQuestions = results.reduce((acc, curr) => acc + curr.total, 0);
  const correctAnswers = results.reduce((acc, curr) => acc + curr.score, 0);
  const readiness = Math.round((bundle?.practiceState.learningDashboardV2?.examReadinessRate ?? 0) * 100);
  const coverage = Math.round((bundle?.practiceState.learningDashboardV2?.coverageRate ?? 0) * 100);
  const learningAccuracy = Math.round((bundle?.practiceState.pressureInsightsV2?.learningAccuracy ?? 0) * 100);
  const simulacroAccuracy = Math.round((bundle?.practiceState.pressureInsightsV2?.simulacroAccuracy ?? 0) * 100);
  const pressureGap = Math.round((bundle?.practiceState.pressureInsightsV2?.pressureGapRaw ?? 0) * 100);

  const modeMap = new Map<string, number>();
  for (const result of results) modeMap.set(result.label, (modeMap.get(result.label) ?? 0) + 1);
  const modeData = [...modeMap.entries()].map(([name, value]) => ({ name, value }));

  const groupedSessions = useMemo(() => {
    const dayGroups = new Map<string, Map<string, { score: number; total: number; count: number }>>();
    for (const result of results) {
      if (!dayGroups.has(result.date)) dayGroups.set(result.date, new Map());
      const typeMap = dayGroups.get(result.date)!;
      const current = typeMap.get(result.label) ?? { score: 0, total: 0, count: 0 };
      typeMap.set(result.label, {
        score: current.score + result.score,
        total: current.total + result.total,
        count: current.count + 1,
      });
    }
    return [...dayGroups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, typeMap]) => ({
        date,
        types: [...typeMap.entries()].map(([label, stats]) => ({
          label,
          totalSessions: stats.count,
          totalScore: stats.score,
          totalQuestions: stats.total,
          percentage: stats.total > 0 ? (stats.score / stats.total) * 100 : 0,
        })),
      }));
  }, [results]);

  const parseIsoDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, Math.max(0, m - 1), d);
  };

  const toIsoDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const daySummaryMap = useMemo(() => {
    const map = new Map<string, {
      totalSessions: number;
      totalQuestions: number;
      totalCorrect: number;
      accuracy: number;
      types: Array<{ label: string; totalSessions: number; totalScore: number; totalQuestions: number; percentage: number }>;
    }>();
    for (const day of groupedSessions) {
      const totalSessions = day.types.reduce((acc, item) => acc + item.totalSessions, 0);
      const totalQuestions = day.types.reduce((acc, item) => acc + item.totalQuestions, 0);
      const totalCorrect = day.types.reduce((acc, item) => acc + item.totalScore, 0);
      map.set(day.date, {
        totalSessions,
        totalQuestions,
        totalCorrect,
        accuracy: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
        types: day.types,
      });
    }
    return map;
  }, [groupedSessions]);

  const dailyTrendData = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(getIntlLocale(locale), { day: '2-digit', month: 'short' });
    return [...daySummaryMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([iso, summary]) => ({
        name: formatter.format(parseIsoDate(iso)),
        score: Math.round(summary.accuracy),
      }));
  }, [daySummaryMap, locale]);

  const initialCalendarMonth = useMemo(() => {
    const base = groupedSessions[0]?.date ? parseIsoDate(groupedSessions[0].date) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [groupedSessions]);

  const [calendarMonth, setCalendarMonth] = useState(initialCalendarMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(groupedSessions[0]?.date ?? null);

  useEffect(() => {
    setCalendarMonth(initialCalendarMonth);
  }, [initialCalendarMonth]);

  useEffect(() => {
    if (!selectedDate && groupedSessions[0]?.date) setSelectedDate(groupedSessions[0].date);
  }, [groupedSessions, selectedDate]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const weekdayIndex = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - weekdayIndex);
    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
      return { iso: toIsoDate(current), date: current, inMonth: current.getMonth() === month };
    });
  }, [calendarMonth]);

  const selectedDaySummary = selectedDate ? daySummaryMap.get(selectedDate) ?? null : null;
  const weekdayLabels = getCalendarWeekdayLabels(locale);
  const calendarLabel = formatMonthYear(calendarMonth, locale);
  const colors = ['#4f46e5', '#10b981', '#f97316', '#ef4444', '#0ea5e9'];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-2 rounded-[3rem] bg-[#0a0a1a] text-white p-8 md:p-10 relative overflow-hidden border border-white/5">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-[360px] h-[360px] rounded-full bg-indigo-600/30 blur-[120px]" />
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-[260px] h-[260px] rounded-full bg-emerald-500/20 blur-[100px]" />
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">
              <Zap size={12} />
              {t('Preparacion', 'Prestaketa')}
            </div>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <p className="text-sm font-bold text-indigo-200/80 uppercase tracking-widest mb-2">{t('Prediccion de exito', 'Arrakasta iragarpena')}</p>
                <div className="text-6xl font-black tracking-tighter">{readiness}%</div>
              </div>
              <div className="rounded-[2rem] bg-white/5 border border-white/10 px-5 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300 mb-2">{t('Cobertura', 'Estaldura')}</div>
                <div className="text-3xl font-black">{coverage}%</div>
              </div>
            </div>
            <div className="rounded-[2rem] bg-white/5 border border-white/10 px-6 py-5 text-indigo-50/85 text-sm leading-relaxed font-medium">
              {isBasque
                ? 'Prestaketaren irakurketa hau zure jarduera errealetik eraikitzen ari da.'
                : bundle?.practiceState.learningDashboardV2?.focusMessage ?? 'Todavia no hay una lectura suficiente del progreso.'}
            </div>
          </div>
        </div>

        {[{
          label: t('Sesiones', 'Saioak'),
          value: results.length,
          icon: Calendar,
        }, {
          label: t('Preguntas', 'Galderak'),
          value: totalQuestions,
          icon: Target,
        }, {
          label: t('Aciertos', 'Asmatzeak'),
          value: correctAnswers,
          icon: CheckCircle2,
        }, {
          label: t('Rango actual', 'Uneko maila'),
          value: levelLabel,
          icon: TrendingUp,
        }].map((item) => (
          <div key={item.label} className="rounded-[2.5rem] bg-white border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                <item.icon size={20} />
              </div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{item.label}</div>
            <div className="text-3xl font-black text-slate-900 break-words">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-[2.5rem] bg-white border border-slate-100 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-black text-slate-900">{t('Evolucion del rendimiento', 'Errendimenduaren bilakaera')}</h3>
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500">
              <Filter size={14} />
              {t('Ultimos 10 dias', 'Azken 10 egunak')}
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrendData}>
                <defs>
                  <linearGradient id="statsTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                <Tooltip />
                <Area type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={3} fill="url(#statsTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white border border-slate-100 p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">{t('Presion', 'Presioa')}</h3>
            <div className={`rounded-2xl p-3 ${pressureGap < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('Entrenamiento', 'Entrenamendua')}</div>
              <div className="text-3xl font-black text-slate-900">{learningAccuracy}%</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('Simulacro', 'Simulakroa')}</div>
              <div className="text-3xl font-black text-slate-900">{simulacroAccuracy}%</div>
            </div>
          </div>
          <div className={`rounded-[2rem] border p-5 ${pressureGap < 0 ? 'border-rose-100 bg-rose-50 text-rose-900' : 'border-emerald-100 bg-emerald-50 text-emerald-900'}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] mb-2">{t('Gap de presion', 'Presio arrakala')}</div>
            <div className="text-4xl font-black mb-2">{pressureGap}%</div>
            <div className="text-sm font-medium leading-relaxed">
              {isBasque
                ? 'Presiopeko portaera neurtzeko entrenamenduaren eta simulakroen arteko aldea erabiltzen da.'
                : bundle?.practiceState.pressureInsightsV2?.pressureMessage ?? 'Todavia faltan mas datos para medir bien la presion.'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="rounded-[2.5rem] bg-white border border-slate-100 p-8 shadow-sm xl:col-span-1">
          <h3 className="text-2xl font-black text-slate-900 mb-6">{t('Estrategia de estudio', 'Ikasketa estrategia')}</h3>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={modeData} dataKey="value" cx="50%" cy="50%" innerRadius={54} outerRadius={80} paddingAngle={6}>
                  {modeData.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-6">
            {modeData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colors[index % colors.length] }} />
                  <span className="text-sm font-bold text-slate-700 truncate">{entry.name}</span>
                </div>
                <span className="text-sm font-black text-slate-900 shrink-0">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white border border-slate-100 p-8 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-black text-slate-900">{t('Registro de sesiones', 'Saioen erregistroa')}</h3>
              <p className="text-sm font-medium text-slate-500 mt-1">{t('Calendario y resumen diario', 'Egutegia eta eguneroko laburpena')}</p>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-8 text-slate-500">
              {t('Aun no hay sesiones registradas.', 'Oraindik ez dago saiorik erregistratuta.')}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
              <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
                <div className="flex items-center justify-between mb-5">
                  <button onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="w-10 h-10 rounded-xl border border-slate-100 bg-white flex items-center justify-center text-slate-600">
                    <ChevronLeft size={18} />
                  </button>
                  <div className="text-center">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Calendario', 'Egutegia')}</div>
                    <div className="text-lg font-black text-slate-900">{calendarLabel}</div>
                  </div>
                  <button onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="w-10 h-10 rounded-xl border border-slate-100 bg-white flex items-center justify-center text-slate-600">
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-2 mb-3">
                  {weekdayLabels.map((day) => (
                    <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarCells.map((cell) => {
                    const summary = daySummaryMap.get(cell.iso);
                    const isSelected = selectedDate === cell.iso;
                    return (
                      <button
                        key={cell.iso}
                        onClick={() => setSelectedDate(cell.iso)}
                        className={`h-11 rounded-xl border flex items-center justify-center text-sm font-black transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : summary
                              ? 'border-indigo-200 bg-white text-slate-800'
                              : 'border-slate-100 bg-white text-slate-300'
                        } ${cell.inMonth ? '' : 'opacity-50'}`}
                      >
                        {cell.date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
                {!selectedDaySummary || !selectedDate ? (
                  <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 text-slate-500">
                    {t('Selecciona un dia con actividad para ver el detalle.', 'Hautatu jardueradun egun bat xehetasuna ikusteko.')}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{t('Resumen del dia', 'Eguneko laburpena')}</div>
                        <div className="text-2xl font-black text-slate-900">{formatLongDate(parseIsoDate(selectedDate), locale)}</div>
                      </div>
                      <div className="rounded-[1.5rem] bg-white border border-slate-100 px-5 py-4 text-right">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">{t('Acierto global', 'Asmatze orokorra')}</div>
                        <div className="text-3xl font-black text-indigo-600">{selectedDaySummary.accuracy.toFixed(0)}%</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[{
                        label: t('Sesiones', 'Saioak'),
                        value: selectedDaySummary.totalSessions,
                      }, {
                        label: t('Preguntas', 'Galderak'),
                        value: selectedDaySummary.totalQuestions,
                      }, {
                        label: t('Aciertos', 'Asmatzeak'),
                        value: selectedDaySummary.totalCorrect,
                      }].map((item) => (
                        <div key={item.label} className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
                          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{item.label}</div>
                          <div className="text-3xl font-black text-slate-900">{item.value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      {selectedDaySummary.types.map((typeGroup) => (
                        <div key={`${selectedDate}-${typeGroup.label}`} className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                              <div className="text-sm font-black text-slate-900">{typeGroup.label}</div>
                              <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">
                                {typeGroup.totalSessions} {typeGroup.totalSessions === 1 ? t('sesion', 'saio') : t('sesiones', 'saio')}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 min-w-[180px]">
                              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div className={`h-full ${typeGroup.percentage >= 80 ? 'bg-emerald-500' : typeGroup.percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${typeGroup.percentage}%` }} />
                              </div>
                              <div className="text-lg font-black text-slate-900">{typeGroup.percentage.toFixed(0)}%</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
