import { supabase } from './supabaseClient';
import { supabaseAnonKey, supabaseUrl } from './supabaseConfig';

type LoginFunctionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

const getLoginFunctionUrl = () =>
  import.meta.env.VITE_LOGIN_WITH_USERNAME_FUNCTION_URL ||
  `${supabaseUrl}/functions/v1/login-with-username`;

const buildLegacyInternalEmail = (usernameInput: string) => {
  const normalized = usernameInput.trim().toLowerCase();
  return normalized.includes('@') ? normalized : `${normalized}@quantia.app`;
};

const canUseLegacyFallback =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_LEGACY_USERNAME_LOGIN_FALLBACK === '1';

const signInWithLegacyEmail = async (username: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: buildLegacyInternalEmail(username),
    password,
  });

  if (error || !data.session) {
    throw new Error(
      error?.message?.includes('Invalid login credentials')
        ? 'Usuario o contrasena incorrectos. Revisa tus datos.'
        : error?.message || 'No se ha podido iniciar sesion. Intentalo de nuevo.',
    );
  }

  return data.session;
};

const tryLegacyFallback = async (username: string, password: string, prefixMessage: string) => {
  try {
    return await signInWithLegacyEmail(username, password);
  } catch (legacyError) {
    const legacyMessage =
      legacyError instanceof Error
        ? legacyError.message
        : 'No se ha podido iniciar sesion. Intentalo de nuevo.';

    throw new Error(`${prefixMessage} ${legacyMessage}`);
  }
};

export const loginWithUsername = async (username: string, password: string) => {
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
      if (canUseLegacyFallback) {
        return await tryLegacyFallback(
          username,
          password,
          'El servicio de acceso por usuario no esta disponible todavia. El acceso alternativo tambien ha fallado:',
        );
      }

      throw new Error(
        'No esta desplegado el servicio de acceso por usuario. Publica la funcion `login-with-username`.',
      );
    }

    if (!response.ok || !payload?.access_token || !payload.refresh_token) {
      throw new Error(payload?.message || 'Usuario o contrasena incorrectos. Revisa tus datos.');
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

    if (canUseLegacyFallback && isNetworkLevelFailure) {
      return await tryLegacyFallback(
        username,
        password,
        'El servicio de acceso por usuario no esta disponible en este momento. El acceso alternativo tambien ha fallado:',
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
