import { ArrowRight, Flame, Sparkles } from 'lucide-react';

export interface TodayPlanStripProps {
  streakDays: number;
  hydrated: boolean;
  disabled?: boolean;
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  sessionMetaLabel?: string | null;
  ctaLabel: string;
  tone?: 'rescue' | 'protect' | 'build' | 'push' | 'maintain';
  onStartPlan: () => void;
  locale?: 'es' | 'eu';
}

const TONE_STYLES: Record<
  NonNullable<TodayPlanStripProps['tone']>,
  {
    containerBorder: string;
    eyebrowBadge: string;
    ctaButton: string;
  }
> = {
  rescue: {
    containerBorder: 'border-amber-400/25',
    eyebrowBadge: 'bg-amber-500/15 text-amber-200 border-amber-400/25',
    ctaButton: 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-amber-950/30',
  },
  protect: {
    containerBorder: 'border-sky-400/25',
    eyebrowBadge: 'bg-sky-500/15 text-sky-200 border-sky-400/25',
    ctaButton: 'bg-sky-400 text-slate-950 hover:bg-sky-300 shadow-sky-950/30',
  },
  build: {
    containerBorder: 'border-indigo-400/25',
    eyebrowBadge: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
    ctaButton: 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-950/40',
  },
  push: {
    containerBorder: 'border-emerald-400/25',
    eyebrowBadge: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/25',
    ctaButton: 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-emerald-950/30',
  },
  maintain: {
    containerBorder: 'border-indigo-400/20',
    eyebrowBadge: 'bg-white/10 text-indigo-200 border-white/15',
    ctaButton: 'bg-white text-slate-950 hover:bg-indigo-50 shadow-slate-950/30',
  },
};

export default function TodayPlanStrip({
  streakDays,
  hydrated,
  disabled = false,
  eyebrow,
  title,
  subtitle = null,
  sessionMetaLabel = null,
  ctaLabel,
  tone = 'maintain',
  onStartPlan,
  locale = 'es',
}: TodayPlanStripProps) {
  const isBasque = locale === 'eu';
  const safeStreak = Number.isFinite(streakDays) ? Math.max(0, Math.floor(streakDays)) : 0;
  const styles = TONE_STYLES[tone] ?? TONE_STYLES.maintain;

  const streakLabel =
    safeStreak > 0
      ? isBasque
        ? `${safeStreak} egun`
        : `${safeStreak} ${safeStreak === 1 ? 'día' : 'días'}`
      : isBasque
        ? '0 egun · Hasi gaur'
        : '0 días · Empieza hoy';

  return (
    <section
      aria-label={eyebrow}
      data-testid="today-plan-strip"
      data-hydrated={hydrated ? 'true' : 'false'}
      data-tone={tone}
      className={`relative overflow-hidden rounded-[2rem] border bg-gradient-to-r from-[#0a0a1a] via-slate-900 to-indigo-950 p-4 text-white shadow-lg shadow-slate-900/10 lg:rounded-[1.75rem] lg:px-6 lg:py-4 ${styles.containerBorder}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl"
      />

      <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] ${styles.eyebrowBadge}`}
            >
              <Sparkles size={12} aria-hidden="true" />
              {eyebrow}
            </span>

            <span
              data-testid="today-plan-streak"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-black ${
                safeStreak > 0
                  ? 'border-amber-400/30 bg-amber-500/15 text-amber-200'
                  : 'border-white/15 bg-white/5 text-slate-200'
              }`}
            >
              <Flame
                size={13}
                aria-hidden="true"
                className={safeStreak > 0 ? 'text-amber-400 fill-amber-400/25' : 'text-slate-400'}
              />
              <span>{streakLabel}</span>
            </span>

            {sessionMetaLabel ? (
              <span
                data-testid="today-plan-session-meta"
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-bold text-slate-200"
              >
                {sessionMetaLabel}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-black leading-snug tracking-tight text-white sm:text-lg">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-xs font-medium leading-relaxed text-slate-300 sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={onStartPlan}
          className={`inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black shadow-lg transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto lg:px-5 lg:py-3 ${styles.ctaButton}`}
        >
          <span>{ctaLabel}</span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
