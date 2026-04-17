import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, BookOpen, ChevronDown, Sparkles, TrendingUp } from 'lucide-react';
import CoachHero from './CoachHero';
import ProgressOverview from './ProgressOverview';
import PrimaryActionCard from './PrimaryActionCard';
import SecondaryActions from './SecondaryActions';
import WeeklyInsight from './WeeklyInsight';
import { SyllabusType } from '../../types';
import { useAppLocale } from '../../lib/locale';

interface DashboardProps {
  secondaryHydrated?: boolean;
  actionsDisabled?: boolean;
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
  onPrimaryCardAction: () => void;
  onWeakCardAction: () => void;
  onStartTest: (syllabus: SyllabusType) => void;
  onShowStats: () => void;
  onReviewErrors: () => void;
}

export default function Dashboard({
  secondaryHydrated = true,
  actionsDisabled = false,
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
  onPrimaryCardAction,
  onWeakCardAction,
  onStartTest,
  onShowStats,
  onReviewErrors,
}: DashboardProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const t = useMemo(() => (es: string, eu: string) => (isBasque ? eu : es), [isBasque]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 sm:space-y-6 lg:space-y-12 lg:pb-20">
      <div className="hover-lift hidden lg:block">
        <CoachHero
          label={coachLabel}
          title={coachTitle}
          description={coachDescription}
          ctaLabel={coachCtaLabel}
          onAction={onCoachAction}
          disabled={actionsDisabled}
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
          disabled={actionsDisabled}
        />
      </div>

      {secondaryHydrated ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-6">
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
              className="glass-premium group flex cursor-pointer flex-col justify-between rounded-[2rem] p-6 hover-lift md:col-span-2 md:rounded-[2.5rem] md:p-8 lg:col-span-1"
            >
              <div className="flex justify-between items-start">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                  <TrendingUp size={24} />
                </div>
                <Sparkles size={20} className="text-amber-400 animate-pulse" />
              </div>
              <div>
                <p className="mb-1 text-3xl font-black text-slate-800 sm:text-4xl">{accuracyRate == null ? '-' : `${accuracyRate}%`}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:text-sm sm:tracking-widest">
                  {isBasque ? 'Azken doitasuna' : 'Acierto reciente'}
                </p>
              </div>
              <button className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600 transition-all group-hover:gap-4 sm:text-xs sm:tracking-[0.2em]">
                {isBasque ? 'Nola zoazen ikusi' : 'Ver como vas'} <ArrowRight size={14} />
              </button>
            </div>

            <div className="md:col-span-2 lg:col-span-2 hover-lift h-full">
              <PrimaryActionCard
                title={primaryCardTitle}
                description={primaryCardDescription}
                icon={<BookOpen size={32} />}
              progressLabel={primaryCardProgressLabel}
              progressValue={primaryCardProgressValue}
              ctaText={primaryCardCtaLabel}
              onAction={onPrimaryCardAction}
              variant="indigo"
              disabled={actionsDisabled}
            />
          </div>

          <div className="md:col-span-2 lg:col-span-2 hover-lift h-full">
              <PrimaryActionCard
                title={weakTitle}
              description={weakDescription}
              icon={<AlertCircle size={32} />}
              ctaText={weakCardCtaLabel}
              onAction={onWeakCardAction}
              variant="rose"
              disabled={actionsDisabled}
            />
          </div>

            <div className="space-y-4 md:col-span-4 lg:col-span-4 md:space-y-5">
              <div className="flex items-center gap-3 px-1 text-slate-400 sm:px-2">
                <TrendingUp size={16} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                  {isBasque ? 'Aste honetako mugimendua' : 'Lo que llevas esta semana'}
                </span>
              </div>

              <div className={`${mobileExpanded ? 'block' : 'hidden'} lg:block glass-premium overflow-hidden rounded-[2.5rem] p-1.5 hover-lift sm:rounded-[3rem] sm:p-2`}>
                <WeeklyInsight data={weeklyInsightData} summary={weeklyInsightSummary} deltaLabel={weeklyInsightDelta} />
              </div>
            </div>
          </div>

          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setMobileExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-[1.75rem] border border-slate-200 bg-white px-5 py-4 text-base font-black text-slate-700 shadow-sm"
            >
              <span>{mobileExpanded ? t('Ver menos', 'Gutxiago ikusi') : t('Ver mas', 'Gehiago ikusi')}</span>
              <ChevronDown className={`h-5 w-5 transition-transform ${mobileExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className={`${mobileExpanded ? 'block' : 'hidden'} lg:block space-y-4 sm:space-y-6`}>
            <div className="flex items-center gap-3 px-1 text-slate-400 sm:px-2">
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
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-6">
          <div className="hover-lift h-full">
            <PrimaryActionCard
              title={primaryCardTitle}
              description={primaryCardDescription}
              icon={<BookOpen size={32} />}
              ctaText={primaryCardCtaLabel}
              onAction={onPrimaryCardAction}
              variant="indigo"
              disabled={actionsDisabled}
            />
          </div>

          <div className="rounded-[2.25rem] border border-slate-100 bg-white px-6 py-6 shadow-sm sm:rounded-[3rem] sm:px-8 sm:py-7">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              {isBasque ? 'Testuingurua fintzen' : 'Afinando el contexto'}
            </div>
            <p className="mt-4 text-lg font-black text-slate-900">
              {isBasque ? 'Zure hurrengo mugimendua prest dago jada.' : 'Tu siguiente movimiento ya esta listo.'}
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              {isBasque
                ? 'Aurrerapena eta azalpen osagarriak kargatzen ari gara, lehenengo erabakia blokeatu gabe.'
                : 'Estamos cargando progreso y explicaciones secundarias sin bloquear la primera decision.'}
            </p>
            <div className="mt-6 space-y-3">
              <div className="h-2.5 w-24 rounded-full bg-slate-200 animate-pulse" />
              <div className="h-2.5 w-full rounded-full bg-slate-200 animate-pulse" />
              <div className="h-2.5 w-5/6 rounded-full bg-slate-200 animate-pulse" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
