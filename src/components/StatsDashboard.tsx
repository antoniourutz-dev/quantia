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
  ChevronLeft,
  ChevronRight,
  Filter,
  ShieldAlert,
  Swords,
  Zap,
} from 'lucide-react';
import { TestResult, formatModeLabel } from '../types';
import { DashboardBundle } from '../lib/quantiaApi';
import type { CoachPlanV2 } from '../lib/coach';
import {
  buildCoachCopySeed,
  getSurfaceCopy,
  resolveCoachSurfaceState,
} from '../lib/coachCopyV2';
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
  curriculum: string;
  levelLabel?: string;
  coachPlan?: CoachPlanV2 | null;
  onStartRecommended?: () => void;
}

export default function StatsDashboard({
  results,
  bundle,
  curriculum,
  levelLabel = 'Ritmo actual',
  coachPlan = null,
  onStartRecommended,
}: StatsDashboardProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);
  const [mobileView, setMobileView] = useState<'summary' | 'detail'>('summary');

  const learningV2 = bundle?.practiceState.learningDashboardV2 ?? null;
  const pressureV2 = bundle?.practiceState.pressureInsightsV2 ?? null;
  const weakCategories = bundle?.weakCategories ?? [];

  const totalQuestions = results.reduce((acc, curr) => acc + curr.total, 0);
  const correctAnswers = results.reduce((acc, curr) => acc + curr.score, 0);

  const readiness = Math.round((learningV2?.examReadinessRate ?? 0) * 100);
  const readinessCiLow = learningV2?.examReadinessCiLow == null ? null : Math.round(learningV2.examReadinessCiLow * 100);
  const readinessCiHigh = learningV2?.examReadinessCiHigh == null ? null : Math.round(learningV2.examReadinessCiHigh * 100);
  const readinessConfidence = learningV2?.examReadinessConfidenceFlag ?? 'low';

  const coverage = Math.round((learningV2?.coverageRate ?? 0) * 100);
  const seenQuestions = learningV2?.seenQuestions ?? 0;
  const totalBankQuestions = learningV2?.totalQuestions ?? 0;

  const observedAccuracy = Math.round((learningV2?.observedAccuracyRate ?? 0) * 100);
  const observedAccuracyN = learningV2?.observedAccuracyN ?? 0;
  const observedCiLow = learningV2?.observedAccuracyCiLow == null ? null : Math.round(learningV2.observedAccuracyCiLow * 100);
  const observedCiHigh = learningV2?.observedAccuracyCiHigh == null ? null : Math.round(learningV2.observedAccuracyCiHigh * 100);
  const observedOk = Boolean(learningV2?.observedAccuracySampleOk);

  const recommendedCount = learningV2?.recommendedTodayCount ?? 0;
  const recommendedMode = coachPlan?.primaryAction ?? learningV2?.recommendedMode ?? 'standard';

  const examSection = useMemo(() => {
    const learningAccuracy = pressureV2?.learningAccuracy;
    const examAccuracy = pressureV2?.simulacroAccuracy;
    const learningPct = learningAccuracy == null ? null : Math.round(learningAccuracy * 100);
    const examPct = examAccuracy == null ? null : Math.round(examAccuracy * 100);
    const gapRaw = pressureV2?.pressureGapRaw;
    const gapPct =
      gapRaw == null
        ? learningPct == null || examPct == null
          ? null
          : learningPct - examPct
        : Math.round(gapRaw * 100);

    const learningQ = pressureV2?.learningQuestionN ?? 0;
    const examQ = pressureV2?.simulacroQuestionN ?? 0;
    const learningS = pressureV2?.learningSessionN ?? 0;
    const examS = pressureV2?.simulacroSessionN ?? 0;

    const enoughToCompare = learningPct != null && examPct != null && learningQ > 0 && examQ > 0;
    const stillEarly = !pressureV2?.sampleOk || learningQ < 30 || examQ < 20;

    const absGap = gapPct == null ? null : Math.abs(gapPct);
    const direction =
      gapPct == null ? 'unknown' : gapPct > 0 ? 'drops' : gapPct < 0 ? 'improves' : 'stable';

    const headline = t('Estudio vs examen', 'Ikasketa vs azterketa');
    const subtitle = t(
      'No es lo mismo saberlo que sostenerlo cuando sube la exigencia.',
      'Ez da gauza bera jakitea eta exijentzia igotzean eustea.',
    );

    const gapLabel =
      gapPct == null
        ? t('Sin base suficiente todavía', 'Oraindik oinarri gutxiegi')
        : direction === 'stable'
          ? t('Casi no hay diferencia', 'Ia ez dago aldearik')
          : direction === 'improves'
            ? t('En examen incluso subes', 'Azterketan are hobeto')
            : absGap != null && absGap >= 20
              ? t('Aquí se nota una caída real', 'Hemen beherakada nabaria da')
              : absGap != null && absGap >= 10
                ? t('Se te cae al exigirte más', 'Exijitzean jaisten zaizu')
                : t('Hay una bajada pequeña', 'Beherakada txiki bat dago');

    const gapDetail = (() => {
      if (!enoughToCompare) {
        return t(
          'Todavía falta confirmarlo: necesitamos más sesiones tipo examen para comparar bien.',
          'Oraindik baieztatzeko falta da: azterketa motako saio gehiago behar ditugu ondo alderatzeko.',
        );
      }
      if (stillEarly) {
        return t(
          'Se intuye una diferencia, pero aún con poca base. No saques conclusiones duras todavía.',
          'Aldea antzematen da, baina oraindik oinarri gutxirekin. Ez atera ondorio gogorrik oraindik.',
        );
      }
      if (direction === 'stable' || absGap == null) {
        return t(
          'Lo estás sosteniendo bien: lo que sabes sale parecido incluso cuando aprieta.',
          'Ondo eusten diozu: dakizuna antzera ateratzen da estutzen duenean ere.',
        );
      }
      if (direction === 'improves') {
        return t(
          'Cuando hay presión, te concentras y lo sacas incluso mejor. Mantén este patrón.',
          'Presioa dagoenean, kontzentratu eta are hobeto ateratzen duzu. Mantendu eredua.',
        );
      }
      if (absGap >= 20) {
        return t(
          'Sabes más de lo que consigues mostrar bajo presión. El salto ahora es aprender a sostenerlo.',
          'Dakizuna baino gutxiago erakusten duzu presiopean. Orain jauzia eusten ikastea da.',
        );
      }
      if (absGap >= 10) {
        return t(
          'La base está, pero al exigirte más se resiente. Con un poco de entrenamiento específico lo cierras.',
          'Oinarria badago, baina exijitzean jaisten da. Entrenamendu zehatz pixka batekin itxiko duzu.',
        );
      }
      return t(
        'Se nota una bajada leve. Con práctica corta tipo examen la irás reduciendo.',
        'Beherakada arina nabaritzen da. Azterketa motako praktika laburrarekin gutxitzen joango da.',
      );
    })();

    const paceDetail = (() => {
      const fatigue = pressureV2?.avgSimulacroFatigue;
      if (!enoughToCompare || stillEarly || fatigue == null) return null;
      if (fatigue >= 0.65) {
        return t(
          'En examen parece que se te hace cuesta arriba al final: conviene entrenar aguante con simulacros cortos.',
          'Azterketan badirudi amaieran gehiago kostatzen zaizula: komeni da simulakro laburrekin eustea lantzea.',
        );
      }
      if (fatigue >= 0.4) {
        return t(
          'Hay algo de desgaste en examen. Mejor pocos bloques, pero muy limpios.',
          'Azterketan higadura pixka bat dago. Hobe bloke gutxi, baina oso garbi.',
        );
      }
      return t(
        'El aguante no parece el problema principal. Aquí la clave suele ser afinar precisión bajo exigencia.',
        'Eustea ez dirudi arazo nagusia. Hemen giltza normalean exijentziapean doitasuna fintzea da.',
      );
    })();

    const cta = (() => {
      if (!enoughToCompare) {
        return t(
          'De momento, sigue construyendo base. Cuando metas algún simulacro, podremos ver si hay caída real.',
          'Momentuz, jarraitu oinarria eraikitzen. Simulakruren bat sartzen duzunean, benetako beherakada dagoen ikusiko dugu.',
        );
      }
      if (stillEarly) {
        return t(
          'Haz un simulacro corto de vez en cuando: con dos o tres ya podremos leer esto con más claridad.',
          'Egin simulakro labur bat noizean behin: bi edo hirurekin hau askoz argiago irakurriko dugu.',
        );
      }
      if (direction === 'drops' && absGap != null && absGap >= 10) {
        return t(
          'Tu siguiente mejora está en transferir lo que ya sabes: mete simulacros cortos y medibles para sostenerlo.',
          'Hurrengo hobekuntza dakizuna transferitzean dago: sartu simulakro labur eta neurgarriak eusteko.',
        );
      }
      return t(
        'Aquí no hay un problema grande. Mantén la base y usa el examen como comprobación puntual.',
        'Hemen ez dago arazo handirik. Mantendu oinarria eta erabili azterketa noizean behingo egiaztapen gisa.',
      );
    })();

    return {
      headline,
      subtitle,
      gapLabel,
      gapDetail,
      paceDetail,
      cta,
      stillEarly,
      learningPct,
      examPct,
      gapPct,
      learningQ,
      examQ,
      learningS,
      examS,
    };
  }, [pressureV2, t]);

  const coachSurfaceState = useMemo(
    () => resolveCoachSurfaceState(coachPlan, bundle),
    [bundle, coachPlan],
  );

  const coachCopySeed = useMemo(
    () =>
      buildCoachCopySeed({
        curriculum,
        username: bundle?.identity.current_username,
        state: coachSurfaceState,
        extra: `stats:${recommendedMode}`,
      }),
    [bundle?.identity.current_username, coachSurfaceState, curriculum, recommendedMode],
  );

  const statsCopy = useMemo(
    () =>
      getSurfaceCopy({
        state: coachSurfaceState,
        surface: 'statsSummary',
        locale,
        seed: `${coachCopySeed}:summary`,
      }),
    [coachCopySeed, coachSurfaceState, locale],
  );

  const actionCopy = useMemo(
    () =>
      getSurfaceCopy({
        state: coachSurfaceState,
        surface: 'homeCard',
        locale,
        seed: `${coachCopySeed}:action`,
      }),
    [coachCopySeed, coachSurfaceState, locale],
  );

  const actionSummary = [statsCopy.line1, statsCopy.line2].filter(Boolean).join(' ');

  const formatConfidence = (flag: 'low' | 'medium' | 'high') =>
    flag === 'high' ? t('Alta', 'Handia') : flag === 'medium' ? t('Media', 'Ertaina') : t('Baja', 'Baxua');

  const confidenceClass = (flag: 'low' | 'medium' | 'high') =>
    flag === 'high'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : flag === 'medium'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : 'bg-rose-50 text-rose-700 border-rose-100';

  const sampleLabel = (enough: boolean) =>
    enough ? t('Lectura suficiente', 'Irakurketa nahikoa') : t('Aun con pocos datos', 'Oraindik datu gutxirekin');

  const recommendedModeLabel = formatModeLabel(
    recommendedMode === 'push'
      ? 'standard'
      : recommendedMode === 'recovery'
        ? 'review'
        : recommendedMode,
    locale,
  );

  const rankedWeakCategories = useMemo(() => {
    return [...weakCategories]
      .filter((item) => typeof item.excessRisk === 'number' && Number.isFinite(item.excessRisk))
      .sort((a, b) => (b.excessRisk ?? -Infinity) - (a.excessRisk ?? -Infinity))
      .slice(0, 7);
  }, [weakCategories]);

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
    const shortFormatter = new Intl.DateTimeFormat(getIntlLocale(locale), { day: '2-digit', month: 'short' });
    const longFormatter = new Intl.DateTimeFormat(getIntlLocale(locale), {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });

    const rows = [...daySummaryMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([iso, summary]) => ({
        iso,
        name: shortFormatter.format(parseIsoDate(iso)),
        longLabel: longFormatter.format(parseIsoDate(iso)),
        score: Math.round(summary.accuracy),
        totalQuestions: summary.totalQuestions,
        totalCorrect: summary.totalCorrect,
        totalSessions: summary.totalSessions,
      }));

    const maxQuestions = rows.reduce((acc, row) => Math.max(acc, row.totalQuestions), 0);
    return rows.map((row) => ({
      ...row,
      volumeRatio: maxQuestions > 0 ? row.totalQuestions / maxQuestions : 0,
    }));
  }, [daySummaryMap, locale]);

  const trendNarrative = useMemo(() => {
    const days = dailyTrendData.filter((day) => day.totalQuestions > 0);
    if (days.length === 0) {
      return t('Aún no hay actividad suficiente para ver una evolución.', 'Oraindik ez dago jarduera nahikorik bilakaera ikusteko.');
    }

    const totalQuestions = days.reduce((acc, day) => acc + day.totalQuestions, 0);
    const activeDays = days.length;
    const average = days.reduce((acc, day) => acc + day.score, 0) / Math.max(activeDays, 1);
    const first = days.slice(0, Math.min(3, activeDays));
    const last = days.slice(Math.max(0, activeDays - 3));
    const firstAvg = first.reduce((acc, day) => acc + day.score, 0) / Math.max(first.length, 1);
    const lastAvg = last.reduce((acc, day) => acc + day.score, 0) / Math.max(last.length, 1);
    const delta = lastAvg - firstAvg;

    const scores = days.map((d) => d.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const spread = max - min;

    const lowActivity = totalQuestions < 60 || activeDays < 4;
    const improving = delta >= 4;
    const falling = delta <= -4;
    const irregular = spread >= 20;

    if (lowActivity) {
      return t(
        'Vas sumando, pero todavía con pocos días para sacar conclusiones firmes. Mantén el ritmo un poco más.',
        'Mugimendua badago, baina oraindik egun gutxiegi ondorio sendoak ateratzeko. Eutsi erritmoari pixka bat gehiago.',
      );
    }
    if (improving && irregular) {
      return t(
        'Hay mejora, aunque todavía irregular. Lo importante ahora es repetir días buenos, no buscar picos.',
        'Hobekuntza badago, baina oraindik irregularra. Orain garrantzitsuena egun onak errepikatzea da, ez puntak bilatzea.',
      );
    }
    if (improving) {
      return t(
        'Vas asentándolo: en los últimos días estás mejor que al principio. Sigue así y consolídalo con constancia.',
        'Finkatzen ari zara: azken egunetan hobeto zoaz hasieran baino. Jarrai horrela eta sendotu jarraikortasunez.',
      );
    }
    if (falling) {
      return t(
        'Últimamente se te está haciendo más cuesta arriba. Hoy conviene volver a una sesión corta y limpia para recuperar sensaciones.',
        'Azkenaldian gehiago kostatzen ari zaizu. Gaur hobe saio labur eta garbi batera itzultzea berriro martxa hartzeko.',
      );
    }
    if (irregular) {
      return t(
        'Estás siendo constante, pero con días muy distintos entre sí. Un poco más de regularidad te hará subir más rápido.',
        'Jarraikortasuna baduzu, baina egunak oso desberdinak dira. Erregularitate pixka batek azkarrago igoko zaitu.',
      );
    }
    if (average >= 75) {
      return t(
        'Buen nivel y bastante estable. En este punto, lo que más te hace avanzar es no dejar huecos sin repasar.',
        'Maila ona eta nahiko egonkorra. Une honetan, gehien laguntzen duena hutsunerik ez uztea da.',
      );
    }
    return t(
      'Vas en buena línea. Si mantienes la frecuencia, el progreso se vuelve más sólido semana a semana.',
      'Bide onean zoaz. Maiztasuna mantentzen baduzu, aurrerapena gero eta sendoagoa izango da astez aste.',
    );
  }, [dailyTrendData, t]);

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

  const calendarHeatMax = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    let max = 0;
    for (const [iso, summary] of daySummaryMap.entries()) {
      const date = parseIsoDate(iso);
      if (date.getFullYear() !== year || date.getMonth() !== month) continue;
      max = Math.max(max, summary.totalQuestions);
    }
    return max;
  }, [calendarMonth, daySummaryMap]);

  const selectedDaySummary = selectedDate ? daySummaryMap.get(selectedDate) ?? null : null;
  const weekdayLabels = getCalendarWeekdayLabels(locale);
  const calendarLabel = formatMonthYear(calendarMonth, locale);
  const colors = ['#4f46e5', '#10b981', '#f97316', '#ef4444', '#0ea5e9'];

  const renderTrendDot = (props: { cx?: number; cy?: number; payload?: { volumeRatio?: unknown; iso?: unknown } | null }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload) {
      return <circle key="trend-dot-empty" cx={0} cy={0} r={0} />;
    }
    const ratio = Number(payload.volumeRatio ?? 0);
    const radius = 3 + Math.round(Math.max(0, Math.min(1, ratio)) * 5);
    return (
      <circle
        key={`trend-dot:${typeof payload.iso === 'string' ? payload.iso : `${cx}-${cy}`}`}
        cx={cx}
        cy={cy}
        r={radius}
        fill="#4f46e5"
        fillOpacity={0.85}
        stroke="#ffffff"
        strokeWidth={2}
      />
    );
  };

  const renderTrendTooltip = (props: { active?: boolean; payload?: Array<{ payload?: unknown }> }) => {
    const { active, payload } = props;
    const raw = payload?.[0]?.payload;
    if (!active || !raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.longLabel !== 'string') return null;
    const totalQuestions = Number(row.totalQuestions ?? 0);
    const totalCorrect = Number(row.totalCorrect ?? 0);
    const totalSessions = Number(row.totalSessions ?? 0);

    const accuracy =
      totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const dayTone =
      totalQuestions === 0
        ? t('Sin actividad.', 'Jarduerarik gabe.')
        : accuracy >= 80
          ? t('Día fuerte.', 'Egun indartsua.')
          : accuracy >= 60
            ? t('Día correcto.', 'Egun zuzena.')
            : t('Día flojo: conviene repasar.', 'Egun ahula: komeni da errepasatzea.');

    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
        <div className="text-xs font-black text-slate-900">{row.longLabel}</div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t('Preguntas', 'Galderak')}
            </div>
            <div className="text-sm font-black text-slate-900">{Number.isFinite(totalQuestions) ? totalQuestions : 0}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t('Aciertos', 'Asmatzeak')}
            </div>
            <div className="text-sm font-black text-slate-900">{Number.isFinite(totalCorrect) ? totalCorrect : 0}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t('Precisión', 'Doitasuna')}
            </div>
            <div className="text-sm font-black text-slate-900">{accuracy}%</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t('Sesiones', 'Saioak')}
            </div>
            <div className="text-sm font-black text-slate-900">{Number.isFinite(totalSessions) ? totalSessions : 0}</div>
          </div>
        </div>
        <div className="mt-2 text-[10px] font-bold text-slate-500">{dayTone}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-16 lg:pb-20 [@media(max-height:800px)]:space-y-6 [@media(max-height:800px)]:pb-16">
      <div className="rounded-[3rem] bg-[#0a0a1a] text-white p-6 md:p-8 [@media(max-height:800px)]:p-6 [@media(max-height:800px)]:md:p-7 relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-[360px] h-[360px] rounded-full bg-indigo-600/30 blur-[120px]" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-[260px] h-[260px] rounded-full bg-emerald-500/20 blur-[100px]" />
        <div className="relative z-10 space-y-8 [@media(max-height:800px)]:space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">
              <Zap size={12} />
              {t('Tu momento', 'Zure unea')}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`px-3 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-[0.2em] ${confidenceClass(readinessConfidence)}`}>
                {t('Lectura', 'Irakurketa')}: {formatConfidence(readinessConfidence)}
              </div>
              <div className="px-3 py-2 rounded-2xl border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">
                {t('Visto', 'Ikusita')}: {coverage}%
                <span className="[@media(max-height:800px)]:hidden"> ({seenQuestions}/{totalBankQuestions})</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 [@media(max-height:800px)]:gap-4">
            <div className="rounded-[2.5rem] bg-white/5 border border-white/10 px-7 py-6 [@media(max-height:800px)]:px-6 [@media(max-height:800px)]:py-5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200/80 mb-3">
                {t('Punto actual', 'Uneko puntua')}
              </div>
              <div className="flex items-end justify-between gap-6">
                <div className="text-5xl md:text-6xl font-black tracking-tighter leading-none">{readiness}%</div>
                <div className="text-right text-xs font-bold text-indigo-100/80">
                  {readinessCiLow != null && readinessCiHigh != null ? (
                    <div>
                      <span className="[@media(max-height:800px)]:hidden">{t('Margen', 'Tartea')}: </span>
                      {readinessCiLow}–{readinessCiHigh}
                    </div>
                  ) : (
                    <div>{t('Leyendo tus ultimas sesiones...', 'Azken saioak irakurtzen...')}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 text-sm font-medium text-indigo-50/80 leading-relaxed [@media(max-height:800px)]:hidden">
                {actionSummary || t('Todavia hace falta un poco mas para leer bien este momento.', 'Oraindik pixka bat gehiago falta da une hau ondo irakurtzeko.')}
              </div>
            </div>

            <div className="rounded-[2.5rem] bg-white/5 border border-white/10 px-7 py-6 [@media(max-height:800px)]:px-6 [@media(max-height:800px)]:py-5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200/80 mb-3">
                {t('Como estas respondiendo', 'Nola ari zaren erantzuten')}
              </div>
              <div className="flex items-end justify-between gap-6">
                <div className="text-4xl md:text-5xl font-black tracking-tighter leading-none">{observedAccuracy}%</div>
                <div className="text-right text-xs font-bold text-indigo-100/80">
                  <div>
                    <span className="[@media(max-height:800px)]:hidden">{t('Respuestas', 'Erantzunak')}: </span>
                    {observedAccuracyN}
                  </div>
                  {observedCiLow != null && observedCiHigh != null ? (
                    <div className="[@media(max-height:800px)]:hidden">{t('Margen', 'Tartea')}: {observedCiLow}–{observedCiHigh}</div>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className={`px-3 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-[0.2em] ${
                  observedOk ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/20' : 'bg-amber-500/10 text-amber-200 border-amber-400/20'
                }`}>
                  {sampleLabel(observedOk)}
                </div>
                <div className="px-3 py-2 rounded-2xl border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">
                  {t('Por repasar', 'Errepasatzeko')}: {learningV2?.backlogOverdueCount ?? 0}
                </div>
              </div>
            </div>

            <div className="rounded-[2.5rem] bg-white/5 border border-white/10 px-7 py-6 [@media(max-height:800px)]:px-6 [@media(max-height:800px)]:py-5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] [@media(max-height:800px)]:tracking-[0.22em] text-indigo-200/80 mb-3 whitespace-nowrap overflow-hidden text-ellipsis">
                {t('Tu actividad reciente', 'Azken jarduera')}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl bg-black/20 border border-white/10 px-4 py-4 [@media(max-height:800px)]:px-3 [@media(max-height:800px)]:py-3">
                  <div className="text-[9px] [@media(max-height:800px)]:text-[8px] font-black uppercase tracking-[0.3em] [@media(max-height:800px)]:tracking-[0.18em] text-slate-300/80 mb-2 text-center whitespace-nowrap overflow-hidden text-ellipsis leading-none">
                    {t('Sesiones', 'Saioak')}
                  </div>
                  <div className="text-2xl font-black">{results.length}</div>
                </div>
                <div className="rounded-2xl bg-black/20 border border-white/10 px-4 py-4 [@media(max-height:800px)]:px-3 [@media(max-height:800px)]:py-3">
                  <div className="text-[9px] [@media(max-height:800px)]:text-[8px] font-black uppercase tracking-[0.3em] [@media(max-height:800px)]:tracking-[0.18em] text-slate-300/80 mb-2 text-center whitespace-nowrap overflow-hidden text-ellipsis leading-none">
                    {t('Preguntas', 'Galderak')}
                  </div>
                  <div className="text-2xl font-black">{totalQuestions}</div>
                </div>
                <div className="rounded-2xl bg-black/20 border border-white/10 px-4 py-4 [@media(max-height:800px)]:px-3 [@media(max-height:800px)]:py-3">
                  <div className="text-[9px] [@media(max-height:800px)]:text-[8px] font-black uppercase tracking-[0.3em] [@media(max-height:800px)]:tracking-[0.18em] text-slate-300/80 mb-2 text-center whitespace-nowrap overflow-hidden text-ellipsis leading-none">
                    {t('Aciertos', 'Asmatzeak')}
                  </div>
                  <div className="text-2xl font-black">{correctAnswers}</div>
                </div>
              </div>
              <div className="mt-4 text-xs font-bold text-indigo-100/80 [@media(max-height:800px)]:hidden">
                {t('Ritmo actual', 'Uneko erritmoa')}: {levelLabel}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-white border border-slate-100 p-8 [@media(max-height:800px)]:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 [@media(max-height:800px)]:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              <Swords size={14} className="text-indigo-600" />
              {t('Hoy', 'Gaur')}
            </div>
            <h3 className="mt-2 text-2xl [@media(max-height:800px)]:text-xl font-black text-slate-900">
              {t('Lo que te conviene hacer ahora', 'Orain egitea komeni zaizuna')}
            </h3>
            <div className="mt-2 text-sm font-medium text-slate-500 leading-relaxed [@media(max-height:800px)]:hidden">
              {actionSummary}
            </div>
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-3">
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <div className="px-3 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                {t('Formato', 'Formatua')}: {recommendedModeLabel}
              </div>
              <div className="px-3 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                {t('Sugeridas hoy', 'Gaurko gomendioa')}: {recommendedCount}
              </div>
            </div>
            <button
              type="button"
              onClick={onStartRecommended}
              disabled={!onStartRecommended}
              className="w-full sm:w-auto px-6 py-4 [@media(max-height:800px)]:py-3 rounded-2xl bg-indigo-600 text-white font-black text-lg [@media(max-height:800px)]:text-base shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-60 disabled:hover:bg-indigo-600"
            >
              {actionCopy.cta ?? t('Practicar por aqui', 'Hemendik praktikatu')}
            </button>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMobileView('summary')}
              className={`rounded-[1.5rem] px-4 py-3 text-xs font-black uppercase tracking-[0.25em] transition-all ${
                mobileView === 'summary' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'
              }`}
            >
              {t('Resumen', 'Laburpena')}
            </button>
            <button
              type="button"
              onClick={() => setMobileView('detail')}
              className={`rounded-[1.5rem] px-4 py-3 text-xs font-black uppercase tracking-[0.25em] transition-all ${
                mobileView === 'detail' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'
              }`}
            >
              {t('Detalle', 'Xehetasunak')}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-white border border-slate-100 p-8 [@media(max-height:800px)]:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              <ShieldAlert size={14} className="text-rose-600" />
              {t('Temas a reforzar', 'Indartu beharreko gaiak')}
            </div>
            <h3 className="mt-2 text-2xl [@media(max-height:800px)]:text-xl font-black text-slate-900">
              {t('Donde mas te conviene entrar', 'Non komeni zaizun gehien sartzea')}
            </h3>
            <div className="mt-2 text-sm font-medium text-slate-500 leading-relaxed [@media(max-height:800px)]:hidden">
              {rankedWeakCategories.length > 0
                ? t('Empieza por los puntos donde mas se te esta yendo el acierto.', 'Hasi gehien kostatzen ari zaizkizun puntuetatik.')
                : t('Todavia hacen falta algunas respuestas mas para ordenar bien tus prioridades.', 'Oraindik erantzun batzuk gehiago falta dira lehentasunak ondo ordenatzeko.')}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3 [@media(max-height:800px)]:mt-4">
          {rankedWeakCategories.length > 0 ? (
            (mobileView === 'summary' ? rankedWeakCategories.slice(0, 3) : rankedWeakCategories).map((item, index) => {
              const risk = item.excessRisk ?? 0;
              const riskPct = Math.max(0, Math.min(100, Math.round(risk * 100)));
              const barPct = Math.max(8, Math.min(100, riskPct));
              const confidence = item.confidenceFlag ?? 'low';
              return (
                <div key={`${item.category}-${index}`} className="rounded-3xl border border-slate-100 bg-slate-50 px-5 py-4 [@media(max-height:800px)]:px-4 [@media(max-height:800px)]:py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900 truncate">{item.category}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <div className={`px-2.5 py-1 rounded-2xl border text-[10px] font-black uppercase tracking-[0.2em] ${confidenceClass(confidence)}`}>
                          {t('Lectura', 'Irakurketa')}: {formatConfidence(confidence)}
                        </div>
                        <div className="px-2.5 py-1 rounded-2xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 [@media(max-height:800px)]:hidden">
                          {t('Intentos', 'Saiakerak')}: {item.attempts}
                        </div>
                        {item.sampleOk ? (
                          <div className="px-2.5 py-1 rounded-2xl border border-emerald-200 bg-emerald-50 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
                            {t('Patron claro', 'Eredu argia')}
                          </div>
                        ) : (
                          <div className="px-2.5 py-1 rounded-2xl border border-amber-200 bg-amber-50 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
                            {t('Aun poco visto', 'Oraindik gutxi ikusita')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        {t('Te esta costando', 'Kostatzen ari zaizu')}
                      </div>
                      <div className="text-xl font-black text-slate-900">{riskPct}%</div>
                    </div>
                  </div>
                  <div className="mt-3 w-full h-2 rounded-full bg-white border border-slate-200 overflow-hidden">
                    <div
                      className={`${riskPct >= 20 ? 'bg-rose-500' : riskPct >= 10 ? 'bg-amber-500' : 'bg-emerald-500'} h-full`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-3xl border border-slate-100 bg-slate-50 px-6 py-5 text-sm font-bold text-slate-600">
              {t('Por ahora no hay un tema que te este tirando claramente hacia abajo.', 'Oraingoz ez dago beherantz eramaten zaituen gairik modu argian.')}
            </div>
          )}
        </div>
        {rankedWeakCategories.length > 3 ? (
          <div className="mt-5 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileView((prev) => (prev === 'summary' ? 'detail' : 'summary'))}
              className="w-full rounded-[2rem] border border-slate-200 bg-white px-6 py-4 text-slate-700 font-black text-base shadow-sm hover:bg-slate-50 transition-all"
            >
              {mobileView === 'summary' ? t('Ver todo', 'Dena ikusi') : t('Ver menos', 'Gutxiago ikusi')}
            </button>
          </div>
        ) : null}
      </div>

      <div className={`${mobileView === 'detail' ? 'block' : 'hidden'} lg:block rounded-[2.5rem] bg-white border border-slate-100 p-8 [@media(max-height:800px)]:p-6 shadow-sm`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl [@media(max-height:800px)]:text-xl font-black text-slate-900">
            {t('Tu precision en los ultimos dias', 'Azken egunetako zure doitasuna')}
          </h3>
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500">
            <Filter size={14} />
            {t('Ultimos 10 dias', 'Azken 10 egunak')}
          </div>
        </div>
        <div className="h-[280px] [@media(max-height:800px)]:h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyTrendData}>
              <defs>
                <linearGradient id="statsTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                minTickGap={16}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                width={34}
              />
              <Tooltip content={renderTrendTooltip} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#4f46e5"
                strokeWidth={3}
                fill="url(#statsTrend)"
                dot={renderTrendDot}
                activeDot={{ r: 7, stroke: '#ffffff', strokeWidth: 2, fill: '#4f46e5' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 [@media(max-height:800px)]:mt-3 rounded-3xl border border-slate-100 bg-slate-50 px-6 py-5 [@media(max-height:800px)]:px-5 [@media(max-height:800px)]:py-4 text-sm font-bold text-slate-700 leading-relaxed">
          {trendNarrative}
        </div>
      </div>

      <div className={`${mobileView === 'detail' ? 'grid' : 'hidden'} lg:grid grid-cols-1 xl:grid-cols-3 gap-6 [@media(max-height:800px)]:gap-4`}>
        <div className="rounded-[2.5rem] bg-white border border-slate-100 p-8 [@media(max-height:800px)]:p-6 shadow-sm xl:col-span-1">
          <h3 className="text-2xl [@media(max-height:800px)]:text-xl font-black text-slate-900 mb-6 [@media(max-height:800px)]:mb-4">
            {t('Como has repartido las sesiones', 'Nola banatu dituzun saioak')}
          </h3>
          <div className="h-[220px] [@media(max-height:800px)]:h-[180px] w-full">
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
          <div className="space-y-3 mt-6 [@media(max-height:800px)]:mt-4 [@media(max-height:800px)]:hidden">
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

        <div className="rounded-[2.5rem] bg-white border border-slate-100 p-8 [@media(max-height:800px)]:p-6 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl [@media(max-height:800px)]:text-xl font-black text-slate-900">
                {t('Tu registro de sesiones', 'Zure saioen erregistroa')}
              </h3>
              <p className="text-sm font-medium text-slate-500 mt-1 [@media(max-height:800px)]:hidden">
                {t('Un vistazo a tu habito y a como te fue cada dia', 'Zure ohiturari eta egun bakoitza nola joan den begirada bat')}
              </p>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-8 [@media(max-height:800px)]:p-6 text-slate-500">
              {t('Aun no hay sesiones registradas.', 'Oraindik ez dago saiorik erregistratuta.')}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 [@media(max-height:800px)]:gap-4">
              <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-5 [@media(max-height:800px)]:p-4">
                <div className="flex items-center justify-between mb-5 [@media(max-height:800px)]:mb-4">
                  <button onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="w-10 h-10 rounded-xl border border-slate-100 bg-white flex items-center justify-center text-slate-600">
                    <ChevronLeft size={18} />
                  </button>
                  <div className="text-center">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Calendario', 'Egutegia')}</div>
                    <div className="text-lg [@media(max-height:800px)]:text-base font-black text-slate-900">{calendarLabel}</div>
                  </div>
                  <button onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="w-10 h-10 rounded-xl border border-slate-100 bg-white flex items-center justify-center text-slate-600">
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-2 mb-3 [@media(max-height:800px)]:mb-2">
                  {weekdayLabels.map((day) => (
                    <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarCells.map((cell) => {
                    const summary = daySummaryMap.get(cell.iso);
                    const isSelected = selectedDate === cell.iso;
                    const intensity =
                      summary && calendarHeatMax > 0 ? summary.totalQuestions / calendarHeatMax : 0;
                    const heatClass = summary
                      ? intensity >= 0.76
                        ? 'border-indigo-300 bg-indigo-500/20 text-slate-900'
                        : intensity >= 0.5
                          ? 'border-indigo-200 bg-indigo-500/12 text-slate-900'
                          : intensity >= 0.26
                            ? 'border-indigo-200 bg-indigo-500/8 text-slate-800'
                            : 'border-indigo-100 bg-indigo-500/5 text-slate-700'
                      : 'border-slate-100 bg-white text-slate-300';

                    const title = (() => {
                      if (!summary) {
                        return `${formatLongDate(cell.date, locale)} · ${t('Sin actividad', 'Jarduerarik gabe')}`;
                      }
                      const accuracy = summary.totalQuestions > 0 ? Math.round(summary.accuracy) : 0;
                      const tone =
                        summary.totalQuestions === 0
                          ? t('Sin actividad', 'Jarduerarik gabe')
                          : accuracy >= 80
                            ? t('Día fuerte', 'Egun indartsua')
                            : accuracy >= 60
                              ? t('Día correcto', 'Egun zuzena')
                              : t('Día flojo', 'Egun ahula');

                      return `${formatLongDate(cell.date, locale)} · ${summary.totalQuestions} ${t('preguntas', 'galdera')} · ${summary.totalCorrect} ${t('aciertos', 'asmatze')} · ${accuracy}% · ${summary.totalSessions} ${t('sesiones', 'saio')} · ${tone}`;
                    })();
                    return (
                      <button
                        key={cell.iso}
                        onClick={() => setSelectedDate(cell.iso)}
                        title={title}
                        className={`h-11 [@media(max-height:800px)]:h-9 rounded-xl border flex items-center justify-center text-sm [@media(max-height:800px)]:text-xs font-black transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : heatClass
                        } ${cell.inMonth ? '' : 'opacity-50'}`}
                      >
                        {cell.date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6 [@media(max-height:800px)]:p-5">
                {!selectedDaySummary || !selectedDate ? (
                  <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 text-slate-500">
                    {t('Elige un dia del calendario para ver como te fue.', 'Hautatu egutegiko egun bat nola joan den ikusteko.')}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
                          {t('Resumen del dia', 'Eguneko laburpena')}
                        </div>
                        <div className="text-2xl [@media(max-height:800px)]:text-xl font-black text-slate-900">{formatLongDate(parseIsoDate(selectedDate), locale)}</div>
                      </div>
                      <div className="rounded-[1.5rem] bg-white border border-slate-100 px-5 py-4 text-right">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                          {t('Como te fue', 'Nola joan da')}
                        </div>
                        <div className="text-3xl [@media(max-height:800px)]:text-2xl font-black text-indigo-600">{selectedDaySummary.accuracy.toFixed(0)}%</div>
                        <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {selectedDaySummary.totalQuestions === 0
                            ? t('Sin actividad', 'Jarduerarik gabe')
                            : selectedDaySummary.accuracy >= 80
                              ? t('Dia fuerte', 'Egun indartsua')
                              : selectedDaySummary.accuracy >= 60
                                ? t('Dia correcto', 'Egun zuzena')
                                : t('Dia flojo', 'Egun ahula')}
                        </div>
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
                          <div className="text-3xl [@media(max-height:800px)]:text-2xl font-black text-slate-900">{item.value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 [@media(max-height:800px)]:hidden">
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

      <div className={`${mobileView === 'detail' ? 'block' : 'hidden'} lg:block rounded-[2.5rem] bg-white border border-slate-100 p-8 [@media(max-height:800px)]:p-6 shadow-sm`}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              <ShieldAlert size={14} className="text-amber-600" />
              {t('Estudio vs examen', 'Ikasketa vs azterketa')}
            </div>
            <h3 className="mt-2 text-2xl [@media(max-height:800px)]:text-xl font-black text-slate-900">{examSection.headline}</h3>
            <div className="mt-2 text-sm font-medium text-slate-500 leading-relaxed [@media(max-height:800px)]:hidden">{examSection.subtitle}</div>
          </div>
          <div className="shrink-0 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              {t('Lectura', 'Irakurketa')}
            </div>
            <div className="mt-1 text-sm font-black text-slate-900">{examSection.gapLabel}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 [@media(max-height:800px)]:mt-4">
          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 px-6 py-5">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
              {t('Como estudias', 'Nola ikasten duzu')}
            </div>
            <div className="text-3xl font-black text-slate-900">
              {examSection.learningPct == null ? '—' : `${examSection.learningPct}%`}
            </div>
            <div className="mt-2 text-xs font-bold text-slate-500 [@media(max-height:800px)]:hidden">
              {examSection.learningQ > 0 || examSection.learningS > 0
                ? `${examSection.learningQ} ${t('preguntas', 'galdera')} · ${examSection.learningS} ${t('sesiones', 'saio')}`
                : t('Todavía sin base suficiente.', 'Oraindik oinarri gutxiegi.')}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 px-6 py-5">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
              {t('Como te sale en examen', 'Azterketan nola ateratzen da')}
            </div>
            <div className="text-3xl font-black text-slate-900">
              {examSection.examPct == null ? '—' : `${examSection.examPct}%`}
            </div>
            <div className="mt-2 text-xs font-bold text-slate-500 [@media(max-height:800px)]:hidden">
              {examSection.examQ > 0 || examSection.examS > 0
                ? `${examSection.examQ} ${t('preguntas', 'galdera')} · ${examSection.examS} ${t('sesiones', 'saio')}`
                : t('Aún no hay simulacros suficientes.', 'Oraindik ez dago simulakrurik nahikorik.')}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 px-6 py-5">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
              {t('Diferencia', 'Aldea')}
            </div>
            <div className="text-3xl font-black text-slate-900">
              {examSection.gapPct == null
                ? '—'
                : `${examSection.gapPct > 0 ? '-' : examSection.gapPct < 0 ? '+' : ''}${Math.abs(examSection.gapPct)} ${t('puntos', 'puntu')}`}
            </div>
            <div className="mt-2 text-xs font-bold text-slate-500 [@media(max-height:800px)]:hidden">
              {examSection.stillEarly
                ? t('Aún con poca base para afirmarlo.', 'Oraindik oinarri gutxirekin baieztatzeko.')
                : t('Comparación ya bastante estable.', 'Alderaketa nahiko egonkorra.')}
            </div>
          </div>
        </div>

        <div className="mt-6 [@media(max-height:800px)]:mt-4 space-y-3">
          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 px-6 py-5 [@media(max-height:800px)]:px-5 [@media(max-height:800px)]:py-4 text-sm font-bold text-slate-700 leading-relaxed">
            {examSection.gapDetail}
          </div>
          {examSection.paceDetail ? (
            <div className="rounded-[2rem] border border-slate-100 bg-white px-6 py-5 text-sm font-bold text-slate-700 leading-relaxed">
              {examSection.paceDetail}
            </div>
          ) : null}
          <div className="rounded-[2rem] border border-indigo-100 bg-indigo-50 px-6 py-5 text-sm font-black text-indigo-900 leading-relaxed">
            {examSection.cta}
          </div>
        </div>
      </div>
    </div>
  );
}
