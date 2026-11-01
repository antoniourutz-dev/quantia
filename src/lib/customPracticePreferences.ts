import type { CustomPracticeSupportMode } from '../domain/customPractice/customPracticeTypes';

const STORAGE_PREFIX = 'quantia.custom-practice-support';

const storageKey = (userId: string) => `${STORAGE_PREFIX}:${userId}`;

export const DEFAULT_CUSTOM_PRACTICE_SUPPORT: CustomPracticeSupportMode = {
  showMarks: false,
  showNotes: false,
};

export const readCustomPracticeSupport = (userId: string): CustomPracticeSupportMode => {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_CUSTOM_PRACTICE_SUPPORT;
    const parsed = JSON.parse(raw) as Partial<CustomPracticeSupportMode>;
    return {
      showMarks: parsed.showMarks === true,
      showNotes: parsed.showNotes === true,
    };
  } catch {
    return DEFAULT_CUSTOM_PRACTICE_SUPPORT;
  }
};

export const writeCustomPracticeSupport = (
  userId: string,
  supportMode: CustomPracticeSupportMode,
) => {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(supportMode));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
};
