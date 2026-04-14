import { ReactNode } from 'react';
import { AlertCircle, PlayCircle, TrendingUp } from 'lucide-react';
import { useAppLocale } from '../../lib/locale';

interface SecondaryActionItemProps {
  label: string;
  icon: ReactNode;
  onAction: () => void;
  badge?: string;
}

function SecondaryActionItem({ label, icon, onAction, badge }: SecondaryActionItemProps) {
  return (
    <button
      onClick={onAction}
      className="flex items-center gap-4 p-5 rounded-3xl bg-white border border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition-all duration-300 group shadow-sm hover:shadow-md"
    >
      <div className="p-3 bg-slate-50 text-slate-500 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
        {icon}
      </div>
      <div className="flex-1 flex items-center justify-between gap-3">
        <span className="text-lg font-bold text-slate-700">{label}</span>
        {badge ? (
          <span className="px-3 py-1 bg-rose-50 text-rose-600 text-xs font-black rounded-full uppercase tracking-widest">
            {badge}
          </span>
        ) : null}
      </div>
    </button>
  );
}

interface SecondaryActionsProps {
  onSimulation: () => void;
  onStats: () => void;
  onWeakAreas: () => void;
  weakAreasBadge?: string;
}

export default function SecondaryActions({
  onSimulation,
  onStats,
  onWeakAreas,
  weakAreasBadge,
}: SecondaryActionsProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <SecondaryActionItem
        label={isBasque ? 'Praktika ausazkoa' : 'Practica aleatoria'}
        icon={<PlayCircle size={24} />}
        onAction={onSimulation}
      />
      <SecondaryActionItem
        label={isBasque ? 'Estatistika osoak' : 'Estadisticas completas'}
        icon={<TrendingUp size={24} />}
        onAction={onStats}
      />
      <SecondaryActionItem
        label={isBasque ? 'Hobetu beharreko arloak' : 'Areas de mejora'}
        icon={<AlertCircle size={24} />}
        onAction={onWeakAreas}
        badge={weakAreasBadge}
      />
    </div>
  );
}
