import { createClient, type Session } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './supabaseConfig';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const supabaseAuthStorageKey = `sb-${projectRef}-auth-token`;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
};

export const isInvalidRefreshTokenError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('invalid refresh token') || message.includes('refresh token not found');
};

export const clearSupabaseAuthStorage = () => {
  if (typeof window === 'undefined') return;

  const storageKeys = [
    supabaseAuthStorageKey,
    `${supabaseAuthStorageKey}-code-verifier`,
    'supabase.auth.token',
    'supabase.auth.token-code-verifier',
  ];

  for (const key of storageKeys) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

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
