import { useMemo, useState } from 'react';
import { AlertCircle, BookOpen, ChevronDown, Sparkles, TrendingUp, ArrowRight } from 'lucide-react';
import CoachHero from './CoachHero';
import ProgressOverview from './ProgressOverview';
import PrimaryActionCard from './PrimaryActionCard';
import SecondaryActions from './SecondaryActions';
import WeeklyInsight from './WeeklyInsight';
import { SyllabusType } from '../../types';
import { useAppLocale } from '../../lib/locale';

interface DashboardProps {
  coachLabel: string;
  coachTitle: string;
  coachDescription: string;
  coachCtaLabel: string;
  commonProgress: number | null;
  specificProgress: number | null;
  weeklyQuestions: number;
  accuracyRate: number | null;
  primaryCardTitle: string;
  primaryCardDescription: string;
  primaryCardCtaLabel: string;
  primaryCardProgressLabel?: string;
  primaryCardProgressValue?: number;
  weakTitle: string;
  weakDescription: string;
  weakCardCtaLabel: string;
  weakAreasBadge?: string;
  weeklyInsightData: Array<{ name: string; questions: number }>;
  weeklyInsightSummary: string;
  weeklyInsightDelta: string;
  onCoachAction: () => void;
  onStartTest: (syllabus: SyllabusType) => void;
  onShowStats: () => void;
  onReviewErrors: () => void;
}

export default function Dashboard({
  coachLabel,
  coachTitle,
  coachDescription,
  coachCtaLabel,
  commonProgress,
  specificProgress,
  weeklyQuestions,
  accuracyRate,
  primaryCardTitle,
  primaryCardDescription,
  primaryCardCtaLabel,
  primaryCardProgressLabel,
  primaryCardProgressValue,
  weakTitle,
  weakDescription,
  weakCardCtaLabel,
  weakAreasBadge,
  weeklyInsightData,
  weeklyInsightSummary,
  weeklyInsightDelta,
  onCoachAction,
  onStartTest,
  onShowStats,
  onReviewErrors,
}: DashboardProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const t = useMemo(() => (es: string, eu: string) => (isBasque ? eu : es), [isBasque]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 lg:space-y-12 pb-10 lg:pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="hover-lift hidden lg:block">
        <CoachHero
          label={coachLabel}
          title={coachTitle}
          description={coachDescription}
          ctaLabel={coachCtaLabel}
          onAction={onCoachAction}
        />
      </div>
      <div className="hover-lift lg:hidden">
        <CoachHero
          label={coachLabel}
          title={coachTitle}
          description={coachDescription}
          ctaLabel={coachCtaLabel}
          onAction={onCoachAction}
          compact
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-4 lg:col-span-3">
          <ProgressOverview
            commonProgress={commonProgress}
            specificProgress={specificProgress}
            weeklyQuestions={weeklyQuestions}
            accuracyRate={accuracyRate}
          />
        </div>

        <div
          onClick={onShowStats}
          className="md:col-span-2 lg:col-span-1 glass-premium rounded-[2.5rem] p-8 flex flex-col justify-between hover-lift cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
              <TrendingUp size={24} />
            </div>
            <Sparkles size={20} className="text-amber-400 animate-pulse" />
          </div>
          <div>
            <p className="text-4xl font-black text-slate-800 mb-1">{accuracyRate == null ? '-' : `${accuracyRate}%`}</p>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              {isBasque ? 'Azken doitasuna' : 'Acierto reciente'}
            </p>
          </div>
          <button className="text-indigo-600 font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 group-hover:gap-4 transition-all">
            {isBasque ? 'Nola zoazen ikusi' : 'Ver como vas'} <ArrowRight size={14} />
          </button>
        </div>

        <div className="md:col-span-2 lg:col-span-2 hover-lift">
          <PrimaryActionCard
            title={primaryCardTitle}
            description={primaryCardDescription}
            icon={<BookOpen size={32} />}
            progressLabel={primaryCardProgressLabel}
            progressValue={primaryCardProgressValue}
            ctaText={primaryCardCtaLabel}
            onAction={() => onStartTest('common')}
            variant="indigo"
          />
        </div>

        <div className="md:col-span-2 lg:col-span-2 hover-lift">
          <PrimaryActionCard
            title={weakTitle}
            description={weakDescription}
            icon={<AlertCircle size={32} />}
            ctaText={weakCardCtaLabel}
            onAction={onReviewErrors}
            variant="rose"
          />
        </div>

        <div className="md:col-span-4 lg:col-span-4 space-y-5">
          <div className="flex items-center gap-3 text-slate-400 px-2">
            <TrendingUp size={16} className="text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">
              {isBasque ? 'Aste honetako mugimendua' : 'Lo que llevas esta semana'}
            </span>
          </div>

          <div className={`${mobileExpanded ? 'block' : 'hidden'} lg:block glass-premium rounded-[3rem] p-2 overflow-hidden hover-lift`}>
            <WeeklyInsight data={weeklyInsightData} summary={weeklyInsightSummary} deltaLabel={weeklyInsightDelta} />
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          className="w-full rounded-[2rem] border border-slate-200 bg-white px-6 py-4 text-slate-700 font-black text-base flex items-center justify-between shadow-sm"
        >
          <span>{mobileExpanded ? t('Ver menos', 'Gutxiago ikusi') : t('Ver más', 'Gehiago ikusi')}</span>
          <ChevronDown className={`h-5 w-5 transition-transform ${mobileExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className={`${mobileExpanded ? 'block' : 'hidden'} lg:block space-y-6`}>
        <div className="flex items-center gap-3 text-slate-400 px-2">
          <Sparkles size={16} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">
            {isBasque ? 'Orain egitea komeni dena' : 'Lo que te conviene hacer ahora'}
          </span>
        </div>

        <SecondaryActions
          onSimulation={() => onStartTest('specific')}
          onStats={onShowStats}
          onWeakAreas={onReviewErrors}
          weakAreasBadge={weakAreasBadge}
        />
      </div>
    </div>
  );
}
