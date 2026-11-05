export const homeFirstPaintStorageKey = (userId: string) => 'quantia.home.firstpaint.v2:' + userId;

export type HomeFirstPaintModel = {
  coachLabel: string;
  coachTitle: string;
  coachDescription: string;
  coachCtaLabel: string;
  primaryCardTitle: string;
  primaryCardDescription: string;
  primaryCardCtaLabel: string;
};

export const readHomeFirstPaintCache = (userId: string): Record<string, HomeFirstPaintModel> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(homeFirstPaintStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, HomeFirstPaintModel>;
  } catch {
    return {};
  }
};
