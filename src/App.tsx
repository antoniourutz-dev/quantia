import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AuthScreen from './components/AuthScreen';
import AppErrorBoundary from './components/app/AppErrorBoundary';
import { loginWithUsername } from './lib/auth';
import { LocaleProvider, getLocaleForCurriculum } from './lib/locale';
import { supabaseConfigError } from './lib/supabaseConfig';
import { getSafeSupabaseSession, supabase } from './lib/supabaseClient';

const AuthenticatedAppShell = lazy(() => import('./components/app/AuthenticatedAppShell'));
const RestrictedQuestionBankShell = lazy(() => import('./components/app/RestrictedQuestionBankShell'));

function AssignmentGate({session, restricted}: {session: Session; restricted: boolean}) {
  const [scope, setScope] = useState<{manager:boolean; keys:string[]} | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    const refresh = async () => {
      const ticket = ++sequence;
      try {
        const {data,error} = await supabase.rpc('student_access_scope');
        if (!active || ticket !== sequence) return;
        if (error || !Array.isArray(data?.keys) || typeof data?.manager !== 'boolean') throw new Error();
        setScope(data); setFailed(false);
      } catch {
        if (active && ticket === sequence) { setFailed(true); setScope(null); }
      }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 60000);
    return () => { active = false; window.removeEventListener('focus', refresh); window.clearInterval(interval); };
  }, [session.user.id]);
  if (!scope || (!scope.manager && !scope.keys.length)) return <main className="mx-auto max-w-md p-8">
    <h1 className="text-xl font-bold">{failed ? 'No se pudieron comprobar los permisos' : !scope ? 'Consultando permisos…' : 'Sin oposiciones asignadas'}</h1>
    {scope && <p>Tu administrador puede asignarte oposiciones desde tu ficha de alumno.</p>}
    {failed && <button onClick={() => window.location.reload()}>Reintentar</button>}
    <button className="mt-4 block" onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button>
  </main>;
  const keys = scope.manager ? undefined : scope.keys;
  const key = JSON.stringify(keys);
  return restricted
    ? <RestrictedQuestionBankShell key={key} session={session} assignedKeys={keys} />
    : <AuthenticatedAppShell key={key} session={session} assignedKeys={keys} />;
}

const CURRICULUM_STORAGE_KEY = 'quantia_curriculum';
const LEGACY_CURRICULUM_STORAGE_KEY = 'osakitest_curriculum';
const DEFAULT_PUBLIC_CURRICULUM = 'administrativo';

type SessionAppMetadata = Record<string, unknown> & {
  role?: unknown;
};

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

const readSessionAppMetadata = (session: Session): SessionAppMetadata | null => {
  const metadata = session.user.app_metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  return metadata as SessionAppMetadata;
};

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const publicLocale = useMemo(() => getLocaleForCurriculum(readLastKnownCurriculum()), [session]);
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
        <AuthScreen
          error={authError}
          loading={authLoading}
          onSubmit={handleLogin}
        />
      </LocaleProvider>
    );
  }

  const appMetadata = readSessionAppMetadata(session);
  const appRole = typeof appMetadata?.role === 'string' ? appMetadata.role : '';
  const isRestrictedQuestionBankViewer = appRole === 'restricted_question_bank_viewer';

  return (
    <AppErrorBoundary>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        }
      >
        <AssignmentGate key={session.user.id} session={session} restricted={isRestrictedQuestionBankViewer} />
      </Suspense>
    </AppErrorBoundary>
  );
}
