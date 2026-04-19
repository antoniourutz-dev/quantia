import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import Target from 'lucide-react/dist/esm/icons/target';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Activity from 'lucide-react/dist/esm/icons/activity';
import { useAppLocale } from '../../lib/locale';
import { formatSyllabusLabel } from '../../types';

interface ProgressOverviewProps {
  curriculum: string;
  commonProgress: number | null;
  specificProgress: number | null;
  weeklyQuestions: number;
  accuracyRate: number | null;
}

export default function ProgressOverview({
  curriculum,
  commonProgress,
  specificProgress,
  weeklyQuestions,
  accuracyRate,
}: ProgressOverviewProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const stats = [
    {
      label: formatSyllabusLabel('common', locale, { curriculum, variant: 'summary' }),
      value: commonProgress == null ? '-' : `${commonProgress}%`,
      icon: BarChart3,
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
    },
    {
      label: formatSyllabusLabel('specific', locale, { curriculum, variant: 'summary' }),
      value: specificProgress == null ? '-' : `${specificProgress}%`,
      icon: Target,
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
    {
      label: isBasque ? 'Aste honetan' : 'Esta semana',
      value: weeklyQuestions,
      icon: Activity,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      label: isBasque ? 'Azken doitasuna' : 'Acierto reciente',
      value: accuracyRate == null ? '-' : `${accuracyRate}%`,
      icon: TrendingUp,
      bgColor: 'bg-rose-50',
      textColor: 'text-rose-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-start gap-3 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md sm:gap-4 sm:rounded-[2rem] sm:p-6"
        >
          <div className={`rounded-2xl p-2.5 sm:p-3 ${stat.bgColor} ${stat.textColor}`}>
            <stat.icon size={20} />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:text-xs">{stat.label}</p>
            <h3 className="text-xl font-black tracking-tight text-slate-800 sm:text-2xl">{stat.value}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}
