import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { buildCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

type LoginRequest = {
  username?: unknown;
  password?: unknown;
};

type Json = Record<string, unknown>;

const USERNAME_ATTEMPT_LIMIT = 8;
const IP_ATTEMPT_LIMIT = 60;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

const readText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const getSupabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? '';
const getAnonKey = () => Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const getServiceRoleKey = () =>
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY') ??
  '';

const jsonResponse = (payload: Json, init: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

const hashRateLimitKey = async (secret: string, value: string) => {
  const bytes = new TextEncoder().encode(`${secret}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const getClientIp = (req: Request) => {
  const forwarded = readText(req.headers.get('x-forwarded-for'));
  return forwarded.split(',')[0]?.trim() || readText(req.headers.get('cf-connecting-ip')) || 'unknown';
};

const consumeRateLimit = async (
  service: ReturnType<typeof createClient>,
  keyHash: string,
  limit: number,
) => {
  const { data, error } = await service.rpc('consume_login_rate_limit', {
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });

  if (error) throw error;
  return data === true;
};

const resolveEmailForUsername = async (
  service: ReturnType<typeof createClient>,
  username: string,
) => {
  const normalized = username.toLowerCase();
  if (normalized.includes('@')) return normalized;

  const { data: indexedUsername, error: indexError } = await service
    .from('login_usernames')
    .select('user_id')
    .eq('username', normalized)
    .maybeSingle();

  if (indexError) throw indexError;
  const userId = readText(indexedUsername?.user_id);
  if (!userId) return null;

  const { data: authUser, error: authUserError } = await service.auth.admin.getUserById(userId);
  if (authUserError) throw authUserError;
  return readText(authUser.user?.email).toLowerCase() || null;
};

Deno.serve(async (req) => {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const corsHeaders = buildCorsHeaders(req);
  if (req.method !== 'POST') {
    return jsonResponse(
      { message: 'Method not allowed.' },
      { status: 405, headers: { ...corsHeaders } },
    );
  }

  const supabaseUrl = getSupabaseUrl();
  const anonKey = getAnonKey();
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(
      { message: 'El servicio de acceso no está disponible.' },
      { status: 503, headers: { ...corsHeaders } },
    );
  }

  const apiKeyHeader = readText(req.headers.get('apikey'));
  if (!apiKeyHeader || apiKeyHeader !== anonKey) {
    return jsonResponse(
      { message: 'Unauthorized.' },
      { status: 401, headers: { ...corsHeaders } },
    );
  }

  const body = (await req.json().catch(() => null)) as LoginRequest | null;
  const username = readText(body?.username);
  const password = readText(body?.password);

  if (!username || !password || username.length > 254 || password.length > 512) {
    return jsonResponse(
      { message: 'Solicitud de acceso no válida.' },
      { status: 400, headers: { ...corsHeaders } },
    );
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const normalizedUsername = username.toLowerCase();

  try {
    const [usernameKey, ipKey] = await Promise.all([
      hashRateLimitKey(serviceRoleKey, `username:${normalizedUsername}`),
      hashRateLimitKey(serviceRoleKey, `ip:${getClientIp(req)}`),
    ]);
    const [usernameAllowed, ipAllowed] = await Promise.all([
      consumeRateLimit(service, usernameKey, USERNAME_ATTEMPT_LIMIT),
      consumeRateLimit(service, ipKey, IP_ATTEMPT_LIMIT),
    ]);

    if (!usernameAllowed || !ipAllowed) {
      return jsonResponse(
        { message: 'Demasiados intentos. Inténtalo de nuevo más tarde.' },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS),
          },
        },
      );
    }
  } catch {
    return jsonResponse(
      { message: 'El servicio de acceso no está disponible.' },
      { status: 503, headers: { ...corsHeaders } },
    );
  }

  let email: string | null = null;
  try {
    email = await resolveEmailForUsername(service, normalizedUsername);
  } catch {
    return jsonResponse(
      { message: 'El servicio de acceso no está disponible.' },
      { status: 503, headers: { ...corsHeaders } },
    );
  }

  if (!email) {
    return jsonResponse(
      { message: 'Usuario o contraseña incorrectos.' },
      { status: 401, headers: { ...corsHeaders } },
    );
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data?.session) {
    return jsonResponse(
      { message: 'Usuario o contraseña incorrectos.' },
      { status: 401, headers: { ...corsHeaders } },
    );
  }

  return jsonResponse(
    {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    { status: 200, headers: { ...corsHeaders } },
  );
});
