const STORAGE_PREFIX = 'quantia.visible-curriculums.v1';

const normalizeIds = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
};

const storageKey = (userId: string) => `${STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}`;

export const readVisibleCurriculumIds = (userId: string): string[] | null => {
  if (!userId.trim()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const ids = normalizeIds(JSON.parse(raw));
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
};

export const writeVisibleCurriculumIds = (userId: string, curriculumIds: string[]) => {
  const ids = normalizeIds(curriculumIds);
  if (!userId.trim() || ids.length === 0) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch {
    // The in-memory selection still applies when storage is unavailable.
  }
};
