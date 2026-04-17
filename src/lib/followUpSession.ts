import type { ExecutableSessionPlan, PracticeMode } from '../types';

export type FollowUpSessionAction =
  | { type: 'start_test'; mode: PracticeMode; count: number | null };

export const resolveFollowUpSession = (input: {
  trigger: 'recommended' | 'clean' | 'errors';
  executablePlan: ExecutableSessionPlan | null;
  weakCategory: string | null;
  fallbackCount?: number;
}): FollowUpSessionAction => {
  const fallbackCount = input.fallbackCount ?? 20;

  if (input.trigger === 'errors') {
    if (input.executablePlan?.primaryAction === 'review') {
      return {
        type: 'start_test',
        mode: 'review',
        count: input.executablePlan.questionCount ?? fallbackCount,
      };
    }
    if (input.weakCategory) {
      return {
        type: 'start_test',
        mode: 'review',
        count: input.executablePlan?.questionCount ?? fallbackCount,
      };
    }
  }

  if (input.executablePlan) {
    return {
      type: 'start_test',
      mode: input.executablePlan.mode,
      count: input.executablePlan.questionCount ?? fallbackCount,
    };
  }

  return {
    type: 'start_test',
    mode: input.trigger === 'errors' ? 'review' : 'standard',
    count: fallbackCount,
  };
};
