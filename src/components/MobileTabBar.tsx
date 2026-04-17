import { BookOpen, ClipboardList, LayoutDashboard, Settings, TrendingUp } from 'lucide-react';
import { useAppLocale } from '../lib/locale';

type MobileTabKey = 'dashboard' | 'test-selection' | 'stats' | 'study' | 'settings';

export default function MobileTabBar({
  active,
  onChange,
}: {
  active: MobileTabKey;
  onChange: (next: MobileTabKey) => void;
}) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const tabs: Array<{
    key: MobileTabKey;
    label: string;
    Icon: typeof LayoutDashboard;
  }> = [
    { key: 'dashboard', label: t('Inicio', 'Hasiera'), Icon: LayoutDashboard },
    { key: 'test-selection', label: t('Test', 'Test'), Icon: ClipboardList },
    { key: 'stats', label: t('Stats', 'Stats'), Icon: TrendingUp },
    { key: 'study', label: t('Estudio', 'Ikasketa'), Icon: BookOpen },
    { key: 'settings', label: t('Perfil', 'Profila'), Icon: Settings },
  ];

  return (
    <div className="lg:hidden fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-7xl px-3 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2">
        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/96 p-1.5 shadow-[0_-12px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="grid grid-cols-5 gap-1.5">
            {tabs.map(({ key, label, Icon }) => {
              const selected = key === active;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange(key)}
                  aria-current={selected ? 'page' : undefined}
                  className={`flex min-h-[62px] w-full flex-col items-center justify-center gap-1.5 rounded-[1.15rem] px-1.5 py-2 transition-all ${
                    selected
                      ? 'bg-indigo-50 text-indigo-700 shadow-[inset_0_0_0_1px_rgba(79,70,229,0.12)]'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={18} className={selected ? 'text-indigo-700' : 'text-slate-500'} />
                  <span
                    className={`w-full truncate text-center text-[11px] font-bold leading-none ${
                      selected ? 'text-indigo-700' : 'text-slate-500'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
