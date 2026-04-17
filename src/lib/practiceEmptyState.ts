import type { AppLocale } from './locale';
import type { PracticeMode, SyllabusType } from '../types';

export type PracticeEmptyStateKind = 'completed' | 'no_results' | 'no_content' | 'loading' | 'error';

export type PracticeEmptyStateTone = 'positive' | 'neutral' | 'error';

export type PracticeEmptyStateAction =
  | { type: 'start_recommended' }
  | { type: 'start_test'; mode: PracticeMode; syllabus: SyllabusType | null; count: number | null }
  | { type: 'start_law'; law: string; count: number | null }
  | { type: 'start_custom'; from: number; to: number; randomize: boolean }
  | { type: 'go_dashboard' }
  | { type: 'go_test_selection' };

export type PracticeEmptyStateModel = {
  kind: PracticeEmptyStateKind;
  tone: PracticeEmptyStateTone;
  title: string;
  body: string;
  primaryCta: { label: string; action: PracticeEmptyStateAction };
  secondaryCta?: { label: string; action: PracticeEmptyStateAction } | null;
};

export const resolveEmptyStateReason = (input: {
  request:
    | { kind: 'test'; mode: PracticeMode; syllabus: SyllabusType | null; count: number | null }
    | { kind: 'law'; law: string; count: number | null }
    | { kind: 'custom'; from: number; to: number; randomize: boolean }
    | { kind: 'study'; syllabus: SyllabusType | null; topic: string | null };
  bundleQuestionsCount: number | null;
}): PracticeEmptyStateKind => {
  const hasAnyQuestions = (input.bundleQuestionsCount ?? 0) > 0;

  if (input.request.kind === 'test') {
    if (input.request.mode === 'review') {
      return hasAnyQuestions ? 'completed' : 'no_content';
    }

    if (input.request.syllabus) {
      return hasAnyQuestions ? 'no_results' : 'no_content';
    }

    return 'no_content';
  }

  if (input.request.kind === 'law') {
    return hasAnyQuestions ? 'no_results' : 'no_content';
  }

  if (input.request.kind === 'custom') {
    return hasAnyQuestions ? 'no_results' : 'no_content';
  }

  if (input.request.kind === 'study') {
    if (input.request.topic) return hasAnyQuestions ? 'no_results' : 'no_content';
    if (input.request.syllabus) return hasAnyQuestions ? 'no_results' : 'no_content';
    return 'no_content';
  }

  return 'no_content';
};

export const buildPracticeEmptyStateModel = (input: {
  locale: AppLocale;
  kind: PracticeEmptyStateKind;
  request:
    | { kind: 'test'; mode: PracticeMode; syllabus: SyllabusType | null; count: number | null }
    | { kind: 'law'; law: string; count: number | null }
    | { kind: 'custom'; from: number; to: number; randomize: boolean }
    | { kind: 'study'; syllabus: SyllabusType | null; topic: string | null };
  errorMessage?: string | null;
}): PracticeEmptyStateModel => {
  const isBasque = input.locale === 'eu';
  const t = (es: string, eu: string) => (isBasque ? eu : es);

  if (input.kind === 'completed') {
    return {
      kind: 'completed',
      tone: 'positive',
      title: t('Este repaso está limpio', 'Errepaso hau garbi dago'),
      body: t(
        'No quedan preguntas pendientes aquí. Buen trabajo: hoy has cerrado un frente.',
        'Ez dago galdera pendenterik hemen. Lan ona: gaur fronte bat itxi duzu.',
      ),
      primaryCta: { label: t('Hacer sesión recomendada', 'Gomendatutako saioa egin'), action: { type: 'start_recommended' } },
      secondaryCta: { label: t('Volver al panel', 'Panelera itzuli'), action: { type: 'go_dashboard' } },
    };
  }

  if (input.kind === 'no_results') {
    return {
      kind: 'no_results',
      tone: 'neutral',
      title: t('Aquí no hay nada que revisar ahora', 'Hemen ez dago berrikustekorik orain'),
      body: t(
        'Este filtro no devuelve preguntas en este momento. Prueba con otra opción o vuelve a una sesión general.',
        'Iragazki honek ez du galderarik ematen une honetan. Probatu beste aukera batekin edo itzuli saio orokor batera.',
      ),
      primaryCta: { label: t('Ver otras opciones', 'Beste aukerak ikusi'), action: { type: 'go_test_selection' } },
      secondaryCta: { label: t('Volver al panel', 'Panelera itzuli'), action: { type: 'go_dashboard' } },
    };
  }

  if (input.kind === 'no_content') {
    return {
      kind: 'no_content',
      tone: 'neutral',
      title: t('Este bloque aún no tiene preguntas', 'Bloke honek oraindik ez du galderarik'),
      body: t(
        'No hay contenido disponible aquí. Puedes seguir con otro temario o una sesión general.',
        'Hemen ez dago eduki erabilgarririk. Beste temario batekin edo saio orokor batekin jarrai dezakezu.',
      ),
      primaryCta: { label: t('Ver otras opciones', 'Beste aukerak ikusi'), action: { type: 'go_test_selection' } },
      secondaryCta: { label: t('Volver al panel', 'Panelera itzuli'), action: { type: 'go_dashboard' } },
    };
  }

  if (input.kind === 'loading') {
    return {
      kind: 'loading',
      tone: 'neutral',
      title: t('Preparando tu sesión…', 'Zure saioa prestatzen…'),
      body: t(
        'Un momento: estamos cargando las preguntas.',
        'Itxaron une batez: galderak kargatzen ari gara.',
      ),
      primaryCta: { label: t('Volver al panel', 'Panelera itzuli'), action: { type: 'go_dashboard' } },
    };
  }

  const message = (input.errorMessage ?? '').trim();
  return {
    kind: 'error',
    tone: 'error',
    title: t('No hemos podido preparar tu sesión', 'Ezin izan dugu zure saioa prestatu'),
    body: message || t('Ha ocurrido un problema al cargar las preguntas.', 'Arazo bat egon da galderak kargatzean.'),
    primaryCta: (() => {
      if (input.request.kind === 'test') {
        return {
          label: t('Reintentar', 'Berriro saiatu'),
          action: { type: 'start_test', mode: input.request.mode, syllabus: input.request.syllabus, count: input.request.count },
        };
      }
      if (input.request.kind === 'law') {
        return {
          label: t('Reintentar', 'Berriro saiatu'),
          action: { type: 'start_law', law: input.request.law, count: input.request.count },
        };
      }
      if (input.request.kind === 'custom') {
        return {
          label: t('Reintentar', 'Berriro saiatu'),
          action: { type: 'start_custom', from: input.request.from, to: input.request.to, randomize: input.request.randomize },
        };
      }
      return { label: t('Volver al panel', 'Panelera itzuli'), action: { type: 'go_dashboard' } };
    })(),
    secondaryCta: { label: t('Volver al panel', 'Panelera itzuli'), action: { type: 'go_dashboard' } },
  };
};

