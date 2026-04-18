export type QuestionFrictionTag =
  | 'repeated_error'
  | 'recent_trouble'
  | 'pressure_trouble'
  | 'memory_fragile'
  | 'mixed';

export type QuestionFrictionItem = {
  questionId: string;
  curriculum: string;
  prompt: string;
  topic: string | null;
  attemptsTotal: number;
  wrongTotal: number;
  correctTotal: number;
  errorRate: number;
  wrongStreak: number;
  repeatWrongCount: number;
  simulacroWrongCount: number;
  normalWrongCount: number;
  lastSeenAt: string | null;
  lastWrongAt: string | null;
  frictionScore: number;
  primaryTag: QuestionFrictionTag;
};

export type QuestionFrictionPriority = 'most_problematic';

