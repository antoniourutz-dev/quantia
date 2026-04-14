import { TrendingUp, Target, BarChart3, Activity } from 'lucide-react';
import { useAppLocale } from '../../lib/locale';

interface ProgressOverviewProps {
  commonProgress: number | null;
  specificProgress: number | null;
  weeklyQuestions: number;
  accuracyRate: number | null;
}

export default function ProgressOverview({
  commonProgress,
  specificProgress,
  weeklyQuestions,
  accuracyRate,
}: ProgressOverviewProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const stats = [
    {
      label: isBasque ? 'Zati arrunta' : 'Parte comun',
      value: commonProgress == null ? '-' : `${commonProgress}%`,
      icon: BarChart3,
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
    },
    {
      label: isBasque ? 'Zati espezifikoa' : 'Parte especifica',
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-start gap-4 hover:shadow-md transition-all duration-300"
        >
          <div className={`p-3 ${stat.bgColor} ${stat.textColor} rounded-2xl`}>
            <stat.icon size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}
