import { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

interface PrimaryActionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  progressLabel?: string;
  progressValue?: number;
  ctaText: string;
  onAction: () => void;
  variant?: 'indigo' | 'emerald' | 'rose';
  disabled?: boolean;
}

export default function PrimaryActionCard({
  title,
  description,
  icon,
  progressLabel,
  progressValue,
  ctaText,
  onAction,
  variant = 'indigo',
  disabled = false,
}: PrimaryActionCardProps) {
  const colorMap = {
    indigo: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      cta: 'bg-indigo-600 hover:bg-indigo-700 shadow-glow-indigo',
      progress: 'bg-gradient-to-r from-indigo-500 to-indigo-700',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      cta: 'bg-emerald-600 hover:bg-emerald-700 shadow-glow-emerald',
      progress: 'bg-gradient-to-r from-emerald-500 to-emerald-700',
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      cta: 'bg-rose-600 hover:bg-rose-700 shadow-glow-rose',
      progress: 'bg-gradient-to-r from-rose-500 to-rose-700',
    },
  };

  const colors = colorMap[variant];

  return (
    <div className="relative flex h-full flex-col items-start gap-6 overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-premium-xl transition-all duration-700 group hover-lift sm:gap-10 sm:rounded-[3.5rem] sm:p-10">
      <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-slate-50 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors duration-700"></div>
      
      <div className={`relative z-10 rounded-[1.75rem] p-4 shadow-sm transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 sm:rounded-[2.5rem] sm:p-6 ${colors.bg} ${colors.text}`}>
        {icon}
      </div>

      <div className="relative z-10 flex-1 space-y-4 sm:space-y-6">
        <h3 className="text-[1.75rem] font-black leading-tight tracking-tighter text-slate-800 sm:text-4xl">{title}</h3>
        <p className="text-sm font-medium leading-relaxed text-slate-500 opacity-80 sm:text-lg">
          {description}
        </p>

        {progressLabel && (
          <div className="space-y-3 pt-4 sm:space-y-4 sm:pt-8">
            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              <span>{progressLabel}</span>
              <span className={colors.text}>{progressValue}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner p-0.5">
              <div 
                className={`${colors.progress} h-full rounded-full transition-all duration-1000 ease-out`} 
                style={{ width: `${progressValue}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onAction}
        disabled={disabled}
        className={`group/btn relative flex w-full items-center justify-center gap-4 overflow-hidden rounded-[1.5rem] py-4 text-base font-black transition-all duration-500 sm:rounded-[2rem] sm:py-6 sm:text-xl ${
          disabled
            ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
            : `${colors.cta} text-white shadow-xl hover:-translate-y-2 active:scale-[0.98]`
        }`}
      >
        {!disabled ? (
          <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000"></div>
        ) : null}
        <span className="relative z-10">{ctaText}</span>
        <ArrowRight
          size={24}
          className={`relative z-10 ${disabled ? '' : 'group-hover/btn:translate-x-2 transition-transform duration-500'}`}
        />
      </button>
    </div>
  );
}
