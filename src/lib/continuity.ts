export type SessionCloseSummary = {
  timestamp: string;
  curriculum: string;
  mode: string;
  dominantState: string | null;
  thesis: string;
  nextCta: string;
  score: number;
  total: number;
};

const STORAGE_KEY = 'quantia.session_close.v1';

const readStored = (): SessionCloseSummary | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as SessionCloseSummary;
  } catch {
    return null;
  }
};

export const storeSessionCloseSummary = (summary: SessionCloseSummary) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
  } catch {
    void 0;
  }
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const daysBetween = (fromIso: string, toDate: Date) => {
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return null;
  const a = startOfDay(new Date(from)).getTime();
  const b = startOfDay(toDate).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
};

export const getContinuityLine = (locale: 'es' | 'eu', curriculum: string) => {
  const last = readStored();
  if (!last || last.curriculum !== curriculum) return null;
  const deltaDays = daysBetween(last.timestamp, new Date());
  if (deltaDays == null || deltaDays <= 0) return null;
  if (deltaDays !== 1) return null;

  if (locale === 'eu') {
    return `Atzo: ${last.thesis} Gaur: ${last.nextCta}.`;
  }
  return `Ayer: ${last.thesis} Hoy: ${last.nextCta}.`;
};
