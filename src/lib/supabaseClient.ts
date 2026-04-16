import { createClient, type Session } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './supabaseConfig';

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const supabaseAuthStorageKey = `sb-${projectRef}-auth-token`;
const supabaseAuthStorageKeys = [
  supabaseAuthStorageKey,
  `${supabaseAuthStorageKey}-code-verifier`,
  'supabase.auth.token',
  'supabase.auth.token-code-verifier',
];

const getBrowserStorages = () => {
  if (typeof window === 'undefined') return [];
  return [window.localStorage, window.sessionStorage];
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
};

export const isInvalidRefreshTokenError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('invalid refresh token') || message.includes('refresh token not found');
};

const hasSessionTokenShape = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;

  if (Array.isArray(value)) {
    return value.some((entry) => hasSessionTokenShape(entry));
  }

  const record = value as Record<string, unknown>;
  const accessToken = typeof record.access_token === 'string' ? record.access_token.trim() : '';
  const refreshToken = typeof record.refresh_token === 'string' ? record.refresh_token.trim() : '';

  if (accessToken || refreshToken) {
    return Boolean(accessToken && refreshToken);
  }

  return (
    hasSessionTokenShape(record.currentSession) ||
    hasSessionTokenShape(record.session) ||
    hasSessionTokenShape(record.data)
  );
};

export const clearSupabaseAuthStorage = () => {
  for (const storage of getBrowserStorages()) {
    for (const key of supabaseAuthStorageKeys) {
      storage.removeItem(key);
    }
  }
};

const sanitizeSupabaseAuthStorage = () => {
  for (const storage of getBrowserStorages()) {
    const rawValue = storage.getItem(supabaseAuthStorageKey);
    if (!rawValue) continue;

    try {
      const parsedValue = JSON.parse(rawValue) as unknown;
      if (!hasSessionTokenShape(parsedValue)) {
        clearSupabaseAuthStorage();
        return;
      }
    } catch {
      clearSupabaseAuthStorage();
      return;
    }
  }
};

sanitizeSupabaseAuthStorage();

const safeFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    const text = await response.text().catch(() => '');
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
    const snippet = text.trim().slice(0, 120);
    throw new Error(`Respuesta HTML inesperada (${response.status}) desde ${url || 'fetch'}. ${snippet}`);
  }
  return response;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: safeFetch } });

export const getSafeSupabaseSession = async (): Promise<Session | null> => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (!error) {
    return session;
  }

  if (isInvalidRefreshTokenError(error)) {
    clearSupabaseAuthStorage();
    return null;
  }

  throw error;
};
