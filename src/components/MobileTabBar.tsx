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
    <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-[52px] max-w-md items-center justify-between px-2">
        {tabs.map(({ key, label, Icon }) => {
          const selected = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-current={selected ? 'page' : undefined}
              className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 transition-all ${
                selected ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={20} strokeWidth={selected ? 2.5 : 2} className={selected ? 'scale-110 mb-0.5' : 'mb-0.5'} />
              <span className={`text-[10px] tracking-tight ${selected ? 'font-black' : 'font-bold'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
