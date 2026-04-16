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
    { key: 'settings', label: t('Ajustes', 'Doikuntzak'), Icon: Settings },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white to-transparent opacity-95" />
      <div className="relative mx-auto max-w-7xl px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <div className="grid grid-cols-5 gap-2 rounded-[2rem] border border-slate-200 bg-white/90 backdrop-blur-xl p-2 shadow-xl">
          {tabs.map(({ key, label, Icon }) => {
            const selected = key === active;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                className={`w-full h-[56px] flex flex-col items-center justify-center gap-1 rounded-[1.5rem] px-1.5 py-2 transition-all overflow-hidden ${
                  selected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Icon size={18} className={selected ? 'text-white' : 'text-slate-500'} />
                <span
                  className={`w-full text-center whitespace-nowrap overflow-hidden text-ellipsis text-[9px] font-black uppercase tracking-[0.18em] leading-none ${
                    selected ? 'text-white' : 'text-slate-500'
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
  );
}
