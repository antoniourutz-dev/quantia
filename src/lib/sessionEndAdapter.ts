import type { FinishedTestPayload, PracticeMode } from '../types';
import type { CopyLocale, SurfaceCopyState } from './coachCopyV2';
import { buildSessionEndCopy } from './coachCopyV2';
import { pickMicroReward } from './microRewards';

export type SessionEndDecision = {
  dominantState: SurfaceCopyState;
  dominantTitle: string;
  dominantBody: string;
  primaryCta: string;
  microReward: { title: string; detail: string } | null;
};

export const buildSessionEndDecision = (input: {
  locale: CopyLocale;
  payload: FinishedTestPayload;
  questionsCount: number;
  mode: PracticeMode;
  curriculum: string;
  username?: string | null;
  didReturnAfterGap: boolean;
}): SessionEndDecision => {
  const copy = buildSessionEndCopy({
    locale: input.locale,
    payload: input.payload,
    questionsCount: input.questionsCount,
    mode: input.mode,
    curriculum: input.curriculum,
    username: input.username,
  });

  const microReward = pickMicroReward(
    {
      locale: input.locale,
      sessionState: copy.state,
      didReturnAfterGap: input.didReturnAfterGap,
      trainedPressure: input.mode === 'simulacro',
      reducedPending: copy.state === 'consistency_risk',
    },
    `${input.curriculum}:${input.mode}:${input.payload.score}:${input.questionsCount}`,
  );

  return {
    dominantState: copy.state,
    dominantTitle: copy.line1,
    dominantBody: copy.line2 ?? '',
    primaryCta: copy.cta ?? (input.locale === 'eu' ? 'Hemendik jarraitu' : 'Seguir por aquí'),
    microReward: microReward ? { title: microReward.title, detail: microReward.detail } : null,
  };
};
