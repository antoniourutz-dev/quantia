import { Sparkles, ArrowRight, Stars } from 'lucide-react';
import { useAppLocale } from '../../lib/locale';

interface CoachHeroProps {
  onAction: () => void;
  label?: string;
  title: string;
  description: string;
  ctaLabel?: string;
}

export default function CoachHero({
  onAction,
  label = 'Sugerencia de hoy',
  title,
  description,
  ctaLabel = 'Empezar por aqui',
}: CoachHeroProps) {
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const titleParts = title.includes(' - ') ? title.split(' - ') : [title];

  return (
    <section className="relative overflow-hidden bg-[#0a0a1a] rounded-[3rem] p-10 md:p-16 text-white shadow-2xl group border border-white/5">
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px] opacity-20 group-hover:opacity-30 transition-opacity duration-1000"></div>
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-[400px] h-[400px] bg-emerald-600 rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity duration-1000"></div>

      <div className="absolute top-10 right-10 opacity-20 animate-float-slow">
        <Stars size={40} className="text-indigo-300" />
      </div>

      <div className="relative z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8">
          <Sparkles size={16} className="text-indigo-400 fill-indigo-400/20" />
          <span className="text-xs font-black tracking-[0.2em] uppercase text-indigo-200">{label}</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-black mb-8 leading-[1.05] tracking-tight">
          {titleParts.map((part, index) => (
            <span
              key={`${part}-${index}`}
              className={index === titleParts.length - 1 && titleParts.length > 1 ? 'block text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-emerald-300' : 'block'}
            >
              {part}
            </span>
          ))}
        </h1>

        <p className="text-xl text-indigo-100/70 mb-12 leading-relaxed font-medium max-w-2xl">
          {description}
        </p>

        <div className="flex flex-wrap items-center gap-6">
          <button
            onClick={onAction}
            className="inline-flex items-center gap-3 px-10 py-5 bg-white text-indigo-950 rounded-2xl font-black text-lg hover:bg-indigo-50 transition-all duration-500 group shadow-[0_0_40px_-5px_rgba(255,255,255,0.3)] hover:-translate-y-1 active:scale-95"
          >
            {ctaLabel}
            <ArrowRight size={22} className="group-hover:translate-x-2 transition-transform duration-500" />
          </button>
        </div>
      </div>
    </section>
  );
}
