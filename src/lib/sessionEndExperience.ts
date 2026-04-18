import type { ActivePracticeSession, FinishedTestPayload, PracticeMode, SyllabusType } from '../types';
import type { CopyLocale, SurfaceCopyState } from './coachCopyV2';
import { getContinuityLine } from './continuity';
import { buildSessionEndDecision } from './sessionEndAdapter';

export type SessionEndNextMove =
  | { kind: 'start_session'; mode: PracticeMode; syllabus: SyllabusType | null; questionCount: number | null }
  | { kind: 'review_on_page' };

export type SessionEndExperience = {
  dominantState: SurfaceCopyState;
  headline: string;
  summary: string;
  primaryCta: string;
  nextMove: SessionEndNextMove;
  microReward: { title: string; detail: string } | null;
  continuityLine: string | null;
  continuityMessage: string | null;
};

export const buildSessionEndExperience = (input: {
  locale: CopyLocale;
  payload: FinishedTestPayload;
  questionsCount: number;
  mode: PracticeMode;
  curriculum: string;
  username?: string | null;
  coachContext?: ActivePracticeSession['coach'] | null;
}): SessionEndExperience => {
  const isBasque = input.locale === 'eu';
  const continuityLine = getContinuityLine(input.locale, input.curriculum);
  const didReturnAfterGap = Boolean(continuityLine);

  const decision = buildSessionEndDecision({
    locale: input.locale,
    payload: input.payload,
    questionsCount: input.questionsCount,
    mode: input.mode,
    curriculum: input.curriculum,
    username: input.username,
    didReturnAfterGap,
  });

  const total = Math.max(input.questionsCount, 1);
  const failed = total - input.payload.score;

  const coachPrimary = input.coachContext?.primaryAction ?? null;
  const wantsClose = coachPrimary === 'recovery';

  const heavyErrorLoad = failed >= Math.max(5, Math.round(total * 0.35));

  let nextMove: SessionEndNextMove;
  let primaryCta = decision.primaryCta;

  if (wantsClose) {
    nextMove = { kind: 'start_session', mode: 'review', syllabus: null, questionCount: 10 };
    primaryCta = isBasque ? 'Hurrengo errepasoa hasi' : 'Empezar siguiente repaso';
  } else if (input.mode === 'simulacro') {
    nextMove = { kind: 'review_on_page' };
    primaryCta = isBasque ? 'Zuzenketa ikusi' : 'Ver corrección';
  } else if (heavyErrorLoad) {
    nextMove = { kind: 'start_session', mode: 'review', syllabus: null, questionCount: 20 };
    primaryCta = isBasque ? 'Nire akatsak landu' : 'Corregir mis fallos';
  } else {
    nextMove = {
      kind: 'start_session',
      mode: input.mode,
      syllabus: null,
      questionCount: input.questionsCount,
    };
    primaryCta =
      input.mode === 'review'
        ? isBasque
          ? 'Hurrengo errepasoa hasi'
          : 'Seguir con el siguiente repaso'
        : isBasque
          ? 'Beste test bat egin'
          : 'Hacer otro test';
  }

  const continuityMessage = isBasque
    ? `Hurrengoa: ${primaryCta}.`
    : `Siguiente: ${primaryCta}.`;

  return {
    dominantState: decision.dominantState,
    headline: decision.dominantTitle,
    summary: decision.dominantBody,
    primaryCta,
    nextMove,
    microReward: decision.microReward,
    continuityLine,
    continuityMessage,
  };
};
