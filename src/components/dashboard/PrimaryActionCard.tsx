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
    <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-premium-xl flex flex-col items-start gap-10 transition-all duration-700 group relative overflow-hidden hover-lift">
      <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-slate-50 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors duration-700"></div>
      
      <div className={`p-6 ${colors.bg} ${colors.text} rounded-[2.5rem] group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-sm relative z-10`}>
        {icon}
      </div>

      <div className="flex-1 space-y-6 relative z-10">
        <h3 className="text-4xl font-black text-slate-800 tracking-tighter leading-tight">{title}</h3>
        <p className="text-lg text-slate-500 font-medium leading-relaxed opacity-80">
          {description}
        </p>

        {progressLabel && (
          <div className="pt-8 space-y-4">
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
        className={`w-full group/btn relative py-6 ${colors.cta} text-white rounded-[2rem] font-black text-xl shadow-xl transition-all duration-500 flex items-center justify-center gap-4 hover:-translate-y-2 active:scale-[0.98] overflow-hidden`}
      >
        <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000"></div>
        <span className="relative z-10">{ctaText}</span>
        <ArrowRight size={24} className="relative z-10 group-hover/btn:translate-x-2 transition-transform duration-500" />
      </button>
    </div>
  );
}
