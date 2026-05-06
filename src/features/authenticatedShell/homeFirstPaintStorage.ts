export const HOME_FIRST_PAINT_STORAGE_KEY = 'quantia.home.firstpaint.v1';

export type HomeFirstPaintModel = {
  coachLabel: string;
  coachTitle: string;
  coachDescription: string;
  coachCtaLabel: string;
  primaryCardTitle: string;
  primaryCardDescription: string;
  primaryCardCtaLabel: string;
};

export const readHomeFirstPaintCache = (): Record<string, HomeFirstPaintModel> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(HOME_FIRST_PAINT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, HomeFirstPaintModel>;
  } catch {
    return {};
  }
};
