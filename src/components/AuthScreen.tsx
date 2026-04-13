import { useState } from 'react';
import { GraduationCap, Loader2, LogIn } from 'lucide-react';

interface AuthScreenProps {
  error: string | null;
  loading: boolean;
  onSubmit: (username: string, password: string) => Promise<void>;
}

export default function AuthScreen({ error, loading, onSubmit }: AuthScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(username, password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a1a] px-6 py-12 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-[600px] h-[600px] bg-indigo-600 rounded-full blur-[140px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-[400px] h-[400px] bg-emerald-600 rounded-full blur-[120px] opacity-10"></div>
      
      <div className="w-full max-w-md glass-premium rounded-[3.5rem] p-12 shadow-premium-xl border border-white/10 relative z-10 animate-in fade-in zoom-in duration-1000">
        <div className="mb-12 flex flex-col items-center text-center gap-6">
          <div className="rounded-[2rem] bg-gradient-to-br from-indigo-500 to-emerald-500 p-5 text-white shadow-glow-indigo animate-float-slow">
            <GraduationCap className="h-10 w-10" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-2">Neural Link v2.0</p>
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter">OsakiTest<span className="text-indigo-600">Pro</span></h1>
          </div>
        </div>

        <p className="mb-10 text-center text-sm font-bold leading-relaxed text-slate-400 uppercase tracking-widest opacity-80 px-4">
          Accede al entorno de alto rendimiento para opositores de élite.
        </p>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <span className="ml-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificador</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-6 py-4 font-black text-slate-800 outline-none transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-premium"
              placeholder="Usuario Quantia"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <span className="ml-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clave de Acceso</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-6 py-4 font-black text-slate-800 outline-none transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-premium"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-4 text-xs font-bold text-rose-600 animate-in shake duration-500">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="group relative flex w-full items-center justify-center gap-4 rounded-3xl bg-indigo-600 px-6 py-5 text-lg font-black text-white shadow-glow-indigo transition-all duration-500 hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:shadow-none overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <LogIn className="h-6 w-6" />}
            <span className="relative z-10">INICIAR SESIÓN ELITE</span>
          </button>
        </form>

        <p className="mt-12 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] opacity-40">
          Secure Environment • Osakidetza OPE
        </p>
      </div>
    </div>
  );
}
