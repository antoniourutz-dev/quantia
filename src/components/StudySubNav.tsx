import { BookOpen, Compass, Highlighter } from 'lucide-react';
import { useAppLocale } from '../lib/locale';

export type StudySubView = 'study-bank' | 'study' | 'study-notes';
export type StudySubNavTab = StudySubView;

export interface StudySubNavProps {
  activeView?: StudySubView;
  onSelectView?: (view: StudySubView) => void;
  /** Legacy alias of `activeView`. */
  activeTab?: StudySubView;
  /** Legacy alias of `onSelectView`. */
  onChangeTab?: (tab: StudySubView) => void;
  /** Optional badge with the number of annotated questions. */
  notesCount?: number;
}

export default function StudySubNav({
  activeView,
  onSelectView,
  activeTab,
  onChangeTab,
  notesCount,
}: StudySubNavProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);
  const current = activeView ?? activeTab ?? 'study-bank';
  const select = (view: StudySubView) => {
    if (onSelectView) onSelectView(view);
    else onChangeTab?.(view);
  };

  const tabs: Array<{ id: StudySubView; label: string; Icon: typeof BookOpen }> = [
    {
      id: 'study-bank',
      label: t('Banco de preguntas', 'Galdera-bankua'),
      Icon: BookOpen,
    },
    {
      id: 'study',
      label: t('Estudio guiado', 'Ikasketa gidatua'),
      Icon: Compass,
    },
    {
      id: 'study-notes',
      label: t('Mis notas y subrayados', 'Nire oharrak eta azpimarrak'),
      Icon: Highlighter,
    },
  ];

  const safeCount =
    typeof notesCount === 'number' && Number.isFinite(notesCount) && notesCount > 0
      ? Math.floor(notesCount)
      : null;

  return (
    <nav
      aria-label={t('Secciones de estudio', 'Ikasketa atalak')}
      className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = current === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => select(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-black transition-all ${
              isActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{label}</span>
            {id === 'study-notes' && safeCount !== null ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  isActive ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
                }`}
              >
                {safeCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
