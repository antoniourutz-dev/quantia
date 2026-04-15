import { useMemo, useState } from 'react';
import { ArrowLeft, GraduationCap, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { useAppLocale } from '../lib/locale';

interface AuthScreenProps {
  error: string | null;
  loading: boolean;
  onSubmit: (username: string, password: string) => Promise<void>;
  onBack?: () => void;
}

export default function AuthScreen({ error, loading, onSubmit, onBack }: AuthScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const locale = useAppLocale();
  const isBasque = locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(username, password);
  };

  const headline = useMemo(
    () =>
      isBasque
        ? 'Sartu zure prestakuntza-ingurunera'
        : 'Entra a tu entorno de preparación',
    [isBasque],
  );

  const subhead = useMemo(
    () =>
      isBasque
        ? 'Sarbidea kontrolatua da. Sarbidea baduzu, hasi saioa.'
        : 'Acceso controlado. Si ya tienes acceso, inicia sesión.',
    [isBasque],
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-slate-50 to-indigo-50 px-6 py-12 [@media(max-height:800px)]:py-8">
      <div className="absolute top-0 right-0 -mt-28 -mr-28 h-[760px] w-[760px] rounded-full bg-indigo-500 opacity-15 blur-[170px]" />
      <div className="absolute bottom-0 left-0 -mb-28 -ml-28 h-[560px] w-[560px] rounded-full bg-emerald-500 opacity-10 blur-[150px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(99,102,241,0.08),transparent_45%),radial-gradient(circle_at_85%_70%,rgba(16,185,129,0.06),transparent_45%)]" />

      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-8 items-start">
          <div className="rounded-[3.5rem] border border-slate-100 bg-white p-10 md:p-12 [@media(max-height:800px)]:p-8 shadow-xl">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="inline-flex items-center gap-3 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-700">
                <GraduationCap size={14} />
                Quantia
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                <ShieldCheck size={14} />
                {t('Acceso controlado', 'Sarbide kontrolatua')}
              </div>
            </div>

            <h1 className="mt-8 text-4xl md:text-5xl font-black leading-[1.05] tracking-tight text-slate-900">
              {headline}
            </h1>
            <p className="mt-5 text-lg font-medium text-slate-600 leading-relaxed">{subhead}</p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { k: t('Sesiones', 'Saioak'), v: t('Diarias y medibles', 'Egunero eta neurgarriak') },
                { k: t('Corrección', 'Zuzenketa'), v: t('Fallos que importan', 'Garrantzitsuak diren akatsak') },
                { k: t('Continuidad', 'Jarraitutasuna'), v: t('Que se nota', 'Nabaritzen dena') },
              ].map((item) => (
                <div key={item.k} className="rounded-3xl border border-slate-100 bg-slate-50 px-6 py-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{item.k}</div>
                  <div className="mt-2 text-sm font-black text-slate-900">{item.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[3.5rem] border border-slate-100 bg-white p-10 md:p-12 [@media(max-height:800px)]:p-8 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  {t('Inicio de sesión', 'Saio hasiera')}
                </div>
                <div className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
                  {t('Accede', 'Sartu')}
                </div>
              </div>
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('Volver', 'Itzuli')}
                </button>
              ) : null}
            </div>

            <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <div className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t('Identificador', 'Erabiltzailea')}
                </div>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-800 outline-none transition-all focus:border-indigo-400"
                  placeholder={t('Usuario', 'Erabiltzailea')}
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <div className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t('Clave', 'Pasahitza')}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-800 outline-none transition-all focus:border-indigo-400"
                  placeholder="********"
                  autoComplete="current-password"
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
                className="group flex w-full items-center justify-center gap-4 rounded-[2rem] bg-indigo-600 px-6 py-5 text-lg font-black text-white shadow-xl shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <LogIn className="h-6 w-6" />}
                {t('Iniciar sesión', 'Saioa hasi')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
