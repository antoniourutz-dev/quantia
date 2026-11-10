export const PRACTICE_MODE_IDS = ['topics', 'challenge', 'custom', 'errors', 'standard', 'quick', 'simulacro'] as const;

export type PracticeModeVisibilityId = (typeof PRACTICE_MODE_IDS)[number];

const STORAGE_PREFIX = 'quantia.visible-practice-modes.v2';
const LEGACY_STORAGE_PREFIX = 'quantia.visible-practice-modes.v1';

export const normalizePracticeModeIds = (values: unknown): PracticeModeVisibilityId[] => {
  if (!Array.isArray(values)) return [];
  const visible = new Set(values);
  return PRACTICE_MODE_IDS.filter(id => visible.has(id));
};

const storageKey = (userId: string, prefix = STORAGE_PREFIX) => `${prefix}:${encodeURIComponent(userId.trim())}`;

export const readVisiblePracticeModeIds = (userId: string): PracticeModeVisibilityId[] => {
  if (!userId.trim()) return [...PRACTICE_MODE_IDS];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (raw !== null) {
      const ids = normalizePracticeModeIds(JSON.parse(raw));
      return ids.length > 0 ? ids : [...PRACTICE_MODE_IDS];
    }
    const legacy = window.localStorage.getItem(storageKey(userId, LEGACY_STORAGE_PREFIX));
    const ids = normalizePracticeModeIds(legacy ? JSON.parse(legacy) : null);
    return ids.length > 0 ? normalizePracticeModeIds([...ids, 'challenge', 'topics']) : [...PRACTICE_MODE_IDS];
  } catch {
    return [...PRACTICE_MODE_IDS];
  }
};

export const writeVisiblePracticeModeIds = (userId: string, practiceModeIds: PracticeModeVisibilityId[]) => {
  const ids = normalizePracticeModeIds(practiceModeIds);
  if (!userId.trim() || ids.length === 0) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch {
    // The in-memory selection still applies when storage is unavailable.
  }
};
