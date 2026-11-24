import type { TopicInsightItem } from './statsInsights';
import type { SyllabusType } from '../types';

export type PenaltyRuleId = 'none' | 'quarter' | 'third';

export interface PenaltyRuleMeta {
  id: PenaltyRuleId;
  factor: number;
  shortLabel: string;
  errorsPerPoint: number | null;
  breakEvenPct: number;
}

export const DEFAULT_PENALTY_RULE: PenaltyRuleId = 'none';

export const PENALTY_RULE_ORDER: PenaltyRuleId[] = ['none', 'quarter', 'third'];

export const PENALTY_RULES: Record<PenaltyRuleId, PenaltyRuleMeta> = {
  none: {
    id: 'none',
    factor: 0,
    shortLabel: '0',
    errorsPerPoint: null,
    breakEvenPct: 0,
  },
  quarter: {
    id: 'quarter',
    factor: 0.25,
    shortLabel: '-0,25',
    errorsPerPoint: 4,
    breakEvenPct: 20,
  },
  third: {
    id: 'third',
    factor: 1 / 3,
    shortLabel: '-0,33',
    errorsPerPoint: 3,
    breakEvenPct: 25,
  },
};

const STORAGE_PREFIX = 'quantia.penalty-rule.v1';

const storageKey = (userId: string) =>
  `${STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}`;

export const isPenaltyRuleId = (value: unknown): value is PenaltyRuleId =>
  value === 'none' || value === 'quarter' || value === 'third';

export const readPenaltyRule = (userId: string): PenaltyRuleId => {
  const trimmed = userId.trim();
  if (!trimmed) return DEFAULT_PENALTY_RULE;
  try {
    const raw = window.localStorage.getItem(storageKey(trimmed));
    if (!raw) return DEFAULT_PENALTY_RULE;
    return isPenaltyRuleId(raw) ? raw : DEFAULT_PENALTY_RULE;
  } catch {
    return DEFAULT_PENALTY_RULE;
  }
};

export const writePenaltyRule = (userId: string, rule: PenaltyRuleId): void => {
  const trimmed = userId.trim();
  if (!trimmed || !isPenaltyRuleId(rule)) return;
  try {
    window.localStorage.setItem(storageKey(trimmed), rule);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
};

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const clampNonNegInt = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

export const formatNetScore = (value: number, decimals = 2): string => {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = safe.toFixed(decimals);
  const normalized = Number(fixed) === 0 ? (0).toFixed(decimals) : fixed;
  return normalized.replace('.', ',');
};

export interface NetScoreInput {
  correct: number;
  incorrect: number;
  unanswered?: number;
  total: number;
  penaltyRule: PenaltyRuleId;
}

export interface NetScoreResult {
  penaltyRule: PenaltyRuleId;
  penaltyFactor: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  rawAccuracyPct: number;
  rawNetPoints: number;
  clampedNetPoints: number;
  rawScoreBase10: number;
  scoreBase10: number;
  netPct: number;
  penaltyLostPoints: number;
  penaltyLostBase10: number;
}

export const calculateNetScore = (input: NetScoreInput): NetScoreResult => {
  const penaltyRule = isPenaltyRuleId(input.penaltyRule)
    ? input.penaltyRule
    : DEFAULT_PENALTY_RULE;
  const penaltyFactor = PENALTY_RULES[penaltyRule].factor;

  const total = clampNonNegInt(input.total);
  const correct = clampNonNegInt(input.correct);
  const incorrect = clampNonNegInt(input.incorrect);
  const unanswered =
    input.unanswered != null
      ? clampNonNegInt(input.unanswered)
      : Math.max(0, total - correct - incorrect);

  const rawAccuracyPct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const penaltyLostPoints = incorrect * penaltyFactor;
  const rawNetPoints = correct - penaltyLostPoints;
  const clampedNetPoints = Math.max(0, rawNetPoints);
  const rawScoreBase10 = total > 0 ? (rawNetPoints / total) * 10 : 0;
  const scoreBase10 = Math.max(0, rawScoreBase10);
  const netPct = total > 0 ? Math.round((clampedNetPoints / total) * 100) : 0;
  const penaltyLostBase10 = total > 0 ? (penaltyLostPoints / total) * 10 : 0;

  return {
    penaltyRule,
    penaltyFactor,
    correct,
    incorrect,
    unanswered,
    total,
    rawAccuracyPct,
    rawNetPoints,
    clampedNetPoints,
    rawScoreBase10,
    scoreBase10,
    netPct,
    penaltyLostPoints,
    penaltyLostBase10,
  };
};

export interface NetScoreSimulationInput {
  examQuestions: number;
  accuracyRate: number;
  answerRate: number;
  penaltyRule: PenaltyRuleId;
  targetScoreBase10: number;
}

export interface NetScoreSimulationResult {
  examQuestions: number;
  answeredCount: number;
  blankCount: number;
  expectedCorrect: number;
  expectedIncorrect: number;
  rawNetPoints: number;
  scoreBase10: number;
  targetScoreBase10: number;
  gapBase10: number;
  meetsTarget: boolean;
  penaltyLostBase10: number;
  requiredAccuracyPct: number | null;
  byRule: Record<PenaltyRuleId, { scoreBase10: number; meetsTarget: boolean }>;
}

export const simulateExamNetScore = (
  input: NetScoreSimulationInput,
): NetScoreSimulationResult => {
  const penaltyRule = isPenaltyRuleId(input.penaltyRule)
    ? input.penaltyRule
    : DEFAULT_PENALTY_RULE;
  const examQuestions = Math.max(
    1,
    Math.round(Number.isFinite(input.examQuestions) ? input.examQuestions : 100),
  );
  const accuracyRate = clamp(input.accuracyRate, 0, 1);
  const answerRate = clamp(input.answerRate, 0, 1);
  const targetScoreBase10 = clamp(input.targetScoreBase10, 0, 10);

  const answeredCount = examQuestions * answerRate;
  const blankCount = examQuestions - answeredCount;
  const expectedCorrect = answeredCount * accuracyRate;
  const expectedIncorrect = answeredCount * (1 - accuracyRate);

  const computeRuleOutcome = (ruleId: PenaltyRuleId) => {
    const factor = PENALTY_RULES[ruleId].factor;
    const rawNet = expectedCorrect - expectedIncorrect * factor;
    const score10 = Math.max(0, (rawNet / examQuestions) * 10);
    return {
      rawNet,
      scoreBase10: score10,
      meetsTarget: score10 + 1e-9 >= targetScoreBase10,
      penaltyLostBase10: ((expectedIncorrect * factor) / examQuestions) * 10,
    };
  };

  const noneOutcome = computeRuleOutcome('none');
  const quarterOutcome = computeRuleOutcome('quarter');
  const thirdOutcome = computeRuleOutcome('third');

  const activeOutcome =
    penaltyRule === 'quarter'
      ? quarterOutcome
      : penaltyRule === 'third'
        ? thirdOutcome
        : noneOutcome;

  const activeFactor = PENALTY_RULES[penaltyRule].factor;
  let requiredAccuracyPct: number | null;
  if (targetScoreBase10 <= 0) {
    requiredAccuracyPct = 0;
  } else if (answerRate <= 0) {
    requiredAccuracyPct = null;
  } else {
    const requiredRate =
      (targetScoreBase10 / (10 * answerRate) + activeFactor) / (1 + activeFactor);
    if (requiredRate > 1 + 1e-9) {
      requiredAccuracyPct = null;
    } else {
      requiredAccuracyPct = Math.min(
        100,
        Math.max(0, Math.ceil(requiredRate * 100 - 1e-9)),
      );
    }
  }

  return {
    examQuestions,
    answeredCount,
    blankCount,
    expectedCorrect,
    expectedIncorrect,
    rawNetPoints: activeOutcome.rawNet,
    scoreBase10: activeOutcome.scoreBase10,
    targetScoreBase10,
    gapBase10: activeOutcome.scoreBase10 - targetScoreBase10,
    meetsTarget: activeOutcome.meetsTarget,
    penaltyLostBase10: activeOutcome.penaltyLostBase10,
    requiredAccuracyPct,
    byRule: {
      none: {
        scoreBase10: noneOutcome.scoreBase10,
        meetsTarget: noneOutcome.meetsTarget,
      },
      quarter: {
        scoreBase10: quarterOutcome.scoreBase10,
        meetsTarget: quarterOutcome.meetsTarget,
      },
      third: {
        scoreBase10: thirdOutcome.scoreBase10,
        meetsTarget: thirdOutcome.meetsTarget,
      },
    },
  };
};

export type TopicRoiReason =
  | 'high_error_weight'
  | 'unexplored_weight'
  | 'fragile_cleanup';

export interface TopicRoiItem {
  id: string;
  label: string;
  scope: SyllabusType;
  questionCount: number;
  weightPct: number;
  coveragePct: number;
  currentAccuracyPct: number | null;
  fragileCount: number;
  unseenCount: number;
  potentialBase10Gain: number;
  effortScore: number;
  roiScore: number;
  reason: TopicRoiReason;
}

export const buildTopicRoiPriorities = (params: {
  topics: TopicInsightItem[];
  penaltyRule: PenaltyRuleId;
  targetAccuracyRate?: number;
  limit?: number;
}): TopicRoiItem[] => {
  const { topics, targetAccuracyRate = 0.85, limit = 5 } = params;
  const penaltyRule = isPenaltyRuleId(params.penaltyRule)
    ? params.penaltyRule
    : DEFAULT_PENALTY_RULE;
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0 || topics.length === 0) return [];

  const validTopics = topics.filter((topic) => topic.questionCount > 0);
  const totalBankQuestions = validTopics.reduce(
    (sum, topic) => sum + topic.questionCount,
    0,
  );
  if (totalBankQuestions <= 0) return [];

  const factor = PENALTY_RULES[penaltyRule].factor;
  const targetAcc = clamp(targetAccuracyRate, 0, 1);
  const targetYield = targetAcc - (1 - targetAcc) * factor;
  const unseenYield = Math.max(0, 0.25 - 0.75 * factor);

  const items: TopicRoiItem[] = [];

  for (const topic of validTopics) {
    const weight = topic.questionCount / totalBankQuestions;
    const seenShare = clamp(topic.seenCount / topic.questionCount, 0, 1);
    const unseenShare = clamp(topic.unseenCount / topic.questionCount, 0, 1);
    const seenAccuracy = clamp((topic.accuracyPct ?? 50) / 100, 0, 1);

    const seenYield = seenAccuracy - (1 - seenAccuracy) * factor;
    const currentYield = seenShare * seenYield + unseenShare * unseenYield;
    const potentialBase10Gain = Math.max(0, weight * (targetYield - currentYield) * 10);

    if (potentialBase10Gain < 0.02) continue;

    const workUnits = Math.max(
      5,
      topic.fragileCount * 1.0 +
        topic.consolidatingCount * 0.4 +
        topic.unseenCount * 0.7,
    );
    const roiScore = (potentialBase10Gain / Math.sqrt(workUnits)) * 10;

    let reason: TopicRoiReason;
    if (topic.coveragePct < 35) {
      reason = 'unexplored_weight';
    } else if (
      topic.fragileCount >= Math.max(4, Math.round(topic.seenCount * 0.25))
    ) {
      reason = 'fragile_cleanup';
    } else {
      reason = 'high_error_weight';
    }

    items.push({
      id: topic.id,
      label: topic.label,
      scope: topic.scope,
      questionCount: topic.questionCount,
      weightPct: Math.round(weight * 100),
      coveragePct: topic.coveragePct,
      currentAccuracyPct: topic.accuracyPct,
      fragileCount: topic.fragileCount,
      unseenCount: topic.unseenCount,
      potentialBase10Gain,
      effortScore: workUnits,
      roiScore,
      reason,
    });
  }

  return items
    .sort(
      (a, b) =>
        b.roiScore - a.roiScore ||
        b.potentialBase10Gain - a.potentialBase10Gain ||
        a.label.localeCompare(b.label),
    )
    .slice(0, safeLimit);
};
