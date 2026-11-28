import { useCallback, useState } from 'react';

export const FONT_SIZES = [15, 16, 17, 18, 20, 22];

export interface ReaderPrefs {
  size: number;
  font: 'serif' | 'sans';
  theme: 'light' | 'sepia' | 'dark';
}

const KEY = 'quantia.studyReader.prefs.v1';
const DEFAULTS: ReaderPrefs = { size: 3, font: 'serif', theme: 'light' };

export const readPrefs = (): ReaderPrefs => {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    return {
      size:
        typeof parsed.size === 'number' && parsed.size >= 0 && parsed.size < FONT_SIZES.length
          ? parsed.size
          : DEFAULTS.size,
      font: parsed.font === 'sans' ? 'sans' : 'serif',
      theme: parsed.theme === 'sepia' || parsed.theme === 'dark' ? parsed.theme : 'light',
    };
  } catch {
    return DEFAULTS;
  }
};

/** Per-device reading comfort settings; annotations and progress live in Supabase. */
export const useReaderPrefs = (): [ReaderPrefs, (next: ReaderPrefs) => void] => {
  const [prefs, setPrefsState] = useState<ReaderPrefs>(readPrefs);
  const setPrefs = useCallback((next: ReaderPrefs) => {
    setPrefsState(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: keep in memory only */
    }
  }, []);
  return [prefs, setPrefs];
};
