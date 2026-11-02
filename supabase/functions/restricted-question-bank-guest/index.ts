import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { buildCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

const DEFAULT_ALLOWED_CURRICULUM_KEYS = ['administrativo', 'auxiliar-administrativo'] as const;
const DEFAULT_ADMIN_EMAIL = 'admin@oposik.app';

const readText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const canonicalizeAccessKey = (value: string) =>
  value.trim().toLowerCase().replace(/[_\s]+/g, '-').replace(/-+/g, '-');

const readServerAllowlist = () => {
  const configured = readText(Deno.env.get('RESTRICTED_QUESTION_BANK_GUEST_ALLOWED_CURRICULUM_KEYS') ?? '')
    .split(',')
    .map(canonicalizeAccessKey)
    .filter(Boolean);
  return new Set(configured.length > 0 ? configured : DEFAULT_ALLOWED_CURRICULUM_KEYS);
};

const readAccessToken = (req: Request) => {
  const match = /^(?:Bearer)\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  return match?.[1]?.trim() ?? '';
};

Deno.serve(async (req) => {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;
  const corsHeaders = buildCorsHeaders(req);
  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
    });

  if (req.method !== 'POST') return respond(405, { message: 'Method not allowed.' });

  const url = readText(Deno.env.get('SUPABASE_URL'));
  const serviceKey = readText(
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY'),
  );
  if (!url || !serviceKey) return respond(503, { message: 'Service not configured.' });

  const token = readAccessToken(req);
  if (!token) return respond(401, { message: 'Authentication required.' });

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  // The token is verified against Supabase Auth; no user-editable metadata
  // is trusted to decide who can grant restricted access.
  const { data: actorData, error: actorError } = await service.auth.getUser(token);
  if (actorError || !actorData.user) return respond(401, { message: 'Invalid session.' });

  const approvedAdminEmail =
    readText(Deno.env.get('QUANTIA_ADMIN_EMAIL') ?? DEFAULT_ADMIN_EMAIL).toLowerCase();
  if (actorData.user.email?.trim().toLowerCase() !== approvedAdminEmail) {
    return respond(403, { message: 'Administrator access required.' });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = readText(body?.userId ?? body?.user_id);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return respond(400, { message: 'Valid target user ID required.' });
  }
  if (userId === actorData.user.id) {
    return respond(400, { message: 'An administrator cannot change their own role here.' });
  }

  const rawKeys = body?.allowedCurriculumKeys ?? body?.allowed_curriculum_keys;
  const requested = Array.isArray(rawKeys)
    ? rawKeys.filter((value): value is string => typeof value === 'string')
        .map(canonicalizeAccessKey).filter(Boolean)
    : [];
  const allowed = Array.from(new Set(requested));
  const serverAllowlist = readServerAllowlist();
  if (!allowed.length || allowed.some((key) => !serverAllowlist.has(key))) {
    return respond(400, { message: 'Requested curricula are not approved.' });
  }

  const { data: targetData, error: targetError } = await service.auth.admin.getUserById(userId);
  if (targetError || !targetData.user) return respond(404, { message: 'User not found.' });

  const previousMetadata = targetData.user.app_metadata &&
    typeof targetData.user.app_metadata === 'object'
      ? targetData.user.app_metadata as Record<string, unknown>
      : {};
  const { error: updateError } = await service.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...previousMetadata,
      role: 'restricted_question_bank_viewer',
      allowed_curriculum_keys: allowed,
      allowedCurriculumKeys: allowed,
    },
  });
  if (updateError) return respond(500, { message: 'Role update failed.' });

  const { error: accessError } = await service
    .schema('public')
    .from('restricted_question_bank_access')
    .upsert({
      user_id: userId,
      role: 'restricted_question_bank_viewer',
      allowed_curriculum_keys: allowed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (accessError) {
    // Compensate the first write if the second resource cannot be updated.
    const { error: rollbackError } = await service.auth.admin.updateUserById(userId, {
      app_metadata: previousMetadata,
    });
    if (rollbackError) {
      console.error('restricted-question-bank-guest: manual reconciliation required', userId);
    }
    return respond(500, { message: 'Could not persist restricted access.' });
  }

  return respond(200, { userId, role: 'restricted_question_bank_viewer', allowedCurriculumKeys: allowed });
});
