import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { buildCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

type LoginRequest = {
  username?: unknown;
  password?: unknown;
};

type Json = Record<string, unknown>;
type ProfileSource = {
  schema: 'public' | 'app';
  table: string;
  userIdColumn: string;
  nameColumns: string[];
};

const readText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getSupabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? '';
const getAnonKey = () => Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const getServiceRoleKey = () =>
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY') ??
  '';

const readMetaUsernames = (value: unknown) => {
  if (!value || typeof value !== 'object') return [] as string[];
  const record = value as Record<string, unknown>;
  const candidates = [record.current_username, record.username, record.preferred_username];
  return candidates.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
};

const readEmailUsername = (value: unknown) => {
  const email = readText(value).toLowerCase();
  if (!email || !email.includes('@')) return '';
  return email.split('@')[0]?.trim() ?? '';
};

const matchUsername = (candidate: unknown, normalized: string) => {
  const raw = readText(candidate).toLowerCase();
  if (!raw) return false;
  return raw === normalized;
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

const pickNameColumns = (columns: string[]) => {
  const preferred = ['display_name', 'full_name', 'name', 'current_username', 'username'];
  return preferred.filter((key) => columns.includes(key));
};

const resolveProfileSource = async (
  service: ReturnType<typeof createClient>,
): Promise<ProfileSource | null> => {
  const candidates = [
    { schema: 'public', table: 'profiles' },
    { schema: 'app', table: 'user_profiles' },
  ] as const;

  for (const candidate of candidates) {
    const columns = await getTableColumns(service, candidate.schema, candidate.table);
    if (columns.length === 0) continue;

    const userIdColumn = columns.includes('user_id') ? 'user_id' : columns.includes('id') ? 'id' : null;
    const nameColumns = pickNameColumns(columns);
    if (userIdColumn && nameColumns.length > 0) {
      return {
        schema: candidate.schema,
        table: candidate.table,
        userIdColumn,
        nameColumns,
      };
    }
  }

  return null;
};

const resolveEmailFromProfiles = async (
  service: ReturnType<typeof createClient>,
  normalized: string,
) => {
  const source = await resolveProfileSource(service);
  if (!source) return null;

  const client = source.schema === 'app' ? service.schema('app') : service.schema('public');

  for (const nameColumn of source.nameColumns) {
    const { data, error } = await client
      .from(source.table)
      .select(`${source.userIdColumn},${nameColumn}`)
      .ilike(nameColumn, normalized)
      .limit(10);

    if (error || !Array.isArray(data)) continue;

    const match = (data as Array<Record<string, unknown>>).find((row) =>
      matchUsername(row[nameColumn], normalized),
    );
    const userId = match ? readText(match[source.userIdColumn]) : '';
    if (!userId) continue;

    const { data: authUser, error: authUserError } = await service.auth.admin.getUserById(userId);
    if (authUserError || !authUser.user) continue;

    const email = readText(authUser.user.email).toLowerCase();
    if (email) return email;
  }

  return null;
};

const resolveEmailForUsername = async (service: ReturnType<typeof createClient>, username: string) => {
  const normalized = readText(username).toLowerCase();
  if (!normalized) return null;

  // If user typed an email, use it directly.
  if (normalized.includes('@')) return normalized;

  for (let page = 1; page <= 5; page += 1) {
    const result = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) throw result.error;
    const users = (result.data?.users ?? []) as Array<Record<string, unknown>>;

    const match = users.find((u) => {
      if (readMetaUsernames(u.user_metadata).some((candidate) => matchUsername(candidate, normalized))) return true;
      if (readMetaUsernames(u.app_metadata).some((candidate) => matchUsername(candidate, normalized))) return true;
      if (matchUsername(readEmailUsername(u.email), normalized)) return true;
      return false;
    });

    const email = match ? readText(match.email).toLowerCase() : '';
    if (email) return email;
    if (users.length < 200) break;
  }

  return await resolveEmailFromProfiles(service, normalized);
};

const jsonResponse = (payload: Json, init: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

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
      { message: 'Supabase env missing.' },
      { status: 500, headers: { ...corsHeaders } },
    );
  }

  // Lightweight gateway so the endpoint isn't wide-open.
  const apiKeyHeader = readText(req.headers.get('apikey') ?? '');
  if (!apiKeyHeader || apiKeyHeader !== anonKey) {
    return jsonResponse(
      { message: 'Unauthorized.' },
      { status: 401, headers: { ...corsHeaders } },
    );
  }

  const body = (await req.json().catch(() => null)) as LoginRequest | null;
  const username = readText(body?.username);
  const password = readText(body?.password);

  if (!username || !password) {
    return jsonResponse(
      { message: 'Missing username/password.' },
      { status: 400, headers: { ...corsHeaders } },
    );
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let email: string | null = null;
  try {
    email = await resolveEmailForUsername(service, username);
  } catch (error) {
    return jsonResponse(
      {
        message: 'Unable to resolve username.',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: { ...corsHeaders } },
    );
  }

  if (!email) {
    return jsonResponse(
      { message: 'Usuario no encontrado.' },
      { status: 404, headers: { ...corsHeaders } },
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
