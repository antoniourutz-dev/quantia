const supabaseUrlEnv = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKeyEnv = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const missingSupabaseEnvVars = [
  !supabaseUrlEnv ? 'VITE_SUPABASE_URL' : null,
  !supabaseAnonKeyEnv ? 'VITE_SUPABASE_ANON_KEY' : null,
].filter((value): value is string => Boolean(value));

export const supabaseConfigError =
  missingSupabaseEnvVars.length > 0
    ? `Missing Supabase configuration. Define ${missingSupabaseEnvVars.join(' and ')} before starting the app.`
    : null;

export const supabaseUrl = supabaseUrlEnv ?? 'https://placeholder.supabase.co';
export const supabaseAnonKey = supabaseAnonKeyEnv ?? 'missing-supabase-anon-key';
