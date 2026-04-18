import { useMemo, useState } from 'react';
import { AlertCircle, BookOpen, ChevronDown, PlayCircle, Sparkles, TrendingUp } from 'lucide-react';
import CoachHero from './CoachHero';
import ProgressOverview from './ProgressOverview';
import PrimaryActionCard from './PrimaryActionCard';
import SecondaryActions from './SecondaryActions';
import WeeklyInsight from './WeeklyInsight';
import { SyllabusType } from '../../types';
import { useAppLocale } from '../../lib/locale';

interface DashboardProps {
  curriculum: string;
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
  curriculum,
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
          <button
            type="button"
            onClick={() => onStartTest('specific')}
            disabled={actionsDisabled}
            className={`flex items-center justify-between gap-4 rounded-[2rem] border px-6 py-5 shadow-sm transition-all hover:shadow-md ${
              actionsDisabled ? 'border-slate-100 bg-slate-100 text-slate-400' : 'border-slate-100 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                <PlayCircle className="text-slate-700" size={22} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  {isBasque ? 'Alternatiba' : 'Alternativa'}
                </div>
                <div className="mt-1 text-lg font-black truncate">
                  {isBasque ? 'Errepaso librea' : 'Repaso libre'}
                </div>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-slate-300 rotate-[-90deg]" />
          </button>

          <div>
            <button
              type="button"
              onClick={() => setMobileExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-[1.75rem] border border-slate-200 bg-white px-5 py-4 text-base font-black text-slate-700 shadow-sm"
            >
              <span>{mobileExpanded ? t('Ver menos', 'Gutxiago ikusi') : t('Ver detalle', 'Xehetasunak ikusi')}</span>
              <ChevronDown className={`h-5 w-5 transition-transform ${mobileExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className={`${mobileExpanded ? 'block' : 'hidden'} space-y-6`}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-6">
              <div className="md:col-span-4">
                <ProgressOverview
                  curriculum={curriculum}
                  commonProgress={commonProgress}
                  specificProgress={specificProgress}
                  weeklyQuestions={weeklyQuestions}
                  accuracyRate={accuracyRate}
                />
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

              <div className="md:col-span-4 space-y-4">
                <div className="flex items-center gap-3 px-1 text-slate-400 sm:px-2">
                  <TrendingUp size={16} className="text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                    {isBasque ? 'Aste honetako mugimendua' : 'Lo que llevas esta semana'}
                  </span>
                </div>

                <div className="glass-premium overflow-hidden rounded-[2.5rem] p-1.5 hover-lift sm:rounded-[3rem] sm:p-2">
                  <WeeklyInsight data={weeklyInsightData} summary={weeklyInsightSummary} deltaLabel={weeklyInsightDelta} />
                </div>
              </div>

              <div className="md:col-span-4 space-y-4">
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
            </div>
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
