import { supabase } from './supabaseClient';
import { supabaseAnonKey, supabaseUrl } from './supabaseConfig';

type LoginFunctionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

const FALLBACK_EMAIL_DOMAINS = ['oposik.app', 'quantia.app'] as const;

const getLoginFunctionUrl = () =>
  import.meta.env.VITE_LOGIN_WITH_USERNAME_FUNCTION_URL ||
  `${supabaseUrl}/functions/v1/login-with-username`;

const buildLegacyInternalEmails = (usernameInput: string) => {
  const normalized = usernameInput.trim().toLowerCase();
  if (!normalized) return [];
  if (normalized.includes('@')) return [normalized];
  return Array.from(new Set(FALLBACK_EMAIL_DOMAINS.map((domain) => `${normalized}@${domain}`)));
};

const signInWithLegacyEmail = async (username: string, password: string) => {
  let lastMessage = 'No se ha podido iniciar sesion. Intentalo de nuevo.';

  for (const email of buildLegacyInternalEmails(username)) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.session) {
      return data.session;
    }

    lastMessage = error?.message?.includes('Invalid login credentials')
      ? 'Usuario o contrasena incorrectos. Revisa tus datos.'
      : error?.message || lastMessage;
  }

  throw new Error(lastMessage);
};

const tryLegacyFallback = async (username: string, password: string, prefixMessage?: string) => {
  try {
    return await signInWithLegacyEmail(username, password);
  } catch (legacyError) {
    const legacyMessage =
      legacyError instanceof Error
        ? legacyError.message
        : 'No se ha podido iniciar sesion. Intentalo de nuevo.';

    throw new Error(prefixMessage ? `${prefixMessage} ${legacyMessage}` : legacyMessage);
  }
};

export const loginWithUsername = async (username: string, password: string) => {
  const normalizedUsername = username.trim();
  if (normalizedUsername.includes('@')) {
    return await tryLegacyFallback(
      normalizedUsername,
      password,
      'No se ha podido validar el acceso por email.',
    );
  }

  try {
    const response = await fetch(getLoginFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ username, password }),
    });

    const payload = (await response.json().catch(() => null)) as
      | (Partial<LoginFunctionResponse> & { message?: string })
      | null;

    if (response.status === 404) {
      return await tryLegacyFallback(
        normalizedUsername,
        password,
        'El servicio de acceso por usuario no esta disponible todavia. El acceso directo tambien ha fallado:',
      );
    }

    if (!response.ok || !payload?.access_token || !payload.refresh_token) {
      return await tryLegacyFallback(
        normalizedUsername,
        password,
        payload?.message
          ? `${payload.message} El acceso directo tambien ha fallado:`
          : 'El acceso por usuario no se ha podido resolver. El acceso directo tambien ha fallado:',
      );
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });

    if (error || !data.session) {
      throw new Error('No se ha podido iniciar sesion. Intentalo de nuevo.');
    }

    return data.session;
  } catch (error) {
    const isNetworkLevelFailure =
      error instanceof TypeError ||
      (error instanceof Error && /fetch|network|failed to fetch/i.test(error.message));

    if (isNetworkLevelFailure) {
      return await tryLegacyFallback(
        normalizedUsername,
        password,
        'El servicio de acceso por usuario no esta disponible en este momento. El acceso directo tambien ha fallado:',
      );
    }

    if (error instanceof Error && error.message) {
      throw error;
    }

    throw new Error(
      'El servicio de acceso por usuario no esta disponible. Publica la funcion `login-with-username`.',
    );
  }
};
