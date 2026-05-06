import type { Session } from '@supabase/supabase-js';
import type { AccountIdentity } from '../../types';
import type { CurriculumOption } from '../../lib/quantia/types';
import { DEFAULT_CURRICULUM } from '../../lib/quantia/constants';

export const ADMIN_EMAIL = 'admin@oposik.app';

const normalizeUserIdentifier = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

const canonicalizeAccessKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-');

type SessionAppMetadata = Record<string, unknown> & {
  allowedCurriculumKeys?: unknown;
  allowed_curriculum_keys?: unknown;
};

export type CurriculumAccessPolicy = {
  allowedCurriculumKeys: string[];
  preferredCurriculumId: string | null;
};

export const readAllowedCurriculumKeys = (session: Session | null): string[] => {
  const metadata = session?.user?.app_metadata as SessionAppMetadata | null | undefined;
  const raw = Array.isArray(metadata?.allowedCurriculumKeys)
    ? metadata?.allowedCurriculumKeys
    : Array.isArray(metadata?.allowed_curriculum_keys)
      ? metadata?.allowed_curriculum_keys
      : [];

  const list = raw
    .map((value) => (typeof value === 'string' ? value : ''))
    .map(canonicalizeAccessKey)
    .filter(Boolean);

  return Array.from(new Set(list));
};

const mapAllowedKeyToCurriculumIds = (key: string): string[] => {
  const normalized = canonicalizeAccessKey(key);
  if (!normalized) return [];

  if (normalized === 'administrativo' || normalized === 'osakidetza-admin' || normalized === 'osakidetza_admin') {
    return [DEFAULT_CURRICULUM, 'osakidetza-admin', 'osakidetza_admin'];
  }
  if (
    normalized === 'auxiliar-administrativo' ||
    normalized === 'auxiliar_administrativo' ||
    normalized === 'auxiliar administrativo'
  ) {
    return ['auxiliar_administrativo', 'auxiliar-administrativo'];
  }

  return [normalized, normalized.replace(/-/g, '_'), normalized.replace(/_/g, '-')];
};

export const filterCurriculumOptionsByAllowedKeys = (options: CurriculumOption[], allowedKeys: string[]) => {
  if (!Array.isArray(options) || options.length === 0) return options;
  if (!Array.isArray(allowedKeys) || allowedKeys.length === 0) return options;

  const allowedIds = new Set(allowedKeys.flatMap(mapAllowedKeyToCurriculumIds).map(canonicalizeAccessKey));
  if (allowedIds.size === 0) return options;

  const filtered = options.filter((opt) => allowedIds.has(canonicalizeAccessKey(opt.id)));
  return filtered.length > 0 ? filtered : options;
};

const collectIdentityIdentifiers = (
  session: Session | null,
  identity: AccountIdentity | null | undefined,
) => {
  const identifiers = new Set<string>();
  const email = normalizeUserIdentifier(session?.user?.email);
  if (email) {
    identifiers.add(email);
    const [localPart] = email.split('@');
    if (localPart) identifiers.add(localPart);
  }

  const metadataUsername = normalizeUserIdentifier(
    typeof session?.user?.user_metadata?.username === 'string'
      ? session.user.user_metadata.username
      : typeof session?.user?.user_metadata?.preferred_username === 'string'
        ? session.user.user_metadata.preferred_username
        : null,
  );
  if (metadataUsername) identifiers.add(metadataUsername);

  const currentUsername = normalizeUserIdentifier(identity?.current_username);
  if (currentUsername) identifiers.add(currentUsername);

  for (const previous of identity?.previous_usernames ?? []) {
    const normalized = normalizeUserIdentifier(previous);
    if (normalized) identifiers.add(normalized);
  }

  return identifiers;
};

export const getCurriculumAccessPolicyForIdentity = (
  session: Session | null,
  identity: AccountIdentity | null | undefined,
): CurriculumAccessPolicy | null => {
  const identifiers = collectIdentityIdentifiers(session, identity);

  if (identifiers.has('alu4')) {
    return {
      allowedCurriculumKeys: ['auxiliar-administrativo', 'administrativo'],
      preferredCurriculumId: 'auxiliar_administrativo',
    };
  }

  return null;
};

export const getRestrictedCurriculumForIdentity = (
  session: Session | null,
  identity: AccountIdentity | null | undefined,
) => {
  const identifiers = collectIdentityIdentifiers(session, identity);

  if (identifiers.has('eneko@oposik.app') || identifiers.has('eneko')) {
    return 'goi-teknikaria';
  }

  return null;
};

export const GOI_TEKNIKARIA_FALLBACK_OPTION: CurriculumOption = {
  id: 'goi-teknikaria',
  label: 'Goi-teknikaria',
};
