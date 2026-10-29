export const PRACTICE_MODE_IDS = ['standard', 'quick', 'errors', 'simulacro', 'custom'] as const;

export type PracticeModeVisibilityId = (typeof PRACTICE_MODE_IDS)[number];

const STORAGE_PREFIX = 'quantia.visible-practice-modes.v1';
const validIds = new Set<string>(PRACTICE_MODE_IDS);

export const normalizePracticeModeIds = (values: unknown): PracticeModeVisibilityId[] => {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values.filter(
        (value): value is PracticeModeVisibilityId => typeof value === 'string' && validIds.has(value),
      ),
    ),
  );
};

const storageKey = (userId: string) => `${STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}`;

export const readVisiblePracticeModeIds = (userId: string): PracticeModeVisibilityId[] => {
  if (!userId.trim()) return [...PRACTICE_MODE_IDS];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [...PRACTICE_MODE_IDS];
    const ids = normalizePracticeModeIds(JSON.parse(raw));
    return ids.length > 0 ? ids : [...PRACTICE_MODE_IDS];
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
