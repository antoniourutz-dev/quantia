import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Stars from 'lucide-react/dist/esm/icons/stars';

interface CoachHeroProps {
  onAction: () => void;
  label?: string;
  title: string;
  description: string;
  ctaLabel?: string;
  compact?: boolean;
  disabled?: boolean;
}

export default function CoachHero({
  onAction,
  label = 'Sugerencia de hoy',
  title,
  description,
  ctaLabel = 'Empezar por aqui',
  compact = false,
  disabled = false,
}: CoachHeroProps) {
  const titleParts = title.includes(' - ') ? title.split(' - ') : [title];

  return (
    <section
      className={`relative overflow-hidden bg-[#0a0a1a] rounded-[3rem] text-white shadow-2xl group border border-white/5 ${
        compact ? 'p-6 sm:p-8' : 'p-8 md:p-16'
      }`}
    >
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px] opacity-20 group-hover:opacity-30 transition-opacity duration-1000"></div>
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-[400px] h-[400px] bg-emerald-600 rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity duration-1000"></div>

      <div className={`absolute top-10 right-10 opacity-20 animate-float-slow ${compact ? 'hidden sm:block' : ''}`}>
        <Stars size={40} className="text-indigo-300" />
      </div>

      <div className="relative z-10 max-w-3xl">
        <div className={`inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2 backdrop-blur-md ${compact ? 'mb-4' : 'mb-8'}`}>
          <Sparkles size={16} className="text-indigo-400 fill-indigo-400/20" />
          <span className="text-xs font-black tracking-[0.2em] uppercase text-indigo-200">{label}</span>
        </div>

        <h1
          data-home-lcp-title="true"
          className={`${compact ? 'text-[2rem] sm:text-4xl' : 'text-4xl md:text-6xl'} font-black ${compact ? 'mb-4' : 'mb-8'} leading-[1.05] tracking-tight`}
        >
          {titleParts.map((part, index) => (
            <span
              key={`${part}-${index}`}
              className={index === titleParts.length - 1 && titleParts.length > 1 ? 'block text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-emerald-300' : 'block'}
            >
              {part}
            </span>
          ))}
        </h1>

        <p className={`${compact ? 'text-sm sm:text-lg' : 'text-xl'} text-indigo-100/70 ${compact ? 'mb-6' : 'mb-12'} leading-relaxed font-medium max-w-2xl`}>
          {description}
        </p>

        <div className="flex flex-wrap items-center gap-6">
          <button
            onClick={onAction}
            disabled={disabled}
            className={`inline-flex items-center gap-3 rounded-2xl font-black transition-all duration-500 group shadow-[0_0_40px_-5px_rgba(255,255,255,0.3)] ${
              compact ? 'w-full justify-center px-6 py-4 text-base sm:w-auto' : 'px-10 py-5 text-lg'
            } ${
              disabled
                ? 'bg-white/20 text-white/70 cursor-not-allowed shadow-none'
                : 'bg-white text-indigo-950 hover:bg-indigo-50 hover:-translate-y-1 active:scale-95'
            }`}
          >
            {ctaLabel}
            <ArrowRight size={22} className={disabled ? '' : 'group-hover:translate-x-2 transition-transform duration-500'} />
          </button>
        </div>
      </div>
    </section>
  );
}
