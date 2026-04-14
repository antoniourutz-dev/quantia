import { useState } from 'react';
import { GraduationCap, Loader2, LogIn } from 'lucide-react';
import { useAppLocale } from '../lib/locale';

interface AuthScreenProps {
  error: string | null;
  loading: boolean;
  onSubmit: (username: string, password: string) => Promise<void>;
}

export default function AuthScreen({ error, loading, onSubmit }: AuthScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const locale = useAppLocale();
  const isBasque = locale === 'eu';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(username, password);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a1a] px-6 py-12">
      <div className="absolute top-0 right-0 -mt-20 -mr-20 h-[600px] w-[600px] animate-pulse rounded-full bg-indigo-600 opacity-20 blur-[140px]"></div>
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-[400px] w-[400px] rounded-full bg-emerald-600 opacity-10 blur-[120px]"></div>

      <div className="glass-premium relative z-10 w-full max-w-md rounded-[3.5rem] border border-white/10 p-12 shadow-premium-xl animate-in fade-in zoom-in duration-1000">
        <div className="mb-12 flex flex-col items-center gap-6 text-center">
          <div className="animate-float-slow rounded-[2rem] bg-gradient-to-br from-indigo-500 to-emerald-500 p-5 text-white shadow-glow-indigo">
            <GraduationCap className="h-10 w-10" />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">
              Quantia Access
            </p>
            <h1 className="text-4xl font-black tracking-tighter text-slate-800">Quantia</h1>
          </div>
        </div>

        <p className="mb-10 px-4 text-center text-sm font-bold uppercase tracking-widest text-slate-400 opacity-80">
          {isBasque
            ? 'Sartu Supabaserekin konektatutako zure praktika-ingurunera.'
            : 'Accede a tu entorno de practica conectado con Supabase.'}
        </p>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <span className="ml-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {isBasque ? 'Erabiltzailea' : 'Identificador'}
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-6 py-4 font-black text-slate-800 outline-none transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-premium"
              placeholder={isBasque ? 'Quantia erabiltzailea' : 'Usuario Quantia'}
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <span className="ml-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {isBasque ? 'Pasahitza' : 'Clave de acceso'}
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-6 py-4 font-black text-slate-800 outline-none transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-premium"
              placeholder="********"
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <div className="animate-in shake rounded-2xl border border-rose-100 bg-rose-50 px-6 py-4 text-xs font-bold text-rose-600 duration-500">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="group relative flex w-full items-center justify-center gap-4 overflow-hidden rounded-3xl bg-indigo-600 px-6 py-5 text-lg font-black text-white shadow-glow-indigo transition-all duration-500 hover:-translate-y-1 hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:shadow-none"
          >
            <div className="absolute inset-0 translate-x-[-100%] bg-white/10 transition-transform duration-1000 group-hover:translate-x-[100%]"></div>
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <LogIn className="h-6 w-6" />}
            <span className="relative z-10">{isBasque ? 'SAIOA HASI' : 'INICIAR SESION'}</span>
          </button>
        </form>

        <p className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 opacity-40">
          {isBasque ? 'SEGURTASUN INGURUNEA • SUPABASE LOTUTA' : 'SECURE ENVIRONMENT • SUPABASE CONNECTED'}
        </p>
      </div>
    </div>
  );
}
