import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const DEFAULT_ALLOWED_CURRICULUM_KEYS = ['administrativo', 'auxiliar-administrativo'] as const;

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
} as const;

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });

const readText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const canonicalizeAccessKey = (value: string) =>
  value.trim().toLowerCase().replace(/[_\s]+/g, '-').replace(/-+/g, '-');

const getSupabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? '';

const getServiceRoleKey = () =>
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY') ??
  '';

const getAuthToken = (req: Request) => {
  const authHeader = req.headers.get('authorization') ?? '';
  const [scheme, token] = authHeader.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    throw new Error('Missing authorization header.');
  }
  return token.trim();
};

const readAllowedCurriculumKeys = async (req: Request) => {
  const fromEnv = readText(Deno.env.get('RESTRICTED_QUESTION_BANK_GUEST_ALLOWED_CURRICULUM_KEYS') ?? '')
    .split(',')
    .map(canonicalizeAccessKey)
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const rawAllowed =
      (Array.isArray(body?.allowedCurriculumKeys)
        ? (body?.allowedCurriculumKeys as unknown[])
        : Array.isArray(body?.allowed_curriculum_keys)
          ? (body?.allowed_curriculum_keys as unknown[])
          : []) ?? [];

    const allowed = rawAllowed
      .map((value) => (typeof value === 'string' ? value : ''))
      .map(canonicalizeAccessKey)
      .filter(Boolean);

    if (allowed.length > 0) return allowed;
  } catch {
    void 0;
  }

  return Array.from(DEFAULT_ALLOWED_CURRICULUM_KEYS);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ message: 'Method not allowed.' }, { status: 405 });
    }

    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceRoleKey();
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Supabase env missing.');
    }

    const accessToken = getAuthToken(req);
    const allowed = await readAllowedCurriculumKeys(req);

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await service.auth.getUser(accessToken);
    if (userError || !userData.user) {
      throw new Error('Sesion no valida.');
    }

    const userId = userData.user.id;
    const currentAppMetadata =
      userData.user.app_metadata && typeof userData.user.app_metadata === 'object'
        ? (userData.user.app_metadata as Record<string, unknown>)
        : {};

    await service.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...currentAppMetadata,
        role: 'restricted_question_bank_viewer',
        allowed_curriculum_keys: allowed,
        allowedCurriculumKeys: allowed,
      },
    });

    await service
      .schema('public')
      .from('restricted_question_bank_access')
      .upsert(
        {
          user_id: userId,
          role: 'restricted_question_bank_viewer',
          allowed_curriculum_keys: allowed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    return jsonResponse({ userId, role: 'restricted_question_bank_viewer', allowedCurriculumKeys: allowed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ message }, { status: 400 });
  }
});

