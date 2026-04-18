import { createContext, useContext, useEffect, type ReactNode } from 'react';

export type AppLocale = 'es' | 'eu';

const LocaleContext = createContext<AppLocale>('es');

const BASQUE_CURRICULUM_PREFIXES = ['goi-teknikaria', 'goi_teknikaria'];

const normalizeCurriculumId = (curriculum: string | null | undefined) =>
  String(curriculum ?? '').trim().toLowerCase().replace(/_/g, '-');

export const isBasqueCurriculum = (curriculum: string | null | undefined) => {
  const normalized = normalizeCurriculumId(curriculum);
  return BASQUE_CURRICULUM_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}-`),
  );
};

export const isGoiTeknikariaCurriculum = (curriculum: string | null | undefined) =>
  isBasqueCurriculum(curriculum);

export const isSingleScopeCurriculum = (curriculum: string | null | undefined) =>
  isBasqueCurriculum(curriculum);

export const isLawSelectionCurriculum = (curriculum: string | null | undefined) =>
  normalizeCurriculumId(curriculum) === 'leyes-generales';

export const getLocaleForCurriculum = (curriculum: string | null | undefined): AppLocale => {
  return isBasqueCurriculum(curriculum) ? 'eu' : 'es';
};

export const getIntlLocale = (locale: AppLocale) => (locale === 'eu' ? 'eu-ES' : 'es-ES');

export const getWeekdayLabels = (locale: AppLocale) =>
  locale === 'eu' ? ['Ig', 'Al', 'Ar', 'Az', 'Og', 'Or', 'Lr'] : ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export const getCalendarWeekdayLabels = (locale: AppLocale) =>
  locale === 'eu' ? ['Al', 'Ar', 'Az', 'Og', 'Or', 'Lr', 'Ig'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const formatMonthYear = (date: Date, locale: AppLocale) => {
  const label = new Intl.DateTimeFormat(getIntlLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const formatLongDate = (date: Date, locale: AppLocale) =>
  new Intl.DateTimeFormat(getIntlLocale(locale), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);

interface LocaleProviderProps {
  locale: AppLocale;
  children: ReactNode;
}

export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
  }, [locale]);

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useAppLocale = () => useContext(LocaleContext);
