import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AuthScreen from './components/AuthScreen';
import EntryScreen from './components/EntryScreen';
import AppErrorBoundary from './components/app/AppErrorBoundary';
import { loginWithUsername } from './lib/auth';
import { LocaleProvider, getLocaleForCurriculum } from './lib/locale';
import { supabaseConfigError } from './lib/supabaseConfig';
import { getSafeSupabaseSession, supabase } from './lib/supabaseClient';

const AuthenticatedAppShell = lazy(() => import('./components/app/AuthenticatedAppShell'));

const CURRICULUM_STORAGE_KEY = 'quantia_curriculum';
const LEGACY_CURRICULUM_STORAGE_KEY = 'osakitest_curriculum';
const DEFAULT_PUBLIC_CURRICULUM = 'administrativo';

const readLastKnownCurriculum = () => {
  try {
    return (
      window.localStorage.getItem(CURRICULUM_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_CURRICULUM_STORAGE_KEY) ||
      DEFAULT_PUBLIC_CURRICULUM
    );
  } catch {
    return DEFAULT_PUBLIC_CURRICULUM;
  }
};

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unauthView, setUnauthView] = useState<'entry' | 'login'>('entry');

  const publicLocale = useMemo(() => getLocaleForCurriculum(readLastKnownCurriculum()), [session, unauthView]);
  const isBasque = publicLocale === 'eu';
  const t = useCallback((es: string, eu: string) => (isBasque ? eu : es), [isBasque]);

  useEffect(() => {
    let disposed = false;

    getSafeSupabaseSession()
      .then((nextSession) => {
        if (disposed) return;
        setSession(nextSession);
        setSessionReady(true);
      })
      .catch((error) => {
        if (disposed) return;
        setAuthError(
          error instanceof Error ? error.message : t('No se ha podido leer la sesion.', 'Ezin izan da saioa irakurri.'),
        );
        setSessionReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthError(null);
      if (!nextSession) {
        setUnauthView('entry');
      }
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [t]);

  const handleLogin = useCallback(async (username: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const nextSession = await loginWithUsername(username, password);
      setSession(nextSession);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : t('No se ha podido iniciar sesion.', 'Ezin izan da saioa hasi.'),
      );
    } finally {
      setAuthLoading(false);
    }
  }, [t]);

  if (supabaseConfigError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-10 text-center">
        <div className="mb-6 max-w-md rounded-3xl border border-rose-100 bg-rose-50 p-6 text-rose-600 shadow-sm">
          <h2 className="mb-2 text-xl font-bold">{t('Error de configuracion', 'Konfigurazio errorea')}</h2>
          <p className="font-medium">
            {t(
              'Faltan las variables de entorno de Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).',
              'Supabase ingurune-aldagaiak falta dira (VITE_SUPABASE_URL eta VITE_SUPABASE_ANON_KEY).',
            )}
          </p>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <LocaleProvider locale={publicLocale}>
        {unauthView === 'entry' ? (
          <EntryScreen onLogin={() => setUnauthView('login')} />
        ) : (
          <AuthScreen
            error={authError}
            loading={authLoading}
            onSubmit={handleLogin}
            onBack={() => setUnauthView('entry')}
          />
        )}
      </LocaleProvider>
    );
  }

  return (
    <AppErrorBoundary>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        }
      >
        <AuthenticatedAppShell session={session} />
      </Suspense>
    </AppErrorBoundary>
  );
}
