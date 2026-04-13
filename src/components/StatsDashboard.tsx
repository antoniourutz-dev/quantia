import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
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
  Info,
  Layers,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { TestResult } from '../types';
import { DashboardBundle } from '../lib/quantiaApi';

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
  // 1. Basic metrics
  const totalQuestions = results.reduce((acc, curr) => acc + curr.total, 0);
  const correctAnswers = results.reduce((acc, curr) => acc + curr.score, 0);

  // 2. Readiness Score (Success Probability)
  const readiness = bundle?.practiceState.learningDashboardV2?.examReadinessRate ?? 0;
  const readinessCiLow = bundle?.practiceState.learningDashboardV2?.examReadinessCiLow ?? 0;
  const readinessCiHigh = bundle?.practiceState.learningDashboardV2?.examReadinessCiHigh ?? 0;
  const readinessConfidence = bundle?.practiceState.learningDashboardV2?.examReadinessConfidenceFlag ?? 'low';

  // 3. Pressure Insights (Learning vs Simulacro)
  const learningAccuracy = bundle?.practiceState.pressureInsightsV2?.learningAccuracy ?? 0;
  const simulacroAccuracy = bundle?.practiceState.pressureInsightsV2?.simulacroAccuracy ?? 0;
  const pressureGap = bundle?.practiceState.pressureInsightsV2?.pressureGapRaw ?? 0;
  const hasPressureData = bundle?.practiceState.pressureInsightsV2?.sampleOk ?? false;

  // 4. Topic Mastery (Radar Data)
  const topicData = (bundle?.practiceState.learningDashboardV2?.topicBreakdown ?? [])
    .slice(0, 6)
    .map((topic) => ({
      subject: topic.topicLabel.length > 15 ? `${topic.topicLabel.substring(0, 12)}...` : topic.topicLabel,
      A: Math.round(topic.accuracyRate * 100),
      fullMark: 100,
    }));

  // 5. Mode Distribution
  const modeMap = new Map<string, number>();
  for (const result of results) {
    modeMap.set(result.label, (modeMap.get(result.label) ?? 0) + 1);
  }
  const modeData = [...modeMap.entries()].map(([name, value]) => ({ name, value }));

  // 6. Trend Data (Last 10 sessions)
  const trendData = results.slice(0, 10).reverse().map((result, index) => ({
    name: `S${index + 1}`,
    score: Math.round((result.score / Math.max(1, result.total)) * 100),
  }));

  // 7. Group sessions by day and type (calculating averages)
  const groupedSessions = useMemo(() => {
    const dayGroups = new Map<string, Map<string, { totalScore: number; totalQuestions: number; count: number }>>();
    
    for (const result of results) {
      const date = result.date;
      const type = result.label;
      
      if (!dayGroups.has(date)) {
        dayGroups.set(date, new Map());
      }
      
      const typeMap = dayGroups.get(date)!;
      const current = typeMap.get(type) ?? { totalScore: 0, totalQuestions: 0, count: 0 };
      
      typeMap.set(type, {
        totalScore: current.totalScore + result.score,
        totalQuestions: current.totalQuestions + result.total,
        count: current.count + 1
      });
    }

    // Convert to a sortable structure
    return [...dayGroups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, typeMap]) => ({
        date,
        types: [...typeMap.entries()].map(([label, stats]) => ({
          label,
          totalScore: stats.totalScore,
          totalQuestions: stats.totalQuestions,
          avgScore: stats.totalScore / stats.count,
          avgTotal: stats.totalQuestions / stats.count,
          totalSessions: stats.count,
          percentage: (stats.totalScore / stats.totalQuestions) * 100
        }))
      }));
  }, [results]);

  const toIsoDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const parseIsoDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map((value) => Number(value));
    return new Date(y, Math.max(0, m - 1), d);
  };

  const sessionCalendarByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        totalSessions: number;
        totalQuestions: number;
        totalCorrect: number;
        accuracy: number;
        types: Array<{
          label: string;
          totalSessions: number;
          totalScore: number;
          totalQuestions: number;
          avgScore: number;
          avgTotal: number;
          percentage: number;
        }>;
      }
    >();

    for (const day of groupedSessions) {
      const totalSessions = day.types.reduce((acc, curr) => acc + curr.totalSessions, 0);
      const totalQuestions = day.types.reduce((acc, curr) => acc + curr.totalQuestions, 0);
      const totalCorrect = day.types.reduce((acc, curr) => acc + curr.totalScore, 0);
      const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

      map.set(day.date, {
        date: day.date,
        totalSessions,
        totalQuestions,
        totalCorrect,
        accuracy,
        types: day.types,
      });
    }

    return map;
  }, [groupedSessions]);

  const initialCalendarMonth = useMemo(() => {
    const reference = groupedSessions[0]?.date ? parseIsoDate(groupedSessions[0].date) : new Date();
    return new Date(reference.getFullYear(), reference.getMonth(), 1);
  }, [groupedSessions]);

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => initialCalendarMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => groupedSessions[0]?.date ?? null);

  useEffect(() => {
    setCalendarMonth(initialCalendarMonth);
  }, [initialCalendarMonth]);

  useEffect(() => {
    if (!selectedDate && groupedSessions[0]?.date) {
      setSelectedDate(groupedSessions[0].date);
    }
  }, [groupedSessions, selectedDate]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const weekdayIndex = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - weekdayIndex);

    const cells: Array<{ iso: string; date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i += 1) {
      const current = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const iso = toIsoDate(current);
      cells.push({ iso, date: current, inMonth: current.getMonth() === month });
    }
    return cells;
  }, [calendarMonth]);

  const calendarLabel = useMemo(() => {
    const label = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(calendarMonth);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [calendarMonth]);

  const selectedDaySummary = selectedDate ? sessionCalendarByDate.get(selectedDate) ?? null : null;

  const colors = ['#4f46e5', '#10b981', '#f97316', '#ef4444', '#0ea5e9'];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-20">
      {/* SECTION 1: HIGH-LEVEL INTELLIGENCE (Decision Engine style) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Readiness Score Card */}
        <div className="lg:col-span-2 bg-[#0a0a1a] rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-12 text-white shadow-premium-xl relative overflow-hidden border border-white/5 group hover-lift">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-[600px] h-[600px] bg-indigo-600 rounded-full blur-[140px] opacity-20 group-hover:opacity-40 transition-opacity duration-1000 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-[400px] h-[400px] bg-emerald-600 rounded-full blur-[120px] opacity-10 group-hover:opacity-30 transition-opacity duration-1000"></div>
          
          <div className="relative z-10 flex flex-col xl:flex-row items-center gap-8 md:gap-16">
            <div className="relative flex-shrink-0 animate-float-slow">
              {/* Custom Circular Progress - Premium Style */}
              <div className="relative group/circle">
                <svg
                  className="w-48 h-48 md:w-64 md:h-64 transform -rotate-90 drop-shadow-[0_0_30px_rgba(79,70,229,0.4)]"
                  viewBox="0 0 256 256"
                >
                  <circle
                    cx="128"
                    cy="128"
                    r="115"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-white/5"
                  />
                  <circle
                    cx="128"
                    cy="128"
                    r="115"
                    stroke="url(#grad_premium)"
                    strokeWidth="14"
                    fill="transparent"
                    strokeDasharray={722.5}
                    strokeDashoffset={722.5 * (1 - readiness)}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="grad_premium" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="50%" stopColor="#4f46e5" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl md:text-7xl font-black tracking-tighter text-white drop-shadow-lg">{Math.round(readiness * 100)}%</span>
                  <span className="text-[8px] md:text-[10px] font-black text-indigo-300 uppercase tracking-[0.4em] mt-1 md:mt-2 text-center px-4">PREDICCIÓN ÉXITO</span>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-6 md:space-y-10 text-center xl:text-left">
              <div>
                <div className="inline-flex items-center gap-2 px-4 md:px-5 py-1.5 md:py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-[8px] md:text-[10px] font-black tracking-[0.3em] text-indigo-300 mb-4 md:mb-8 uppercase premium-shimmer">
                  <Zap size={12} className="md:w-3.5 md:h-3.5 fill-indigo-400/20" />
                  NEURAL ANALYSIS v2.0
                </div>
                <h2 className="text-3xl md:text-5xl font-black leading-[1.1] mb-4 md:mb-6 tracking-tight">
                  Nivel de preparación <br className="hidden md:block"/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-emerald-300">
                    {readiness >= 0.8 ? 'ÉLITE ABSOLUTA' : readiness >= 0.6 ? 'CONSISTENCIA ALTA' : 'CRECIMIENTO EXPONENCIAL'}
                  </span>
                </h2>
                <p className="text-indigo-100/60 text-base md:text-xl leading-relaxed font-medium max-w-xl mx-auto xl:mx-0">
                  {bundle?.practiceState.learningDashboardV2?.focusMessage ?? 
                    'Tu patrón de respuestas indica una asimilación profunda del temario común.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
                <div className="bg-white/5 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-white/5 backdrop-blur-xl hover:bg-white/10 transition-colors group/card">
                  <p className="text-[8px] md:text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-2 md:mb-3">Margen de Error</p>
                  <p className="text-2xl md:text-3xl font-black group-hover:scale-110 transition-transform origin-left">
                    ±{Math.round((readinessCiHigh - readinessCiLow) * 50)}%
                  </p>
                </div>
                <div className="bg-white/5 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-white/5 backdrop-blur-xl hover:bg-white/10 transition-colors group/card">
                  <p className="text-[8px] md:text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-2 md:mb-3">Nivel Confianza</p>
                  <div className="flex items-center justify-center xl:justify-start gap-3 md:gap-4">
                    <div className="relative">
                      <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full ${
                        readinessConfidence === 'high' ? 'bg-emerald-400 shadow-glow-emerald' : 
                        readinessConfidence === 'medium' ? 'bg-amber-400 shadow-glow-amber' : 'bg-rose-400 shadow-glow-rose'
                      }`} />
                      <div className={`absolute inset-0 w-3 h-3 md:w-4 md:h-4 rounded-full animate-ping ${
                        readinessConfidence === 'high' ? 'bg-emerald-400/50' : 
                        readinessConfidence === 'medium' ? 'bg-amber-400/50' : 'bg-rose-400/50'
                      }`} />
                    </div>
                    <p className="text-2xl md:text-3xl font-black capitalize group-hover:translate-x-1 transition-transform">{readinessConfidence}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Context Card */}
        <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-premium-xl flex flex-col justify-between hover-lift">
          <div>
            <div className="flex items-center justify-between mb-12">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Métricas Core</h3>
              <div className="p-4 bg-slate-50 text-slate-400 rounded-[1.5rem] hover:rotate-12 transition-transform">
                <Target size={24} />
              </div>
            </div>
            
            <div className="space-y-8">
              <div className="flex items-end justify-between">
                <div className="group/metric">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sesiones</p>
                  <p className="text-5xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{results.length}</p>
                </div>
                <div className="text-right group/metric">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Preguntas</p>
                  <p className="text-5xl font-black text-slate-800 group-hover:text-emerald-600 transition-colors">{totalQuestions}</p>
                </div>
              </div>

              <div className="pt-10 border-t border-slate-50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Cobertura Total</span>
                  <span className="text-lg font-black text-indigo-600">
                    {Math.round((bundle?.practiceState.learningDashboardV2?.coverageRate ?? 0) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-indigo-700 h-full transition-all duration-1000 ease-out" 
                    style={{ width: `${(bundle?.practiceState.learningDashboardV2?.coverageRate ?? 0) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 p-6 bg-emerald-50/50 rounded-[2rem] text-emerald-800 border border-emerald-100 group">
                <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:rotate-12 transition-transform">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-600/60 mb-1">Aciertos Totales</p>
                  <p className="text-2xl font-black leading-tight">
                    {correctAnswers} <span className="text-sm font-bold opacity-60">respuestas</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-10 border-t border-slate-50 flex items-center justify-between">
            <span className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">Rango Actual</span>
            <span className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs uppercase tracking-[0.3em] shadow-glow-indigo">
              {levelLabel}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: DEEP ANALYSIS (Visualizations) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Radar Mastery Chart */}
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-6 md:mb-10">
            <div>
              <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Dominio por categoría</h3>
              <p className="text-sm md:text-slate-500 font-medium mt-1">Visualización del equilibrio en tu preparación</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
              <Layers size={24} />
            </div>
          </div>
          
          <div className="h-[300px] md:h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={topicData}>
                <PolarGrid stroke="#f1f5f9" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Acierto %"
                  dataKey="A"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  fill="#4f46e5"
                  fillOpacity={0.15}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e1b4b', 
                    border: 'none', 
                    borderRadius: '16px', 
                    color: '#fff',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pressure Analysis Card */}
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
          <div className="flex justify-between items-start mb-6 md:mb-10">
            <div>
              <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Análisis bajo presión</h3>
              <p className="text-sm md:text-slate-500 font-medium mt-1">Diferencia entre entrenamiento y simulacro</p>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
              <TrendingUp size={24} />
            </div>
          </div>

          <div className="flex-1 space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-2 md:space-y-3">
                <p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest">Entrenamiento</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-black text-slate-800">{Math.round(learningAccuracy * 100)}%</span>
                  <span className="text-xs md:text-sm font-bold text-slate-400">media</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 md:h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full" style={{ width: `${learningAccuracy * 100}%` }} />
                </div>
              </div>
              <div className="space-y-2 md:space-y-3">
                <p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest">Simulacro</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-black text-slate-800">{Math.round(simulacroAccuracy * 100)}%</span>
                  <span className="text-xs md:text-sm font-bold text-slate-400">media</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 md:h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full" style={{ width: `${simulacroAccuracy * 100}%` }} />
                </div>
              </div>
            </div>

            <div className={`p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-2 transition-all duration-500 ${
              pressureGap <= -0.1 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
            }`}>
              <div className="flex items-start gap-3 md:gap-4">
                <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl shrink-0 ${
                  pressureGap <= -0.1 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                }`}>
                  <AlertTriangle size={20} className="md:w-6 md:h-6" />
                </div>
                <div>
                  <h4 className={`text-lg md:text-xl font-black mb-1 md:mb-2 ${
                    pressureGap <= -0.1 ? 'text-rose-900' : 'text-emerald-900'
                  }`}>
                    Gap de presión: {Math.round(pressureGap * 100)}%
                  </h4>
                  <p className={`text-sm md:text-base font-medium leading-relaxed ${
                    pressureGap <= -0.1 ? 'text-rose-700/80' : 'text-emerald-700/80'
                  }`}>
                    {bundle?.practiceState.pressureInsightsV2?.pressureMessage ?? 
                      'Tu rendimiento es consistente entre modos de práctica.'}
                  </p>
                </div>
              </div>
            </div>

            {!hasPressureData && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl text-slate-500 border border-slate-100">
                <Info size={18} />
                <p className="text-xs font-bold leading-tight">
                  Realiza más simulacros para obtener una lectura precisa de tu comportamiento bajo presión.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: RECENT TRENDS & ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Trend Chart */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Evolución del rendimiento</h3>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-xs font-bold text-slate-500 border border-slate-100">
              <Filter size={14} />
              Últimas 10 sesiones
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                  domain={[0, 100]}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e1b4b',
                    border: 'none',
                    borderRadius: '16px',
                    color: '#fff',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  }}
                  itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#4f46e5"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorScore)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mode Distribution (Pie) */}
        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-8">Estrategia de estudio</h3>
          <div className="h-[200px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={modeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {modeData.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #f1f5f9',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-8">
            {modeData.map((entry, index) => (
              <div
                key={entry.name}
                className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <span className="text-sm font-bold text-slate-700">{entry.name}</span>
                </div>
                <span className="text-sm font-black text-slate-900">{entry.value} sesiones</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 4: DETAILED HISTORY */}
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Registro de sesiones</h3>
            <p className="text-xs md:text-sm text-slate-400 font-medium mt-1 uppercase tracking-widest">
              Calendario de estudio y resumen diario
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
            <Calendar size={16} />
            Días activos
          </div>
        </div>

        {results.length === 0 ? (
          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-10 text-slate-500">
            Aún no hay sesiones registradas. Completa un test para ver tu calendario de estudio.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                  className="w-11 h-11 rounded-xl bg-white border border-slate-100 text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="text-center">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    Calendario
                  </div>
                  <div className="text-lg font-black text-slate-800">{calendarLabel}</div>
                </div>
                <button
                  onClick={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                  className="w-11 h-11 rounded-xl bg-white border border-slate-100 text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-3">
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                  <div
                    key={day}
                    className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((cell) => {
                  const summary = sessionCalendarByDate.get(cell.iso);
                  const isSelected = selectedDate === cell.iso;
                  const alpha = summary ? Math.min(0.08 + summary.totalSessions * 0.05, 0.4) : 0;
                  const baseStyle = summary
                    ? { backgroundColor: `rgba(79, 70, 229, ${alpha})` }
                    : undefined;

                  return (
                    <button
                      key={cell.iso}
                      onClick={() => setSelectedDate(cell.iso)}
                      className={`h-11 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center ${
                        isSelected
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white'
                          : summary
                            ? 'border-indigo-200 hover:border-indigo-300'
                            : 'border-slate-100 bg-white hover:bg-slate-50'
                      } ${cell.inMonth ? 'text-slate-800' : summary ? 'text-slate-600' : 'text-slate-300'}`}
                      style={isSelected ? undefined : baseStyle}
                    >
                      <span className="text-sm font-black leading-none">{cell.date.getDate()}</span>
                      <span
                        className={`mt-1 h-1.5 w-1.5 rounded-full ${
                          summary ? 'bg-indigo-600' : 'bg-transparent'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between rounded-2xl bg-white border border-slate-100 px-5 py-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  Total días
                </div>
                <div className="text-lg font-black text-slate-800">{sessionCalendarByDate.size}</div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-slate-50 border border-slate-100 rounded-[2rem] p-6 md:p-8">
              {!selectedDaySummary ? (
                <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-slate-500">
                  Selecciona un día con actividad para ver el resumen.
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                        Resumen del día
                      </div>
                      <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                        {new Intl.DateTimeFormat('es-ES', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        }).format(parseIsoDate(selectedDaySummary.date))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                        Acierto global
                      </div>
                      <div className="text-4xl font-black text-indigo-600">
                        {selectedDaySummary.accuracy.toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-[1.5rem] bg-white border border-slate-100 p-6">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                        Sesiones
                      </div>
                      <div className="text-3xl font-black text-slate-900">{selectedDaySummary.totalSessions}</div>
                    </div>
                    <div className="rounded-[1.5rem] bg-white border border-slate-100 p-6">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                        Preguntas
                      </div>
                      <div className="text-3xl font-black text-slate-900">{selectedDaySummary.totalQuestions}</div>
                    </div>
                    <div className="rounded-[1.5rem] bg-white border border-slate-100 p-6">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                        Aciertos
                      </div>
                      <div className="text-3xl font-black text-slate-900">{selectedDaySummary.totalCorrect}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                        Detalle por tipo
                      </div>
                      <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        {selectedDaySummary.types.length} tipos
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {selectedDaySummary.types.map((typeGroup) => {
                        const percentage = typeGroup.percentage;
                        return (
                          <div
                            key={`${selectedDaySummary.date}-${typeGroup.label}`}
                            className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-[2rem] bg-white border border-slate-100 hover:shadow-premium transition-all duration-300"
                          >
                            <div className="flex items-center gap-6 mb-4 md:mb-0">
                              <div className="flex flex-col">
                                <span className="px-3 py-1 bg-slate-50 text-indigo-600 border border-slate-100 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] mb-2 w-fit">
                                  {typeGroup.label}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-800 font-black text-lg">
                                    Media: {percentage.toFixed(0)}%
                                  </span>
                                  <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                  <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                    {typeGroup.totalSessions}{' '}
                                    {typeGroup.totalSessions === 1 ? 'sesión' : 'sesiones'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-8">
                              <div className="hidden sm:flex flex-col items-end">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                  Acierto Promedio
                                </span>
                                <span className="text-sm font-bold text-slate-600">
                                  {typeGroup.avgScore.toFixed(1)} / {typeGroup.avgTotal.toFixed(1)}{' '}
                                  <span className="text-[10px] opacity-50">preg.</span>
                                </span>
                              </div>

                              <div className="flex items-center gap-4 min-w-[120px] md:min-w-[160px] justify-end">
                                <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden hidden md:block w-32">
                                  <div
                                    className={`h-full rounded-full transition-all duration-1000 ${
                                      percentage >= 80
                                        ? 'bg-emerald-500 shadow-glow-emerald'
                                        : percentage >= 60
                                          ? 'bg-amber-500 shadow-glow-amber'
                                          : 'bg-rose-500 shadow-glow-rose'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span
                                  className={`text-xl font-black ${
                                    percentage >= 80
                                      ? 'text-emerald-600'
                                      : percentage >= 60
                                        ? 'text-amber-600'
                                        : 'text-rose-600'
                                  }`}
                                >
                                  {percentage.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
