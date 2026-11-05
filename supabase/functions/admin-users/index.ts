import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { createRemoteJWKSet, jwtVerify } from 'jsr:@panva/jose@6';
import { buildCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

type Json = Record<string, unknown>;


const readText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const canonicalizeAccessKey = (value: string) =>
  value.trim().toLowerCase().replace(/[_\s]+/g, '-').replace(/-+/g, '-');
const readMetaUsername = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const username = record.current_username;
  return typeof username === 'string' ? username : null;
};

const findUserIdByEmail = async (service: ReturnType<typeof createClient>, email: string) => {
  const target = readText(email).toLowerCase();
  if (!target) return null;
  for (let page = 1; page <= 5; page += 1) {
    const result = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw result.error;
    const users = (result.data?.users ?? []) as Array<Record<string, unknown>>;
    const match = users.find((u) => readText(u.email).toLowerCase() === target);
    const id = match ? readText(match.id) : '';
    if (id) return id;
    if (users.length < 200) break;
  }
  return null;
};

let supabaseJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const getSupabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? '';
const getJwtIssuer = () => Deno.env.get('SB_JWT_ISSUER') ?? `${getSupabaseUrl()}/auth/v1`;
const getSupabaseJwks = () => {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error('Supabase env missing.');
  }
  if (!supabaseJwks) {
    supabaseJwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return supabaseJwks;
};

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

const assertAdmin = async (req: Request) => {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error('Supabase env missing.');
  }
  const accessToken = getAuthToken(req);
  let userId = '';
  try {
    const verified = await jwtVerify(accessToken, getSupabaseJwks(), {
      issuer: getJwtIssuer(),
      audience: 'authenticated',
    });
    userId = readText(verified.payload.sub);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('admin-users jwt verify failed', { message });
    throw new Error('Sesion no valida.');
  }

  if (!userId) {
    throw new Error('Sesion no valida.');
  }

  const service = getServiceClient(supabaseUrl);
  const { data, error } = await service.auth.admin.getUserById(userId);
  if (error || !data.user || (data.user.banned_until && Date.parse(data.user.banned_until) > Date.now())) {
    console.error('admin-users auth user lookup failed', {
      userId,
      message: error?.message ?? 'Missing user.',
    });
    throw new Error('Sesion no valida.');
  }

  // Validate permissions using trusted server-side tables, never JWT email or user_metadata.
  const { data: owner, error: ownerError } = await service
    .from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  if (ownerError) throw ownerError;
  const { data: role, error: roleError } = await service.schema('app')
    .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (roleError) throw roleError;
  const isOwner = Boolean(owner && role);
  const { data: managed, error: managedError } = await service
    .from('quantia_admin_permissions').select('permission')
    .eq('user_id', userId).eq('permission', 'users.manage').maybeSingle();
  if (managedError) throw managedError;
  if (!isOwner && !managed) throw new Error('Acceso denegado.');
  return { supabaseUrl, service, userId, isOwner };
};

const getServiceClient = (supabaseUrl: string) => {
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) {
    throw new Error('Service role key missing.');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
};

const pickUserIdColumn = async (service: ReturnType<typeof createClient>, schema: string, table: string) => {
  try {
    const { data, error } = await service
      .schema('information_schema')
      .from('columns')
      .select('column_name')
      .eq('table_schema', schema)
      .eq('table_name', table);
    if (error || !Array.isArray(data)) return 'user_id';
    const names = new Set(data.map((row) => String((row as Record<string, unknown>).column_name)));
    if (names.has('user_id')) return 'user_id';
    if (names.has('account_id')) return 'account_id';
    if (names.has('owner_id')) return 'owner_id';
    return 'user_id';
  } catch {
    return 'user_id';
  }
};

const getTableColumns = async (service: ReturnType<typeof createClient>, schema: string, table: string) => {
  try {
    const { data, error } = await service
      .schema('information_schema')
      .from('columns')
      .select('column_name')
      .eq('table_schema', schema)
      .eq('table_name', table);
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => String((row as Record<string, unknown>).column_name));
  } catch {
    return [];
  }
};

const pickNameColumn = (columns: string[]) => {
  const preferred = ['display_name', 'full_name', 'name', 'current_username', 'username'];
  for (const key of preferred) {
    if (columns.includes(key)) return key;
  }
  return null;
};

const resolveProfileSource = async (service: ReturnType<typeof createClient>) => {
  const candidates = [
    { schema: 'public', table: 'profiles' },
    { schema: 'app', table: 'user_profiles' },
  ] as const;
  for (const candidate of candidates) {
    const columns = await getTableColumns(service, candidate.schema, candidate.table);
    if (columns.length === 0) continue;
    const userIdColumn = columns.includes('user_id') ? 'user_id' : columns.includes('id') ? 'id' : null;
    const nameColumn = pickNameColumn(columns);
    if (userIdColumn && nameColumn) {
      return { schema: candidate.schema, table: candidate.table, userIdColumn, nameColumn };
    }
  }
  return null;
};

const upsertProfileName = async (service: ReturnType<typeof createClient>, params: { userId: string; username: string }) => {
  const source = await resolveProfileSource(service);
  if (!source) return;
  const client = source.schema === 'app' ? service.schema('app') : service.schema('public');
  const updates: Record<string, unknown> = { [source.nameColumn]: params.username };
  const where: Record<string, unknown> = { [source.userIdColumn]: params.userId };
  const existing = await client.from(source.table).select(source.userIdColumn).match(where).maybeSingle();
  if (!existing.error && existing.data) {
    await client.from(source.table).update(updates).match(where);
    return;
  }
  await client.from(source.table).insert({ ...where, ...updates });
};

const resolveCurriculumFromOppositionId = async (service: ReturnType<typeof createClient>, oppositionId: string) => {
  try {
    const { data, error } = await service
      .schema('public')
      .from('opposition_configs')
      .select('config_json')
      .eq('opposition_id', oppositionId)
      .maybeSingle();
    if (error || !data || typeof data !== 'object') return null;
    const cfg = (data as Record<string, unknown>).config_json as Record<string, unknown> | null;
    if (!cfg || typeof cfg !== 'object') return null;
    return readText(cfg.curriculum) || readText(cfg.curriculum_key) || readText(cfg.curriculumKey) || null;
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  const productionOrigins = ['https://kuantia.vercel.app'];
  const preflight = corsPreflightResponse(req, productionOrigins);
  if (preflight) return preflight;

  const corsHeaders = buildCorsHeaders(req, productionOrigins);
  const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), {
      ...init,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...corsHeaders,
        ...(init.headers ?? {}),
      },
    });

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { service, isOwner, supabaseUrl, userId: actorId } = await assertAdmin(req);
    const body = (await req.json().catch(() => ({}))) as Json;
    const action = readText(body.action).toLowerCase();
    // Delegated managers may administer learners, never owners or other managers.
    const targetUserId = readText(body.userId);
    if (targetUserId && targetUserId !== '') {
      const { data: targetOwner, error: ownerLookupError } = await service
        .from('admin_users').select('user_id').eq('user_id', targetUserId).maybeSingle();
      if (ownerLookupError) throw ownerLookupError;
      const { data: targetRole, error: roleLookupError } = await service.schema('app')
        .from('user_roles').select('role').eq('user_id', targetUserId).eq('role', 'admin').maybeSingle();
      if (roleLookupError) throw roleLookupError;
      const { data: targetManager, error: managerLookupError } = await service
        .from('quantia_admin_permissions').select('permission').eq('user_id', targetUserId).limit(1);
      if (managerLookupError) throw managerLookupError;
      if (!isOwner && (targetOwner || targetRole || (targetManager?.length ?? 0) > 0)) {
        throw new Error('Acceso denegado.');
      }
    }
    if (!isOwner && (action === 'delete' || action === 'reset_progress' || action === 'set_password')) {
      throw new Error('Acceso denegado.');
    }

    if (action === 'learning_record') {
      if (!targetUserId) throw new Error('Alumno requerido.');
      if (!isOwner) {
        const check = await service.from('quantia_admin_permissions').select('permission')
          .eq('user_id', actorId).eq('permission','statistics.read').maybeSingle();
        if (check.error) throw check.error;
        if (!check.data) throw new Error('Acceso denegado.');
      }
      const sources = {
        sessions: ['app','practice_sessions','started_at,curriculum,mode,title,finished_at,score,total','started_at','session_id'],
        answers: ['app','question_attempt_events','answered_at,curriculum,question_id,selected_option,correct_option,is_correct','answered_at','id'],
        visits: ['public','user_question_activity','viewed_at,curriculum,surface,mode,question_number,answered_at','viewed_at','event_id'],
        legacy: ['app','practice_attempts','answered_at,curriculum,question_number,category,is_correct','answered_at','attempt_id'],
        notes: ['public','user_notes','updated_at,question_id,content','updated_at','question_id'],
        highlights: ['public','user_highlights_v2','updated_at,question_id,content_type,category','updated_at','id'],
        goals: ['app','exam_targets','updated_at,curriculum,exam_date,daily_new_capacity,daily_review_capacity','updated_at','curriculum'],
      } as const;
      const section = readText(body.section);
      if (!Object.hasOwn(sources,section)) throw new Error('Sección desconocida.');
      const page = Number(body.page ?? 1);
      if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new Error('Página inválida.');
      const [schema,table,fields,date,key] = sources[section as keyof typeof sources];
      const result = await service.schema(schema).from(table).select(fields,{count:'exact'})
        .eq('user_id',targetUserId).order(date,{ascending:false,nullsFirst:false}).order(key)
        .range((page-1)*20,page*20-1);
      if (result.error) throw result.error;
      return jsonResponse({rows:result.data,count:result.count});
    }

    if (action === 'list') {
      const page = Math.max(1, Number(body.page ?? 1));
      const perPage = Math.max(10, Math.min(200, Number(body.perPage ?? 50)));
      const search = readText(body.search).toLowerCase();

      let data: { users?: Array<{ id: string; email?: string; user_metadata?: unknown; created_at?: string; last_sign_in_at?: string }>; total?: unknown } = {};
      try {
        const result = await service.auth.admin.listUsers({ page, perPage });
        data = result.data ?? {};
        if (result.error) throw result.error;
      } catch (error) {
        const serviceRoleExists = Boolean(
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY'),
        );
        const serviceKeySource = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
          ? 'SUPABASE_SERVICE_ROLE_KEY'
          : Deno.env.get('SERVICE_ROLE_KEY')
            ? 'SERVICE_ROLE_KEY'
            : 'missing';
        const err = error as Record<string, unknown> | null;
        const name = typeof err?.name === 'string' ? err.name : null;
        const message = typeof err?.message === 'string' ? err.message : String(error);
        const stack = typeof err?.stack === 'string' ? err.stack : null;
        console.error('admin-users listUsers failed', {
          supabaseUrl,
          serviceRoleExists,
          serviceKeySource,
          errorType: typeof error,
          name,
          message,
          stack,
        });
        return jsonResponse({ error: 'listUsers failed', detail: message }, { status: 500 });
      }

      const protectedIds = new Set<string>();
      if (!isOwner) {
        for (const [schema, table, roleFilter] of [
          ['public', 'admin_users', false], ['app', 'user_roles', true],
          ['public', 'quantia_admin_permissions', false],
        ] as const) {
          let query = service.schema(schema).from(table).select('user_id');
          if (roleFilter) query = query.eq('role', 'admin');
          const { data: protectedRows, error: protectedError } = await query;
          if (protectedError) throw protectedError;
          for (const row of protectedRows ?? []) protectedIds.add(row.user_id);
        }
      }
      const users = (data.users ?? []).filter((u) => {
        if (protectedIds.has(u.id)) return false;
        if (!search) return true;
        const email = (u.email ?? '').toLowerCase();
        const username = (readMetaUsername(u.user_metadata) ?? '').toLowerCase();
        return email.includes(search) || username.includes(search);
      });

      const profileSource = await resolveProfileSource(service);
      const profileNameByUser: Record<string, string | null> = {};
      if (profileSource) {
        try {
          const ids = users.map((u) => u.id);
          const client = profileSource.schema === 'app' ? service.schema('app') : service.schema('public');
          const { data: profiles } = await client
            .from(profileSource.table)
            .select(`${profileSource.userIdColumn},${profileSource.nameColumn}`)
            .in(profileSource.userIdColumn, ids)
            .limit(1000);
          if (Array.isArray(profiles)) {
            for (const row of profiles as Record<string, unknown>[]) {
              const uid = readText(row[profileSource.userIdColumn]);
              if (!uid) continue;
              profileNameByUser[uid] = readText(row[profileSource.nameColumn]) || null;
            }
          }
        } catch {
          void 0;
        }
      }

      const ids = users.map((u) => u.id);
      let activeByUser: Record<string, { activeOppositionId: string | null; activeCurriculum: string | null }> = {};
      try {
        const { data: contexts } = await service
          .schema('public')
          .from('user_opposition_profiles')
          .select('*')
          .in('user_id', ids)
          .eq('is_active_context', true)
          .order('is_primary', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(500);
        if (Array.isArray(contexts)) {
          const oppositionIds: string[] = [];
          for (const row of contexts as Record<string, unknown>[]) {
            const uid = readText(row.user_id);
            if (!uid || activeByUser[uid]) continue;
            const oppositionId = readText(row.opposition_id);
            activeByUser[uid] = {
              activeOppositionId: oppositionId || null,
              activeCurriculum: null,
            };
            if (oppositionId) oppositionIds.push(oppositionId);
          }

          if (oppositionIds.length > 0) {
            const { data: configs } = await service
              .schema('public')
              .from('opposition_configs')
              .select('opposition_id,config_json')
              .in('opposition_id', oppositionIds);
            const mapByOpposition: Record<string, string | null> = {};
            if (Array.isArray(configs)) {
              for (const row of configs as Record<string, unknown>[]) {
                const oppositionId = readText(row.opposition_id);
                if (!oppositionId || mapByOpposition[oppositionId]) continue;
                const cfg = (row.config_json ?? null) as Record<string, unknown> | null;
                if (!cfg || typeof cfg !== 'object') {
                  mapByOpposition[oppositionId] = null;
                  continue;
                }
                mapByOpposition[oppositionId] =
                  readText(cfg.curriculum) || readText(cfg.curriculum_key) || readText(cfg.curriculumKey) || null;
              }
            }
            for (const uid of Object.keys(activeByUser)) {
              const oppositionId = activeByUser[uid]?.activeOppositionId;
              if (!oppositionId) continue;
              const curriculum = mapByOpposition[oppositionId] ?? null;
              if (!curriculum) continue;
              activeByUser[uid].activeCurriculum = curriculum;
            }
          }
        }
      } catch {
        activeByUser = {};
      }

      return jsonResponse({
        page,
        perPage,
        total: typeof data.total === 'number' ? Math.max(0, data.total - protectedIds.size) : null,
        items: users.map((u) => ({
          userId: u.id,
          email: u.email ?? null,
          createdAt: u.created_at ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
          currentUsername: profileNameByUser[u.id] ?? readMetaUsername(u.user_metadata),
          activeOppositionId: activeByUser[u.id]?.activeOppositionId ?? null,
          activeCurriculum: activeByUser[u.id]?.activeCurriculum ?? null,
        })),
      });
    }

    if (action === 'detail') {
      const userId = readText(body.userId);
      if (!userId) throw new Error('userId required.');
      const { data, error } = await service.auth.admin.getUserById(userId);
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error('User not found.');

      const profileSource = await resolveProfileSource(service);
      let profileName: string | null = null;
      if (profileSource) {
        try {
          const client = profileSource.schema === 'app' ? service.schema('app') : service.schema('public');
          const { data: profileRow } = await client
            .from(profileSource.table)
            .select(`${profileSource.nameColumn}`)
            .eq(profileSource.userIdColumn, userId)
            .maybeSingle();
          if (profileRow && typeof profileRow === 'object') {
            profileName = readText((profileRow as Record<string, unknown>)[profileSource.nameColumn]) || null;
          }
        } catch {
          profileName = null;
        }
      }

      let activeOppositionId: string | null = null;
      let activeCurriculum: string | null = null;

      try {
        const query = service
          .schema('public')
          .from('user_opposition_profiles')
          .select('*')
          .eq('user_id', userId)
          .order('is_primary', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(5);

        const { data: activeContexts } = await query.eq('is_active_context', true);
        const firstActive = Array.isArray(activeContexts) ? (activeContexts[0] as Record<string, unknown> | undefined) : undefined;
        const { data: anyContexts } = await query;
        const firstAny = Array.isArray(anyContexts) ? (anyContexts[0] as Record<string, unknown> | undefined) : undefined;
        const first = firstActive ?? firstAny;
        if (first) activeOppositionId = readText(first.opposition_id) || null;

        if (activeOppositionId) {
          activeCurriculum = await resolveCurriculumFromOppositionId(service, activeOppositionId);
        }
      } catch {
        activeOppositionId = null;
      }

      return jsonResponse({
        userId: user.id,
        email: user.email ?? null,
        createdAt: user.created_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        currentUsername: profileName ?? readMetaUsername(user.user_metadata),
        activeOppositionId,
        activeCurriculum,
      });
    }

    if (action === 'create') {
      const email = readText(body.email);
      const password = readText(body.password);
      const username = readText(body.username);
      if (!email || !password) throw new Error('email/password required.');
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: username ? { current_username: username } : undefined,
      });
      if (error) throw error;
      const createdId = readText(data.user?.id);
      if (createdId && username) {
        await upsertProfileName(service, { userId: createdId, username });
      }
      return jsonResponse({ userId: data.user?.id ?? null });
    }

    if (action === 'create_restricted_question_bank_viewer') {
      const email = readText(body.email);
      const password = readText(body.password);
      const username = readText(body.username);
      const rawAllowed =
        (Array.isArray((body as Record<string, unknown>).allowedCurriculumKeys)
          ? ((body as Record<string, unknown>).allowedCurriculumKeys as unknown[])
          : Array.isArray((body as Record<string, unknown>).allowed_curriculum_keys)
            ? ((body as Record<string, unknown>).allowed_curriculum_keys as unknown[])
            : []) ?? [];

      const allowed = rawAllowed
        .map((value) => (typeof value === 'string' ? value : ''))
        .map(canonicalizeAccessKey)
        .filter(Boolean);

      if (!email) throw new Error('email required.');

      const effectiveAllowed =
        allowed.length > 0 ? allowed : ['administrativo', 'auxiliar-administrativo'];

      let createdId = '';
      const { data, error } = await service.auth.admin.createUser({
        email,
        ...(password ? { password } : {}),
        email_confirm: true,
        user_metadata: username ? { current_username: username } : undefined,
      });
      if (error) {
        const message = error.message ?? '';
        const alreadyExists = /already|exists|registered|duplicate/i.test(message);
        if (!alreadyExists) throw error;
        // Never turn an email-only create into account takeover or credential reset.
        if (!isOwner) throw new Error('Acceso denegado.');
        const existingId = await findUserIdByEmail(service, email);
        if (!existingId) throw error;
        createdId = existingId;
        if (password) {
          await service.auth.admin.updateUserById(createdId, { password });
        }
      } else {
        createdId = readText(data.user?.id);
      }
      if (!createdId) throw new Error('User not created.');

      const { error: metadataError } = await service.auth.admin.updateUserById(createdId, {
        app_metadata: {
          role: 'restricted_question_bank_viewer',
          allowed_curriculum_keys: effectiveAllowed,
        },
      });

      if (metadataError) throw metadataError;

      if (username) {
        await upsertProfileName(service, { userId: createdId, username });
      }

      const { error: accessError } = await service
        .schema('public')
        .from('restricted_question_bank_access')
        .upsert(
          {
            user_id: createdId,
            role: 'restricted_question_bank_viewer',
            allowed_curriculum_keys: effectiveAllowed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (accessError) throw accessError;

      const redirectTo = readText((body as Record<string, unknown>).redirectTo) || req.headers.get('origin') || '';
      let magicLink: string | null = null;
      try {
        const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: redirectTo ? { redirectTo } : undefined,
        } as unknown as Record<string, unknown>);
        if (linkError) throw linkError;
        const properties =
          linkData &&
          typeof linkData === 'object' &&
          'properties' in linkData &&
          linkData.properties &&
          typeof linkData.properties === 'object'
            ? (linkData.properties as Record<string, unknown>)
            : null;
        magicLink =
          typeof properties?.action_link === 'string' ? properties.action_link : null;
      } catch {
        magicLink = null;
      }

      return jsonResponse({ userId: createdId, allowedCurriculumKeys: effectiveAllowed, magicLink });
    }

    if (action === 'update_name') {
      const userId = readText(body.userId);
      const username = readText(body.username);
      if (!userId || !username) throw new Error('userId/username required.');
      await upsertProfileName(service, { userId, username });
      const { error } = await service.auth.admin.updateUserById(userId, {
        user_metadata: { current_username: username },
      });
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === 'set_active_opposition') {
      const userId = readText(body.userId);
      const oppositionId = readText(body.oppositionId);
      if (!userId || !oppositionId) throw new Error('userId/oppositionId required.');
      const { error: rpcErr } = await service.rpc('admin_set_active_opposition_context', {
        p_user_id: userId,
        p_opposition_id: oppositionId,
      });
      if (rpcErr) throw rpcErr;
      return jsonResponse({ ok: true });
    }

    if (action === 'set_password') {
      const userId = readText(body.userId);
      const password = readText(body.password);
      if (!userId || !password) throw new Error('userId/password required.');
      const { error } = await service.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === 'disable') {
      const userId = readText(body.userId);
      if (!userId) throw new Error('userId required.');
      const { error } = await service.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === 'enable') {
      const userId = readText(body.userId);
      if (!userId) throw new Error('userId required.');
      const { error } = await service.auth.admin.updateUserById(userId, { ban_duration: 'none' });
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === 'delete') {
      const userId = readText(body.userId);
      if (!userId) throw new Error('userId required.');
      const { error } = await service.auth.admin.deleteUser(userId);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === 'reset_progress') {
      const userId = readText(body.userId);
      if (!userId) throw new Error('userId required.');
      const deletions: Array<{ schema: 'app' | 'public'; table: string }> = [
        { schema: 'app', table: 'question_attempt_events' },
        { schema: 'app', table: 'practice_attempts' },
        { schema: 'app', table: 'user_question_state' },
        { schema: 'app', table: 'practice_sessions' },
        { schema: 'app', table: 'practice_profiles' },
        { schema: 'app', table: 'exam_targets' },
      ];
      for (const entry of deletions) {
        try {
          const userIdColumn = await pickUserIdColumn(service, entry.schema, entry.table);
          const client = entry.schema === 'app' ? service.schema('app') : service.schema('public');
          await client.from(entry.table).delete().eq(userIdColumn, userId);
        } catch {
          continue;
        }
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('admin-users error:', message);
    const status =
      message === 'Acceso denegado.'
        ? 403
        : message === 'Missing authorization header.' || message === 'Sesion no valida.'
          ? 401
          : 500;
    return jsonResponse({ error: message }, { status });
  }
});
