const allowHeaders = 'authorization, x-client-info, apikey, content-type';
const allowMethods = 'POST, OPTIONS';

const parseAllowedOrigins = () => {
  const raw = Deno.env.get('CORS_ALLOWED_ORIGINS')?.trim() ?? '';
  if (!raw) return [] as string[];
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
};

const isLocalhostOrigin = (origin: string) =>
  /^https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(origin.trim());

const isPrivateNetworkOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    if (!/^https?:$/i.test(url.protocol)) return false;

    const hostname = url.hostname.trim().toLowerCase();
    if (/^10(?:\.\d{1,3}){3}$/.test(hostname)) return true;
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(hostname)) return true;

    const match172 = hostname.match(/^172\.(\d{1,3})(?:\.\d{1,3}){2}$/);
    if (match172) {
      const secondOctet = Number(match172[1]);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }

    return false;
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin: string, allowed: string[]) =>
  isLocalhostOrigin(origin) || isPrivateNetworkOrigin(origin) || allowed.includes(origin);

/** When `CORS_ALLOWED_ORIGINS` is unset, allows `*` (dev / legacy). When set, echoes `Origin` only if listed. */
export const buildCorsHeaders = (req: Request): Record<string, string> => {
  const allowed = parseAllowedOrigins();
  if (allowed.length === 0) {
    return {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': allowHeaders,
      'access-control-allow-methods': allowMethods,
    };
  }

  const origin = req.headers.get('origin');
  if (origin && isAllowedOrigin(origin, allowed)) {
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': allowHeaders,
      'access-control-allow-methods': allowMethods,
      vary: 'Origin',
    };
  }

  if (!origin) {
    return {
      'access-control-allow-origin': allowed[0] ?? '*',
      'access-control-allow-headers': allowHeaders,
      'access-control-allow-methods': allowMethods,
    };
  }

  return {
    'access-control-allow-headers': allowHeaders,
    'access-control-allow-methods': allowMethods,
  };
};

export const corsPreflightResponse = (req: Request): Response | null => {
  if (req.method !== 'OPTIONS') return null;
  const allowed = parseAllowedOrigins();
  const origin = req.headers.get('origin');
  if (allowed.length > 0 && origin && !isAllowedOrigin(origin, allowed)) {
    return new Response('Forbidden', { status: 403 });
  }
  return new Response('ok', { headers: buildCorsHeaders(req) });
};
