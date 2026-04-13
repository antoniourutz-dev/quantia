import { AlertCircle, BookOpen, Sparkles, TrendingUp, ArrowRight } from 'lucide-react';
import CoachHero from './CoachHero';
import ProgressOverview from './ProgressOverview';
import PrimaryActionCard from './PrimaryActionCard';
import SecondaryActions from './SecondaryActions';
import WeeklyInsight from './WeeklyInsight';
import { SyllabusType } from '../../types';

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
  primaryCardProgressLabel?: string;
  primaryCardProgressValue?: number;
  weakTitle: string;
  weakDescription: string;
  weakAreasBadge?: string;
  weeklyInsightData: Array<{ name: string; questions: number }>;
  weeklyInsightSummary: string;
  weeklyInsightDelta: string;
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
  primaryCardProgressLabel,
  primaryCardProgressValue,
  weakTitle,
  weakDescription,
  weakAreasBadge,
  weeklyInsightData,
  weeklyInsightSummary,
  weeklyInsightDelta,
  onStartTest,
  onShowStats,
  onReviewErrors,
}: DashboardProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* 1. COACH HERO (PRIMARY BLOCK) */}
      <div className="hover-lift">
        <CoachHero
          label={coachLabel}
          title={coachTitle}
          description={coachDescription}
          ctaLabel={coachCtaLabel}
          onAction={() => onStartTest('common')}
        />
      </div>

      {/* 2. BENTO GRID LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Progress Overview - Wide */}
        <div className="md:col-span-4 lg:col-span-3">
          <ProgressOverview
            commonProgress={commonProgress}
            specificProgress={specificProgress}
            weeklyQuestions={weeklyQuestions}
            accuracyRate={accuracyRate}
          />
        </div>

        {/* Stats Summary - Small/Tall */}
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
            <p className="text-4xl font-black text-slate-800 mb-1">{accuracyRate == null ? '—' : `${accuracyRate}%`}</p>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Precisión (muestra)</p>
          </div>
          <button className="text-indigo-600 font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 group-hover:gap-4 transition-all">
            Ver Estadísticas <ArrowRight size={14} />
          </button>
        </div>

        {/* Primary Action: Study - Large */}
        <div className="md:col-span-2 lg:col-span-2 hover-lift">
          <PrimaryActionCard
            title={primaryCardTitle}
            description={primaryCardDescription}
            icon={<BookOpen size={32} />}
            progressLabel={primaryCardProgressLabel}
            progressValue={primaryCardProgressValue}
            ctaText="Continuar Estudiando"
            onAction={() => onStartTest('common')}
            variant="indigo"
          />
        </div>

        {/* Error Review - Large */}
        <div className="md:col-span-2 lg:col-span-2 hover-lift">
          <PrimaryActionCard
            title={weakTitle}
            description={weakDescription}
            icon={<AlertCircle size={32} />}
            ctaText="Corregir Errores"
            onAction={onReviewErrors}
            variant="rose"
          />
        </div>

        {/* Weekly Insight - Wide/Bottom */}
        <div className="md:col-span-4 lg:col-span-4 space-y-5">
          <div className="flex items-center gap-3 text-slate-400 px-2">
            <TrendingUp size={16} className="text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Actividad reciente (7 días)</span>
          </div>

          <div className="glass-premium rounded-[3rem] p-2 overflow-hidden hover-lift">
            <WeeklyInsight
              data={weeklyInsightData}
              summary={weeklyInsightSummary}
              deltaLabel={weeklyInsightDelta}
            />
          </div>
        </div>
      </div>

      {/* Secondary Actions - Bottom Shelf */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 text-slate-400 px-2">
          <Sparkles size={16} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Acciones de Alto Rendimiento</span>
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
