import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTopicRoiPriorities,
  calculateNetScore,
  DEFAULT_PENALTY_RULE,
  formatNetScore,
  PENALTY_RULES,
  readPenaltyRule,
  simulateExamNetScore,
  writePenaltyRule,
} from './netScore';
import type { TopicInsightItem } from './statsInsights';

const makeTopic = (overrides: Partial<TopicInsightItem>): TopicInsightItem => ({
  id: 'topic-1',
  label: 'Tema 1',
  scope: 'common',
  questionCount: 50,
  seenCount: 40,
  unseenCount: 10,
  coveragePct: 80,
  attempts: 40,
  accuracyPct: 60,
  deltaPp: null,
  checkpoints: [],
  fragileCount: 5,
  consolidatingCount: 10,
  solidCount: 15,
  masteredCount: 10,
  excessRiskPct: null,
  status: 'risk',
  ...overrides,
});

describe('netScore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('PENALTY_RULES & formatNetScore', () => {
    it('defines exact penalty factors and break-even thresholds', () => {
      expect(PENALTY_RULES.none.factor).toBe(0);
      expect(PENALTY_RULES.quarter.factor).toBe(0.25);
      expect(PENALTY_RULES.third.factor).toBe(1 / 3);
      expect(PENALTY_RULES.none.breakEvenPct).toBe(0);
      expect(PENALTY_RULES.quarter.breakEvenPct).toBe(20);
      expect(PENALTY_RULES.third.breakEvenPct).toBe(25);
    });

    it('formats scores with Spanish/Basque comma decimals and avoids -0,00', () => {
      expect(formatNetScore(6.5)).toBe('6,50');
      expect(formatNetScore(-0.001)).toBe('0,00');
      expect(formatNetScore(-1.25)).toBe('-1,25');
      expect(formatNetScore(7.5, 1)).toBe('7,5');
    });
  });

  describe('calculateNetScore', () => {
    it('calculates exact score with no penalty (0)', () => {
      const result = calculateNetScore({
        correct: 7,
        incorrect: 3,
        unanswered: 0,
        total: 10,
        penaltyRule: 'none',
      });

      expect(result.rawNetPoints).toBe(7);
      expect(result.scoreBase10).toBe(7);
      expect(result.penaltyLostPoints).toBe(0);
      expect(result.penaltyLostBase10).toBe(0);
      expect(result.rawAccuracyPct).toBe(70);
      expect(result.netPct).toBe(70);
    });

    it('deducts 0.25 per error and 0 per blank under quarter (-0,25)', () => {
      const result = calculateNetScore({
        correct: 7,
        incorrect: 4,
        unanswered: 1,
        total: 12,
        penaltyRule: 'quarter',
      });

      expect(result.penaltyLostPoints).toBe(1);
      expect(result.rawNetPoints).toBe(6);
      expect(result.scoreBase10).toBeCloseTo(5, 10);
      expect(result.unanswered).toBe(1);
    });

    it('deducts EXACTLY 1.00 point for 3 errors under third (-0,33) using exact 1/3', () => {
      const result = calculateNetScore({
        correct: 7,
        incorrect: 3,
        unanswered: 0,
        total: 10,
        penaltyRule: 'third',
      });

      expect(result.penaltyLostPoints).toBeCloseTo(1, 12);
      expect(result.rawNetPoints).toBeCloseTo(6, 12);
      expect(result.scoreBase10).toBeCloseTo(6, 12);
      expect(result.netPct).toBe(60);
    });

    it('clamps negative raw net score to 0 on scoreBase10 while preserving rawNetPoints < 0', () => {
      const result = calculateNetScore({
        correct: 1,
        incorrect: 9,
        unanswered: 0,
        total: 10,
        penaltyRule: 'third',
      });

      expect(result.rawNetPoints).toBeCloseTo(-2, 12);
      expect(result.rawScoreBase10).toBeCloseTo(-2, 12);
      expect(result.clampedNetPoints).toBe(0);
      expect(result.scoreBase10).toBe(0);
      expect(result.netPct).toBe(0);
    });

    it('handles total === 0 and negative inputs safely', () => {
      const result = calculateNetScore({
        correct: -2,
        incorrect: -1,
        total: 0,
        penaltyRule: 'quarter',
      });

      expect(result.total).toBe(0);
      expect(result.correct).toBe(0);
      expect(result.incorrect).toBe(0);
      expect(result.scoreBase10).toBe(0);
      expect(result.rawAccuracyPct).toBe(0);
    });
  });

  describe('readPenaltyRule & writePenaltyRule', () => {
    it('persists per userId in localStorage and isolates users', () => {
      expect(readPenaltyRule('user-a')).toBe(DEFAULT_PENALTY_RULE);

      writePenaltyRule('user-a', 'third');
      writePenaltyRule('user-b', 'quarter');

      expect(readPenaltyRule('user-a')).toBe('third');
      expect(readPenaltyRule('user-b')).toBe('quarter');
    });

    it('defaults to none for empty userId, invalid stored value, or storage exceptions', () => {
      expect(readPenaltyRule('   ')).toBe('none');

      window.localStorage.setItem('quantia.penalty-rule.v1:u1', 'invalid_rule');
      expect(readPenaltyRule('u1')).toBe('none');

      const getItemSpy = vi
        .spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => {
          throw new Error('QuotaExceeded');
        });
      expect(readPenaltyRule('u1')).toBe('none');
      getItemSpy.mockRestore();

      const setItemSpy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('PrivateMode');
        });
      expect(() => writePenaltyRule('u1', 'quarter')).not.toThrow();
      setItemSpy.mockRestore();
    });
  });

  describe('simulateExamNetScore', () => {
    it('computes 3-rule comparison and exact net projection', () => {
      const sim = simulateExamNetScore({
        examQuestions: 100,
        accuracyRate: 0.76,
        answerRate: 1,
        penaltyRule: 'quarter',
        targetScoreBase10: 6.5,
      });

      expect(sim.answeredCount).toBe(100);
      expect(sim.blankCount).toBe(0);
      expect(sim.expectedCorrect).toBeCloseTo(76, 6);
      expect(sim.expectedIncorrect).toBeCloseTo(24, 6);
      // 76 - 24 * 0.25 = 70 -> 7.00 / 10
      expect(sim.scoreBase10).toBeCloseTo(7.0, 6);
      expect(sim.meetsTarget).toBe(true);
      expect(sim.byRule.none.scoreBase10).toBeCloseTo(7.6, 6);
      expect(sim.byRule.quarter.scoreBase10).toBeCloseTo(7.0, 6);
      // 76 - 24 * (1/3) = 68 -> 6.80 / 10
      expect(sim.byRule.third.scoreBase10).toBeCloseTo(6.8, 6);
      // Required accuracy for 6.5/10 at 100% answered under -0.25: (0.65 + 0.25) / 1.25 = 72%
      expect(sim.requiredAccuracyPct).toBe(72);
    });

    it('models partial answer rate (blanks) and impossible targets', () => {
      const sim = simulateExamNetScore({
        examQuestions: 100,
        accuracyRate: 0.8,
        answerRate: 0.5,
        penaltyRule: 'third',
        targetScoreBase10: 6.0,
      });

      expect(sim.answeredCount).toBe(50);
      expect(sim.blankCount).toBe(50);
      // Max possible score with 50% answered is 5.0/10 < 6.0 -> impossible
      expect(sim.requiredAccuracyPct).toBeNull();
      expect(sim.meetsTarget).toBe(false);
    });

    it('clamps out-of-range inputs safely', () => {
      const sim = simulateExamNetScore({
        examQuestions: 0,
        accuracyRate: 1.5,
        answerRate: -0.2,
        penaltyRule: 'none',
        targetScoreBase10: 15,
      });

      expect(sim.examQuestions).toBe(1);
      expect(sim.answeredCount).toBe(0);
      expect(sim.targetScoreBase10).toBe(10);
      expect(sim.requiredAccuracyPct).toBeNull();
    });
  });

  describe('buildTopicRoiPriorities', () => {
    it('amplifies potential net gain of high-error topics under stricter penalties', () => {
      const topics = [
        makeTopic({
          id: 't-weak',
          label: 'Tema Flujo',
          questionCount: 100,
          seenCount: 100,
          unseenCount: 0,
          coveragePct: 100,
          accuracyPct: 50,
          fragileCount: 20,
        }),
      ];

      const roiNone = buildTopicRoiPriorities({ topics, penaltyRule: 'none' });
      const roiThird = buildTopicRoiPriorities({ topics, penaltyRule: 'third' });

      expect(roiNone).toHaveLength(1);
      expect(roiThird).toHaveLength(1);
      expect(roiThird[0].potentialBase10Gain).toBeGreaterThan(
        roiNone[0].potentialBase10Gain,
      );
    });

    it('classifies reasons, filters tiny gains, sorts descending by ROI, and enforces limit', () => {
      const topics = [
        makeTopic({
          id: 't-unexplored',
          label: 'Tema Sin Ver',
          questionCount: 80,
          seenCount: 10,
          unseenCount: 70,
          coveragePct: 12,
          accuracyPct: 60,
          fragileCount: 2,
        }),
        makeTopic({
          id: 't-fragile',
          label: 'Tema Frágil',
          questionCount: 60,
          seenCount: 50,
          unseenCount: 10,
          coveragePct: 83,
          accuracyPct: 55,
          fragileCount: 20,
        }),
        makeTopic({
          id: 't-errors',
          label: 'Tema Fallos',
          questionCount: 60,
          seenCount: 55,
          unseenCount: 5,
          coveragePct: 92,
          accuracyPct: 60,
          fragileCount: 2,
        }),
        makeTopic({
          id: 't-mastered',
          label: 'Tema Dominado',
          questionCount: 50,
          seenCount: 50,
          unseenCount: 0,
          coveragePct: 100,
          accuracyPct: 95,
          fragileCount: 0,
        }),
        makeTopic({
          id: 't-zero',
          label: 'Tema Vacío',
          questionCount: 0,
          seenCount: 0,
          unseenCount: 0,
        }),
      ];

      const roi = buildTopicRoiPriorities({
        topics,
        penaltyRule: 'quarter',
        limit: 5,
      });

      const byId = new Map(roi.map((item) => [item.id, item]));
      expect(byId.get('t-unexplored')?.reason).toBe('unexplored_weight');
      expect(byId.get('t-fragile')?.reason).toBe('fragile_cleanup');
      expect(byId.get('t-errors')?.reason).toBe('high_error_weight');
      expect(byId.has('t-mastered')).toBe(false);
      expect(byId.has('t-zero')).toBe(false);

      for (let i = 1; i < roi.length; i += 1) {
        expect(roi[i - 1].roiScore).toBeGreaterThanOrEqual(roi[i].roiScore);
      }
    });

    it('returns empty array for empty input or zero limit', () => {
      expect(buildTopicRoiPriorities({ topics: [], penaltyRule: 'quarter' })).toEqual([]);
      expect(
        buildTopicRoiPriorities({
          topics: [makeTopic({})],
          penaltyRule: 'quarter',
          limit: 0,
        }),
      ).toEqual([]);
    });
  });
});
